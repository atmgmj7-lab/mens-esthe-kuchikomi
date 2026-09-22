-- Partner login-email management is intentionally separate from Auth and
-- memberships. These rows are private operational intent/audit records only;
-- the authenticated Partner remains the only actor that can ask GoTrue to
-- change their own Auth email.
create type private.partner_login_email_intent_kind as enum (
  'operator_initial',
  'operator_change_requested',
  'partner_change_requested'
);

create table private.partner_login_email_intents (
  workspace_id uuid primary key references private.partner_workspaces(id) on delete restrict,
  email text not null check (char_length(email) between 3 and 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  intent private.partner_login_email_intent_kind not null,
  updated_at timestamptz not null default now()
);

create table private.partner_login_email_audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references private.partner_workspaces(id) on delete restrict,
  wp_shop_id bigint not null check (wp_shop_id > 0),
  action private.partner_login_email_intent_kind not null,
  actor_kind text not null check (actor_kind in ('operator', 'partner')),
  result text not null check (result in ('recorded')),
  created_at timestamptz not null default now()
);

create index partner_login_email_audit_events_workspace_created_at_idx
  on private.partner_login_email_audit_events (workspace_id, created_at desc);

alter table private.partner_login_email_intents enable row level security;
alter table private.partner_login_email_audit_events enable row level security;
revoke all on table private.partner_login_email_intents from public, anon, authenticated;
revoke all on table private.partner_login_email_audit_events from public, anon, authenticated;
grant select, insert, update on table private.partner_login_email_intents to service_role;
grant select, insert on table private.partner_login_email_audit_events to service_role;

