-- Supabase-native Review foundation. This is an additive forward migration over
-- the existing SEO-safe content, Partner Foundation, and Partner Review Growth
-- migrations. It does not change the WordPress Shop/Area source of truth.

alter table app.reviews
  add column rating_price smallint,
  add column rating_service smallint,
  add column rating_cleanliness smallint,
  add column visit_period text,
  add column revisit_intent text,
  add column reviewed_at timestamptz,
  add column published_at timestamptz,
  alter column source_system set default 'supabase';

alter table app.reviews
  add constraint reviews_rating_price_range check (rating_price is null or rating_price between 1 and 5),
  add constraint reviews_rating_service_range check (rating_service is null or rating_service between 1 and 5),
  add constraint reviews_rating_cleanliness_range check (rating_cleanliness is null or rating_cleanliness between 1 and 5),
  add constraint reviews_visit_period_length check (
    visit_period is null or char_length(btrim(visit_period)) between 1 and 80
  ),
  add constraint reviews_revisit_intent_length check (
    revisit_intent is null or char_length(btrim(revisit_intent)) between 1 and 80
  );

alter table app.reviews drop constraint reviews_public_safety;
alter table app.reviews
  add constraint reviews_public_safety check (
    not is_public or (
      source_type = 'user-review'
      and moderation_status = 'approved'
      and publication_status = 'published'
      and not is_ai_generated
      and not is_promotion
      and reviewed_at is not null
      and approved_at is not null
      and published_at is not null
    )
  );

-- Shop publication remains canonical in WordPress. Browser roles no longer read
-- app.reviews directly, and the service-only candidate RPC below deliberately
-- applies Review safety predicates without consulting app.shops publication state.
drop policy reviews_public_read on app.reviews;
revoke select on table app.reviews from anon, authenticated;
revoke select on table api.published_reviews from anon, authenticated;

create table private.review_submission_details (
  review_id uuid primary key references app.reviews(id) on delete restrict,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 80),
  email text check (email is null or char_length(btrim(email)) between 3 and 254),
  source_url text not null check (char_length(btrim(source_url)) between 1 and 2048),
  created_at timestamptz not null default now()
);

