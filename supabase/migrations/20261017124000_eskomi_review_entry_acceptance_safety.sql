-- Align v2 entry with the accepted design: one optional common comment,
-- optional nickname and ratings, a benefit on accepted receipt, and strict
-- published-shop boundaries.  This migration is additive for databases that
-- have already applied the earlier canonical foundation migrations.

alter table private.review_experiences alter column guest_display_name drop not null;
alter table private.review_experiences drop constraint if exists review_experiences_guest_display_name_check;
alter table private.review_experiences add constraint review_experiences_guest_display_name_check
  check (guest_display_name is null or char_length(btrim(guest_display_name)) between 1 and 30);

alter table private.review_assessments alter column rating drop not null;
alter table private.review_assessments drop constraint if exists review_assessments_rating_check;
alter table private.review_assessments add constraint review_assessments_rating_check
  check (rating is null or rating between 1 and 5);
alter table private.review_assessments drop constraint if exists review_assessments_body_check;
alter table private.review_assessments add constraint review_assessments_body_check
  check (char_length(btrim(body)) between 0 and 400);

alter table private.review_revisions alter column rating drop not null;
alter table private.review_revisions drop constraint if exists review_revisions_rating_check;
alter table private.review_revisions add constraint review_revisions_rating_check
  check (rating is null or rating between 1 and 5);
alter table private.review_revisions drop constraint if exists review_revisions_body_check;
alter table private.review_revisions add constraint review_revisions_body_check
  check (char_length(btrim(body)) between 0 and 400);

alter table app.review_publications alter column rating drop not null;
alter table app.review_publications alter column display_name drop not null;
alter table app.review_publications drop constraint if exists review_publications_rating_check;
alter table app.review_publications add constraint review_publications_rating_check
  check (rating is null or rating between 1 and 5);
alter table app.review_publications drop constraint if exists review_publications_body_check;
alter table app.review_publications add constraint review_publications_body_check
  check (char_length(btrim(body)) between 0 and 400);
alter table app.review_publications drop constraint if exists review_publications_display_name_check;
alter table app.review_publications add constraint review_publications_display_name_check
  check (display_name is null or char_length(btrim(display_name)) between 1 and 30);

update private.benefit_programs
set eligibility_rule = 'accepted_submission'
where eligibility_rule = 'moderation_approved';
alter table private.benefit_programs drop constraint if exists benefit_programs_eligibility_rule_check;
alter table private.benefit_programs add constraint benefit_programs_eligibility_rule_check
  check (eligibility_rule = 'accepted_submission');
alter table private.benefit_programs alter column eligibility_rule set default 'accepted_submission';

-- Only archived rows and intentional non-public states with existing public
-- history suppress a legacy WordPress record.  A newly imported edit draft
-- starts unlisted and has neither history nor archive event, so it cannot
-- accidentally hide the still-canonical WordPress page.
create or replace function api.list_unlisted_managed_shop_legacy_identities()
returns table(existing_wp_shop_id bigint, shop_slug text)
language sql security invoker set search_path = private, pg_temp as $$
  select s.existing_wp_shop_id, s.shop_slug
  from private.managed_shops as s
  where s.existing_wp_shop_id is not null
    and (
      s.publication_state = 'deleted'
      or (s.publication_state = 'unlisted' and (
        exists (select 1 from private.managed_shop_publications p where p.managed_shop_id = s.id)
        or exists (select 1 from private.managed_shop_archive_events e where e.managed_shop_id = s.id)
      ))
    )
$$;

create or replace function api.list_managed_shop_legacy_listing_states()
returns table(existing_wp_shop_id bigint, shop_slug text, publication_state text)
language sql security invoker set search_path = private, pg_temp as $$
  select s.existing_wp_shop_id, s.shop_slug, s.publication_state
  from private.managed_shops as s
  where s.existing_wp_shop_id is not null
    and (
      s.publication_state = 'deleted'
      or (s.publication_state = 'unlisted' and (
        exists (select 1 from private.managed_shop_publications p where p.managed_shop_id = s.id)
        or exists (select 1 from private.managed_shop_archive_events e where e.managed_shop_id = s.id)
      ))
    )
  order by s.existing_wp_shop_id
$$;

create or replace function private.resolve_review_entry_link(p_entry_handle uuid)
returns table (entry_handle uuid, shop_slug text, shop_name text, therapist_display_name text)
language sql security definer set search_path = private, app, pg_temp as $$
  select link.public_handle, shop.slug, shop.name, assignment.display_name
  from private.review_entry_links as link
  join app.shops as shop on shop.id = link.shop_id and shop.publication_status = 'published'
  left join app.therapist_assignments as assignment
    on assignment.id = link.therapist_assignment_id and assignment.shop_id = link.shop_id
  where link.public_handle = p_entry_handle and link.is_active
    and (link.expires_at is null or link.expires_at > now())
    and (link.therapist_assignment_id is null or (
      assignment.lifecycle_state = 'active' and (assignment.active_until is null or assignment.active_until > now())
    ))
