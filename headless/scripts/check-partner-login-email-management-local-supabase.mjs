import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const headlessRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(headlessRoot, "..");
const config = readFileSync(join(repositoryRoot, "supabase", "config.toml"), "utf8");
const projectId = config.match(/^project_id\s*=\s*"([^"]+)"\s*$/m)?.[1];
assert.ok(projectId, "a local Supabase project id is required");
const database = `supabase_db_${projectId}`;
const containers = execFileSync("docker", ["ps", "--format", "{{.Names}}"], { encoding: "utf8" });
assert.ok(containers.split("\n").includes(database), "local Supabase database must be running");

const migration = readFileSync(join(repositoryRoot, "supabase", "migrations", "20260923000000_partner_login_email_management.sql"), "utf8");
const contract = String.raw`
set local role service_role;
do $$
declare
  v_workspace uuid;
  v_result record;
  v_memberships integer;
  v_state text;
begin
  if has_schema_privilege('anon', 'private', 'usage')
    or has_schema_privilege('authenticated', 'private', 'usage')
    or has_table_privilege('anon', 'private.partner_login_email_intents', 'select,insert,update,delete')
    or has_table_privilege('authenticated', 'private.partner_login_email_intents', 'select,insert,update,delete')
    or has_function_privilege('anon', 'api.set_operator_partner_login_email_intent(bigint,text,text,text,text)', 'execute')
    or has_function_privilege('authenticated', 'api.record_partner_login_email_change_request(uuid,uuid,text)', 'execute') then
    raise exception 'login email management must remain service-role-only';
  end if;
  if not has_function_privilege('service_role', 'api.set_operator_partner_login_email_intent(bigint,text,text,text,text)', 'execute')
    or not has_function_privilege('service_role', 'api.record_partner_login_email_change_request(uuid,uuid,text)', 'execute') then
    raise exception 'service role must retain the server adapter path';
  end if;

  select workspace_id into v_workspace from api.provision_partner_workspace(
    8200000000000000001, 'login-email-a', 'Login email local fixture',
    'https://mens-esthe-kuchikomi.com/shops/login-email-a/', 'operator'
  );

  select * into v_result from api.get_operator_partner_login_email_management(
    8200000000000000001, 'login-email-a', 'https://mens-esthe-kuchikomi.com/shops/login-email-a/'
  );
  if v_result.status <> 'not_set' or v_result.workspace_id <> v_workspace or v_result.email is not null then
    raise exception 'Operator must see only an empty canonical workspace state before setup';
  end if;

  select * into v_result from api.set_operator_partner_login_email_intent(
    8200000000000000001, 'login-email-a', 'https://mens-esthe-kuchikomi.com/shops/login-email-a/',
    'Initial.Owner@Example.Invalid', 'operator_initial'
  );
  if v_result.status <> 'available' or v_result.email <> 'initial.owner@example.invalid'
    or v_result.intent <> 'operator_initial' or v_result.auth_user_id is not null then
    raise exception 'Operator initial email must be a normalized intent without an Auth binding';
  end if;
  select count(m.auth_user_id), max(w.state::text) into v_memberships, v_state from private.partner_memberships m
    right join private.partner_workspaces w on w.id = m.workspace_id where w.id = v_workspace;
  if v_memberships <> 0 or v_state <> 'normal_listing' then
    raise exception 'initial email must not create membership or transition workspace';
  end if;

  update private.partner_workspaces set state = 'free_official_partner' where id = v_workspace;
  insert into private.partner_memberships (workspace_id, auth_user_id, role, status, accepted_at)
  values (v_workspace, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'owner', 'active', now());
  select * into v_result from api.get_partner_login_email_management(v_workspace, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  if v_result.status <> 'available' or v_result.email <> 'initial.owner@example.invalid' then
    raise exception 'active Partner must resolve only their own pending login email state';
  end if;
  select * into v_result from api.record_partner_login_email_change_request(
    v_workspace, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'changed.owner@example.invalid'
  );
  if v_result.status <> 'available' or v_result.email <> 'changed.owner@example.invalid'
    or v_result.intent <> 'partner_change_requested' then
    raise exception 'Partner change request must record a normalized request';
  end if;
  select count(m.auth_user_id), max(w.state::text) into v_memberships, v_state from private.partner_memberships m
    right join private.partner_workspaces w on w.id = m.workspace_id where w.id = v_workspace;
  if v_memberships <> 1 or v_state <> 'free_official_partner' then
    raise exception 'Partner email request must preserve membership and workspace state';
  end if;
  select * into v_result from api.get_partner_login_email_management(v_workspace, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  if v_result.status <> 'forbidden' then
    raise exception 'wrong Partner must not resolve another workspace login email';
  end if;
  begin
    perform * from api.set_operator_partner_login_email_intent(
      8200000000000000001, 'wrong-slug', 'https://mens-esthe-kuchikomi.com/shops/login-email-a/',
      'wrong@example.invalid', 'operator_change_requested'
    );
    raise exception 'canonical mismatch must fail closed';
  exception when sqlstate 'P0001' then null;
  end;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'private' and table_name = 'partner_login_email_audit_events' and column_name = 'email'
  ) then
    raise exception 'audit must not copy email PII';
  end if;
  if not exists (
    select 1 from private.partner_login_email_audit_events
    where workspace_id = v_workspace and wp_shop_id = 8200000000000000001
      and action = 'partner_change_requested' and actor_kind = 'partner' and result = 'recorded'
  ) then
    raise exception 'audit must retain canonical shop ID, action, actor, and result without email';
  end if;
end;
$$;
`;

const sql = `begin;\n${migration}\n${contract}\nrollback;\n`;
const output = execFileSync("docker", [
  "exec", "-i", database, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres",
], { input: sql, encoding: "utf8" });
assert.match(output, /BEGIN/);
assert.match(output, /DO/);
assert.match(output, /ROLLBACK/);
console.log("partner login email management local Supabase contract: PASS");
