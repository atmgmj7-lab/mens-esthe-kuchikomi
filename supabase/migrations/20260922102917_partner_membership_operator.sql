-- P1 Rank UP server-only membership grant. The API wrapper remains callable
-- exclusively by service_role; it is not a browser or Partner-facing surface.
create or replace function private.grant_partner_membership(
  p_workspace_id uuid,
  p_auth_user_id uuid,
  p_wp_shop_id bigint,
  p_shop_slug text,
  p_canonical_url text,
  p_role text
)
returns table (
  workspace_id uuid,
  auth_user_id uuid,
  wp_shop_id bigint,
  role text,
  status text,
  result text
)
language plpgsql
security invoker
set search_path = private, pg_temp
as $$
declare
  v_workspace private.partner_workspaces%rowtype;
  v_membership private.partner_memberships%rowtype;
begin
  if p_role not in ('owner', 'manager') then
    raise exception 'invalid partner membership role' using errcode = '22023';
  end if;

  select * into v_workspace
  from private.partner_workspaces
  where id = p_workspace_id
  for update;

  if not found
    or v_workspace.wp_shop_id <> p_wp_shop_id
    or v_workspace.shop_slug <> p_shop_slug
    or v_workspace.canonical_url <> p_canonical_url then
    raise exception 'partner workspace canonical identity mismatch' using errcode = 'P0001';
  end if;

  select m.* into v_membership
  from private.partner_memberships m
  where m.auth_user_id = p_auth_user_id
  for update;

  if found then
    if v_membership.workspace_id <> p_workspace_id
      or v_membership.role::text <> p_role
      or v_membership.status <> 'active' then
      raise exception 'partner membership conflicts with existing binding' using errcode = 'P0001';
    end if;

    return query
      select v_membership.workspace_id, v_membership.auth_user_id, v_workspace.wp_shop_id,
        v_membership.role::text, v_membership.status::text, 'already_present'::text;
    return;
  end if;

  insert into private.partner_memberships (
    workspace_id,
    auth_user_id,
    role,
    status,
    accepted_at
  ) values (
    p_workspace_id,
    p_auth_user_id,
    p_role::private.partner_membership_role,
    'active',
    now()
  )
  returning * into v_membership;

  return query
    select v_membership.workspace_id, v_membership.auth_user_id, v_workspace.wp_shop_id,
      v_membership.role::text, v_membership.status::text, 'created'::text;
end;
$$;

revoke all on function private.grant_partner_membership(uuid, uuid, bigint, text, text, text) from public, anon, authenticated;
grant execute on function private.grant_partner_membership(uuid, uuid, bigint, text, text, text) to service_role;

create or replace function api.grant_partner_membership(
  p_workspace_id uuid,
  p_auth_user_id uuid,
  p_wp_shop_id bigint,
  p_shop_slug text,
  p_canonical_url text,
  p_role text
)
returns table (
  workspace_id uuid,
  auth_user_id uuid,
  wp_shop_id bigint,
  role text,
  status text,
  result text
)
language sql
security invoker
set search_path = private, api, pg_temp
as $$
  select * from private.grant_partner_membership(
    p_workspace_id,
    p_auth_user_id,
    p_wp_shop_id,
    p_shop_slug,
    p_canonical_url,
    p_role
  )
$$;

revoke all on function api.grant_partner_membership(uuid, uuid, bigint, text, text, text) from public, anon, authenticated;
grant execute on function api.grant_partner_membership(uuid, uuid, bigint, text, text, text) to service_role;
