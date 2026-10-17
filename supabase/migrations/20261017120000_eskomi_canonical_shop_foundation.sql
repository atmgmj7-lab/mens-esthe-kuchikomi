-- Eskomi canonical-shop foundation.
--
-- This is additive and intentionally leaves all WordPress-compatible routes
-- untouched.  It creates the UUID path used by new shops and keeps all guest
-- review evidence, edit receipts, incentive codes, and moderation material in
-- private.  Nothing here grants a browser role direct table access.

-- A managed directory row can now be explicitly linked to the canonical app
-- shop.  Existing rows remain unlinked until a reviewed mapping is supplied.
alter table private.managed_shops
  add column if not exists app_shop_id uuid references app.shops(id) on delete restrict;

create unique index if not exists managed_shops_app_shop_id_key
  on private.managed_shops(app_shop_id) where app_shop_id is not null;

-- Keep legacy workspaces valid while allowing a new, WordPress-independent
-- workspace.  Exactly one identity is required; automatic legacy mapping is
-- deliberately forbidden.
alter table private.partner_workspaces
  add column if not exists app_shop_id uuid references app.shops(id) on delete restrict;

alter table private.partner_workspaces
  alter column wp_shop_id drop not null;

alter table private.partner_workspaces
  drop constraint if exists partner_workspaces_wp_shop_id_check;

alter table private.partner_workspaces
  add constraint partner_workspaces_identity_check
  check (num_nonnulls(wp_shop_id, app_shop_id) = 1);

create unique index if not exists partner_workspaces_app_shop_id_key
  on private.partner_workspaces(app_shop_id) where app_shop_id is not null;

