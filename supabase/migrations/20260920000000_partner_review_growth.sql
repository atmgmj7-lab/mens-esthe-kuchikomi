-- Private review and campaign extension for the Free Official Partner foundation.
-- It intentionally adds no public table, public route, or WordPress write path.
create type private.partner_review_campaign_channel as enum (
  'counter_qr',
  'line_after_visit',
  'shop_website',
  'eskomi_shop_page'
);

revoke all on type private.partner_review_campaign_channel from public, anon, authenticated;
grant usage on type private.partner_review_campaign_channel to service_role;

alter table private.partner_registration_submissions
  add column reviewed_at timestamptz,
  add column reviewed_by text check (reviewed_by is null or char_length(reviewed_by) between 1 and 120),
  add column review_reason text check (review_reason is null or char_length(review_reason) between 1 and 1000);

create table private.partner_review_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references private.partner_workspaces(id) on delete restrict,
  channel private.partner_review_campaign_channel not null,
  token uuid not null unique default gen_random_uuid(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  deactivated_at timestamptz,
  unique (workspace_id, channel),
  check ((is_active and deactivated_at is null) or (not is_active and deactivated_at is not null))
);

create table private.partner_review_campaign_submissions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references private.partner_review_campaigns(id) on delete restrict,
  wp_review_id bigint not null check (wp_review_id > 0),
  created_at timestamptz not null default now(),
  unique (wp_review_id)
);

alter table private.partner_review_campaigns enable row level security;
alter table private.partner_review_campaign_submissions enable row level security;

revoke all on table private.partner_review_campaigns from public, anon, authenticated;
revoke all on table private.partner_review_campaign_submissions from public, anon, authenticated;
grant select, insert, update, delete on table private.partner_review_campaigns to service_role;
grant select, insert on table private.partner_review_campaign_submissions to service_role;

create or replace function private.review_partner_registration(
  p_submission_id uuid,
  p_decision text,
  p_actor_label text,
  p_reason text
)
returns table (state text, status text)
language plpgsql
security invoker
set search_path = private, pg_temp
as $$
declare
  v_submission private.partner_registration_submissions%rowtype;
  v_workspace private.partner_workspaces%rowtype;
  v_next_state private.partner_workspace_state;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid partner registration decision';
  end if;
  if p_actor_label is null or char_length(btrim(p_actor_label)) not between 1 and 120
    or p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'partner registration review actor and reason are required';
  end if;

  select * into v_submission
  from private.partner_registration_submissions
  where id = p_submission_id
  for update;
  if v_submission.id is null then
    raise exception 'partner registration submission not found';
  end if;

  select * into v_workspace
  from private.partner_workspaces
  where id = v_submission.workspace_id
  for update;
  if v_workspace.id is null then
    raise exception 'partner workspace not found';
  end if;

  if v_submission.status = p_decision then
    return query select v_workspace.state::text, v_submission.status;
    return;
  end if;
  if v_submission.status not in ('received', 'under_review') then
    raise exception 'partner registration submission has already been reviewed';
  end if;

  if p_decision = 'rejected' then
    update private.partner_registration_submissions
    set status = 'rejected',
        reviewed_at = now(),
        reviewed_by = btrim(p_actor_label),
        review_reason = btrim(p_reason)
    where id = v_submission.id;
    return query select v_workspace.state::text, 'rejected'::text;
    return;
  end if;

  if v_workspace.state <> 'shop_confirmed' then
    raise exception 'approved partner registration requires a shop_confirmed workspace';
  end if;
  v_next_state := 'free_official_partner';

  update private.partner_registration_submissions
  set status = 'approved',
      reviewed_at = now(),
      reviewed_by = btrim(p_actor_label),
      review_reason = btrim(p_reason)
  where id = v_submission.id;

  perform private.set_partner_workspace_state(
    v_workspace.id, v_next_state, btrim(p_actor_label), btrim(p_reason), 'operator'
  );

  insert into private.partner_review_campaigns (workspace_id, channel)
  select v_workspace.id, channel
  from unnest(enum_range(null::private.partner_review_campaign_channel)) as channel
  on conflict (workspace_id, channel) do nothing;

  return query select v_next_state::text, 'approved'::text;
