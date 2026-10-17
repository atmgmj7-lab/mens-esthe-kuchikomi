-- Eskomi v1.1 adds experience-level public identities and private controls.
-- It deliberately leaves historical assessment-level publications intact;
-- new v2 receipts use the one-experience projection below.

create table private.review_experience_revisions (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references private.review_experiences(id) on delete restrict,
  revision integer not null check (revision > 0),
  nickname text check (nickname is null or char_length(btrim(nickname)) between 1 and 30),
  experience_comment text not null default '' check (char_length(btrim(experience_comment)) <= 400),
  moderation_state text not null default 'pending'
    check (moderation_state in ('pending', 'changes_requested', 'approved', 'rejected', 'spam', 'withdrawn')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (experience_id, revision)
);

create index review_experience_revisions_pending_idx
  on private.review_experience_revisions(moderation_state, submitted_at)
  where moderation_state = 'pending';

-- This is the only public ID for new v1.1 experiences.  It intentionally has
-- no receipt hash, coupon code, operation key, or private assessment ID.
create table app.review_experience_publications (
  id uuid primary key default gen_random_uuid(),
  public_handle uuid not null unique default gen_random_uuid(),
  experience_id uuid not null unique references private.review_experiences(id) on delete restrict,
  active_revision_id uuid not null references private.review_experience_revisions(id) on delete restrict,
  shop_id uuid not null references app.shops(id) on delete restrict,
  therapist_assignment_id uuid references app.therapist_assignments(id) on delete restrict,
  publication_state text not null default 'unpublished'
    check (publication_state in ('unpublished', 'published', 'hidden')),
  public_version bigint not null default 1 check (public_version > 0),
  published_at timestamptz,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((publication_state = 'unpublished') = (published_at is null)),
  check ((publication_state = 'hidden') = (hidden_at is not null))
);

create index review_experience_publications_shop_idx
  on app.review_experience_publications(shop_id, published_at desc, id desc)
  where publication_state = 'published';

-- A receipt is an edit/withdrawal authority, never a public identifier and
-- never a coupon authority.  Raw values are supplied only by the server and
-- are stored as keyed hashes.
create table private.review_edit_receipts (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null unique references private.review_experiences(id) on delete restrict,
  secret_hash text not null unique check (secret_hash ~ '^[0-9a-f]{64}$'),
  scope text not null default 'edit_own,withdraw_own,appeal_own'
    check (scope = 'edit_own,withdraw_own,appeal_own'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz,
  check (expires_at > created_at)
);

-- Short lived operation sessions bind idempotent retries to the same browser
-- context.  They do not identify a person and are not used as public access.
create table private.guest_operation_sessions (
  id uuid primary key default gen_random_uuid(),
  session_secret_hash text not null unique check (session_secret_hash ~ '^[0-9a-f]{64}$'),
  context_fingerprint text not null check (context_fingerprint ~ '^[0-9a-f]{64}$'),
  context_snapshot jsonb not null default '{}'::jsonb,
  submit_context_expires_at timestamptz not null default (now() + interval '30 minutes'),
  replay_expires_at timestamptz not null default (now() + interval '24 hours'),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (replay_expires_at >= submit_context_expires_at)
);

create table private.operation_idempotency (
  id uuid primary key default gen_random_uuid(),
  operation text not null check (operation in ('review_submit', 'benefit_redeem')),
  actor_scope_hash text not null check (actor_scope_hash ~ '^[0-9a-f]{64}$'),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  result_entity_id uuid,
  state text not null default 'committed' check (state = 'committed'),
  created_at timestamptz not null default now(),
  unique (operation, actor_scope_hash, key_hash)
);

create table private.review_entry_rate_limits (
  scope_hash text not null check (scope_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  idempotency_hashes text[] not null default '{}'::text[],
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (scope_hash, window_started_at),
  check (expires_at = window_started_at + interval '1 hour')
);

create or replace function private.claim_review_entry_rate_limit(
  p_scope_hash text, p_idempotency_hash text, p_limit integer
) returns table (allowed boolean, retry_after_seconds integer)
language plpgsql security definer set search_path = private, pg_temp as $$
declare
  v_window timestamptz := date_trunc('hour', now());
  v_count integer;
  v_seen boolean;
begin
  if p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$'
    or p_limit not between 1 and 1000 then
    raise exception 'invalid review-entry rate limit input' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_scope_hash || '|' || v_window::text, 0));
  insert into private.review_entry_rate_limits(scope_hash, window_started_at, request_count, idempotency_hashes, expires_at)
  values (p_scope_hash, v_window, 1, array[p_idempotency_hash], v_window + interval '1 hour')
  on conflict (scope_hash, window_started_at) do update
  set request_count = case
        when p_idempotency_hash = any(private.review_entry_rate_limits.idempotency_hashes) then private.review_entry_rate_limits.request_count
        when private.review_entry_rate_limits.request_count >= p_limit then private.review_entry_rate_limits.request_count
        else private.review_entry_rate_limits.request_count + 1 end,
      idempotency_hashes = case
        when p_idempotency_hash = any(private.review_entry_rate_limits.idempotency_hashes) then private.review_entry_rate_limits.idempotency_hashes
        when private.review_entry_rate_limits.request_count >= p_limit then private.review_entry_rate_limits.idempotency_hashes
        else array_append(private.review_entry_rate_limits.idempotency_hashes, p_idempotency_hash) end,
      updated_at = now()
  returning request_count, p_idempotency_hash = any(idempotency_hashes) into v_count, v_seen;
  return query select v_seen or v_count < p_limit,
    greatest(0, ceil(extract(epoch from (v_window + interval '1 hour' - now())))::integer);
end;
$$;

create or replace function private.open_review_edit_session(
  p_receipt_hash text, p_session_secret_hash text, p_context_fingerprint text
) returns table (experience_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = private, pg_temp as $$
declare v_receipt private.review_edit_receipts%rowtype;
begin
  if p_receipt_hash !~ '^[0-9a-f]{64}$' or p_session_secret_hash !~ '^[0-9a-f]{64}$'
    or p_context_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid edit session request' using errcode = '22023';
  end if;
  select * into v_receipt from private.review_edit_receipts as receipt where receipt.secret_hash = p_receipt_hash for key share;
  if not found or v_receipt.revoked_at is not null or v_receipt.expires_at <= now() then
    raise exception 'edit receipt is unavailable' using errcode = 'P0002';
  end if;
  insert into private.guest_operation_sessions(session_secret_hash, context_fingerprint, context_snapshot)
  values (p_session_secret_hash, p_context_fingerprint, jsonb_build_object('experienceId', v_receipt.experience_id, 'scope', v_receipt.scope));
  return query select v_receipt.experience_id, now() + interval '30 minutes';
end;
$$;

-- Immutable benefit versions are kept separate from the mutable program.
-- Existing programs receive no active version automatically: their old free
-- text has not been approved as title, issuer, conditions, or expiry terms.
alter table private.benefit_programs
  add column if not exists current_version integer not null default 0 check (current_version >= 0),
  add column if not exists revision integer not null default 1 check (revision > 0);

create table private.benefit_program_versions (
  program_id uuid not null references private.benefit_programs(id) on delete restrict,
  version integer not null check (version > 0),
  title text not null check (char_length(btrim(title)) between 1 and 60),
  benefit_kind text not null check (benefit_kind in ('amount_off', 'percent_off', 'other')),
  amount_yen integer,
  rate numeric(6,5),
  cap_yen integer,
  minimum_spend_yen integer,
  terms_text text not null check (char_length(btrim(terms_text)) between 1 and 4000),
  issuer_label text not null check (char_length(btrim(issuer_label)) between 1 and 120),
  funding_party_label text not null check (char_length(btrim(funding_party_label)) between 1 and 120),
  valid_from timestamptz not null,
  valid_until timestamptz,
  redeem_valid_days integer,
  redeem_deadline timestamptz,
  combinable boolean not null default false,
  eligibility_version text not null check (char_length(btrim(eligibility_version)) between 1 and 80),
  approved_at timestamptz,
  approved_by text,
  created_at timestamptz not null default now(),
  primary key (program_id, version),
  check ((benefit_kind = 'amount_off') = (amount_yen is not null and rate is null)),
  check ((benefit_kind = 'percent_off') = (rate is not null and amount_yen is null)),
  check (benefit_kind <> 'other' or (amount_yen is null and rate is null)),
  check (amount_yen is null or amount_yen >= 0),
  check (rate is null or rate > 0 and rate <= 1),
  check (cap_yen is null or cap_yen >= 0),
  check (minimum_spend_yen is null or minimum_spend_yen >= 0),
  check (valid_until is null or valid_until > valid_from),
  check (redeem_valid_days is null or redeem_valid_days between 1 and 3650),
  check (redeem_deadline is null or redeem_deadline > valid_from),
  check ((approved_at is null) = (approved_by is null))
);

alter table private.benefit_codes
  add column if not exists program_version integer,
  add column if not exists expires_at timestamptz,
  add column if not exists benefit_snapshot jsonb;

alter table private.benefit_codes
  add constraint benefit_codes_program_version_fk
  foreign key (program_id, program_version)
  references private.benefit_program_versions(program_id, version) on delete restrict not valid;

create table private.benefit_redemptions (
  id uuid primary key default gen_random_uuid(),
  benefit_code_id uuid not null unique references private.benefit_codes(id) on delete restrict,
  workspace_id uuid not null references private.partner_workspaces(id) on delete restrict,
  idempotency_hash text not null check (idempotency_hash ~ '^[0-9a-f]{64}$'),
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  redeemed_at timestamptz not null default now(),
  unique (workspace_id, idempotency_hash)
);

alter table private.review_experience_revisions enable row level security;
alter table app.review_experience_publications enable row level security;
alter table private.review_edit_receipts enable row level security;
alter table private.guest_operation_sessions enable row level security;
alter table private.operation_idempotency enable row level security;
alter table private.review_entry_rate_limits enable row level security;
alter table private.benefit_program_versions enable row level security;
alter table private.benefit_redemptions enable row level security;
revoke all on table private.review_experience_revisions, app.review_experience_publications,
  private.review_edit_receipts, private.guest_operation_sessions, private.operation_idempotency, private.review_entry_rate_limits,
  private.benefit_program_versions, private.benefit_redemptions from public, anon, authenticated;
grant select, insert, update, delete on table private.review_experience_revisions, app.review_experience_publications,
  private.review_edit_receipts, private.guest_operation_sessions, private.operation_idempotency, private.review_entry_rate_limits,
  private.benefit_program_versions, private.benefit_redemptions to service_role;

revoke all on function private.claim_review_entry_rate_limit(text, text, integer), private.open_review_edit_session(text, text, text) from public, anon, authenticated;
grant execute on function private.claim_review_entry_rate_limit(text, text, integer), private.open_review_edit_session(text, text, text) to service_role;

notify pgrst, 'reload schema';