create or replace function private.operator_partner_login_email_management(
  p_wp_shop_id bigint,
  p_shop_slug text,
  p_canonical_url text
)
returns table (
  status text,
  workspace_id uuid,
  auth_user_id uuid,
  email text,
  intent text,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = private, pg_temp
as $$
declare
  v_workspace private.partner_workspaces%rowtype;
  v_membership private.partner_memberships%rowtype;
  v_intent private.partner_login_email_intents%rowtype;
  v_membership_count integer;
begin
  select * into v_workspace
  from private.partner_workspaces
  where wp_shop_id = p_wp_shop_id
    and shop_slug = p_shop_slug
    and canonical_url = p_canonical_url;

  if not found then
    return query select 'identity_mismatch'::text, null::uuid, null::uuid, null::text, null::text, null::timestamptz;
    return;
  end if;

  select count(*) into v_membership_count
  from private.partner_memberships m
  where m.workspace_id = v_workspace.id
    and m.status = 'active';
  if v_membership_count > 1 then
    return query select 'unavailable'::text, v_workspace.id, null::uuid, null::text, null::text, null::timestamptz;
    return;
  end if;

  select m.* into v_membership
  from private.partner_memberships m
  where m.workspace_id = v_workspace.id
    and m.status = 'active'
  order by m.created_at asc
  limit 1;

  select e.* into v_intent
  from private.partner_login_email_intents e
  where e.workspace_id = v_workspace.id;

  if not found then
    return query select 'not_set'::text, v_workspace.id, coalesce(v_membership.auth_user_id, null::uuid), null::text, null::text, null::timestamptz;
    return;
  end if;

  return query select 'available'::text, v_workspace.id, coalesce(v_membership.auth_user_id, null::uuid), v_intent.email, v_intent.intent::text, v_intent.updated_at;
end;
$$;

create or replace function private.set_operator_partner_login_email_intent(
  p_wp_shop_id bigint,
  p_shop_slug text,
  p_canonical_url text,
  p_email text,
  p_intent text
)
returns table (
  status text,
  workspace_id uuid,
  auth_user_id uuid,
  email text,
  intent text,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = private, pg_temp
as $$
declare
  v_workspace private.partner_workspaces%rowtype;
  v_membership private.partner_memberships%rowtype;
  v_membership_count integer;
  v_normalized_email text := lower(btrim(p_email));
  v_intent private.partner_login_email_intent_kind;
  v_saved private.partner_login_email_intents%rowtype;
begin
  if p_intent not in ('operator_initial', 'operator_change_requested') then
    raise exception 'invalid operator login email intent' using errcode = '22023';
  end if;
  v_intent := p_intent::private.partner_login_email_intent_kind;
  if char_length(v_normalized_email) not between 3 and 254
    or v_normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid login email' using errcode = '22023';
  end if;

  select * into v_workspace
  from private.partner_workspaces
  where wp_shop_id = p_wp_shop_id
    and shop_slug = p_shop_slug
    and canonical_url = p_canonical_url
  for update;
  if not found then
    raise exception 'partner workspace canonical identity mismatch' using errcode = 'P0001';
  end if;

  select count(*) into v_membership_count
  from private.partner_memberships m
  where m.workspace_id = v_workspace.id and m.status = 'active';
  if v_membership_count > 1 then
    raise exception 'multiple active memberships require a dedicated operator flow' using errcode = 'P0001';
  end if;

  select m.* into v_membership
  from private.partner_memberships m
  where m.workspace_id = v_workspace.id and m.status = 'active'
  order by m.created_at asc
  limit 1;
  if (p_intent = 'operator_initial' and v_membership_count <> 0) or (p_intent = 'operator_change_requested' and v_membership_count <> 1) then
    raise exception 'login email intent does not match membership state' using errcode = 'P0001';
  end if;

  insert into private.partner_login_email_intents (workspace_id, email, intent, updated_at)
  values (v_workspace.id, v_normalized_email, v_intent, now())
  on conflict on constraint partner_login_email_intents_pkey do update set email = excluded.email, intent = excluded.intent, updated_at = excluded.updated_at
  returning * into v_saved;

  insert into private.partner_login_email_audit_events (workspace_id, wp_shop_id, action, actor_kind, result)
  values (v_workspace.id, v_workspace.wp_shop_id, v_intent, 'operator', 'recorded');

  return query select 'available'::text, v_workspace.id, coalesce(v_membership.auth_user_id, null::uuid), v_saved.email, v_saved.intent::text, v_saved.updated_at;
end;
$$;

create or replace function private.get_partner_login_email_management(
  p_workspace_id uuid,
  p_auth_user_id uuid
)
returns table (
  status text,
  workspace_id uuid,
  auth_user_id uuid,
  email text,
  intent text,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = private, pg_temp
as $$
declare
  v_intent private.partner_login_email_intents%rowtype;
begin
  if not exists (
    select 1 from private.partner_memberships m
    join private.partner_workspaces w on w.id = m.workspace_id
    where m.workspace_id = p_workspace_id
      and m.auth_user_id = p_auth_user_id
      and m.status = 'active'
      and w.state in ('free_official_partner', 'active_partner')
  ) then
    return query select 'forbidden'::text, null::uuid, null::uuid, null::text, null::text, null::timestamptz;
    return;
  end if;

  select e.* into v_intent from private.partner_login_email_intents e where e.workspace_id = p_workspace_id;
  if not found then
    return query select 'not_set'::text, p_workspace_id, p_auth_user_id, null::text, null::text, null::timestamptz;
    return;
  end if;
  return query select 'available'::text, p_workspace_id, p_auth_user_id, v_intent.email, v_intent.intent::text, v_intent.updated_at;
end;
$$;

create or replace function private.record_partner_login_email_change_request(
  p_workspace_id uuid,
  p_auth_user_id uuid,
  p_email text
)
returns table (
  status text,
  workspace_id uuid,
  auth_user_id uuid,
  email text,
  intent text,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = private, pg_temp
as $$
declare
  v_normalized_email text := lower(btrim(p_email));
  v_saved private.partner_login_email_intents%rowtype;
  v_wp_shop_id bigint;
begin
  if char_length(v_normalized_email) not between 3 and 254
    or v_normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid login email' using errcode = '22023';
  end if;
  select w.wp_shop_id into v_wp_shop_id
    from private.partner_memberships m
    join private.partner_workspaces w on w.id = m.workspace_id
    where m.workspace_id = p_workspace_id
      and m.auth_user_id = p_auth_user_id
      and m.status = 'active'
      and w.state in ('free_official_partner', 'active_partner')
    limit 1;
  if v_wp_shop_id is null then
    raise exception 'active partner membership is required' using errcode = 'P0001';
  end if;

  insert into private.partner_login_email_intents (workspace_id, email, intent, updated_at)
  values (p_workspace_id, v_normalized_email, 'partner_change_requested', now())
  on conflict on constraint partner_login_email_intents_pkey do update set email = excluded.email, intent = excluded.intent, updated_at = excluded.updated_at
  returning * into v_saved;
  insert into private.partner_login_email_audit_events (workspace_id, wp_shop_id, action, actor_kind, result)
  values (p_workspace_id, v_wp_shop_id, 'partner_change_requested', 'partner', 'recorded');
  return query select 'available'::text, p_workspace_id, p_auth_user_id, v_saved.email, v_saved.intent::text, v_saved.updated_at;
end;
$$;

create or replace function api.get_operator_partner_login_email_management(p_wp_shop_id bigint, p_shop_slug text, p_canonical_url text)
returns table (status text, workspace_id uuid, auth_user_id uuid, email text, intent text, updated_at timestamptz)
language sql security invoker set search_path = private, api, pg_temp
as $$ select * from private.operator_partner_login_email_management(p_wp_shop_id, p_shop_slug, p_canonical_url) $$;

create or replace function api.set_operator_partner_login_email_intent(p_wp_shop_id bigint, p_shop_slug text, p_canonical_url text, p_email text, p_intent text)
returns table (status text, workspace_id uuid, auth_user_id uuid, email text, intent text, updated_at timestamptz)
language sql security invoker set search_path = private, api, pg_temp
as $$ select * from private.set_operator_partner_login_email_intent(p_wp_shop_id, p_shop_slug, p_canonical_url, p_email, p_intent) $$;

create or replace function api.get_partner_login_email_management(p_workspace_id uuid, p_auth_user_id uuid)
returns table (status text, workspace_id uuid, auth_user_id uuid, email text, intent text, updated_at timestamptz)
language sql security invoker set search_path = private, api, pg_temp
as $$ select * from private.get_partner_login_email_management(p_workspace_id, p_auth_user_id) $$;

create or replace function api.record_partner_login_email_change_request(p_workspace_id uuid, p_auth_user_id uuid, p_email text)
returns table (status text, workspace_id uuid, auth_user_id uuid, email text, intent text, updated_at timestamptz)
language sql security invoker set search_path = private, api, pg_temp
as $$ select * from private.record_partner_login_email_change_request(p_workspace_id, p_auth_user_id, p_email) $$;

revoke all on function private.operator_partner_login_email_management(bigint, text, text) from public, anon, authenticated;
revoke all on function private.set_operator_partner_login_email_intent(bigint, text, text, text, text) from public, anon, authenticated;
revoke all on function private.get_partner_login_email_management(uuid, uuid) from public, anon, authenticated;
revoke all on function private.record_partner_login_email_change_request(uuid, uuid, text) from public, anon, authenticated;
revoke all on function api.get_operator_partner_login_email_management(bigint, text, text) from public, anon, authenticated;
revoke all on function api.set_operator_partner_login_email_intent(bigint, text, text, text, text) from public, anon, authenticated;
revoke all on function api.get_partner_login_email_management(uuid, uuid) from public, anon, authenticated;
revoke all on function api.record_partner_login_email_change_request(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.operator_partner_login_email_management(bigint, text, text) to service_role;
grant execute on function private.set_operator_partner_login_email_intent(bigint, text, text, text, text) to service_role;
grant execute on function private.get_partner_login_email_management(uuid, uuid) to service_role;
grant execute on function private.record_partner_login_email_change_request(uuid, uuid, text) to service_role;
grant execute on function api.get_operator_partner_login_email_management(bigint, text, text) to service_role;
grant execute on function api.set_operator_partner_login_email_intent(bigint, text, text, text, text) to service_role;
grant execute on function api.get_partner_login_email_management(uuid, uuid) to service_role;
grant execute on function api.record_partner_login_email_change_request(uuid, uuid, text) to service_role;
