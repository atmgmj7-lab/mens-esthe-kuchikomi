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
  const reviewRoute = read("headless/app/api/dashboard/partners/review/route.ts");
  const qrRoute = read("headless/app/api/dashboard/partners/qr/route.ts");
  const publicCampaignRoute = read("headless/app/r/[token]/route.ts");
  const reviewSubmitPage = read("headless/app/reviews/submit/page.tsx");
  const reviewSubmitForm = read("headless/components/reviews/ReviewSubmitForm.tsx");
  const reviewSubmitRoute = read("headless/app/api/reviews/submit/route.ts");
  const changedFlowQa = read("headless/scripts/check-partner-review-growth-browser.mjs");
  const packageJson = JSON.parse(read("headless/package.json"));
  const dashboardPage = read("headless/app/dashboard/partners/page.tsx");
  const dashboardWorkspace = read("headless/components/dashboard/DashboardPartnerWorkspace.tsx");

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

  assert.match(reviewRoute, /authorizeDashboardRequest/);
  assert.match(reviewRoute, /request\.headers\.get\("authorization"\)/);
  assert.match(reviewRoute, /reviewPartnerRegistration/);
  assert.match(reviewRoute, /partnerReviewGrowthRepository/);
  assert.match(reviewRoute, /Cache-Control[\s\S]*no-store/);
  assert.match(reviewRoute, /X-Robots-Tag[\s\S]*noindex, nofollow/);

  assert.match(qrRoute, /authorizeDashboardRequest/);
  assert.match(qrRoute, /request\.headers\.get\("authorization"\)/);
  assert.match(qrRoute, /openPartnerReviewCampaign/);
  assert.match(qrRoute, /partnerReviewGrowthRepository/);
  assert.match(qrRoute, /image\/svg\+xml/);
  assert.match(qrRoute, /Cache-Control[\s\S]*private, no-store/);
  assert.match(qrRoute, /X-Robots-Tag[\s\S]*noindex, nofollow/);
  assert.match(qrRoute, /\/r\/\$\{token\}\//);

  assert.match(publicCampaignRoute, /openPartnerReviewCampaign/);
  assert.match(publicCampaignRoute, /partnerReviewGrowthRepository/);
  assert.match(publicCampaignRoute, /NextResponse\.redirect\([^,]+,\s*307\)/);
  assert.match(publicCampaignRoute, /\/reviews\/submit\//);
  assert.match(publicCampaignRoute, /searchParams\.set\("shop"/);
  assert.match(publicCampaignRoute, /searchParams\.set\("campaign"/);
  assert.match(publicCampaignRoute, /Cache-Control[\s\S]*no-store/);
  assert.match(publicCampaignRoute, /X-Robots-Tag[\s\S]*noindex, nofollow/);
  assert.doesNotMatch(publicCampaignRoute, /SUPABASE_SERVICE_ROLE_KEY|rest\/v1\//);

  assert.match(reviewSubmitPage, /openPartnerReviewCampaign/);
  assert.match(reviewSubmitPage, /partnerReviewGrowthRepository/);
  assert.match(reviewSubmitPage, /campaignShop\.id !== candidate\.id/);
  assert.match(reviewSubmitPage, /キャンペーンの投稿先店舗を確認できません/);
  assert.match(reviewSubmitForm, /campaignToken\?: string/);
  assert.match(reviewSubmitForm, /campaignToken,/);
  assert.match(reviewSubmitForm, /campaignToken,/);
  assert.match(reviewSubmitRoute, /openPartnerReviewCampaign/);
  assert.match(reviewSubmitRoute, /recordPartnerReviewCampaignSubmission/);
  assert.match(reviewSubmitRoute, /partnerReviewGrowthRepository/);
  assert.match(reviewSubmitRoute, /campaign\.id !== shop\.id/);
  assert.match(reviewSubmitRoute, /result\.ok && typeof wordpressReviewId === "number" && Number\.isSafeInteger\(wordpressReviewId\) && wordpressReviewId > 0/);
  assert.ok(packageJson.scripts["qa:partner-review-growth"].includes("check-partner-review-growth-browser.mjs"));
  assert.match(changedFlowQa, /\["run", "start", "--", "--hostname", "127\.0\.0\.1", "--port"/);
  assert.match(changedFlowQa, /form\.hl-review-form/);
  assert.match(changedFlowQa, /キャンペーンの投稿先店舗を確認できません/);
  assert.match(changedFlowQa, /campaignToken: fixtureToken/);

  assert.match(dashboardPage, /listPartnerRegistrationReviews/);
  assert.match(dashboardPage, /partnerReviewGrowthRepository/);
  assert.match(dashboardPage, /reviews\.map/);
  assert.doesNotMatch(dashboardPage, /contactName|contactEmail|confirmationDetails/);
  assert.match(dashboardWorkspace, /pendingReviews/);
  assert.match(dashboardWorkspace, /review\.status === "received"/);
  assert.match(dashboardWorkspace, /Free Official Partnerとして承認/);
  assert.match(dashboardWorkspace, /却下/);
  assert.match(dashboardWorkspace, /率直な口コミにご協力ください/);
  assert.match(dashboardWorkspace, /counter_qr/);
  assert.match(dashboardWorkspace, /line_after_visit/);
  assert.match(dashboardWorkspace, /shop_website/);
  assert.match(dashboardWorkspace, /eskomi_shop_page/);
  assert.doesNotMatch(dashboardWorkspace, /SUPABASE_SERVICE_ROLE_KEY|process\.env|contactName|contactEmail|confirmationDetails/);
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
