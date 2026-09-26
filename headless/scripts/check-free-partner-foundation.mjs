import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const headlessRoot = process.cwd();
const repoRoot = join(headlessRoot, "..");

function read(relativePath) {
  const path = join(repoRoot, relativePath);
  assert.ok(existsSync(path), `${relativePath} must exist`);
  return readFileSync(path, "utf8");
}

const migration = read("supabase/migrations/20260919000000_free_partner_foundation.sql");
const provisioning = read("headless/lib/partner/provisioning-service.ts");
const registration = read("headless/lib/partner/registration-service.ts");
const repository = read("headless/lib/supabase/partner-workspace.ts");
const localSupabaseContract = read("headless/scripts/check-free-partner-local-supabase.mjs");
const operatorRoute = read("headless/app/api/dashboard/partners/provision/route.ts");
const registrationRoute = read("headless/app/api/partner/register/route.ts");
const dashboardPage = read("headless/app/dashboard/partners/page.tsx");
const partnerPage = read("headless/app/partner/register/page.tsx");
const proxy = read("headless/proxy.ts");
const spec = read("docs/superpowers/specs/2026-09-19-eskomi-free-official-partner-foundation-design.md");
const progress = read("pm/PROGRESS.md");

for (const state of [
  "normal_listing",
  "shop_confirmed",
  "free_official_partner",
  "active_partner",
]) {
  assert.match(provisioning, new RegExp(`"${state}"`));
  assert.match(migration, new RegExp(`'${state}'`));
}

assert.match(provisioning, /export async function provisionPartnerWorkspace/);
assert.match(registration, /provisionPartnerWorkspace/);
assert.match(registration, /normalizePublicShopSlug/);
assert.match(registration, /canonicalSlug !== submittedSlug/);
assert.match(operatorRoute, /provisionPartnerWorkspace/);
assert.match(registrationRoute, /submitPartnerRegistration/);
assert.match(registrationRoute, /getShopBySlug/);
assert.match(registrationRoute, /claimShopOwnerRequestRateLimit/);
assert.match(registrationRoute, /resolveTrustedShopOwnerClientIp/);
assert.doesNotMatch(registrationRoute, /state:\s*result\.state/);
assert.match(registrationRoute, /request\.nextUrl\.origin/);
assert.match(registrationRoute, /partner\/register\//);
assert.match(repository, /import "server-only"/);
assert.match(repository, /resolveSupabaseServerSecret/);
assert.match(repository, /Content-Profile": "api"/);
assert.match(repository, /rest\/v1\/rpc\/register_partner_submission/);
assert.doesNotMatch(repository, /rest\/v1\/partner_registration_submissions/);
assert.match(localSupabaseContract, /supabase_db_\$\{projectId\}/);
assert.doesNotMatch(partnerPage, /SUPABASE_(?:SECRET_KEY|SERVICE_ROLE_KEY)|SUPABASE_URL/);

assert.match(migration, /create schema if not exists private/i);
assert.match(migration, /create table private\.partner_workspaces/i);
assert.match(migration, /create table private\.partner_state_history/i);
assert.match(migration, /create table private\.partner_registration_submissions/i);
assert.match(migration, /create or replace function private\.provision_partner_workspace/i);
assert.match(migration, /create or replace function api\.provision_partner_workspace/i);
assert.match(migration, /create or replace function api\.register_partner_submission/i);
assert.match(migration, /security invoker/i);
assert.doesNotMatch(migration, /security definer/i);
assert.match(migration, /revoke all on schema private from public, anon, authenticated/i);
assert.match(migration, /revoke all on all tables in schema private from public, anon, authenticated/i);
assert.match(migration, /revoke all on all functions in schema private from public, anon, authenticated/i);
assert.match(migration, /grant usage on schema private to service_role/i);
assert.match(migration, /grant select, insert, update, delete on all tables in schema private to service_role/i);
assert.match(migration, /revoke update, delete on table private\.partner_state_history from service_role/i);
assert.match(migration, /v_before = 'normal_listing' and p_next_state = 'shop_confirmed'/i);
assert.doesNotMatch(migration, /v_before = 'normal_listing' and p_next_state in \('shop_confirmed', 'free_official_partner'\)/i);
assert.doesNotMatch(migration, /grant\s+(?:all(?:\s+privileges)?|select|insert|update|delete)[^;]*\bprivate\.[^;]*\b(?:public|anon|authenticated)\b/i);
assert.doesNotMatch(migration, /create policy/i, "private workflow tables must not have browser-client RLS policies");
assert.match(migration, /revoke all on function api\.provision_partner_workspace/i);
assert.match(migration, /grant execute on function api\.provision_partner_workspace/i);
assert.match(migration, /revoke all on function api\.register_partner_submission/i);
assert.match(migration, /grant execute on function api\.register_partner_submission/i);

assert.match(dashboardPage, /DashboardPartnerWorkspace/);
assert.match(partnerPage, /PartnerRegistrationForm/);
assert.match(proxy, /isDashboardProtectedPath/);
assert.match(proxy, /www-authenticate/i);
assert.match(spec, /Manual-first/i);
assert.match(spec, /Automation-later/i);
assert.match(spec, /WordPress Writer/i);
assert.match(progress, /2026-09-19-eskomi-free-official-partner-foundation-design\.md/);

console.log("free partner foundation contract check passed");
