-- Correct the service RPC surface after the operational migration. PostgREST
-- resolves named JSON keys, so every api wrapper explicitly preserves its
-- p_* parameter names. This is additive for already-migrated databases.

create or replace function private.submit_partner_review_reply_v11(
  p_workspace_id uuid,p_auth_user_id uuid,p_publication_id uuid,p_expected_revision integer,p_body text
) returns table(reply_id uuid,revision integer,state text)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid; v_revision integer; v_body text; v_id uuid;
begin
  v_shop:=private.assert_partner_v11_membership(p_workspace_id,p_auth_user_id);
  v_body:=btrim(coalesce(p_body,''));
  if p_expected_revision is null or p_expected_revision<0 or char_length(v_body) not between 1 and 500 then raise exception 'invalid reply request' using errcode='22023'; end if;
  perform 1 from app.review_experience_publications publication where publication.id=p_publication_id and publication.shop_id=v_shop and publication.publication_state='published' for key share;
  if not found then raise exception 'review is unavailable for this workspace' using errcode='42501'; end if;
  select coalesce(max(locked.revision),0) into v_revision from (
    select reply.revision from private.review_experience_reply_revisions reply
    where reply.publication_id=p_publication_id and reply.workspace_id=p_workspace_id for update
  ) locked;
  if v_revision<>p_expected_revision then raise exception 'reply changed' using errcode='40001'; end if;
  insert into private.review_experience_reply_revisions(publication_id,workspace_id,revision,body,state)
  values(p_publication_id,p_workspace_id,v_revision+1,v_body,'pending') returning id into v_id;
  insert into private.review_outbox(event_type,aggregate_id,payload)
  values('reply_submitted',v_id,jsonb_build_object('publicationId',p_publication_id,'revision',v_revision+1));
  return query select v_id,v_revision+1,'pending'::text;
end $$;

create or replace function private.save_partner_benefit_program_v11(
  p_workspace_id uuid,p_auth_user_id uuid,p_expected_revision integer,p_title text,p_benefit_kind text,
  p_amount_yen integer,p_rate numeric,p_terms_text text,p_issuer_label text,p_funding_party_label text,
  p_valid_from timestamptz,p_valid_until timestamptz,p_redeem_valid_days integer,p_combinable boolean
) returns table(program_id uuid,revision integer,version integer,state text)
language plpgsql security definer set search_path=private,pg_temp as $$
declare v_shop uuid; v_program private.benefit_programs%rowtype; v_version integer;
begin
  v_shop:=private.assert_partner_v11_membership(p_workspace_id,p_auth_user_id);
  if p_expected_revision is null or p_expected_revision<0 or char_length(btrim(coalesce(p_title,''))) not between 1 and 60
    or p_benefit_kind not in ('amount_off','percent_off','other') or char_length(btrim(coalesce(p_terms_text,''))) not between 1 and 4000
    or char_length(btrim(coalesce(p_issuer_label,''))) not between 1 and 120 or char_length(btrim(coalesce(p_funding_party_label,''))) not between 1 and 120
    or p_valid_from is null or (p_valid_until is not null and p_valid_until<=p_valid_from)
    or (p_redeem_valid_days is not null and p_redeem_valid_days not between 1 and 3650)
    or (p_benefit_kind='amount_off' and (p_amount_yen is null or p_amount_yen<0 or p_rate is not null))
    or (p_benefit_kind='percent_off' and (p_rate is null or p_rate<=0 or p_rate>1 or p_amount_yen is not null))
    or (p_benefit_kind='other' and (p_amount_yen is not null or p_rate is not null)) then raise exception 'invalid benefit program' using errcode='22023'; end if;
  select * into v_program from private.benefit_programs program where program.workspace_id=p_workspace_id and program.shop_id=v_shop for update;
  if not found then
    if p_expected_revision<>0 then raise exception 'benefit program changed' using errcode='40001'; end if;
    insert into private.benefit_programs(workspace_id,shop_id,state,eligibility_rule,benefit_text,current_version,revision)
    values(p_workspace_id,v_shop,'pending_approval','accepted_submission',btrim(p_terms_text),1,1) returning * into v_program;
  else
    if p_expected_revision<>v_program.revision then raise exception 'benefit program changed' using errcode='40001'; end if;
    update private.benefit_programs as program set state='pending_approval',benefit_text=btrim(p_terms_text),current_version=program.current_version+1,revision=program.revision+1,operator_approved_at=null,operator_approved_by=null,updated_at=now()
    where program.id=v_program.id returning * into v_program;
  end if;
  v_version:=v_program.current_version;
  insert into private.benefit_program_versions(program_id,version,title,benefit_kind,amount_yen,rate,terms_text,issuer_label,funding_party_label,valid_from,valid_until,redeem_valid_days,combinable,eligibility_version)
  values(v_program.id,v_version,btrim(p_title),p_benefit_kind,p_amount_yen,p_rate,btrim(p_terms_text),btrim(p_issuer_label),btrim(p_funding_party_label),p_valid_from,p_valid_until,p_redeem_valid_days,coalesce(p_combinable,false),'v1.1');
  return query select v_program.id,v_program.revision,v_version,v_program.state;
