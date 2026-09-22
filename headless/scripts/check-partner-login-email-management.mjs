import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const migrationPath = join(root, "..", "supabase/migrations/20260923000000_partner_login_email_management.sql");

function loadPureModule(path) {
  const output = ts.transpileModule(read(path), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports });
  return module.exports;
}

for (const path of [
  "app/partner/settings/page.tsx",
  "app/partner/settings/login-email/route.ts",
  "app/api/dashboard/shops/[id]/login-email/route.ts",
  "components/partner/PartnerLoginEmailSettings.tsx",
  "components/dashboard/OperatorPartnerLoginEmail.tsx",
  "lib/partner/partner-login-email.ts",
  "lib/partner/partner-login-email-server.ts",
]) {
  assert.equal(existsSync(join(root, path)), true, `${path} が必要です`);
}

assert.equal(existsSync(migrationPath), true, "login emailのprivate migrationが必要です");
const migration = readFileSync(migrationPath, "utf8");
assert.match(migration, /create table private\.partner_login_email_intents/i);
assert.match(migration, /create table private\.partner_login_email_audit_events/i);
assert.match(migration, /wp_shop_id bigint not null/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /revoke all on table private\.partner_login_email_intents from public, anon, authenticated/i);
assert.match(migration, /grant select, insert, update on table private\.partner_login_email_intents to service_role/i);
assert.match(migration, /api\.get_operator_partner_login_email_management/i);
assert.match(migration, /api\.set_operator_partner_login_email_intent/i);
assert.match(migration, /api\.get_partner_login_email_management/i);
assert.match(migration, /api\.record_partner_login_email_change_request/i);
assert.match(migration, /multiple active memberships require a dedicated operator flow/i);
assert.doesNotMatch(migration, /grant .* to anon|grant .* to authenticated/i);
assert.doesNotMatch(migration, /security definer/i);

const server = read("lib/partner/partner-login-email-server.ts");
assert.match(server, /\/auth\/v1\/user/);
assert.match(server, /method:\s*["']PUT["']/);
assert.match(server, /Authorization:\s*`Bearer \$\{accessToken\}`/);
assert.doesNotMatch(server, /SUPABASE_SERVICE_ROLE_KEY/);

const partnerRoute = read("app/partner/settings/login-email/route.ts");
assert.match(partnerRoute, /PARTNER_SESSION_COOKIE/);
assert.match(partnerRoute, /authorizePartnerLoginEmailSession/);
assert.match(partnerRoute, /recordPartnerLoginEmailChangeRequest/);
assert.doesNotMatch(partnerRoute, /body\.workspaceId|body\.shopId|requestedWorkspaceId|requestedShopId/);

const operatorRoute = read("app/api/dashboard/shops/[id]/login-email/route.ts");
assert.match(operatorRoute, /getOperatorPartnerLoginEmailManagement/);
assert.match(operatorRoute, /setOperatorPartnerLoginEmailIntent/);
assert.match(operatorRoute, /Number\(\(await params\)\.id\)/);
assert.doesNotMatch(operatorRoute, /SUPABASE_SERVICE_ROLE_KEY/);

const partnerPage = read("app/partner/settings/page.tsx");
assert.match(partnerPage, /authorizePartnerLoginEmailSession/);
assert.match(partnerPage, /ログインメール/);
assert.match(partnerPage, /data-partner-login-email-settings-root/);

const operatorPresentation = read("components/dashboard/OperatorPartnerLoginEmail.tsx");
assert.match(operatorPresentation, /ログインメール/);
assert.match(operatorPresentation, /初期設定|変更依頼/);
assert.doesNotMatch(operatorPresentation, /service.?role/i);
assert.doesNotMatch(operatorPresentation, /authUserId/, "Auth user ID must remain a server-only implementation detail");

const contract = read("lib/partner/partner-login-email.ts");
assert.match(contract, /normalizePartnerLoginEmail/);
assert.match(contract, /operator_initial|operator_change_requested|partner_change_requested/);
assert.match(contract, /workspaceId/);
assert.match(contract, /authUserId/);
assert.doesNotMatch(contract, /console\.(log|info|debug)/);
const pure = loadPureModule("lib/partner/partner-login-email.ts");
assert.equal(pure.normalizePartnerLoginEmail(" Owner@Example.Invalid "), "owner@example.invalid");
assert.equal(pure.normalizePartnerLoginEmail("not-an-email"), null);
assert.equal(pure.normalizePartnerLoginEmail("x@invalid"), null);
assert.equal(pure.isPartnerLoginEmailIntentKind("partner_change_requested"), true);
assert.equal(pure.isPartnerLoginEmailIntentKind("membership_update"), false);

const existingOperatorProjection = read("lib/dashboard/operator-shop-projection.ts");
assert.doesNotMatch(existingOperatorProjection, /loginEmail|emailIntent/i, "一覧用の店舗projectionへメールPIIを混在させない");

console.log("partner login email management contract: PASS");