create table private.review_idempotency_keys (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  review_id uuid not null unique references app.reviews(id) on delete restrict,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table private.review_abuse_rate_limits (
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  window_expires_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (key_hash, window_started_at),
  check (window_expires_at > window_started_at)
);

create table private.review_moderation_events (
  id bigint generated always as identity primary key,
  review_id uuid not null references app.reviews(id) on delete restrict,
  from_state text not null check (from_state in ('pending', 'approved', 'rejected', 'spam')),
  to_state text not null check (to_state in ('approved', 'rejected', 'spam')),
  actor_label text not null check (char_length(btrim(actor_label)) between 1 and 120),
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  created_at timestamptz not null default now(),
  check (from_state <> to_state)
);

create index review_moderation_events_review_created_idx
  on private.review_moderation_events (review_id, created_at, id);
create index review_abuse_rate_limits_expiry_idx
  on private.review_abuse_rate_limits (window_expires_at);
create index review_idempotency_keys_expiry_idx
  on private.review_idempotency_keys (expires_at);

alter table private.review_submission_details enable row level security;
alter table private.review_idempotency_keys enable row level security;
alter table private.review_abuse_rate_limits enable row level security;
alter table private.review_moderation_events enable row level security;

revoke all on table private.review_submission_details from public, anon, authenticated;
revoke all on table private.review_idempotency_keys from public, anon, authenticated;
revoke all on table private.review_abuse_rate_limits from public, anon, authenticated;
revoke all on table private.review_moderation_events from public, anon, authenticated;
revoke all on sequence private.review_moderation_events_id_seq from public, anon, authenticated;

-- The baseline granted service_role ALL on existing app tables. Replace that
-- inherited app.reviews ACL with only the columns required by the invoker RPCs.
revoke all on table app.reviews from service_role;
grant select on table app.reviews to service_role;
grant insert (
  shop_id,
  body,
  rating,
  rating_price,
  rating_service,
  rating_cleanliness,
  visit_period,
  revisit_intent
) on table app.reviews to service_role;
grant update (
  moderation_status,
  publication_status,
  is_public,
  reviewed_at,
  approved_at,
  published_at,
  updated_at
) on table app.reviews to service_role;

revoke all on table private.review_submission_details from service_role;
revoke all on table private.review_idempotency_keys from service_role;
revoke all on table private.review_abuse_rate_limits from service_role;
revoke all on table private.review_moderation_events from service_role;
grant select, insert on table private.review_submission_details to service_role;
grant select, insert on table private.review_idempotency_keys to service_role;
grant select, insert, update on table private.review_abuse_rate_limits to service_role;
grant select, insert on table private.review_moderation_events to service_role;
grant usage, select on sequence private.review_moderation_events_id_seq to service_role;

-- Extend the already-deployed Growth attribution table without deleting its
-- WordPress identifier. During the transition a row may contain either or both.
alter table private.partner_review_campaign_submissions
  add column review_id uuid references app.reviews(id) on delete restrict,
  alter column wp_review_id drop not null,
  drop constraint partner_review_campaign_submissions_wp_review_id_key,
  add constraint partner_review_campaign_submission_has_review check (
    num_nonnulls(review_id, wp_review_id) >= 1
  );

create unique index partner_review_campaign_submissions_review_id_uidx
  on private.partner_review_campaign_submissions (review_id)
  where review_id is not null;
create unique index partner_review_campaign_submissions_wp_review_id_uidx
  on private.partner_review_campaign_submissions (wp_review_id)
  where wp_review_id is not null;

-- Preserve the legacy WordPress attribution RPC against the new partial index.
create or replace function private.record_partner_review_campaign_submission(
  p_token uuid,
  p_wp_shop_id bigint,
  p_wp_review_id bigint
)
returns boolean
language plpgsql
security invoker
set search_path = private, pg_temp
as $$
declare
  v_campaign_id uuid;
  v_submission_id uuid;
begin
  if p_wp_shop_id <= 0 or p_wp_review_id <= 0 then
    raise exception 'canonical shop and WordPress review identifiers must be positive';
  end if;
  select c.id into v_campaign_id
  from private.partner_review_campaigns c
  join private.partner_workspaces w on w.id = c.workspace_id
  where c.token = p_token and c.is_active and w.wp_shop_id = p_wp_shop_id
  for update of c;
  if v_campaign_id is null then
    return false;
  end if;
  insert into private.partner_review_campaign_submissions (campaign_id, wp_review_id)
  values (v_campaign_id, p_wp_review_id)
  on conflict (wp_review_id) where wp_review_id is not null do nothing
  returning id into v_submission_id;
  return v_submission_id is not null;
end;
$$;

create or replace function private.record_partner_review_campaign_review(
  p_token uuid,
  p_wp_shop_id bigint,
  p_review_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = private, app, pg_temp
as $$
declare
  v_campaign_id uuid;
  v_submission_id uuid;
begin
  if p_token is null or p_wp_shop_id is null or p_wp_shop_id <= 0 or p_review_id is null then
    raise exception using errcode = '22023', message = 'campaign token, canonical shop, and Review UUID are required';
  end if;

  select c.id into v_campaign_id
  from private.partner_review_campaigns c
  join private.partner_workspaces w on w.id = c.workspace_id
  join app.shops s on s.wp_post_id = w.wp_shop_id
  join app.reviews r on r.shop_id = s.id and r.id = p_review_id
  where c.token = p_token
    and c.is_active
    and w.wp_shop_id = p_wp_shop_id
  for update of c;

  if v_campaign_id is null then
    return false;
  end if;

  insert into private.partner_review_campaign_submissions (campaign_id, review_id)
  values (v_campaign_id, p_review_id)
  on conflict (review_id) where review_id is not null do nothing
  returning id into v_submission_id;
  return v_submission_id is not null;
end;
$$;

create or replace function private.submit_review(
  p_wp_shop_id bigint,
  p_body text,
  p_rating smallint,
  p_nickname text,
  p_source_url text,
  p_idempotency_key_hash text,
  p_abuse_key_hash text,
  p_abuse_window_started_at timestamptz,
  p_abuse_window_expires_at timestamptz,
  p_rating_price smallint default null,
  p_rating_service smallint default null,
  p_rating_cleanliness smallint default null,
  p_visit_period text default null,
  p_revisit_intent text default null,
  p_email text default null,
  p_campaign_token uuid default null
)
returns table (review_id uuid, created boolean)
language plpgsql
security invoker
set search_path = private, app, pg_temp
as $$
declare
  v_shop_id uuid;
  v_review_id uuid;
  v_existing_shop_id uuid;
  v_recorded boolean;
begin
  if p_wp_shop_id is null or p_wp_shop_id <= 0 then
    raise exception using errcode = '22023', message = 'canonical WordPress shop identifier must be positive';
  end if;
  if p_body is null or char_length(btrim(p_body)) not between 30 and 1000 then
    raise exception using errcode = '22023', message = 'Review body length is invalid';
  end if;
  if p_nickname is null or char_length(btrim(p_nickname)) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'Review nickname length is invalid';
  end if;
  if p_source_url is null or btrim(p_source_url) = '' then
    raise exception using errcode = '22023', message = 'server-derived Review source URL is required';
  end if;
  if p_idempotency_key_hash is null or p_idempotency_key_hash !~ '^[0-9a-f]{64}$'
    or p_abuse_key_hash is null or p_abuse_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Review digests must be lowercase SHA-256 hex';
  end if;
  if p_abuse_window_started_at is null or p_abuse_window_expires_at is null
    or p_abuse_window_expires_at <= p_abuse_window_started_at
    or p_abuse_window_expires_at <= now() then
    raise exception using errcode = '22023', message = 'Review abuse window is invalid';
  end if;

  select s.id into v_shop_id
  from app.shops s
  where s.wp_post_id = p_wp_shop_id;
  if v_shop_id is null then
    raise exception using errcode = '22023', message = 'canonical WordPress shop is not mirrored in app.shops';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key_hash, 0));
  select k.review_id, r.shop_id into v_review_id, v_existing_shop_id
  from private.review_idempotency_keys k
  join app.reviews r on r.id = k.review_id
  where k.key_hash = p_idempotency_key_hash;
  if v_review_id is not null then
    if v_existing_shop_id <> v_shop_id then
      raise exception using errcode = '22023', message = 'idempotency key is already bound to another shop';
    end if;
    return query select v_review_id, false;
    return;
  end if;

  insert into app.reviews (
    shop_id, body, rating, rating_price, rating_service, rating_cleanliness,
    visit_period, revisit_intent
  ) values (
    v_shop_id, btrim(p_body), p_rating, p_rating_price, p_rating_service,
    p_rating_cleanliness, nullif(btrim(p_visit_period), ''),
    nullif(btrim(p_revisit_intent), '')
  ) returning id into v_review_id;

  insert into private.review_submission_details (review_id, nickname, email, source_url)
  values (v_review_id, btrim(p_nickname), nullif(btrim(p_email), ''), btrim(p_source_url));

  insert into private.review_idempotency_keys (key_hash, review_id, expires_at)
  values (p_idempotency_key_hash, v_review_id, p_abuse_window_expires_at);

  insert into private.review_abuse_rate_limits (
    key_hash, window_started_at, window_expires_at
  ) values (
    p_abuse_key_hash, p_abuse_window_started_at, p_abuse_window_expires_at
  )
  on conflict (key_hash, window_started_at) do update
  set request_count = private.review_abuse_rate_limits.request_count + 1,
      window_expires_at = excluded.window_expires_at,
      updated_at = now();

  if p_campaign_token is not null then
    select private.record_partner_review_campaign_review(
      p_campaign_token, p_wp_shop_id, v_review_id
    ) into v_recorded;
    if not v_recorded then
      raise exception using errcode = '22023', message = 'Review campaign is invalid for the canonical shop';
    end if;
  end if;

  return query select v_review_id, true;
