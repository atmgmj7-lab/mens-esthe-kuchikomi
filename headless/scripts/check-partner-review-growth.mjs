import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const headlessRoot = process.cwd();
const repoRoot = join(headlessRoot, "..");

function read(relativePath) {
  const path = join(repoRoot, relativePath);
  assert.ok(existsSync(path), `${relativePath} must exist`);
  return readFileSync(path, "utf8");
}

function verifySourceContract() {
  const migration = read("supabase/migrations/20260920000000_partner_review_growth.sql");
  const localContract = read("supabase/tests/verify_partner_review_growth.sql");
  const provisioning = read("headless/lib/partner/provisioning-service.ts");
  const repository = read("headless/lib/supabase/partner-workspace.ts");

  for (const functionName of [
    "review_partner_registration",
    "list_partner_registration_reviews",
    "open_partner_review_campaign",
    "record_partner_review_campaign_submission",
  ]) {
    assert.match(migration, new RegExp(`create or replace function api\\.${functionName}`, "i"));
    assert.match(migration, new RegExp(`revoke all on function api\\.${functionName}`, "i"));
    assert.match(migration, new RegExp(`grant execute on function api\\.${functionName}`, "i"));
  }

  assert.match(migration, /create table private\.partner_review_campaigns/i);
  assert.match(migration, /create table private\.partner_review_campaign_submissions/i);
  assert.match(migration, /unique \(workspace_id, channel\)/i);
  assert.match(migration, /unique \(wp_review_id\)/i);
  assert.match(migration, /p_decision is null or p_decision not in \('approved', 'rejected'\)/i);
  assert.match(migration, /partner registration decision requires a shop_confirmed workspace/i);
  assert.match(migration, /security invoker/i);
  assert.doesNotMatch(migration, /security definer/i);
  assert.doesNotMatch(migration, /grant\s+(?:all(?:\s+privileges)?|select|insert|update|delete)[^;]*\bprivate\.[^;]*\b(?:public|anon|authenticated)\b/i);
  assert.doesNotMatch(migration, /create policy/i, "private campaign tables must not have browser-client policies");

  assert.match(provisioning, /export type PartnerReviewCampaign/);
  assert.match(provisioning, /export type PartnerRegistrationReview/);
  assert.match(provisioning, /export async function reviewPartnerRegistration/);
  assert.match(provisioning, /export async function openPartnerReviewCampaign/);
  assert.match(provisioning, /export async function recordPartnerReviewCampaignSubmission/);
  assert.match(repository, /import "server-only"/);
  assert.match(repository, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(repository, /rest\/v1\/rpc\/review_partner_registration/);
  assert.match(repository, /rest\/v1\/rpc\/list_partner_registration_reviews/);
  assert.match(repository, /rest\/v1\/rpc\/open_partner_review_campaign/);
  assert.match(repository, /rest\/v1\/rpc\/record_partner_review_campaign_submission/);
  assert.doesNotMatch(repository, /rest\/v1\/(?:partner_review_campaigns|partner_review_campaign_submissions)/);

  assert.match(localContract, /browser roles must not execute partner review growth RPC adapters/i);
  assert.match(localContract, /same-decision retry/i);
  assert.match(localContract, /rejection must not activate/i);
  assert.match(localContract, /four one-per-channel/i);
  assert.match(localContract, /inactive campaign resolution/i);
  assert.match(localContract, /duplicate conversion/i);
  assert.match(localContract, /PII event payload/i);
  assert.match(localContract, /null decision must reject without changes/i);
  assert.match(localContract, /non-shop_confirmed workspace must reject without changes/i);
}

function verifyLocalSupabaseContract() {
  const sql = readFileSync(join(repoRoot, "supabase/tests/verify_partner_review_growth.sql"), "utf8");
  const config = readFileSync(join(repoRoot, "supabase/config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([^"]+)"\s*$/m)?.[1];
  if (!projectId) throw new Error("supabase/config.toml must define project_id.");
  const containers = execFileSync("docker", ["ps", "--format", "{{.Names}}"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  const database = `supabase_db_${projectId}`;
  if (!containers.includes(database)) {
    throw new Error(`Local Supabase database ${database} is not running; run supabase start in this project first.`);
  }
  execFileSync(
    "docker",
    ["exec", "-i", database, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
    { input: sql, stdio: ["pipe", "pipe", "pipe"] },
  );
}

if (process.argv[2] === "--local-supabase") {
  verifyLocalSupabaseContract();
  console.log("partner review growth local Supabase contract check passed");
} else {
  verifySourceContract();
  console.log("partner review growth source contract check passed");
}
