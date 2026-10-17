-- v1.1 vertical slice: a public entry handle first becomes a short-lived
-- guest context, then creates one experience/revision/publication identity.
-- The route supplies only keyed hashes; raw session/receipt values never enter
-- these tables.

create or replace function private.create_review_submission_context(
  p_entry_handle uuid, p_session_secret_hash text, p_context_fingerprint text
) returns table (entry_handle uuid, shop_slug text, shop_name text, therapist_display_name text, expires_at timestamptz)
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_link private.review_entry_links%rowtype;
begin
  if p_session_secret_hash !~ '^[0-9a-f]{64}$' or p_context_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid review context' using errcode = '22023';
  end if;
  select link.* into v_link from private.review_entry_links as link
  join app.shops as shop on shop.id = link.shop_id and shop.publication_status = 'published'
  left join private.managed_shops as managed on managed.app_shop_id = shop.id
  where link.public_handle = p_entry_handle and link.is_active
    and (link.expires_at is null or link.expires_at > now())
    and (managed.id is null or managed.publication_state = 'published')
  for key share of link;
  if not found then raise exception 'review context is unavailable' using errcode = 'P0002'; end if;
  insert into private.guest_operation_sessions(session_secret_hash, context_fingerprint, context_snapshot)
  values (p_session_secret_hash, p_context_fingerprint,
    jsonb_build_object('entryHandle', v_link.public_handle, 'shopId', v_link.shop_id, 'assignmentId', v_link.therapist_assignment_id, 'formVersion', 'v1.1'));
  return query
    select v_link.public_handle, shop.slug, shop.name, assignment.display_name, now() + interval '30 minutes'
    from app.shops as shop left join app.therapist_assignments as assignment on assignment.id = v_link.therapist_assignment_id
    where shop.id = v_link.shop_id;
end;
$$;

create or replace function private.submit_review_experience_v11(
  p_entry_handle uuid, p_session_secret_hash text, p_idempotency_hash text, p_request_fingerprint text,
  p_receipt_hash text, p_ip_shop_hash text, p_shop_rating smallint, p_common_comment text,
  p_guest_display_name text default null, p_therapist_rating smallint default null
) returns table (experience_id uuid, replayed boolean, receipt_expires_at timestamptz)
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare
  v_session private.guest_operation_sessions%rowtype;
  v_link private.review_entry_links%rowtype;
  v_existing private.operation_idempotency%rowtype;
  v_experience uuid;
  v_revision uuid;
  v_allowed boolean;
