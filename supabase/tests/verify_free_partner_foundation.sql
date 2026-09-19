-- Local-only executable privilege and transaction contract.
-- Run through headless/scripts/check-free-partner-local-supabase.mjs after `supabase start`.
begin;
set local role service_role;

do $$
declare
  v_shop_id bigint := 8000000000000000000 + floor(random() * 1000000000)::bigint;
  v_slug text;
  v_workspace_id uuid;
  v_state text;
  v_submissions integer;
  v_history integer;
begin
  if to_regclass('private.partner_workspaces') is null
    or to_regprocedure('api.provision_partner_workspace(bigint,text,text,text,text)') is null
    or to_regprocedure('api.register_partner_submission(uuid,text,text,text,text,text,boolean)') is null then
    raise exception 'Partner migration is not applied; run supabase start or supabase db reset for this project first';
  end if;
  if has_schema_privilege('anon', 'private', 'usage')
    or has_schema_privilege('authenticated', 'private', 'usage') then
    raise exception 'browser roles must not have private schema usage';
  end if;
  if has_table_privilege('anon', 'private.partner_workspaces', 'select,insert,update,delete')
    or has_table_privilege('authenticated', 'private.partner_workspaces', 'select,insert,update,delete') then
    raise exception 'browser roles must not access private partner workspaces';
  end if;
  if has_function_privilege('anon', 'api.provision_partner_workspace(bigint,text,text,text,text)', 'execute')
    or has_function_privilege('authenticated', 'api.provision_partner_workspace(bigint,text,text,text,text)', 'execute')
    or has_function_privilege('anon', 'api.register_partner_submission(uuid,text,text,text,text,text,boolean)', 'execute')
    or has_function_privilege('authenticated', 'api.register_partner_submission(uuid,text,text,text,text,text,boolean)', 'execute') then
    raise exception 'browser roles must not execute Partner RPC adapters';
  end if;
  if not has_schema_privilege('service_role', 'private', 'usage')
    or not has_table_privilege('service_role', 'private.partner_workspaces', 'select,insert,update,delete')
    or has_table_privilege('service_role', 'private.partner_state_history', 'update,delete') then
    raise exception 'service-role private privilege contract failed';
  end if;

  v_slug := 'partner-contract-' || v_shop_id::text;
  select workspace_id into v_workspace_id
  from api.provision_partner_workspace(
    v_shop_id,
    v_slug,
    'Partner Contract Shop',
    'https://mens-esthe-kuchikomi.com/shops/' || v_slug || '/',
    'operator'
  );

  begin
    perform api.register_partner_submission(
      v_workspace_id,
      'Contract Tester',
      'owner',
      'contract@example.invalid',
      'transaction rollback check',
      'https://mens-esthe-kuchikomi.com/partner/register/',
      false
    );
    raise exception 'invalid registration unexpectedly succeeded';
  exception when check_violation then
    null;
  end;

  select state::text into v_state from private.partner_workspaces where id = v_workspace_id;
  select count(*) into v_submissions from private.partner_registration_submissions where workspace_id = v_workspace_id;
  if v_state <> 'normal_listing' or v_submissions <> 0 then
    raise exception 'failed registration must roll back submission and state: state %, submissions %', v_state, v_submissions;
  end if;

  select api.register_partner_submission(
    v_workspace_id,
    'Contract Tester',
    'owner',
    'contract@example.invalid',
    'atomic success check',
    'https://mens-esthe-kuchikomi.com/partner/register/',
    true
  ) into v_state;
  select count(*) into v_submissions from private.partner_registration_submissions where workspace_id = v_workspace_id;
  select count(*) into v_history from private.partner_state_history where workspace_id = v_workspace_id;
  if v_state <> 'shop_confirmed' or v_submissions <> 1 or v_history <> 2 then
    raise exception 'successful registration state/history contract failed: state %, submissions %, history %', v_state, v_submissions, v_history;
  end if;
end;
$$;

rollback;