end;
$$;

create or replace function private.moderate_review(
  p_review_id uuid,
  p_decision text,
  p_actor_label text,
  p_reason text
)
returns table (
  review_id uuid,
  moderation_status text,
  publication_status text,
  is_public boolean,
  reviewed_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz
)
language plpgsql
security invoker
set search_path = private, app, pg_temp
as $$
declare
  v_review app.reviews%rowtype;
  v_now timestamptz := now();
begin
  if p_decision is null or p_decision not in ('approved', 'rejected', 'spam') then
    raise exception using errcode = '22023', message = 'invalid Review moderation decision';
  end if;
  if p_actor_label is null or char_length(btrim(p_actor_label)) not between 1 and 120
    or p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then
    raise exception using errcode = '22023', message = 'Review moderation actor and reason are required';
  end if;

  select * into v_review
  from app.reviews r
  where r.id = p_review_id
  for update;
  if v_review.id is null then
    raise exception using errcode = '22023', message = 'Review not found';
  end if;
  if v_review.moderation_status <> 'pending' then
    raise exception using errcode = '22023', message = 'invalid Review moderation state transition';
  end if;

  if p_decision = 'approved' then
    update app.reviews
    set moderation_status = 'approved',
        publication_status = 'published',
        is_public = true,
        reviewed_at = v_now,
        approved_at = v_now,
        published_at = v_now,
        updated_at = v_now
    where id = p_review_id;
  else
    update app.reviews
    set moderation_status = p_decision,
        publication_status = 'archived',
        is_public = false,
        reviewed_at = v_now,
        approved_at = null,
        published_at = null,
        updated_at = v_now
    where id = p_review_id;
  end if;

  insert into private.review_moderation_events (
    review_id, from_state, to_state, actor_label, reason
  ) values (
    p_review_id, v_review.moderation_status, p_decision,
    btrim(p_actor_label), btrim(p_reason)
  );

  return query
  select r.id, r.moderation_status, r.publication_status, r.is_public,
         r.reviewed_at, r.approved_at, r.published_at
  from app.reviews r
  where r.id = p_review_id;