$$;

create or replace function api.list_public_review_publications(
  p_shop_slug text, p_limit integer default 20, p_offset integer default 0
) returns table (public_handle uuid, rating smallint, body text, display_name text, therapist_display_name text, published_at timestamptz)
language plpgsql security invoker set search_path = private, app, pg_temp as $$
begin
  if p_shop_slug !~ '^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$' or p_limit not between 1 and 50 or p_offset < 0 then
    raise exception 'invalid public review request' using errcode = '22023';
  end if;
  return query
    select publication.public_handle, publication.rating, publication.body, publication.display_name,
      assignment.display_name, publication.published_at
    from app.review_publications as publication
    join app.shops as shop on shop.id = publication.shop_id and shop.publication_status = 'published'
    left join app.therapist_assignments as assignment on assignment.id = publication.therapist_assignment_id
    where shop.slug = p_shop_slug and publication.archived_at is null
    order by publication.published_at desc, publication.id desc
    limit p_limit offset p_offset;
end;
$$;

create or replace function private.submit_review_experience_v2(
  p_entry_handle uuid, p_idempotency_hash text, p_request_fingerprint text,
  p_guest_display_name text, p_edit_receipt_hash text, p_device_fingerprint_hash text,
  p_ip_prefix_hash text, p_shop_rating smallint default null, p_common_comment text default '',
  p_therapist_rating smallint default null
) returns table (experience_id uuid, replayed boolean, benefit_code text, benefit_status text)
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare
  v_link private.review_entry_links%rowtype;
  v_existing private.review_submission_idempotency%rowtype;
  v_assignment app.therapist_assignments%rowtype;
  v_experience_id uuid;
  v_idempotency_id bigint;
  v_program private.benefit_programs%rowtype;
  v_code text;
  v_code_hash text;
