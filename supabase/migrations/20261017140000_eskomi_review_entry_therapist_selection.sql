-- A general shop link may select one currently active assignment at context
-- creation. The link itself stays shop-scoped; the browser can never name a
-- shop or cross-shop assignment.
create or replace function private.create_review_submission_context(
  p_entry_handle uuid, p_session_secret_hash text, p_context_fingerprint text,
  p_therapist_assignment_id uuid default null
) returns table (entry_handle uuid, shop_slug text, shop_name text, therapist_display_name text, expires_at timestamptz)
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_link private.review_entry_links%rowtype; v_assignment app.therapist_assignments%rowtype;
begin
  if p_session_secret_hash !~ '^[0-9a-f]{64}$' or p_context_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'invalid review context' using errcode='22023'; end if;
  select link.* into v_link from private.review_entry_links link join app.shops shop on shop.id=link.shop_id and shop.publication_status='published'
  left join private.managed_shops managed on managed.app_shop_id=shop.id
  where link.public_handle=p_entry_handle and link.is_active and (link.expires_at is null or link.expires_at>now()) and (managed.id is null or managed.publication_state='published') for key share of link;
  if not found then raise exception 'review context is unavailable' using errcode='P0002'; end if;
  if v_link.therapist_assignment_id is not null and p_therapist_assignment_id is not null and p_therapist_assignment_id <> v_link.therapist_assignment_id then raise exception 'dedicated therapist link cannot change target' using errcode='22023'; end if;
  select * into v_assignment from app.therapist_assignments where id=coalesce(v_link.therapist_assignment_id,p_therapist_assignment_id) and shop_id=v_link.shop_id and lifecycle_state='active' and (active_until is null or active_until>now());
  if coalesce(v_link.therapist_assignment_id,p_therapist_assignment_id) is not null and not found then raise exception 'therapist assignment is unavailable' using errcode='P0002'; end if;
  insert into private.guest_operation_sessions(session_secret_hash,context_fingerprint,context_snapshot)
  values(p_session_secret_hash,p_context_fingerprint,jsonb_build_object('entryHandle',v_link.public_handle,'shopId',v_link.shop_id,'assignmentId',v_assignment.id,'formVersion','v1.1'));
  return query select v_link.public_handle,shop.slug,shop.name,v_assignment.display_name,now()+interval '30 minutes' from app.shops shop where shop.id=v_link.shop_id;
end $$;

create or replace function private.list_review_entry_therapists(p_entry_handle uuid)
returns table(id uuid, display_name text) language sql security definer set search_path=private,app,pg_temp as $$
  select assignment.id,assignment.display_name from private.review_entry_links link join app.shops shop on shop.id=link.shop_id and shop.publication_status='published'
  join app.therapist_assignments assignment on assignment.shop_id=shop.id and assignment.lifecycle_state='active' and (assignment.active_until is null or assignment.active_until>now())
  where link.public_handle=p_entry_handle and link.therapist_assignment_id is null and link.is_active and (link.expires_at is null or link.expires_at>now()) order by assignment.display_name,assignment.id
$$;

create or replace function api.create_review_submission_context(p_entry_handle uuid,p_session_secret_hash text,p_context_fingerprint text,p_therapist_assignment_id uuid default null)
returns table(entry_handle uuid,shop_slug text,shop_name text,therapist_display_name text,expires_at timestamptz)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.create_review_submission_context(p_entry_handle,p_session_secret_hash,p_context_fingerprint,p_therapist_assignment_id) $$;
create or replace function api.list_review_entry_therapists(p_entry_handle uuid) returns table(id uuid,display_name text)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_review_entry_therapists(p_entry_handle) $$;
revoke all on function private.create_review_submission_context(uuid,text,text,uuid),private.list_review_entry_therapists(uuid),api.create_review_submission_context(uuid,text,text,uuid),api.list_review_entry_therapists(uuid) from public,anon,authenticated;
grant execute on function private.create_review_submission_context(uuid,text,text,uuid),private.list_review_entry_therapists(uuid),api.create_review_submission_context(uuid,text,text,uuid),api.list_review_entry_therapists(uuid) to service_role;

alter function private.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint) rename to submit_review_experience_v11_link_fixed;
create function private.submit_review_experience_v11(p_entry_handle uuid,p_session_secret_hash text,p_idempotency_hash text,p_request_fingerprint text,p_receipt_hash text,p_ip_shop_hash text,p_shop_rating smallint,p_common_comment text,p_guest_display_name text default null,p_therapist_rating smallint default null)
returns table(experience_id uuid,replayed boolean,receipt_expires_at timestamptz) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_assignment uuid; v_shop uuid; v_result record;
begin
  select (context_snapshot->>'assignmentId')::uuid into v_assignment from private.guest_operation_sessions where session_secret_hash=p_session_secret_hash and revoked_at is null;
  if v_assignment is null then return query select * from private.submit_review_experience_v11_link_fixed(p_entry_handle,p_session_secret_hash,p_idempotency_hash,p_request_fingerprint,p_receipt_hash,p_ip_shop_hash,p_shop_rating,p_common_comment,p_guest_display_name,p_therapist_rating); return; end if;
  select link.shop_id into v_shop from private.review_entry_links link where link.public_handle=p_entry_handle and link.is_active;
  if v_shop is null or not exists(select 1 from app.therapist_assignments where id=v_assignment and shop_id=v_shop and lifecycle_state='active' and (active_until is null or active_until>now())) then raise exception 'therapist assignment is unavailable' using errcode='P0002'; end if;
  if p_therapist_rating is not null and p_therapist_rating not between 1 and 5 then raise exception 'invalid therapist rating' using errcode='22023'; end if;
  select * into v_result from private.submit_review_experience_v11_link_fixed(p_entry_handle,p_session_secret_hash,p_idempotency_hash,p_request_fingerprint,p_receipt_hash,p_ip_shop_hash,p_shop_rating,p_common_comment,p_guest_display_name,null);
  if not v_result.replayed and p_therapist_rating is not null then insert into private.review_assessments(experience_id,target_kind,shop_id,therapist_assignment_id,rating,body) values(v_result.experience_id,'therapist',v_shop,v_assignment,p_therapist_rating,''); end if;
  return query select v_result.experience_id,v_result.replayed,v_result.receipt_expires_at;
end $$;
create or replace function api.submit_review_experience_v11(p_entry_handle uuid,p_session_secret_hash text,p_idempotency_hash text,p_request_fingerprint text,p_receipt_hash text,p_ip_shop_hash text,p_shop_rating smallint,p_common_comment text,p_guest_display_name text,p_therapist_rating smallint) returns table(experience_id uuid,replayed boolean,receipt_expires_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_review_experience_v11(p_entry_handle,p_session_secret_hash,p_idempotency_hash,p_request_fingerprint,p_receipt_hash,p_ip_shop_hash,p_shop_rating,p_common_comment,p_guest_display_name,p_therapist_rating) $$;
revoke all on function private.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint),api.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint) from public,anon,authenticated;
grant execute on function private.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint),api.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint) to service_role;
notify pgrst,'reload schema';
