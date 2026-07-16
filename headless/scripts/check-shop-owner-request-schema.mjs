import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationName = readdirSync(join(root, "../supabase/migrations"))
  .filter((name) => name.endsWith("_shop_owner_requests.sql"))
  .sort()
  .at(-1);

assert.ok(migrationName, "shop owner request migration must exist");
const sql = readFileSync(join(root, "../supabase/migrations", migrationName), "utf8");

const unsafePublicGrantPattern =
  /\bgrant\s+(?=[^;]*?\b(?:all(?:\s+privileges)?|select|insert|update|delete)\b[^;]*?\s+on\b)[^;]*?\s+on\s+(?:table\s+)?api\.(?:shop_owner_requests|shop_owner_request_rate_limits)\s+to\s+[^;]*\b(?:public|anon|authenticated)\b[^;]*;/i;
const unsafePrivileges = ["all", "select", "insert", "update", "delete"];
const browserRoles = ["public", "anon", "authenticated"];
const unsafePublicGrantExamples = unsafePrivileges.flatMap((privilege) =>
  browserRoles.map(
    (role) => `grant ${privilege} on table api.shop_owner_requests to ${role};`,
  ),
);
unsafePublicGrantExamples.push(
  "grant all privileges on api.shop_owner_requests to authenticated;",
  "grant truncate, select on table api.shop_owner_requests to service_role, anon;",
);

for (const grantSql of unsafePublicGrantExamples) {
  assert.match(grantSql, unsafePublicGrantPattern);
}
assert.doesNotMatch(
  "grant select, insert, update, delete on table api.shop_owner_requests to service_role;",
  unsafePublicGrantPattern,
);

assert.match(sql, /create table api\.shop_owner_requests/i);
assert.match(sql, /alter table api\.shop_owner_requests enable row level security/i);
assert.match(sql, /status text not null default 'received'/i);
assert.match(sql, /requested_fields text\[\] not null/i);
assert.match(
  sql,
  /shop_slug text not null check \([\s\S]*?char_length\(shop_slug\) between 1 and 200[\s\S]*?shop_slug ~ '\^\(\[a-z0-9-\]\|%\[0-9a-f\]\{2\}\)\+\$'[\s\S]*?\),/i,
  "shop slug constraint must accept canonical lowercase percent-encoded WordPress slugs"
);
assert.doesNotMatch(
  sql,
  /shop_slug ~ '\^\[a-z0-9\]\[a-z0-9-\]\{0,199\}\$'/i,
  "ASCII-only shop slug constraint must not return"
);
assert.match(sql, /consent_privacy boolean not null/i);
assert.match(sql, /consent_accuracy boolean not null/i);
assert.match(sql, /consent_image_rights boolean not null/i);
assert.match(sql, /revoke all on table api\.shop_owner_requests from anon, authenticated/i);
assert.match(sql, /grant select, insert, update, delete on table api\.shop_owner_requests to service_role/i);
assert.doesNotMatch(sql, unsafePublicGrantPattern);
assert.doesNotMatch(sql, /create policy/i, "public policies are not required for server-only queue");

assert.match(sql, /create table api\.shop_owner_request_rate_limits/i);
assert.match(sql, /alter table api\.shop_owner_request_rate_limits enable row level security/i);
assert.match(sql, /primary key \(request_key, window_started_at\)/i);
assert.match(sql, /create or replace function api\.claim_shop_owner_request_rate_limit/i);
assert.match(sql, /on conflict \(request_key, window_started_at\) do update/i);
assert.match(sql, /security definer/i);
assert.match(sql, /revoke all on function api\.claim_shop_owner_request_rate_limit\(text\) from public/i);
assert.match(sql, /revoke all on function api\.claim_shop_owner_request_rate_limit\(text\) from anon, authenticated/i);
assert.match(sql, /grant execute on function api\.claim_shop_owner_request_rate_limit\(text\) to service_role/i);
assert.match(sql, /revoke all on table api\.shop_owner_request_rate_limits from anon, authenticated/i);
assert.match(sql, /grant select, insert, update, delete on table api\.shop_owner_request_rate_limits to service_role/i);

console.log("shop owner request schema check passed");