begin
  if p_session_secret_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$'
    or p_request_fingerprint !~ '^[0-9a-f]{64}$' or p_receipt_hash !~ '^[0-9a-f]{64}$'
    or p_ip_shop_hash !~ '^[0-9a-f]{64}$' or char_length(btrim(coalesce(p_guest_display_name, ''))) > 30
    or char_length(btrim(coalesce(p_common_comment, ''))) > 400
    or (p_shop_rating is not null and p_shop_rating not between 1 and 5)
    or (p_therapist_rating is not null and p_therapist_rating not between 1 and 5) then
    raise exception 'invalid review submission' using errcode = '22023';
  end if;
  if p_shop_rating is null and p_therapist_rating is null and btrim(coalesce(p_common_comment, '')) = '' then
    raise exception 'at least one review answer is required' using errcode = '22023';
  end if;
  select * into v_session from private.guest_operation_sessions as session
  where session.session_secret_hash = p_session_secret_hash and session.revoked_at is null for update;
  if not found then raise exception 'review session is unavailable' using errcode = 'P0002'; end if;
  select * into v_existing from private.operation_idempotency as operation
  where operation.operation = 'review_submit' and operation.actor_scope_hash = p_session_secret_hash and operation.key_hash = p_idempotency_hash
  for update;
  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint then raise exception 'idempotency key has a different payload' using errcode = '23505'; end if;
    if v_session.replay_expires_at <= now() then raise exception 'review replay has expired' using errcode = 'P0002'; end if;
    return query select v_existing.result_entity_id, true, receipt.expires_at
      from private.review_edit_receipts as receipt where receipt.experience_id = v_existing.result_entity_id;
    return;
  end if;
  if v_session.submit_context_expires_at <= now() then raise exception 'review context has expired' using errcode = 'P0002'; end if;
  if (v_session.context_snapshot ->> 'entryHandle')::uuid <> p_entry_handle then raise exception 'review context target changed' using errcode = '23505'; end if;
  select link.* into v_link from private.review_entry_links as link
  join app.shops as shop on shop.id = link.shop_id and shop.publication_status = 'published'
  left join private.managed_shops as managed on managed.app_shop_id = shop.id
  where link.public_handle = p_entry_handle and link.is_active and (link.expires_at is null or link.expires_at > now())
    and (managed.id is null or managed.publication_state = 'published') for update of link;
  if not found then raise exception 'review target is unavailable' using errcode = 'P0002'; end if;
  select allowed into v_allowed from private.claim_review_entry_rate_limit(p_ip_shop_hash, p_idempotency_hash, 5);
  if not v_allowed then raise exception 'review burst limit reached' using errcode = 'P0001'; end if;
  insert into private.review_experiences(shop_id, entry_link_id, guest_display_name, edit_receipt_hash, ip_prefix_hash)
  values (v_link.shop_id, v_link.id, nullif(btrim(coalesce(p_guest_display_name, '')), ''), p_receipt_hash, p_ip_shop_hash)
  returning id into v_experience;
  insert into private.review_experience_revisions(experience_id, revision, nickname, experience_comment)
  values (v_experience, 1, nullif(btrim(coalesce(p_guest_display_name, '')), ''), btrim(coalesce(p_common_comment, '')))
  returning id into v_revision;
  insert into private.review_assessments(experience_id, target_kind, shop_id, rating, body)
  values (v_experience, 'shop', v_link.shop_id, p_shop_rating, btrim(coalesce(p_common_comment, '')));
  if p_therapist_rating is not null and v_link.therapist_assignment_id is not null then
    insert into private.review_assessments(experience_id, target_kind, shop_id, therapist_assignment_id, rating, body)
    values (v_experience, 'therapist', v_link.shop_id, v_link.therapist_assignment_id, p_therapist_rating, '');
  elsif p_therapist_rating is not null then
    raise exception 'therapist is not selected for this context' using errcode = '22023';
  end if;
  insert into private.review_edit_receipts(experience_id, secret_hash) values (v_experience, p_receipt_hash);
  insert into private.operation_idempotency(operation, actor_scope_hash, key_hash, request_fingerprint, result_entity_id)
  values ('review_submit', p_session_secret_hash, p_idempotency_hash, p_request_fingerprint, v_experience);
  insert into private.review_outbox(event_type, aggregate_id, payload)
  values ('review_submitted', v_experience, jsonb_build_object('revisionId', v_revision, 'formVersion', 'v1.1'));
  return query select v_experience, false, now() + interval '30 days';
end;
$$;

