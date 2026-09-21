-- Phase 3 Partner Dashboard identity. This adapter exposes the existing
-- workspace projection only to the server-side service role; it creates no
-- new workspace, status, or browser-readable private data model.
create or replace function private.get_partner_workspace_identity(p_workspace_id uuid)
returns table (
  workspace_id uuid,
  wp_shop_id bigint,
  shop_slug text,
  shop_name text,
  canonical_url text,
  state text
)
language sql
security invoker
set search_path = private, pg_temp
as $$
  select w.id, w.wp_shop_id, w.shop_slug, w.shop_name, w.canonical_url, w.state::text
  from private.partner_workspaces w
  where w.id = p_workspace_id
    and w.state in ('free_official_partner', 'active_partner')
$$;

revoke all on function private.get_partner_workspace_identity(uuid) from public, anon, authenticated;
grant execute on function private.get_partner_workspace_identity(uuid) to service_role;

create or replace function api.get_partner_workspace_identity(p_workspace_id uuid)
returns table (
  workspace_id uuid,
  wp_shop_id bigint,
  shop_slug text,
  shop_name text,
  canonical_url text,
  state text
)
language sql
security invoker
set search_path = private, api, pg_temp
as $$
  select * from private.get_partner_workspace_identity(p_workspace_id)
$$;

revoke all on function api.get_partner_workspace_identity(uuid) from public, anon, authenticated;
grant execute on function api.get_partner_workspace_identity(uuid) to service_role;