begin
  if p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_request_fingerprint !~ '^[0-9a-f]{64}$'
    or p_edit_receipt_hash !~ '^[0-9a-f]{64}$'
    or (p_device_fingerprint_hash is not null and p_device_fingerprint_hash !~ '^[0-9a-f]{64}$')
    or (p_ip_prefix_hash is not null and p_ip_prefix_hash !~ '^[0-9a-f]{64}$')
    or char_length(btrim(coalesce(p_guest_display_name, ''))) > 30
    or char_length(btrim(coalesce(p_common_comment, ''))) > 400
    or (p_shop_rating is not null and p_shop_rating not between 1 and 5)
    or (p_therapist_rating is not null and p_therapist_rating not between 1 and 5) then
    raise exception 'invalid review submission' using errcode = '22023';
  end if;
  if p_shop_rating is null and p_therapist_rating is null and btrim(coalesce(p_common_comment, '')) = '' then
    raise exception 'at least one review answer is required' using errcode = '22023';
  end if;
  insert into private.review_submission_idempotency(idempotency_hash, request_fingerprint)
  values (p_idempotency_hash, p_request_fingerprint) on conflict (idempotency_hash) do nothing returning id into v_idempotency_id;
  if v_idempotency_id is null then
    select * into v_existing from private.review_submission_idempotency where idempotency_hash = p_idempotency_hash for update;
    if v_existing.request_fingerprint <> p_request_fingerprint then raise exception 'idempotency key has a different payload' using errcode = '23505'; end if;
    if v_existing.state = 'completed' and v_existing.experience_id is not null then
      return query select v_existing.experience_id, true, null::text,
        case when exists (select 1 from private.benefit_codes where experience_id = v_existing.experience_id) then 'already_issued' else 'unavailable' end;
      return;
    end if;
    raise exception 'review submission is incomplete' using errcode = '40001';
  end if;
  select link.* into v_link
  from private.review_entry_links as link
  join app.shops as shop on shop.id = link.shop_id and shop.publication_status = 'published'
  where link.public_handle = p_entry_handle and link.is_active and (link.expires_at is null or link.expires_at > now())
  for update of link;
  if not found then
    update private.review_submission_idempotency set state = 'failed', updated_at = now() where id = v_idempotency_id;
    raise exception 'review entry link is unavailable' using errcode = 'P0002';
  end if;
  if v_link.therapist_assignment_id is null and p_therapist_rating is not null then
    raise exception 'shop entry link cannot submit a therapist assessment' using errcode = '22023';
  end if;
  if v_link.therapist_assignment_id is not null then
    select * into v_assignment from app.therapist_assignments
    where id = v_link.therapist_assignment_id and shop_id = v_link.shop_id and lifecycle_state = 'active'
      and (active_until is null or active_until > now()) for key share;
    if not found then raise exception 'therapist assignment is unavailable' using errcode = 'P0002'; end if;
  end if;
  insert into private.review_experiences(shop_id, entry_link_id, guest_display_name, edit_receipt_hash, device_fingerprint_hash, ip_prefix_hash)
  values (v_link.shop_id, v_link.id, nullif(btrim(coalesce(p_guest_display_name, '')), ''), p_edit_receipt_hash, p_device_fingerprint_hash, p_ip_prefix_hash)
  returning id into v_experience_id;
  insert into private.review_assessments(experience_id, target_kind, shop_id, rating, body)
  values (v_experience_id, 'shop', v_link.shop_id, p_shop_rating, btrim(coalesce(p_common_comment, '')));
  insert into private.review_revisions(assessment_id, revision, rating, body, change_source)
  select id, 1, rating, body, 'submission' from private.review_assessments where experience_id = v_experience_id and target_kind = 'shop';
  if p_therapist_rating is not null then
    insert into private.review_assessments(experience_id, target_kind, shop_id, therapist_assignment_id, rating, body)
    values (v_experience_id, 'therapist', v_link.shop_id, v_link.therapist_assignment_id, p_therapist_rating, '');
    insert into private.review_revisions(assessment_id, revision, rating, body, change_source)
    select id, 1, rating, body, 'submission' from private.review_assessments where experience_id = v_experience_id and target_kind = 'therapist';
  end if;
  update private.review_submission_idempotency set experience_id = v_experience_id, state = 'completed', updated_at = now() where id = v_idempotency_id;
  insert into private.review_outbox(event_type, aggregate_id) values ('review_submitted', v_experience_id);
  select * into v_program from private.benefit_programs
  where shop_id = v_link.shop_id and state = 'approved' and eligibility_rule = 'accepted_submission' for key share;
  if not found then return query select v_experience_id, false, null::text, 'unavailable'::text; return; end if;
  v_code := 'ESK-' || upper(substr(encode(gen_random_bytes(10), 'hex'), 1, 16));
  v_code_hash := encode(digest(v_code, 'sha256'), 'hex');
  insert into private.benefit_codes(program_id, experience_id, code_hash)
  values (v_program.id, v_experience_id, v_code_hash);
  insert into private.review_outbox(event_type, aggregate_id, payload)
  values ('benefit_issued', v_experience_id, jsonb_build_object('programId', v_program.id));
  return query select v_experience_id, false, v_code, 'issued'::text;
end;
$$;

create or replace function api.submit_review_experience_v2(
  p_entry_handle uuid, p_idempotency_hash text, p_request_fingerprint text,
  p_guest_display_name text, p_edit_receipt_hash text, p_device_fingerprint_hash text,
  p_ip_prefix_hash text, p_shop_rating smallint default null, p_common_comment text default '',
  p_therapist_rating smallint default null
) returns table (experience_id uuid, replayed boolean, benefit_code text, benefit_status text)
language sql security invoker set search_path = private, api, pg_temp as $$
  select * from private.submit_review_experience_v2(p_entry_handle, p_idempotency_hash, p_request_fingerprint,
    p_guest_display_name, p_edit_receipt_hash, p_device_fingerprint_hash, p_ip_prefix_hash,
    p_shop_rating, p_common_comment, p_therapist_rating)
$$;

revoke all on function private.submit_review_experience_v2(uuid, text, text, text, text, text, text, smallint, text, smallint) from public, anon, authenticated;
revoke all on function api.submit_review_experience_v2(uuid, text, text, text, text, text, text, smallint, text, smallint) from public, anon, authenticated;
revoke all on function private.resolve_review_entry_link(uuid) from public, anon, authenticated;
revoke all on function api.resolve_review_entry_link(uuid) from public, anon, authenticated;
revoke all on function api.list_public_review_publications(text, integer, integer) from public, anon, authenticated;
grant execute on function private.submit_review_experience_v2(uuid, text, text, text, text, text, text, smallint, text, smallint) to service_role;
grant execute on function api.submit_review_experience_v2(uuid, text, text, text, text, text, text, smallint, text, smallint) to service_role;
grant execute on function private.resolve_review_entry_link(uuid) to service_role;
grant execute on function api.resolve_review_entry_link(uuid) to service_role;
grant execute on function api.list_public_review_publications(text, integer, integer) to service_role;

notify pgrst, 'reload schema';