end $$;

-- Therapist mutations use the identical live authority check: a manager
-- downgrade, revocation, or workspace stop cannot race a stale tab mutation.
create or replace function private.assert_partner_therapist_membership(p_workspace_id uuid,p_auth_user_id uuid)
returns void language plpgsql security definer set search_path=private,pg_temp as $$
begin
  perform 1 from private.partner_memberships membership join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id and membership.status='active'
    and membership.role='owner' and workspace.state in ('free_official_partner','active_partner') and workspace.app_shop_id is not null
  for update of membership,workspace;
  if not found then raise exception 'partner membership is unavailable' using errcode='42501'; end if;
end $$;

-- Older populated ledgers retain the pre-therapist context signature. Rename
-- it, then publish the current named signature and the retired-person flag.
do $$ begin
  if to_regprocedure('private.create_review_submission_context(uuid,text,text)') is not null and to_regprocedure('private.create_review_submission_context(uuid,text,text,uuid)') is null then
    alter function private.create_review_submission_context(uuid,text,text) rename to create_review_submission_context_pre140;
  end if;
  if to_regprocedure('api.create_review_submission_context(uuid,text,text)') is not null and to_regprocedure('api.create_review_submission_context(uuid,text,text,uuid)') is null then
    alter function api.create_review_submission_context(uuid,text,text) rename to create_review_submission_context_pre140;
  end if;
end $$;
drop function if exists private.create_review_submission_context(uuid,text,text);
drop function if exists api.create_review_submission_context(uuid,text,text);
-- A partially upgraded ledger can already have the four-argument function
-- with the pre-retirement row shape.  PostgreSQL cannot replace OUT columns,
-- so remove only this compatibility surface and recreate it below.
drop function if exists api.create_review_submission_context(uuid,text,text,uuid);
drop function if exists private.create_review_submission_context(uuid,text,text,uuid);
create or replace function private.create_review_submission_context(
  p_entry_handle uuid,p_session_secret_hash text,p_context_fingerprint text,p_therapist_assignment_id uuid default null
) returns table(entry_handle uuid,shop_slug text,shop_name text,therapist_display_name text,therapist_unavailable boolean,expires_at timestamptz)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_link private.review_entry_links%rowtype; v_assignment app.therapist_assignments%rowtype; v_requested uuid; v_unavailable boolean:=false;
begin
  if p_session_secret_hash !~ '^[0-9a-f]{64}$' or p_context_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'invalid review context' using errcode='22023'; end if;
  select link.* into v_link from private.review_entry_links link join app.shops shop on shop.id=link.shop_id and shop.publication_status='published'
    left join private.managed_shops managed on managed.app_shop_id=shop.id where link.public_handle=p_entry_handle and link.is_active and (link.expires_at is null or link.expires_at>now()) and (managed.id is null or managed.publication_state='published') for key share of link;
  if not found then raise exception 'review context is unavailable' using errcode='P0002'; end if;
  if v_link.therapist_assignment_id is not null and p_therapist_assignment_id is not null and p_therapist_assignment_id<>v_link.therapist_assignment_id then raise exception 'dedicated therapist link cannot change target' using errcode='22023'; end if;
  v_requested:=coalesce(v_link.therapist_assignment_id,p_therapist_assignment_id);
  if v_requested is not null then
    select * into v_assignment from app.therapist_assignments assignment where assignment.id=v_requested and assignment.shop_id=v_link.shop_id and assignment.lifecycle_state='active' and (assignment.active_until is null or assignment.active_until>now());
    if not found then if v_link.therapist_assignment_id is not null and p_therapist_assignment_id is null then v_assignment:=null;v_unavailable:=true; else raise exception 'therapist assignment is unavailable' using errcode='P0002'; end if; end if;
  end if;
  insert into private.guest_operation_sessions(session_secret_hash,context_fingerprint,context_snapshot) values(p_session_secret_hash,p_context_fingerprint,jsonb_build_object('entryHandle',v_link.public_handle,'shopId',v_link.shop_id,'assignmentId',v_assignment.id,'formVersion','v1.1'));
  return query select v_link.public_handle,shop.slug,shop.name,v_assignment.display_name,v_unavailable,now()+interval '30 minutes' from app.shops shop where shop.id=v_link.shop_id;