-- Stable, non-PII therapist identity.  The assignment is historical, so a
-- name/photo change never rewrites past review context.
create table app.therapists (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null unique check (stable_key ~ '^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$'),
  lifecycle_state text not null default 'active'
    check (lifecycle_state in ('active', 'inactive', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app.therapist_assignments (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references app.therapists(id) on delete restrict,
  shop_id uuid not null references app.shops(id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  photo_asset_key text,
  photo_rights_confirmed_at timestamptz,
  lifecycle_state text not null default 'active'
    check (lifecycle_state in ('active', 'inactive', 'retired')),
  active_from timestamptz not null default now(),
  active_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (active_until is null or active_until >= active_from),
  check (photo_asset_key is null or photo_rights_confirmed_at is not null)
);

alter table app.therapist_assignments
  add constraint therapist_assignments_id_shop_key unique (id, shop_id);

create index therapist_assignments_shop_active_idx
  on app.therapist_assignments(shop_id, lifecycle_state, active_from desc);
create index therapist_assignments_therapist_history_idx
  on app.therapist_assignments(therapist_id, active_from desc);

-- Review-entry links are target selectors, not authentication credentials.
create table private.review_entry_links (
  id uuid primary key default gen_random_uuid(),
  public_handle uuid not null unique default gen_random_uuid(),
  shop_id uuid not null references app.shops(id) on delete restrict,
  therapist_assignment_id uuid references app.therapist_assignments(id) on delete restrict,
  link_kind text not null check (link_kind in ('shop_qr', 'therapist_link', 'shop_page', 'widget')),
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by text not null check (char_length(btrim(created_by)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((link_kind = 'therapist_link') = (therapist_assignment_id is not null)),
  check (expires_at is null or expires_at > created_at)
);

alter table private.review_entry_links
  add constraint review_entry_links_assignment_shop_fk
  foreign key (therapist_assignment_id, shop_id)
  references app.therapist_assignments(id, shop_id) on delete restrict;

create index review_entry_links_open_idx
  on private.review_entry_links(public_handle)
  where is_active;

-- One private experience may contain separately moderated shop and therapist
-- assessments.  Receipt hashes are non-public edit controls; raw receipts,
-- IP addresses, and browser strings are never persisted here.
create table private.review_experiences (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references app.shops(id) on delete restrict,
  entry_link_id uuid references private.review_entry_links(id) on delete set null,
  guest_display_name text not null check (char_length(btrim(guest_display_name)) between 1 and 80),
  visit_token text,
  edit_receipt_hash text not null unique check (edit_receipt_hash ~ '^[0-9a-f]{64}$'),
  device_fingerprint_hash text check (device_fingerprint_hash is null or device_fingerprint_hash ~ '^[0-9a-f]{64}$'),
  ip_prefix_hash text check (ip_prefix_hash is null or ip_prefix_hash ~ '^[0-9a-f]{64}$'),
  state text not null default 'submitted'
    check (state in ('submitted', 'under_review', 'approved', 'rejected', 'withdrawn')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state = 'withdrawn') = (withdrawn_at is not null))
);

create table private.review_assessments (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references private.review_experiences(id) on delete restrict,
  target_kind text not null check (target_kind in ('shop', 'therapist')),
  shop_id uuid not null references app.shops(id) on delete restrict,
  therapist_assignment_id uuid references app.therapist_assignments(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((target_kind = 'therapist') = (therapist_assignment_id is not null))
);

alter table private.review_assessments
  add constraint review_assessments_assignment_shop_fk
  foreign key (therapist_assignment_id, shop_id)
  references app.therapist_assignments(id, shop_id) on delete restrict;

create unique index review_assessments_one_shop_per_experience
  on private.review_assessments(experience_id) where target_kind = 'shop';
create unique index review_assessments_one_therapist_per_experience
  on private.review_assessments(experience_id, therapist_assignment_id)
  where target_kind = 'therapist';

create table private.review_revisions (
  id bigint generated always as identity primary key,
  assessment_id uuid not null references private.review_assessments(id) on delete restrict,
  revision integer not null check (revision > 0),
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  change_source text not null check (change_source in ('submission', 'guest_edit', 'moderation_redaction', 'withdrawal')),
  created_at timestamptz not null default now(),
  unique (assessment_id, revision)
);

create table private.review_moderation_decisions (
  id bigint generated always as identity primary key,
  experience_id uuid not null references private.review_experiences(id) on delete restrict,
  decision text not null check (decision in ('under_review', 'approved', 'rejected', 'withdrawn')),
  actor_label text not null check (char_length(btrim(actor_label)) between 1 and 120),
  note text check (note is null or char_length(note) <= 4000),
  created_at timestamptz not null default now()
);

-- The public identifier intentionally lives in app and contains only approved,
-- publishable fields.  It does not reveal the private experience or receipt.
create table app.review_publications (
  id uuid primary key default gen_random_uuid(),
  public_handle uuid not null unique default gen_random_uuid(),
  assessment_id uuid not null unique references private.review_assessments(id) on delete restrict,
  shop_id uuid not null references app.shops(id) on delete restrict,
  therapist_assignment_id uuid references app.therapist_assignments(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  published_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table app.review_publications
  add constraint review_publications_assignment_shop_fk
  foreign key (therapist_assignment_id, shop_id)
  references app.therapist_assignments(id, shop_id) on delete restrict;

create index review_publications_shop_published_idx
  on app.review_publications(shop_id, published_at desc) where archived_at is null;
create index review_publications_therapist_published_idx
  on app.review_publications(therapist_assignment_id, published_at desc)
  where therapist_assignment_id is not null and archived_at is null;

create table private.review_replies (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references app.review_publications(id) on delete restrict,
  workspace_id uuid not null references private.partner_workspaces(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  state text not null default 'submitted' check (state in ('submitted', 'approved', 'rejected', 'withdrawn')),
  submitted_at timestamptz not null default now(),
  moderated_at timestamptz,
  moderated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A benefit program has a single neutral eligibility rule.  Rating is absent
-- by design so high and low reviews are treated identically.
create table private.benefit_programs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references private.partner_workspaces(id) on delete restrict,
  shop_id uuid not null unique references app.shops(id) on delete restrict,
  state text not null default 'disabled' check (state in ('disabled', 'pending_approval', 'approved', 'suspended')),
  eligibility_rule text not null default 'moderation_approved'
    check (eligibility_rule = 'moderation_approved'),
  benefit_text text not null check (char_length(btrim(benefit_text)) between 1 and 500),
  operator_approved_at timestamptz,
  operator_approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state = 'approved') = (operator_approved_at is not null and operator_approved_by is not null))
);

create table private.benefit_codes (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references private.benefit_programs(id) on delete restrict,
  experience_id uuid not null unique references private.review_experiences(id) on delete restrict,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  state text not null default 'issued' check (state in ('issued', 'redeemed', 'void')),
  issued_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by_workspace_id uuid references private.partner_workspaces(id) on delete restrict,
  voided_at timestamptz,
  check ((state = 'redeemed') = (redeemed_at is not null and redeemed_by_workspace_id is not null)),
  check ((state = 'void') = (voided_at is not null))
);

create table private.review_submission_idempotency (
  id bigint generated always as identity primary key,
  idempotency_hash text not null unique check (idempotency_hash ~ '^[0-9a-f]{64}$'),
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  experience_id uuid references private.review_experiences(id) on delete restrict,
  state text not null default 'accepted' check (state in ('accepted', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.review_outbox (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('review_submitted', 'review_approved', 'review_rejected', 'reply_submitted', 'benefit_issued', 'benefit_redeemed')),
  aggregate_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  available_at timestamptz not null default now(),
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

-- The submission RPC is the only write entrypoint for a guest review.  The
-- caller sends already-hashed idempotency/receipt/fraud signals; it never
-- sends a trusted shop or therapist identifier.  Both are resolved from the
-- reviewed QR/widget handle while the link is locked.
create or replace function private.submit_review_experience(
  p_entry_handle uuid,
  p_idempotency_hash text,
  p_request_fingerprint text,
  p_guest_display_name text,
  p_edit_receipt_hash text,
  p_device_fingerprint_hash text,
  p_ip_prefix_hash text,
  p_shop_rating smallint,
  p_shop_body text,
  p_therapist_rating smallint default null,
  p_therapist_body text default null
) returns table (experience_id uuid, replayed boolean)
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare
  v_link private.review_entry_links%rowtype;
  v_existing private.review_submission_idempotency%rowtype;
  v_experience_id uuid;
  v_idempotency_id bigint;
  v_assignment app.therapist_assignments%rowtype;
begin
  if p_idempotency_hash !~ '^[0-9a-f]{64}$'
    or p_request_fingerprint !~ '^[0-9a-f]{64}$'
    or p_edit_receipt_hash !~ '^[0-9a-f]{64}$'
    or (p_device_fingerprint_hash is not null and p_device_fingerprint_hash !~ '^[0-9a-f]{64}$')
    or (p_ip_prefix_hash is not null and p_ip_prefix_hash !~ '^[0-9a-f]{64}$')
    or char_length(btrim(coalesce(p_guest_display_name, ''))) not between 1 and 80
    or p_shop_rating not between 1 and 5
    or char_length(btrim(coalesce(p_shop_body, ''))) not between 1 and 4000 then
    raise exception 'invalid review submission' using errcode = '22023';
  end if;

  insert into private.review_submission_idempotency (idempotency_hash, request_fingerprint)
  values (p_idempotency_hash, p_request_fingerprint)
  on conflict (idempotency_hash) do nothing
  returning id into v_idempotency_id;
  if v_idempotency_id is null then
    select * into v_existing from private.review_submission_idempotency
    where idempotency_hash = p_idempotency_hash for update;
    if v_existing.request_fingerprint <> p_request_fingerprint then
      raise exception 'idempotency key has a different payload' using errcode = '23505';
    end if;
    if v_existing.state = 'completed' and v_existing.experience_id is not null then
      return query select v_existing.experience_id, true;
      return;
    end if;
    raise exception 'review submission is incomplete' using errcode = '40001';
  end if;

  select * into v_link from private.review_entry_links
  where public_handle = p_entry_handle and is_active and (expires_at is null or expires_at > now())
  for update;
  if not found then
    update private.review_submission_idempotency set state = 'failed', updated_at = now()
    where idempotency_hash = p_idempotency_hash;
    raise exception 'review entry link is unavailable' using errcode = 'P0002';
  end if;
  if v_link.therapist_assignment_id is null then
    if p_therapist_rating is not null or nullif(btrim(coalesce(p_therapist_body, '')), '') is not null then
      raise exception 'shop entry link cannot submit a therapist assessment' using errcode = '22023';
    end if;
  else
    select * into v_assignment from app.therapist_assignments
    where id = v_link.therapist_assignment_id and shop_id = v_link.shop_id
      and lifecycle_state = 'active' and (active_until is null or active_until > now())
    for key share;
    if not found then raise exception 'therapist assignment is unavailable' using errcode = 'P0002'; end if;
    if (p_therapist_rating is null) <> (nullif(btrim(coalesce(p_therapist_body, '')), '') is null)
      or (p_therapist_rating is not null and (p_therapist_rating not between 1 and 5 or char_length(btrim(p_therapist_body)) not between 1 and 4000)) then
      raise exception 'invalid therapist assessment' using errcode = '22023';
    end if;
  end if;

  insert into private.review_experiences (
    shop_id, entry_link_id, guest_display_name, edit_receipt_hash,
    device_fingerprint_hash, ip_prefix_hash
  ) values (
    v_link.shop_id, v_link.id, btrim(p_guest_display_name), p_edit_receipt_hash,
    p_device_fingerprint_hash, p_ip_prefix_hash
  ) returning id into v_experience_id;

  insert into private.review_assessments (experience_id, target_kind, shop_id, rating, body)
  values (v_experience_id, 'shop', v_link.shop_id, p_shop_rating, btrim(p_shop_body));
  insert into private.review_revisions (assessment_id, revision, rating, body, change_source)
  select assessment.id, 1, assessment.rating, assessment.body, 'submission'
  from private.review_assessments as assessment
  where assessment.experience_id = v_experience_id and assessment.target_kind = 'shop';
  if p_therapist_rating is not null then
    insert into private.review_assessments (experience_id, target_kind, shop_id, therapist_assignment_id, rating, body)
    values (v_experience_id, 'therapist', v_link.shop_id, v_link.therapist_assignment_id, p_therapist_rating, btrim(p_therapist_body));
    insert into private.review_revisions (assessment_id, revision, rating, body, change_source)
    select assessment.id, 1, assessment.rating, assessment.body, 'submission'
    from private.review_assessments as assessment
    where assessment.experience_id = v_experience_id and assessment.target_kind = 'therapist';
  end if;
  update private.review_submission_idempotency
  set experience_id = v_experience_id, state = 'completed', updated_at = now()
  where idempotency_hash = p_idempotency_hash;
  insert into private.review_outbox (event_type, aggregate_id)
  values ('review_submitted', v_experience_id);
  return query select v_experience_id, false;
end;
$$;

-- New canonical managed shop: no WordPress post or media ID is accepted.
create or replace function private.create_canonical_managed_shop(
  p_shop_slug text, p_payload jsonb, p_actor_label text
) returns table (managed_shop_id uuid, app_shop_id uuid)
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare
  v_managed_shop_id uuid;
  v_app_shop_id uuid;
begin
  if p_shop_slug !~ '^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$'
    or char_length(trim(coalesce(p_actor_label, ''))) not between 1 and 120 then
    raise exception 'invalid canonical managed shop identity' using errcode = '22023';
  end if;
  if exists (select 1 from private.managed_shops where shop_slug = p_shop_slug)
    or exists (select 1 from app.shops where slug = p_shop_slug) then
    raise exception 'canonical shop slug already exists' using errcode = '23505';
  end if;

  insert into app.shops (slug, canonical_path, name, description_html, excerpt, official_url, address_text, booking_url, publication_status)
  values (
    p_shop_slug,
    '/shops/' || p_shop_slug || '/',
    trim(p_payload ->> 'shop_name'),
    coalesce(nullif(trim(p_payload ->> 'introduction'), ''), ''),
    coalesce(nullif(trim(p_payload ->> 'introduction'), ''), ''),
    trim(p_payload ->> 'official_url'),
    nullif(trim(p_payload ->> 'address'), ''),
    nullif(trim(p_payload ->> 'booking_url'), ''),
    'draft'
  ) returning id into v_app_shop_id;

  insert into private.managed_shops (app_shop_id, shop_slug, current_revision)
  values (v_app_shop_id, p_shop_slug, 1)
  returning id into v_managed_shop_id;
  perform private.insert_managed_shop_revision(v_managed_shop_id, 1, 'draft', p_payload);

  return query select v_managed_shop_id, v_app_shop_id;
end;
$$;

-- New partner workspace provisioning is UUID based.  It is intentionally a
-- separate RPC from the legacy wp_shop_id version.
create or replace function private.provision_partner_workspace_for_app_shop(
  p_app_shop_id uuid, p_source text default 'provisioning'
) returns table (workspace_id uuid, state text, initialized boolean)
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare
  v_shop app.shops%rowtype;
  v_workspace private.partner_workspaces%rowtype;
begin
  select * into v_shop from app.shops where id = p_app_shop_id for key share;
  if not found then raise exception 'canonical shop not found' using errcode = 'P0002'; end if;
  insert into private.partner_workspaces (app_shop_id, shop_slug, shop_name, canonical_url)
  values (v_shop.id, v_shop.slug, v_shop.name, 'https://mens-esthe-kuchikomi.com' || v_shop.canonical_path)
  on conflict (app_shop_id) where app_shop_id is not null do nothing
  returning * into v_workspace;
  if v_workspace.id is null then
    select * into v_workspace from private.partner_workspaces where app_shop_id = v_shop.id for key share;
    return query select v_workspace.id, v_workspace.state::text, false;
    return;
  end if;
  insert into private.partner_state_history (workspace_id, from_state, to_state, transition_source, reason)
  values (v_workspace.id, null, v_workspace.state, p_source, 'canonical shop workspace initialized');
  return query select v_workspace.id, v_workspace.state::text, true;
end;
$$;

-- Review approval atomically creates a separately-addressable public record
-- for each assessment.  Any rejected/withdrawn decision cannot publish.
create or replace function private.moderate_review_experience(
  p_experience_id uuid, p_decision text, p_actor_label text, p_note text default null
) returns text
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare
  v_experience private.review_experiences%rowtype;
  v_assessment private.review_assessments%rowtype;
begin
  if p_decision not in ('approved', 'rejected', 'withdrawn')
    or char_length(trim(coalesce(p_actor_label, ''))) not between 1 and 120 then
    raise exception 'invalid review moderation decision' using errcode = '22023';
  end if;
  select * into v_experience from private.review_experiences where id = p_experience_id for update;
  if not found then raise exception 'review experience not found' using errcode = 'P0002'; end if;
  if v_experience.state in ('approved', 'rejected', 'withdrawn') then return v_experience.state; end if;
  update private.review_experiences
  set state = p_decision, reviewed_at = now(), withdrawn_at = case when p_decision = 'withdrawn' then now() else null end, updated_at = now()
  where id = v_experience.id;
  insert into private.review_moderation_decisions (experience_id, decision, actor_label, note)
  values (v_experience.id, p_decision, trim(p_actor_label), nullif(trim(coalesce(p_note, '')), ''));
  if p_decision = 'approved' then
    for v_assessment in select * from private.review_assessments where experience_id = v_experience.id loop
      insert into app.review_publications (assessment_id, shop_id, therapist_assignment_id, rating, body, display_name)
      values (v_assessment.id, v_assessment.shop_id, v_assessment.therapist_assignment_id, v_assessment.rating, v_assessment.body, v_experience.guest_display_name)
      on conflict (assessment_id) do nothing;
    end loop;
  end if;
  insert into private.review_outbox (event_type, aggregate_id, payload)
  values (
    case p_decision when 'approved' then 'review_approved' else 'review_rejected' end,
    v_experience.id,
    jsonb_build_object('decision', p_decision)
  );
  return p_decision;
end;
$$;

-- Exactly one redemption wins: the row lock and state predicate make replay
-- and concurrent scans return a non-success state without consuming again.
create or replace function private.redeem_benefit_code(
  p_workspace_id uuid, p_code_hash text
) returns text
language plpgsql security definer set search_path = private, pg_temp as $$
declare
  v_code private.benefit_codes%rowtype;
  v_program private.benefit_programs%rowtype;
begin
  if p_code_hash !~ '^[0-9a-f]{64}$' then return 'invalid'; end if;
  select * into v_code from private.benefit_codes where code_hash = p_code_hash for update;
  if not found then return 'invalid'; end if;
  select * into v_program from private.benefit_programs where id = v_code.program_id for key share;
  if v_program.workspace_id <> p_workspace_id then return 'forbidden'; end if;
  if v_program.state <> 'approved' then return 'disabled'; end if;
  if v_code.state <> 'issued' then return 'already_used'; end if;
  update private.benefit_codes
  set state = 'redeemed', redeemed_at = now(), redeemed_by_workspace_id = p_workspace_id
  where id = v_code.id and state = 'issued';
  if not found then return 'already_used'; end if;
  insert into private.review_outbox (event_type, aggregate_id, payload)
  values ('benefit_redeemed', v_code.id, jsonb_build_object('programId', v_program.id));
  return 'redeemed';
end;
$$;

-- Issuance accepts a server-side hash only.  A code can be created after
-- moderation approval, independent of every rating value, and once per guest
-- experience.  The raw code is never placed in an audit row or outbox event.
create or replace function private.issue_benefit_code(
  p_program_id uuid, p_experience_id uuid, p_code_hash text
) returns text
language plpgsql security definer set search_path = private, pg_temp as $$
declare
  v_program private.benefit_programs%rowtype;
  v_experience private.review_experiences%rowtype;
begin
  if p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid benefit code hash' using errcode = '22023';
  end if;
  select * into v_program from private.benefit_programs where id = p_program_id for update;
  if not found then raise exception 'benefit program not found' using errcode = 'P0002'; end if;
  if v_program.state <> 'approved' or v_program.eligibility_rule <> 'moderation_approved' then
    return 'disabled';
  end if;
  select * into v_experience from private.review_experiences where id = p_experience_id for key share;
  if not found or v_experience.shop_id <> v_program.shop_id then return 'ineligible'; end if;
  if v_experience.state <> 'approved' then return 'ineligible'; end if;
  insert into private.benefit_codes (program_id, experience_id, code_hash)
  values (v_program.id, v_experience.id, p_code_hash)
  on conflict (experience_id) do nothing;
  if not found then return 'already_issued'; end if;
  insert into private.review_outbox (event_type, aggregate_id, payload)
  values ('benefit_issued', v_experience.id, jsonb_build_object('programId', v_program.id));
  return 'issued';
end;
$$;

-- The archive import never creates a publication.  It leaves a tombstone and
-- audit event in one transaction instead of import-and-publish then unlisting.
create table private.managed_shop_archive_events (
  id bigint generated always as identity primary key,
  managed_shop_id uuid not null references private.managed_shops(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  actor_label text not null check (char_length(btrim(actor_label)) between 1 and 120),
  created_at timestamptz not null default now()
);

create or replace function private.import_managed_shop_from_legacy_as_archived(
  p_wp_shop_id bigint, p_shop_slug text, p_payload jsonb, p_actor_label text, p_reason text
) returns uuid
language plpgsql security definer set search_path = private, pg_temp as $$
declare v_managed_shop_id uuid;
begin
  if char_length(trim(coalesce(p_reason, ''))) not between 1 and 1000 then
    raise exception 'archive reason is required' using errcode = '22023';
  end if;
  v_managed_shop_id := private.import_managed_shop_from_legacy(p_wp_shop_id, p_shop_slug, p_payload, p_actor_label);
  if exists (select 1 from private.managed_shop_publications where managed_shop_id = v_managed_shop_id) then
    raise exception 'published managed shop cannot be archived by import' using errcode = '23505';
  end if;
  update private.managed_shops set publication_state = 'deleted', updated_at = now() where id = v_managed_shop_id;
  insert into private.managed_shop_archive_events (managed_shop_id, reason, actor_label)
  values (v_managed_shop_id, trim(p_reason), trim(p_actor_label));
  return v_managed_shop_id;
end;
$$;

-- Private-by-default: service role is the only transport until a reviewed API
-- adapter exists.  RLS remains enabled on every new table.
alter table app.therapists enable row level security;
alter table app.therapist_assignments enable row level security;
alter table app.review_publications enable row level security;
alter table private.review_entry_links enable row level security;
alter table private.review_experiences enable row level security;
alter table private.review_assessments enable row level security;
alter table private.review_revisions enable row level security;
alter table private.review_moderation_decisions enable row level security;
alter table private.review_replies enable row level security;
alter table private.benefit_programs enable row level security;
alter table private.benefit_codes enable row level security;
alter table private.review_submission_idempotency enable row level security;
alter table private.review_outbox enable row level security;
alter table private.managed_shop_archive_events enable row level security;

revoke all on table app.therapists, app.therapist_assignments, app.review_publications from public, anon, authenticated;
revoke all on table private.review_entry_links, private.review_experiences, private.review_assessments,
  private.review_revisions, private.review_moderation_decisions, private.review_replies,
  private.benefit_programs, private.benefit_codes, private.review_submission_idempotency,
  private.review_outbox, private.managed_shop_archive_events from public, anon, authenticated;
grant select, insert, update, delete on table app.therapists, app.therapist_assignments, app.review_publications to service_role;
grant select, insert, update, delete on table private.review_entry_links, private.review_experiences,
  private.review_assessments, private.review_revisions, private.review_moderation_decisions,
  private.review_replies, private.benefit_programs, private.benefit_codes,
  private.review_submission_idempotency, private.review_outbox, private.managed_shop_archive_events to service_role;

create or replace function api.create_canonical_managed_shop(p_shop_slug text, p_payload jsonb, p_actor_label text)
returns table (managed_shop_id uuid, app_shop_id uuid)
language sql security invoker set search_path = private, api, pg_temp as $$
  select * from private.create_canonical_managed_shop(p_shop_slug, p_payload, p_actor_label)
$$;

create or replace function api.provision_partner_workspace_for_app_shop(p_app_shop_id uuid, p_source text default 'provisioning')
returns table (workspace_id uuid, state text, initialized boolean)
language sql security invoker set search_path = private, api, pg_temp as $$
  select * from private.provision_partner_workspace_for_app_shop(p_app_shop_id, p_source)
$$;

create or replace function api.moderate_review_experience(p_experience_id uuid, p_decision text, p_actor_label text, p_note text default null)
returns text language sql security invoker set search_path = private, api, pg_temp as $$
  select private.moderate_review_experience(p_experience_id, p_decision, p_actor_label, p_note)
$$;

create or replace function api.submit_review_experience(
  p_entry_handle uuid, p_idempotency_hash text, p_request_fingerprint text,
  p_guest_display_name text, p_edit_receipt_hash text, p_device_fingerprint_hash text,
  p_ip_prefix_hash text, p_shop_rating smallint, p_shop_body text,
  p_therapist_rating smallint default null, p_therapist_body text default null
) returns table (experience_id uuid, replayed boolean)
language sql security invoker set search_path = private, api, pg_temp as $$
  select * from private.submit_review_experience(
    p_entry_handle, p_idempotency_hash, p_request_fingerprint, p_guest_display_name,
    p_edit_receipt_hash, p_device_fingerprint_hash, p_ip_prefix_hash, p_shop_rating,
    p_shop_body, p_therapist_rating, p_therapist_body
  )
$$;

create or replace function api.redeem_benefit_code(p_workspace_id uuid, p_code_hash text)
returns text language sql security invoker set search_path = private, api, pg_temp as $$
  select private.redeem_benefit_code(p_workspace_id, p_code_hash)
$$;

create or replace function api.issue_benefit_code(p_program_id uuid, p_experience_id uuid, p_code_hash text)
returns text language sql security invoker set search_path = private, api, pg_temp as $$
  select private.issue_benefit_code(p_program_id, p_experience_id, p_code_hash)
$$;

create or replace function api.import_managed_shop_from_legacy_as_archived(
  p_wp_shop_id bigint, p_shop_slug text, p_payload jsonb, p_actor_label text, p_reason text
) returns uuid language sql security invoker set search_path = private, api, pg_temp as $$
  select private.import_managed_shop_from_legacy_as_archived(p_wp_shop_id, p_shop_slug, p_payload, p_actor_label, p_reason)
$$;

revoke all on function api.create_canonical_managed_shop(text, jsonb, text) from public, anon, authenticated;
revoke all on function api.provision_partner_workspace_for_app_shop(uuid, text) from public, anon, authenticated;
revoke all on function api.moderate_review_experience(uuid, text, text, text) from public, anon, authenticated;
revoke all on function api.submit_review_experience(uuid, text, text, text, text, text, text, smallint, text, smallint, text) from public, anon, authenticated;
revoke all on function api.redeem_benefit_code(uuid, text) from public, anon, authenticated;
revoke all on function api.issue_benefit_code(uuid, uuid, text) from public, anon, authenticated;
revoke all on function api.import_managed_shop_from_legacy_as_archived(bigint, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function api.create_canonical_managed_shop(text, jsonb, text) to service_role;
grant execute on function api.provision_partner_workspace_for_app_shop(uuid, text) to service_role;
grant execute on function api.moderate_review_experience(uuid, text, text, text) to service_role;
grant execute on function api.submit_review_experience(uuid, text, text, text, text, text, text, smallint, text, smallint, text) to service_role;
grant execute on function api.redeem_benefit_code(uuid, text) to service_role;
grant execute on function api.issue_benefit_code(uuid, uuid, text) to service_role;
grant execute on function api.import_managed_shop_from_legacy_as_archived(bigint, text, jsonb, text, text) to service_role;

revoke all on function private.create_canonical_managed_shop(text, jsonb, text) from public, anon, authenticated;
revoke all on function private.provision_partner_workspace_for_app_shop(uuid, text) from public, anon, authenticated;
revoke all on function private.moderate_review_experience(uuid, text, text, text) from public, anon, authenticated;
revoke all on function private.submit_review_experience(uuid, text, text, text, text, text, text, smallint, text, smallint, text) from public, anon, authenticated;
revoke all on function private.redeem_benefit_code(uuid, text) from public, anon, authenticated;
revoke all on function private.issue_benefit_code(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.import_managed_shop_from_legacy_as_archived(bigint, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function private.create_canonical_managed_shop(text, jsonb, text) to service_role;
grant execute on function private.provision_partner_workspace_for_app_shop(uuid, text) to service_role;
grant execute on function private.moderate_review_experience(uuid, text, text, text) to service_role;
grant execute on function private.submit_review_experience(uuid, text, text, text, text, text, text, smallint, text, smallint, text) to service_role;
grant execute on function private.redeem_benefit_code(uuid, text) to service_role;
grant execute on function private.issue_benefit_code(uuid, uuid, text) to service_role;
grant execute on function private.import_managed_shop_from_legacy_as_archived(bigint, text, jsonb, text, text) to service_role;

notify pgrst, 'reload schema';