end;
$$;

create or replace function private.open_partner_review_campaign(p_token uuid)
returns table (
  wp_shop_id bigint,
  shop_slug text,
  shop_name text,
  canonical_url text
)
language sql
security invoker
set search_path = private, pg_temp
as $$
  select w.wp_shop_id, w.shop_slug, w.shop_name, w.canonical_url
  from private.partner_review_campaigns c
  join private.partner_workspaces w on w.id = c.workspace_id
  where c.token = p_token and c.is_active
$$;

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
  on conflict (wp_review_id) do nothing;
  return found;
end;
$$;

revoke all on function private.review_partner_registration(uuid, text, text, text) from public, anon, authenticated;
revoke all on function private.open_partner_review_campaign(uuid) from public, anon, authenticated;
revoke all on function private.record_partner_review_campaign_submission(uuid, bigint, bigint) from public, anon, authenticated;
grant execute on function private.review_partner_registration(uuid, text, text, text) to service_role;
grant execute on function private.open_partner_review_campaign(uuid) to service_role;
grant execute on function private.record_partner_review_campaign_submission(uuid, bigint, bigint) to service_role;

create or replace function api.review_partner_registration(
  p_submission_id uuid,
  p_decision text,
  p_actor_label text,
  p_reason text
)
returns table (state text, status text)
language sql
security invoker
set search_path = private, api, pg_temp
as $$
  select * from private.review_partner_registration(p_submission_id, p_decision, p_actor_label, p_reason)
$$;

create or replace function api.list_partner_registration_reviews()
returns table (
  submission_id uuid,
  workspace_id uuid,
  status text,
  contact_name text,
  contact_role text,
  contact_email text,
  confirmation_details text,
  source_url text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  review_reason text,
  workspace_state text,
  wp_shop_id bigint,
  shop_slug text,
  shop_name text,
  canonical_url text,
  campaigns jsonb
)
language sql
security invoker
set search_path = private, api, pg_temp
as $$
  select
    s.id,
    s.workspace_id,
    s.status,
    s.contact_name,
    s.contact_role,
    s.contact_email,
    s.confirmation_details,
    s.source_url,
    s.created_at,
    s.reviewed_at,
    s.reviewed_by,
    s.review_reason,
    w.state::text,
    w.wp_shop_id,
    w.shop_slug,
    w.shop_name,
    w.canonical_url,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'channel', c.channel::text,
          'token', c.token,
          'isActive', c.is_active,
          'createdAt', c.created_at
        ) order by c.channel
      ) filter (where c.id is not null),
      '[]'::jsonb
    )
  from private.partner_registration_submissions s
  join private.partner_workspaces w on w.id = s.workspace_id
  left join private.partner_review_campaigns c on c.workspace_id = w.id
  group by s.id, w.id
  order by s.created_at desc
$$;

create or replace function api.open_partner_review_campaign(p_token uuid)
returns table (
  wp_shop_id bigint,
  shop_slug text,
  shop_name text,
  canonical_url text
)
language sql
security invoker
set search_path = private, api, pg_temp
as $$
  select * from private.open_partner_review_campaign(p_token)
$$;

create or replace function api.record_partner_review_campaign_submission(
  p_token uuid,
  p_wp_shop_id bigint,
  p_wp_review_id bigint
)
returns boolean
language sql
security invoker
set search_path = private, api, pg_temp
as $$
  select private.record_partner_review_campaign_submission(p_token, p_wp_shop_id, p_wp_review_id)
$$;

revoke all on function api.review_partner_registration(uuid, text, text, text) from public, anon, authenticated;
revoke all on function api.list_partner_registration_reviews() from public, anon, authenticated;
revoke all on function api.open_partner_review_campaign(uuid) from public, anon, authenticated;
revoke all on function api.record_partner_review_campaign_submission(uuid, bigint, bigint) from public, anon, authenticated;
grant execute on function api.review_partner_registration(uuid, text, text, text) to service_role;
grant execute on function api.list_partner_registration_reviews() to service_role;
grant execute on function api.open_partner_review_campaign(uuid) to service_role;
grant execute on function api.record_partner_review_campaign_submission(uuid, bigint, bigint) to service_role;