end $$;

-- Drop/recreate only api wrappers: it is the sole way to change parameter
-- names in PostgreSQL and migrations run atomically before PostgREST reload.
drop function if exists api.get_review_benefit_receipt_v11(uuid,text);
drop function if exists api.submit_partner_review_reply_v11(uuid,uuid,uuid,integer,text);
drop function if exists api.save_partner_benefit_program_v11(uuid,uuid,integer,text,text,integer,numeric,text,text,text,timestamptz,timestamptz,integer,boolean);
drop function if exists api.list_partner_benefit_operations_v11(uuid,uuid);
drop function if exists api.list_partner_replyable_reviews_v11(uuid,uuid);
drop function if exists api.list_review_moderation_v11();
drop function if exists api.list_operator_benefit_programs_v11();
drop function if exists api.list_operator_review_replies_v11();
drop function if exists api.moderate_review_experience_v11(uuid,text,text,text,integer);
drop function if exists api.moderate_partner_review_reply_v11(uuid,text,text);
drop function if exists api.approve_benefit_program_v11(uuid,integer,text);
drop function if exists api.create_review_submission_context(uuid,text,text,uuid);
create function api.get_review_benefit_receipt_v11(p_experience_id uuid,p_session_secret_hash text) returns table(benefit_status text,expires_at timestamptz,benefit_snapshot jsonb) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_review_benefit_receipt_v11(p_experience_id,p_session_secret_hash) $$;
create function api.submit_partner_review_reply_v11(p_workspace_id uuid,p_auth_user_id uuid,p_publication_id uuid,p_expected_revision integer,p_body text) returns table(reply_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_partner_review_reply_v11(p_workspace_id,p_auth_user_id,p_publication_id,p_expected_revision,p_body) $$;
create function api.save_partner_benefit_program_v11(p_workspace_id uuid,p_auth_user_id uuid,p_expected_revision integer,p_title text,p_benefit_kind text,p_amount_yen integer,p_rate numeric,p_terms_text text,p_issuer_label text,p_funding_party_label text,p_valid_from timestamptz,p_valid_until timestamptz,p_redeem_valid_days integer,p_combinable boolean) returns table(program_id uuid,revision integer,version integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.save_partner_benefit_program_v11(p_workspace_id,p_auth_user_id,p_expected_revision,p_title,p_benefit_kind,p_amount_yen,p_rate,p_terms_text,p_issuer_label,p_funding_party_label,p_valid_from,p_valid_until,p_redeem_valid_days,p_combinable) $$;
create function api.list_partner_benefit_operations_v11(p_workspace_id uuid,p_auth_user_id uuid) returns table(program_id uuid,revision integer,state text,version integer,title text,benefit_kind text,amount_yen integer,rate numeric,terms_text text,valid_from timestamptz,valid_until timestamptz,redeem_valid_days integer,combinable boolean,issued_count bigint,redeemed_count bigint) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_partner_benefit_operations_v11(p_workspace_id,p_auth_user_id) $$;
create function api.list_partner_replyable_reviews_v11(p_workspace_id uuid,p_auth_user_id uuid) returns table(publication_id uuid,body text,published_at timestamptz,reply_revision integer,reply_state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_partner_replyable_reviews_v11(p_workspace_id,p_auth_user_id) $$;
create function api.list_review_moderation_v11() returns table(experience_id uuid,moderation_revision integer,state text,shop_name text,comment text,shop_rating smallint,submitted_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_review_moderation_v11() $$;
create function api.list_operator_benefit_programs_v11() returns table(program_id uuid,revision integer,state text,title text,terms_text text,valid_from timestamptz,valid_until timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_benefit_programs_v11() $$;
create function api.list_operator_review_replies_v11() returns table(reply_id uuid,shop_name text,body text,submitted_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_review_replies_v11() $$;
create function api.moderate_review_experience_v11(p_experience_id uuid,p_decision text,p_actor_label text,p_note text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.moderate_review_experience_v11(p_experience_id,p_decision,p_actor_label,p_note,p_expected_revision) $$;
create function api.moderate_partner_review_reply_v11(p_reply_id uuid,p_decision text,p_actor_label text) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.moderate_partner_review_reply_v11(p_reply_id,p_decision,p_actor_label) $$;
create function api.approve_benefit_program_v11(p_program_id uuid,p_expected_revision integer,p_actor_label text) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.approve_benefit_program_v11(p_program_id,p_expected_revision,p_actor_label) $$;
create function api.create_review_submission_context(p_entry_handle uuid,p_session_secret_hash text,p_context_fingerprint text,p_therapist_assignment_id uuid default null) returns table(entry_handle uuid,shop_slug text,shop_name text,therapist_display_name text,therapist_unavailable boolean,expires_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.create_review_submission_context(p_entry_handle,p_session_secret_hash,p_context_fingerprint,p_therapist_assignment_id) $$;
revoke all on function api.get_review_benefit_receipt_v11(uuid,text),api.submit_partner_review_reply_v11(uuid,uuid,uuid,integer,text),api.save_partner_benefit_program_v11(uuid,uuid,integer,text,text,integer,numeric,text,text,text,timestamptz,timestamptz,integer,boolean),api.list_partner_benefit_operations_v11(uuid,uuid),api.list_partner_replyable_reviews_v11(uuid,uuid),api.list_review_moderation_v11(),api.list_operator_benefit_programs_v11(),api.list_operator_review_replies_v11(),api.moderate_review_experience_v11(uuid,text,text,text,integer),api.moderate_partner_review_reply_v11(uuid,text,text),api.approve_benefit_program_v11(uuid,integer,text),api.create_review_submission_context(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function api.get_review_benefit_receipt_v11(uuid,text),api.submit_partner_review_reply_v11(uuid,uuid,uuid,integer,text),api.save_partner_benefit_program_v11(uuid,uuid,integer,text,text,integer,numeric,text,text,text,timestamptz,timestamptz,integer,boolean),api.list_partner_benefit_operations_v11(uuid,uuid),api.list_partner_replyable_reviews_v11(uuid,uuid),api.list_review_moderation_v11(),api.list_operator_benefit_programs_v11(),api.list_operator_review_replies_v11(),api.moderate_review_experience_v11(uuid,text,text,text,integer),api.moderate_partner_review_reply_v11(uuid,text,text),api.approve_benefit_program_v11(uuid,integer,text),api.create_review_submission_context(uuid,text,text,uuid) to service_role;

-- Operator approval must show every immutable commercial condition, not a
-- title and free text alone. Recreate the service-only reader with its named
-- parameters preserved.
drop function if exists api.list_operator_benefit_programs_v11();
drop function if exists private.list_operator_benefit_programs_v11();
create function private.list_operator_benefit_programs_v11()
returns table(program_id uuid,revision integer,state text,shop_name text,title text,benefit_kind text,amount_yen integer,rate numeric,terms_text text,issuer_label text,funding_party_label text,valid_from timestamptz,valid_until timestamptz,redeem_valid_days integer,redeem_deadline timestamptz,combinable boolean)
language sql security definer set search_path=private,app,pg_temp as $$
 select program.id,program.revision,program.state,shop.name,version.title,version.benefit_kind,version.amount_yen,version.rate,version.terms_text,version.issuer_label,version.funding_party_label,version.valid_from,version.valid_until,version.redeem_valid_days,version.redeem_deadline,version.combinable
 from private.benefit_programs program join private.benefit_program_versions version on version.program_id=program.id and version.version=program.current_version join app.shops shop on shop.id=program.shop_id
 where program.state='pending_approval' order by version.created_at asc
$$;
create function api.list_operator_benefit_programs_v11()
returns table(program_id uuid,revision integer,state text,shop_name text,title text,benefit_kind text,amount_yen integer,rate numeric,terms_text text,issuer_label text,funding_party_label text,valid_from timestamptz,valid_until timestamptz,redeem_valid_days integer,redeem_deadline timestamptz,combinable boolean)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_benefit_programs_v11() $$;
revoke all on function private.list_operator_benefit_programs_v11(),api.list_operator_benefit_programs_v11() from public,anon,authenticated;
grant execute on function private.list_operator_benefit_programs_v11(),api.list_operator_benefit_programs_v11() to service_role;

drop function if exists api.get_review_editable_v11(text);
drop function if exists api.edit_review_experience_v11(text,integer,text,text,smallint,smallint);
drop function if exists api.withdraw_review_experience_v11(text,integer);
drop function if exists api.create_review_appeal_v11(text,integer,text);
drop function if exists api.get_partner_review_widget_v11(uuid,uuid);
drop function if exists api.get_public_review_widget_v11(uuid,integer,integer);
create function api.get_review_editable_v11(p_session_secret_hash text) returns table(experience_id uuid,revision integer,nickname text,comment text,shop_rating smallint,therapist_rating smallint,expires_at timestamptz,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_review_editable_v11(p_session_secret_hash) $$;
create function api.edit_review_experience_v11(p_session_secret_hash text,p_expected_revision integer,p_nickname text,p_comment text,p_shop_rating smallint,p_therapist_rating smallint) returns table(experience_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.edit_review_experience_v11(p_session_secret_hash,p_expected_revision,p_nickname,p_comment,p_shop_rating,p_therapist_rating) $$;
create function api.withdraw_review_experience_v11(p_session_secret_hash text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.withdraw_review_experience_v11(p_session_secret_hash,p_expected_revision) $$;
create function api.create_review_appeal_v11(p_session_secret_hash text,p_expected_revision integer,p_reason text) returns table(appeal_id uuid,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.create_review_appeal_v11(p_session_secret_hash,p_expected_revision,p_reason) $$;
create function api.get_partner_review_widget_v11(p_workspace_id uuid,p_auth_user_id uuid) returns table(public_handle uuid,state text,revision integer,shop_name text,canonical_path text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_partner_review_widget_v11(p_workspace_id,p_auth_user_id) $$;
create function api.get_public_review_widget_v11(p_handle uuid,p_limit integer default 3,p_offset integer default 0) returns table(shop_name text,canonical_path text,review_count bigint,average_rating numeric,public_version bigint,data_as_of timestamptz,review_body text,review_rating smallint,published_at timestamptz,reply_body text,reply_published_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_public_review_widget_v11(p_handle,p_limit,p_offset) $$;
revoke all on function api.get_review_editable_v11(text),api.edit_review_experience_v11(text,integer,text,text,smallint,smallint),api.withdraw_review_experience_v11(text,integer),api.create_review_appeal_v11(text,integer,text),api.get_partner_review_widget_v11(uuid,uuid),api.get_public_review_widget_v11(uuid,integer,integer) from public,anon,authenticated;
grant execute on function api.get_review_editable_v11(text),api.edit_review_experience_v11(text,integer,text,text,smallint,smallint),api.withdraw_review_experience_v11(text,integer),api.create_review_appeal_v11(text,integer,text),api.get_partner_review_widget_v11(uuid,uuid),api.get_public_review_widget_v11(uuid,integer,integer) to service_role;

-- Sessions carry a comma-separated capability set.  The original v1.1
-- assertion compared it as a scalar, which rejected the normal edit receipt.
create or replace function private.assert_review_edit_session_v11(p_session_secret_hash text)
returns uuid language plpgsql security definer
set search_path=private,pg_temp as $$
declare v_experience uuid;
begin
  if p_session_secret_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid edit session' using errcode='22023'; end if;
  select (session.context_snapshot->>'experienceId')::uuid into v_experience
  from private.guest_operation_sessions session
   where session.session_secret_hash=p_session_secret_hash
     and session.revoked_at is null
     and session.submit_context_expires_at>now()
     and position('edit_own' in coalesce(session.context_snapshot->>'scope',''))>0
   for update;
  if v_experience is null then raise exception 'review edit session is unavailable' using errcode='42501'; end if;
  return v_experience;
end $$;
revoke all on function private.assert_review_edit_session_v11(text) from public,anon,authenticated;
grant execute on function private.assert_review_edit_session_v11(text) to service_role;
notify pgrst,'reload schema';