end;
$$;

create or replace function private.list_published_reviews(
  p_wp_shop_id bigint default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  review_id uuid,
  wp_shop_id bigint,
  body text,
  submitted_at timestamptz,
  published_at timestamptz,
  rating_total smallint,
  rating_price smallint,
  rating_service smallint,
  rating_cleanliness smallint,
  visit_period text,
  revisit_intent text
)
language plpgsql
stable
security invoker
set search_path = private, app, pg_temp
as $$
begin
  if p_wp_shop_id is not null and p_wp_shop_id <= 0 then
    raise exception using errcode = '22023', message = 'canonical WordPress shop identifier must be positive';
  end if;
  if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset < 0 then
    raise exception using errcode = '22023', message = 'published Review pagination is invalid';
  end if;

  return query
  select
    r.id,
    s.wp_post_id,
    r.body,
    r.submitted_at,
    r.published_at,
    r.rating,
    r.rating_price,
    r.rating_service,
    r.rating_cleanliness,
    r.visit_period,
    r.revisit_intent
  from app.reviews r
  join app.shops s on s.id = r.shop_id
  where (p_wp_shop_id is null or s.wp_post_id = p_wp_shop_id)
    and r.is_public
    and r.source_type = 'user-review'
    and r.moderation_status = 'approved'
    and r.publication_status = 'published'
    and not r.is_ai_generated
    and not r.is_promotion
    and r.reviewed_at is not null
    and r.approved_at is not null
    and r.published_at is not null
  order by r.submitted_at desc, r.id desc
  limit p_limit offset p_offset;
end;
$$;

create or replace function private.get_published_review_metrics(p_wp_shop_id bigint default null)
returns table (
  public_approved_review_count bigint,
  valid_overall_rating_count bigint,
  average_overall_rating numeric,
  valid_price_rating_count bigint,
  average_price_rating numeric,
  valid_service_rating_count bigint,
  average_service_rating numeric,
  valid_cleanliness_rating_count bigint,
  average_cleanliness_rating numeric
)
language plpgsql
stable
security invoker
set search_path = private, app, pg_temp
as $$
begin
  if p_wp_shop_id is not null and p_wp_shop_id <= 0 then
    raise exception using errcode = '22023', message = 'canonical WordPress shop identifier must be positive';
  end if;

  return query
  select
    count(*),
    count(r.rating),
    round(avg(r.rating)::numeric, 1),
    count(r.rating_price),
    round(avg(r.rating_price)::numeric, 1),
    count(r.rating_service),
    round(avg(r.rating_service)::numeric, 1),
    count(r.rating_cleanliness),
    round(avg(r.rating_cleanliness)::numeric, 1)
  from app.reviews r
  join app.shops s on s.id = r.shop_id
  where (p_wp_shop_id is null or s.wp_post_id = p_wp_shop_id)
    and r.is_public
    and r.source_type = 'user-review'
    and r.moderation_status = 'approved'
    and r.publication_status = 'published'
    and not r.is_ai_generated
    and not r.is_promotion
    and r.reviewed_at is not null
    and r.approved_at is not null
    and r.published_at is not null;
end;
$$;

revoke all on function private.record_partner_review_campaign_review(uuid, bigint, uuid) from public, anon, authenticated;
revoke all on function private.submit_review(bigint, text, smallint, text, text, text, text, timestamptz, timestamptz, smallint, smallint, smallint, text, text, text, uuid) from public, anon, authenticated;
revoke all on function private.moderate_review(uuid, text, text, text) from public, anon, authenticated;
revoke all on function private.list_published_reviews(bigint, integer, integer) from public, anon, authenticated;
revoke all on function private.get_published_review_metrics(bigint) from public, anon, authenticated;
grant execute on function private.record_partner_review_campaign_review(uuid, bigint, uuid) to service_role;
grant execute on function private.submit_review(bigint, text, smallint, text, text, text, text, timestamptz, timestamptz, smallint, smallint, smallint, text, text, text, uuid) to service_role;
grant execute on function private.moderate_review(uuid, text, text, text) to service_role;
grant execute on function private.list_published_reviews(bigint, integer, integer) to service_role;
grant execute on function private.get_published_review_metrics(bigint) to service_role;

