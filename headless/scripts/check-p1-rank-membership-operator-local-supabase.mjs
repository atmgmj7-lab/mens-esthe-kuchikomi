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

const migrationPath = join(repositoryRoot, "supabase", "migrations", "20260922102917_partner_membership_operator.sql");
const migration = readFileSync(migrationPath, "utf8");
const contract = String.raw`
set local role service_role;
do $$
declare
  v_workspace_a uuid;
  v_workspace_b uuid;
  v_first record;
  v_repeat record;
begin
  if has_schema_privilege('anon', 'private', 'usage')
    or has_schema_privilege('authenticated', 'private', 'usage')
    or has_function_privilege('anon', 'api.grant_partner_membership(uuid,uuid,bigint,text,text,text)', 'execute')
    or has_function_privilege('authenticated', 'api.grant_partner_membership(uuid,uuid,bigint,text,text,text)', 'execute')
    or not has_function_privilege('service_role', 'api.grant_partner_membership(uuid,uuid,bigint,text,text,text)', 'execute') then
    raise exception 'P1 Rank membership grant must remain service-role-only';
  end if;

  select workspace_id into v_workspace_a
  from api.provision_partner_workspace(
    768,
    'mrs-rank-up-local-fixture',
    'Mrs.Rank UP local fixture',
    'https://mens-esthe-kuchikomi.com/shops/mrs-rank-up-local-fixture/',
    'operator'
  );
  select workspace_id into v_workspace_b
  from api.provision_partner_workspace(
    99170009,
    'foreign-shop-local-fixture',
    'Foreign shop local fixture',
    'https://mens-esthe-kuchikomi.com/shops/foreign-shop-local-fixture/',
    'operator'
  );

  select * into v_first
  from api.grant_partner_membership(
    v_workspace_a,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    768,
    'mrs-rank-up-local-fixture',
    'https://mens-esthe-kuchikomi.com/shops/mrs-rank-up-local-fixture/',
    'owner'
  );
  if v_first.workspace_id <> v_workspace_a
    or v_first.auth_user_id <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
    or v_first.wp_shop_id <> 768
    or v_first.role <> 'owner'
    or v_first.status <> 'active'
    or v_first.result <> 'created' then
    raise exception 'P1 Rank canonical grant must create one active membership';
  end if;

  select * into v_repeat
  from api.grant_partner_membership(
    v_workspace_a,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    768,
    'mrs-rank-up-local-fixture',
    'https://mens-esthe-kuchikomi.com/shops/mrs-rank-up-local-fixture/',
    'owner'
  );
  if v_repeat.result <> 'already_present' then
    raise exception 'exact P1 Rank membership retry must be idempotent';
  end if;

  begin
    perform * from api.grant_partner_membership(
      v_workspace_b,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      768,
      'mrs-rank-up-local-fixture',
      'https://mens-esthe-kuchikomi.com/shops/mrs-rank-up-local-fixture/',
      'owner'
    );
    raise exception 'wrong workspace must fail closed';
  exception when sqlstate 'P0001' then
    null;
  end;

  begin
    perform * from api.grant_partner_membership(
      v_workspace_a,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      99170009,
      'mrs-rank-up-local-fixture',
      'https://mens-esthe-kuchikomi.com/shops/mrs-rank-up-local-fixture/',
      'owner'
    );
    raise exception 'wrong WordPress Shop must fail closed';
  exception when sqlstate 'P0001' then
    null;
  end;

  insert into private.partner_memberships (workspace_id, auth_user_id, role, status, accepted_at)
  values (v_workspace_b, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'owner', 'active', now());
  begin
    perform * from api.grant_partner_membership(
      v_workspace_a,
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      768,
      'mrs-rank-up-local-fixture',
      'https://mens-esthe-kuchikomi.com/shops/mrs-rank-up-local-fixture/',
      'owner'
    );
    raise exception 'conflicting existing membership must fail closed';
  exception when sqlstate 'P0001' then
    null;
  end;
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
console.log("P1 Rank Auth/Membership local Supabase contract: PASS");
