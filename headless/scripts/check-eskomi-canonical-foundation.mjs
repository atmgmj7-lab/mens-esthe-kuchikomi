import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migration = readFileSync(
  join(root, "..", "supabase", "migrations", "20261017120000_eskomi_canonical_shop_foundation.sql"),
  "utf8",
);

function requires(pattern, description) {
  assert.match(migration, pattern, description);
}

function forbids(pattern, description) {
  assert.doesNotMatch(migration, pattern, description);
}

requires(/add column if not exists app_shop_id uuid references app\.shops\(id\)/, "managed shops must gain an explicit canonical Shop UUID bridge");
requires(/alter column wp_shop_id drop not null/, "new partner workspaces must not require a WordPress ID");
requires(/partner_workspaces_identity_check[\s\S]*num_nonnulls\(wp_shop_id, app_shop_id\) = 1/, "a workspace must use exactly one identity path");
requires(/create table app\.therapists/, "therapists need a stable, non-PII identity table");
requires(/create table app\.therapist_assignments/, "therapist history must be shop-assignment based");
requires(/create table private\.review_experiences/, "private guest experience records are required");
requires(/create table private\.review_assessments/, "shop and therapist assessments must be separate records");
requires(/review_assessments_one_shop_per_experience/, "one experience must not double-count a shop assessment");
requires(/review_assessments_one_therapist_per_experience/, "one experience must not double-count a therapist assessment");
requires(/create table app\.review_publications/, "public review IDs must be separated from private edit receipts");
requires(/create table private\.review_submission_idempotency/, "guest submission idempotency must be persisted privately");
requires(/create or replace function private\.submit_review_experience/, "guest writes require an atomic submission RPC");
requires(/idempotency key has a different payload/, "idempotency collisions must reject a mismatched payload");
requires(/for update;/, "submission and redemption paths must lock their mutable rows");
requires(/create table private\.benefit_programs/, "benefits require an explicit program record");
requires(/eligibility_rule = 'moderation_approved'/, "benefit eligibility must remain rating-neutral");
forbids(/rating[^\n]{0,80}(>=|>|<=|<)[^\n]{0,80}benefit|benefit[^\n]{0,80}(>=|>|<=|<)[^\n]{0,80}rating/i, "benefit eligibility cannot depend on score");
requires(/create or replace function private\.redeem_benefit_code/, "coupon redemption needs one atomic function");
requires(/where id = v_code\.id and state = 'issued'/, "coupon redemption must consume only an issued code");
requires(/create or replace function private\.issue_benefit_code/, "coupon issuance needs one atomic function");
requires(/v_experience\.state <> 'approved'/, "coupons may only be issued after moderation approval");
requires(/create or replace function private\.import_managed_shop_from_legacy_as_archived/, "legacy archive imports need a dedicated non-publishing path");
requires(/publication_state = 'deleted'/, "legacy archive imports must leave a tombstone");
const directBrowserGrants = migration.split("\n").filter((line) => /^\s*grant\s+(?:select|insert|update|delete|execute)\b/i.test(line)
  && /\b(?:anon|authenticated)\b/i.test(line));
assert.deepEqual(directBrowserGrants, [], "no new direct browser privilege may be granted");
requires(/grant execute on function api\.submit_review_experience[\s\S]*to service_role/, "guest submission transport must remain server-only");
requires(/alter table app\.review_publications enable row level security/, "public publication data must remain RLS guarded before a reviewed read adapter exists");

console.log("Eskomi canonical-shop foundation contract: PASS");
