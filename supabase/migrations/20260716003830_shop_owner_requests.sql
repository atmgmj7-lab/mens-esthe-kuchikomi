create table api.shop_owner_requests (
  id uuid primary key default gen_random_uuid(),
  wp_shop_id bigint not null check (wp_shop_id > 0),
  shop_slug text not null check (
    char_length(shop_slug) between 1 and 200
    and shop_slug ~ '^([a-z0-9-]|%[0-9a-f]{2})+$'
  ),
  shop_name text not null check (char_length(shop_name) between 1 and 120),
  target_url text not null check (
    char_length(target_url) between 1 and 500
    and target_url = 'https://mens-esthe-kuchikomi.com/shops/' || shop_slug || '/'
  ),
  source_url text not null check (char_length(source_url) between 1 and 2048),
  requester_name text not null check (char_length(requester_name) between 1 and 80),
  requester_role text not null check (requester_role in ('owner', 'manager', 'staff', 'authorized-agency')),
  requester_email text not null check (char_length(requester_email) between 3 and 254),
  requested_fields text[] not null check (cardinality(requested_fields) between 1 and 8),
  change_details text not null check (char_length(change_details) between 1 and 5000),
  evidence_url text check (evidence_url is null or char_length(evidence_url) <= 500),
  official_image_url text check (official_image_url is null or char_length(official_image_url) <= 500),
  consent_privacy boolean not null check (consent_privacy),
  consent_accuracy boolean not null check (consent_accuracy),
  consent_image_rights boolean not null check (consent_image_rights),
  status text not null default 'received' check (status in ('received', 'reviewing', 'approved-candidate', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_note text
);

comment on table api.shop_owner_requests is
  'Server-only owner submissions. Never joined into public shop views automatically.';

create index shop_owner_requests_status_created_idx
  on api.shop_owner_requests (status, created_at desc);
create index shop_owner_requests_wp_shop_created_idx
  on api.shop_owner_requests (wp_shop_id, created_at desc);

alter table api.shop_owner_requests enable row level security;

revoke all on table api.shop_owner_requests from public;
revoke all on table api.shop_owner_requests from anon, authenticated;
grant select, insert, update, delete on table api.shop_owner_requests to service_role;

create table api.shop_owner_request_rate_limits (
  request_key text not null check (request_key ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (request_key, window_started_at)
);

comment on table api.shop_owner_request_rate_limits is
  'Server-only distributed throttle. Keys are HMAC digests and never contain raw IP or email values.';

alter table api.shop_owner_request_rate_limits enable row level security;

revoke all on table api.shop_owner_request_rate_limits from public;
revoke all on table api.shop_owner_request_rate_limits from anon, authenticated;
grant select, insert, update, delete on table api.shop_owner_request_rate_limits to service_role;

create or replace function api.claim_shop_owner_request_rate_limit(p_request_key text)
returns boolean
language plpgsql
security definer
set search_path = api, pg_temp
as $$
declare
  v_window_started_at timestamptz := to_timestamp(
    floor(extract(epoch from statement_timestamp()) / 600) * 600
  );
  v_request_count integer;
begin
  if p_request_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid request key' using errcode = '22023';
  end if;

  insert into api.shop_owner_request_rate_limits (
    request_key,
    window_started_at,
    request_count,
    updated_at
  ) values (
    p_request_key,
    v_window_started_at,
    1,
    statement_timestamp()
  )
  on conflict (request_key, window_started_at) do update
    set request_count = api.shop_owner_request_rate_limits.request_count + 1,
        updated_at = statement_timestamp()
    where api.shop_owner_request_rate_limits.request_count < 5
  returning request_count into v_request_count;

  return v_request_count is not null;
end;
$$;

revoke all on function api.claim_shop_owner_request_rate_limit(text) from public;
revoke all on function api.claim_shop_owner_request_rate_limit(text) from anon, authenticated;
grant execute on function api.claim_shop_owner_request_rate_limit(text) to service_role;
