-- Local-only contract for Phase 3 Partner Dashboard identity. Fixtures are
-- rolled back and this script never targets a hosted Supabase project.
begin;
set local role service_role;

do $$
declare
  workspace_a uuid;
  workspace_b uuid;
  identity record;
begin
  if to_regprocedure('api.get_partner_workspace_identity(uuid)') is null then
    raise exception 'Partner Dashboard identity migration is not applied';
  end if;

  if has_schema_privilege('anon', 'private', 'usage')
    or has_schema_privilege('authenticated', 'private', 'usage')
    or has_function_privilege('anon', 'api.get_partner_workspace_identity(uuid)', 'execute')
    or has_function_privilege('authenticated', 'api.get_partner_workspace_identity(uuid)', 'execute') then
    raise exception 'browser roles must not execute Partner Dashboard identity RPC';
  end if;

  if not has_function_privilege('service_role', 'api.get_partner_workspace_identity(uuid)', 'execute') then
    raise exception 'service role must retain the Partner Dashboard identity path';
  end if;

  select workspace_id into workspace_a
  from api.provision_partner_workspace(
    8300000000000000011, 'partner-dashboard-a', 'Partner Dashboard A',
    'https://mens-esthe-kuchikomi.com/shops/partner-dashboard-a/', 'operator'
  );
  select workspace_id into workspace_b
  from api.provision_partner_workspace(
    8300000000000000012, 'partner-dashboard-b', 'Partner Dashboard B',
    'https://mens-esthe-kuchikomi.com/shops/partner-dashboard-b/', 'operator'
  );
  update private.partner_workspaces set state = 'free_official_partner' where id in (workspace_a, workspace_b);

  select * into identity from api.get_partner_workspace_identity(workspace_a);
  if identity.workspace_id <> workspace_a
    or identity.wp_shop_id <> 8300000000000000011
    or identity.shop_slug <> 'partner-dashboard-a'
    or identity.shop_name <> 'Partner Dashboard A'
    or identity.canonical_url <> 'https://mens-esthe-kuchikomi.com/shops/partner-dashboard-a/'
    or identity.state <> 'free_official_partner' then
    raise exception 'Partner Dashboard must resolve the canonical identity and existing workspace state';
  end if;

  if exists (
    select 1 from api.get_partner_workspace_identity(workspace_a)
    where workspace_id = workspace_b or wp_shop_id = 8300000000000000012
  ) then
    raise exception 'Partner A identity lookup must not resolve Partner B workspace';
  end if;
end;
$$;

rollback;
