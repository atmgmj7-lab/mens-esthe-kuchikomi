import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const migration = read("../supabase/migrations/20260920062938_review_native_foundation.sql");
const types = read("lib/partner/provisioning-service.ts");
const repository = read("lib/supabase/partner-workspace.ts");
const redirectRoute = read("app/r/[token]/route.ts");
const submitPage = read("app/reviews/submit/page.tsx");
const dbContract = read("../supabase/tests/verify_review_native_db_contract.sql");

for (const channel of ["counter_qr", "line_after_visit", "shop_website", "eskomi_shop_page"]) {
  assert.match(types, new RegExp(channel));
}
assert.doesNotMatch(types, /therapist_qr/);
assert.match(types, /buildPartnerReviewCampaignUrl/);
assert.match(types, /recordPartnerReviewCampaignVisit/);
assert.match(types, /getPartnerReviewGrowthMetrics/);
assert.match(types, /submittedReviews/);
assert.match(types, /pendingReviews/);
assert.match(types, /publicReviews/);
assert.match(types, /openCount/);
assert.match(types, /startCount/);
assert.match(types, /conversionCount/);

for (const functionName of ["record_partner_review_campaign_event", "get_partner_review_growth_metrics"]) {
  assert.match(migration, new RegExp(`create or replace function private\\.${functionName}`, "i"));
  assert.match(migration, new RegExp(`create or replace function api\\.${functionName}`, "i"));
  assert.match(migration, new RegExp(`revoke all on function api\\.${functionName}[\\s\\S]*from public, anon, authenticated`, "i"));
  assert.match(migration, new RegExp(`grant execute on function api\\.${functionName}[\\s\\S]*to service_role`, "i"));
  assert.match(repository, new RegExp(`rest/v1/rpc/${functionName}`));
}
assert.match(migration, /open_count bigint not null default 0/i);
assert.match(migration, /start_count bigint not null default 0/i);
assert.match(migration, /count\(distinct s\.review_id\)/i);
assert.match(migration, /moderation_status = 'pending'/i);
assert.match(migration, /publication_status = 'published'/i);
assert.match(redirectRoute, /recordPartnerReviewCampaignVisit[\s\S]*event:\s*"open"/);
assert.match(submitPage, /recordPartnerReviewCampaignVisit[\s\S]*event:\s*"start"/);
assert.match(redirectRoute, /getShopById/);
assert.match(redirectRoute, /publicationStatus\s*!==\s*"publish"/);
assert.match(submitPage, /getShopById/);
assert.match(dbContract, /campaign open\/start counters/i);
assert.match(dbContract, /Phase 3 Review growth metrics/i);
assert.match(dbContract, /duplicate UUID conversion/i);
assert.match(dbContract, /cross-shop Review UUID attribution/i);

function loadTypeScript(path, dependencies) {
  const output = ts.transpileModule(read(path), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)((specifier) => {
    if (specifier in dependencies) return dependencies[specifier];
    throw new Error(`Unexpected dependency in ${path}: ${specifier}`);
  }, loaded, loaded.exports);
  return loaded.exports;
}

const service = loadTypeScript("lib/partner/provisioning-service.ts", {
  "server-only": {},
  "@/lib/shop-slug": { normalizePublicShopSlug: (value) => value },
});
const token = "11111111-1111-4111-8111-111111111111";
assert.equal(
  service.buildPartnerReviewCampaignUrl(token),
  `https://mens-esthe-kuchikomi.com/r/${token}/`,
);
assert.equal(service.buildPartnerReviewCampaignUrl("not-a-token"), null);
const calls = [];
const repositoryMock = {
  async recordReviewCampaignVisit(input) {
    calls.push(input);
    return { id: 712, slug: "shop", title: "Shop", canonicalUrl: "https://mens-esthe-kuchikomi.com/shops/shop/" };
  },
  async getReviewGrowthMetrics(workspaceId) {
    calls.push({ workspaceId });
    return { workspaceId, shopId: 712, submittedReviews: 3, pendingReviews: 1, publicReviews: 1, campaigns: [] };
  },
};
assert.equal((await service.recordPartnerReviewCampaignVisit({ token, event: "open" }, repositoryMock)).id, 712);
assert.deepEqual(calls.at(-1), { token, event: "open" });
const beforeInvalid = calls.length;
assert.equal(await service.recordPartnerReviewCampaignVisit({ token: "bad", event: "open" }, repositoryMock), null);
assert.equal(calls.length, beforeInvalid);
assert.equal((await service.getPartnerReviewGrowthMetrics(token, repositoryMock)).submittedReviews, 3);

console.log("Review Growth backend source contract passed");