create or replace function private.moderate_review_experience_v11(
  p_experience_id uuid, p_decision text, p_actor_label text, p_note text default null
) returns text
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_experience private.review_experiences%rowtype; v_revision private.review_experience_revisions%rowtype;
begin
  if p_decision not in ('approved', 'rejected', 'withdrawn') or char_length(btrim(coalesce(p_actor_label, ''))) not between 1 and 120 then raise exception 'invalid moderation decision' using errcode = '22023'; end if;
  select * into v_experience from private.review_experiences as experience where experience.id = p_experience_id for update;
  if not found then raise exception 'review experience not found' using errcode = 'P0002'; end if;
  select * into v_revision from private.review_experience_revisions as revision where revision.experience_id = v_experience.id order by revision.revision desc limit 1 for update;
  if not found then raise exception 'v1.1 revision not found' using errcode = 'P0002'; end if;
  update private.review_experiences set state = p_decision, reviewed_at = now(), withdrawn_at = case when p_decision = 'withdrawn' then now() else null end, updated_at = now() where id = v_experience.id;
  update private.review_experience_revisions set moderation_state = case when p_decision = 'approved' then 'approved' when p_decision = 'withdrawn' then 'withdrawn' else 'rejected' end, reviewed_at = now() where id = v_revision.id;
  if p_decision = 'approved' then
    insert into app.review_experience_publications(experience_id, active_revision_id, shop_id, therapist_assignment_id, publication_state, published_at)
    values (v_experience.id, v_revision.id, v_experience.shop_id, (select therapist_assignment_id from private.review_assessments where experience_id = v_experience.id and target_kind = 'therapist'), 'published', now())
    on conflict (experience_id) do update set active_revision_id = excluded.active_revision_id, publication_state = 'published', published_at = now(), hidden_at = null, public_version = app.review_experience_publications.public_version + 1, updated_at = now();
  elsif p_decision = 'withdrawn' then
    update app.review_experience_publications set publication_state = 'hidden', hidden_at = now(), public_version = public_version + 1, updated_at = now() where experience_id = v_experience.id and publication_state <> 'hidden';
  end if;
  insert into private.review_moderation_decisions(experience_id, decision, actor_label, note) values (v_experience.id, p_decision, btrim(p_actor_label), nullif(btrim(coalesce(p_note, '')), ''));
  insert into private.review_outbox(event_type, aggregate_id, payload) values (case when p_decision = 'approved' then 'review_approved' when p_decision = 'withdrawn' then 'review_withdrawn' else 'review_rejected' end, v_experience.id, jsonb_build_object('v11', true));
  return p_decision;
end;
$$;

create or replace function api.list_public_review_experience_publications(p_shop_slug text, p_limit integer default 20, p_offset integer default 0)
returns table (public_handle uuid, rating smallint, body text, display_name text, therapist_display_name text, published_at timestamptz)
language sql security invoker set search_path = private, app, pg_temp as $$
  select publication.public_handle, assessment.rating, revision.experience_comment, revision.nickname, assignment.display_name, publication.published_at
  from app.review_experience_publications as publication
  join private.review_experience_revisions as revision on revision.id = publication.active_revision_id and revision.moderation_state = 'approved'
  left join private.review_assessments as assessment on assessment.experience_id = publication.experience_id and assessment.target_kind = 'shop'
  join app.shops as shop on shop.id = publication.shop_id and shop.publication_status = 'published'
  left join private.managed_shops as managed on managed.app_shop_id = shop.id
  left join app.therapist_assignments as assignment on assignment.id = publication.therapist_assignment_id
  where shop.slug = p_shop_slug and publication.publication_state = 'published' and (managed.id is null or managed.publication_state = 'published')
  order by publication.published_at desc, publication.id desc limit greatest(1, least(p_limit, 20)) offset greatest(p_offset, 0)
$$;

create or replace function api.create_review_submission_context(uuid, text, text)
returns table (entry_handle uuid, shop_slug text, shop_name text, therapist_display_name text, expires_at timestamptz)
language sql security invoker set search_path = private, api, pg_temp as $$ select * from private.create_review_submission_context($1, $2, $3) $$;
create or replace function api.submit_review_experience_v11(uuid, text, text, text, text, text, smallint, text, text, smallint)
returns table (experience_id uuid, replayed boolean, receipt_expires_at timestamptz)
language sql security invoker set search_path = private, api, pg_temp as $$ select * from private.submit_review_experience_v11($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) $$;

revoke all on function private.create_review_submission_context(uuid,text,text), private.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint), private.moderate_review_experience_v11(uuid,text,text,text), api.create_review_submission_context(uuid,text,text), api.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint), api.list_public_review_experience_publications(text,integer,integer) from public, anon, authenticated;
grant execute on function private.create_review_submission_context(uuid,text,text), private.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint), private.moderate_review_experience_v11(uuid,text,text,text), api.create_review_submission_context(uuid,text,text), api.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint), api.list_public_review_experience_publications(text,integer,integer) to service_role;
notify pgrst, 'reload schema';
