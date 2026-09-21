-- Phase 3 Partner Auth / Membership. This remains a private, service-role-only
-- control-plane mapping; it grants no browser role access to private data.
create type private.partner_membership_role as enum ('owner', 'manager');
create type private.partner_membership_status as enum ('invited', 'active', 'revoked');

create table private.partner_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references private.partner_workspaces(id) on delete restrict,
  auth_user_id uuid not null unique,
  role private.partner_membership_role not null,
  status private.partner_membership_status not null default 'invited',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  check (
    (status = 'invited' and accepted_at is null and revoked_at is null)
    or (status = 'active' and accepted_at is not null and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  ),
  unique (workspace_id, auth_user_id)
);

alter table private.partner_memberships enable row level security;
revoke all on table private.partner_memberships from public, anon, authenticated;
grant select, insert, update, delete on table private.partner_memberships to service_role;

create or replace function private.get_partner_auth_membership(p_auth_user_id uuid)
returns table (
  workspace_id uuid,
  wp_shop_id bigint,
  shop_slug text,
  role text
)
language sql
security invoker
set search_path = private, pg_temp
as $$
  select m.workspace_id, w.wp_shop_id, w.shop_slug, m.role::text
  from private.partner_memberships m
  join private.partner_workspaces w on w.id = m.workspace_id
  where m.auth_user_id = p_auth_user_id
    and m.status = 'active'
    and w.state in ('free_official_partner', 'active_partner')
$$;

revoke all on function private.get_partner_auth_membership(uuid) from public, anon, authenticated;
grant execute on function private.get_partner_auth_membership(uuid) to service_role;

create or replace function api.get_partner_auth_membership(p_auth_user_id uuid)
returns table (
  workspace_id uuid,
  wp_shop_id bigint,
  shop_slug text,
  role text
)
language sql
security invoker
set search_path = private, api, pg_temp
as $$
  select * from private.get_partner_auth_membership(p_auth_user_id)
$$;

revoke all on function api.get_partner_auth_membership(uuid) from public, anon, authenticated;
grant execute on function api.get_partner_auth_membership(uuid) to service_role;
