-- Local-only contract for Phase 3 Partner Auth / Membership. The transaction
-- rolls its fixtures back and never targets a hosted Supabase project.
begin;
set local role service_role;

do $$
declare
  workspace_a uuid;
  workspace_b uuid;
  access_workspace uuid;
  access_shop_id bigint;
begin
  if to_regclass('private.partner_memberships') is null
    or to_regprocedure('api.get_partner_auth_membership(uuid)') is null then
    raise exception 'Partner Auth membership migration is not applied';
  end if;

  if has_schema_privilege('anon', 'private', 'usage')
    or has_schema_privilege('authenticated', 'private', 'usage')
    or has_table_privilege('anon', 'private.partner_memberships', 'select,insert,update,delete')
    or has_table_privilege('authenticated', 'private.partner_memberships', 'select,insert,update,delete')
    or has_function_privilege('anon', 'api.get_partner_auth_membership(uuid)', 'execute')
    or has_function_privilege('authenticated', 'api.get_partner_auth_membership(uuid)', 'execute') then
    raise exception 'browser roles must not read private partner memberships';
  end if;

  if not has_table_privilege('service_role', 'private.partner_memberships', 'select,insert,update,delete')
    or not has_function_privilege('service_role', 'api.get_partner_auth_membership(uuid)', 'execute') then
    raise exception 'service role must retain the trusted membership path';
  end if;

  select workspace_id into workspace_a
  from api.provision_partner_workspace(
    8300000000000000001, 'partner-auth-a', 'Partner Auth A',
    'https://mens-esthe-kuchikomi.com/shops/partner-auth-a/', 'operator'
  );
  select workspace_id into workspace_b
  from api.provision_partner_workspace(
    8300000000000000002, 'partner-auth-b', 'Partner Auth B',
    'https://mens-esthe-kuchikomi.com/shops/partner-auth-b/', 'operator'
  );

  update private.partner_workspaces set state = 'free_official_partner' where id in (workspace_a, workspace_b);
  insert into private.partner_memberships (workspace_id, auth_user_id, role, status, accepted_at)
  values
    (workspace_a, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'owner', 'active', now()),
    (workspace_b, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'manager', 'active', now());

  select workspace_id, wp_shop_id into access_workspace, access_shop_id
  from api.get_partner_auth_membership('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  if access_workspace <> workspace_a or access_shop_id <> 8300000000000000001 then
    raise exception 'Partner A must resolve only its own workspace and shop';
  end if;
  if exists (
    select 1 from api.get_partner_auth_membership('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    where workspace_id = workspace_b
  ) then
    raise exception 'Partner A must not resolve Partner B workspace';
  end if;

  insert into private.partner_memberships (workspace_id, auth_user_id, role, status, revoked_at)
  values (
    workspace_a, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'owner', 'revoked', now()
  );
  if exists (
    select 1 from api.get_partner_auth_membership('cccccccc-cccc-4ccc-8ccc-cccccccccccc')
  ) then
    raise exception 'revoked membership must not resolve an active partner access path';
  end if;
end;
$$;

rollback;