create or replace function api.record_partner_review_campaign_review(
  p_token uuid,
  p_wp_shop_id bigint,
  p_review_id uuid
)
returns boolean
language sql
security invoker
set search_path = private, api, pg_temp
as $$
  select private.record_partner_review_campaign_review(p_token, p_wp_shop_id, p_review_id)
$$;

create or replace function api.submit_review(
  p_wp_shop_id bigint,
  p_body text,
  p_rating smallint,
  p_nickname text,
  p_source_url text,
  p_idempotency_key_hash text,
  p_abuse_key_hash text,
  p_abuse_window_started_at timestamptz,
  p_abuse_window_expires_at timestamptz,
  p_rating_price smallint default null,
  p_rating_service smallint default null,
  p_rating_cleanliness smallint default null,
  p_visit_period text default null,
  p_revisit_intent text default null,
  p_email text default null,
  p_campaign_token uuid default null
)
returns table (review_id uuid, created boolean)
language sql
security invoker
set search_path = private, api, pg_temp
as $$
  select * from private.submit_review(
    p_wp_shop_id, p_body, p_rating, p_nickname, p_source_url,
    p_idempotency_key_hash, p_abuse_key_hash,
    p_abuse_window_started_at, p_abuse_window_expires_at,
    p_rating_price, p_rating_service, p_rating_cleanliness,
    p_visit_period, p_revisit_intent, p_email, p_campaign_token
  )
$$;

create or replace function api.moderate_review(
  p_review_id uuid,
  p_decision text,
  p_actor_label text,
  p_reason text
)
returns table (
  review_id uuid,
  moderation_status text,
  publication_status text,
  is_public boolean,
  reviewed_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz
)
language sql
security invoker
set search_path = private, api, pg_temp
as $$
  select * from private.moderate_review(p_review_id, p_decision, p_actor_label, p_reason)
$$;

create or replace function api.list_published_reviews(
  p_wp_shop_id bigint default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  review_id uuid,
  wp_shop_id bigint,
  body text,
  submitted_at timestamptz,
  published_at timestamptz,
  rating_total smallint,
  rating_price smallint,
  rating_service smallint,
  rating_cleanliness smallint,
  visit_period text,
  revisit_intent text
)
language sql
stable
security invoker
set search_path = private, api, pg_temp
as $$
  select * from private.list_published_reviews(p_wp_shop_id, p_limit, p_offset)
$$;

create or replace function api.get_published_review_metrics(p_wp_shop_id bigint default null)
returns table (
  public_approved_review_count bigint,
  valid_overall_rating_count bigint,
  average_overall_rating numeric,
  valid_price_rating_count bigint,
  average_price_rating numeric,
  valid_service_rating_count bigint,
  average_service_rating numeric,
  valid_cleanliness_rating_count bigint,
  average_cleanliness_rating numeric
)
language sql
stable
security invoker
set search_path = private, api, pg_temp
as $$
  select * from private.get_published_review_metrics(p_wp_shop_id)
$$;

revoke all on function api.record_partner_review_campaign_review(uuid, bigint, uuid) from public, anon, authenticated;
revoke all on function api.submit_review(bigint, text, smallint, text, text, text, text, timestamptz, timestamptz, smallint, smallint, smallint, text, text, text, uuid) from public, anon, authenticated;
revoke all on function api.moderate_review(uuid, text, text, text) from public, anon, authenticated;
revoke all on function api.list_published_reviews(bigint, integer, integer) from public, anon, authenticated;
revoke all on function api.get_published_review_metrics(bigint) from public, anon, authenticated;
grant execute on function api.record_partner_review_campaign_review(uuid, bigint, uuid) to service_role;
grant execute on function api.submit_review(bigint, text, smallint, text, text, text, text, timestamptz, timestamptz, smallint, smallint, smallint, text, text, text, uuid) to service_role;
grant execute on function api.moderate_review(uuid, text, text, text) to service_role;
grant execute on function api.list_published_reviews(bigint, integer, integer) to service_role;
grant execute on function api.get_published_review_metrics(bigint) to service_role;
