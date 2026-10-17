-- Keep active, WordPress-only workspaces able to authenticate while their
-- reviewed app_shop_id mapping is pending. Canonical rows remain stricter:
-- they require both a published app shop and published managed projection.
create or replace function private.get_partner_compatible_auth_membership(p_auth_user_id uuid)
returns table(workspace_id uuid,identity_kind text,app_shop_id uuid,wp_shop_id bigint,shop_slug text,role text)
language sql security definer set search_path=private,app,pg_temp as $$
  select workspace.id,
    case when workspace.app_shop_id is null then 'legacy' else 'canonical' end,
    workspace.app_shop_id,workspace.wp_shop_id,workspace.shop_slug,membership.role::text
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  left join app.shops shop on shop.id=workspace.app_shop_id
  left join private.managed_shops managed on managed.app_shop_id=workspace.app_shop_id
  where membership.auth_user_id=p_auth_user_id
    and membership.status='active'
    and membership.role in ('owner','manager')
    and workspace.state in ('free_official_partner','active_partner')
    and (
      (workspace.app_shop_id is null and workspace.wp_shop_id is not null)
      or (workspace.app_shop_id is not null and shop.publication_status='published' and managed.publication_state='published')
    )
$$;

create or replace function private.get_partner_compatible_workspace_identity(
  p_workspace_id uuid,p_auth_user_id uuid
) returns table(workspace_id uuid,identity_kind text,app_shop_id uuid,wp_shop_id bigint,shop_slug text,shop_name text,canonical_url text,state text)
language sql security definer set search_path=private,app,pg_temp as $$
  select workspace.id,
    case when workspace.app_shop_id is null then 'legacy' else 'canonical' end,
    workspace.app_shop_id,workspace.wp_shop_id,workspace.shop_slug,workspace.shop_name,workspace.canonical_url,workspace.state::text
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  left join app.shops shop on shop.id=workspace.app_shop_id
  left join private.managed_shops managed on managed.app_shop_id=workspace.app_shop_id
  where workspace.id=p_workspace_id
    and membership.auth_user_id=p_auth_user_id
    and membership.status='active'
    and membership.role in ('owner','manager')
    and workspace.state in ('free_official_partner','active_partner')
    and (
      (workspace.app_shop_id is null and workspace.wp_shop_id is not null)
      or (workspace.app_shop_id is not null and shop.publication_status='published' and managed.publication_state='published')
    )
$$;

create or replace function api.get_partner_compatible_auth_membership(p_auth_user_id uuid)
returns table(workspace_id uuid,identity_kind text,app_shop_id uuid,wp_shop_id bigint,shop_slug text,role text)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.get_partner_compatible_auth_membership(p_auth_user_id)
$$;
create or replace function api.get_partner_compatible_workspace_identity(p_workspace_id uuid,p_auth_user_id uuid)
returns table(workspace_id uuid,identity_kind text,app_shop_id uuid,wp_shop_id bigint,shop_slug text,shop_name text,canonical_url text,state text)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.get_partner_compatible_workspace_identity(p_workspace_id,p_auth_user_id)
$$;

revoke all on function private.get_partner_compatible_auth_membership(uuid),private.get_partner_compatible_workspace_identity(uuid,uuid),api.get_partner_compatible_auth_membership(uuid),api.get_partner_compatible_workspace_identity(uuid,uuid) from public,anon,authenticated;
grant execute on function private.get_partner_compatible_auth_membership(uuid),private.get_partner_compatible_workspace_identity(uuid,uuid),api.get_partner_compatible_auth_membership(uuid),api.get_partner_compatible_workspace_identity(uuid,uuid) to service_role;

notify pgrst,'reload schema';
