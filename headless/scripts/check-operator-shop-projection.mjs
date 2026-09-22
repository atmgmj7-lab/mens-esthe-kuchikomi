import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const projectionPath = join(root, "lib/dashboard/operator-shop-projection.ts");

function loadProjection() {
  const output = ts.transpileModule(readFileSync(projectionPath, "utf8"), {
    fileName: projectionPath,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require: (specifier) => {
      if (specifier === "server-only") return {};
      if (specifier === "@/lib/partner/provisioning-service") return {
        getPartnerReviewGrowthMetrics: async () => null,
        listPartnerRegistrationReviews: async () => [],
      };
      if (specifier === "@/lib/supabase/partner-workspace") return { partnerReviewGrowthRepository: {} };
      if (specifier === "@/lib/wp/shops") return { getAllShopsForListing: async () => [], getShopById: async () => null };
      throw new Error(`Unexpected dependency: ${specifier}`);
    },
  });
  return module.exports;
}

const { getOperatorShopDetail, getOperatorShopPage } = loadProjection();
const shop = {
  id: 768,
  title: "Mrs.Rank UP",
  slug: "mrs-rank-up",
  link: "https://mens-esthe-kuchikomi.com/shops/mrs-rank-up/",
  contentHtml: "", excerpt: "", imageUrl: "", media: { cardSquare: { url: "", alt: "" }, detailBanner: null }, terms: [], acf: {}, officialUrl: "https://example.test/", areaSlug: "umeda", primaryArea: { id: 1, slug: "umeda", name: "梅田" }, ranking: {}, strictRanking: {}, publicationStatus: "publish",
};
const registration = {
  submissionId: "11111111-1111-4111-8111-111111111111",
  workspaceId: "22222222-2222-4222-8222-222222222222",
  status: "approved",
  contactName: "must-not-project",
  contactRole: "owner",
  contactEmail: "must-not-project@example.test",
  confirmationDetails: "must-not-project",
  sourceUrl: "https://example.test/",
  createdAt: "2026-09-23T00:00:00.000Z",
  reviewedAt: null, reviewedBy: null, reviewReason: null,
  workspaceState: "active_partner",
  shop: { id: 768, slug: "mrs-rank-up", title: "Mrs.Rank UP", canonicalUrl: "https://mens-esthe-kuchikomi.com/shops/mrs-rank-up/" },
  campaigns: [
    { id: "33333333-3333-4333-8333-333333333333", channel: "counter_qr", token: "token-not-projected", isActive: true, createdAt: "2026-09-23T00:00:00.000Z" },
    { id: "44444444-4444-4444-8444-444444444444", channel: "shop_website", token: "token-not-projected", isActive: true, createdAt: "2026-09-23T00:00:00.000Z" },
  ],
};
const metrics = { workspaceId: registration.workspaceId, shopId: 768, submittedReviews: 3, pendingReviews: 1, publicReviews: 2, campaigns: [] };
const overrides = {
  listShops: async () => [shop], getShop: async () => shop, listRegistrations: async () => [registration], getMetrics: async () => metrics,
};

const page = await getOperatorShopPage({}, overrides);
assert.equal(page.total, 1);
assert.equal(page.records[0].partner.status, "available");
assert.equal(page.records[0].partner.workspaceState, "active_partner");
assert.equal(page.records[0].partner.membershipStatus, "not_available", "membership PII must not be projected");
assert.deepEqual(JSON.parse(JSON.stringify(page.records[0].reviews)), { status: "available", submitted: 3, pending: 1, published: 2 });
assert.deepEqual(JSON.parse(JSON.stringify(page.records[0].assets)), { qr: "ready", line: "not_ready", websiteCta: "ready", widget: "not_ready" });
assert.doesNotMatch(JSON.stringify(page.records[0]), /workspaceId|token-not-projected|must-not-project|service.?role/i, "projection must exclude private identifiers, tokens, PII, and service authority");

const absent = await getOperatorShopDetail(768, { ...overrides, listRegistrations: async () => [] });
assert.equal(absent?.partner.status, "not_observed", "absence from the safe projection must not claim that no workspace exists");
assert.equal(absent?.reviews.submitted, null);

const mismatch = await getOperatorShopDetail(768, { ...overrides, getMetrics: async () => ({ ...metrics, shopId: 999 }) });
assert.equal(mismatch?.partner.status, "identity_mismatch", "a metric/shop mismatch must deny operational projection");
assert.equal(mismatch?.assets.qr, "identity_mismatch");

const slugMismatch = await getOperatorShopDetail(768, {
  ...overrides,
  listRegistrations: async () => [{ ...registration, shop: { ...registration.shop, slug: "wrong-shop" } }],
});
assert.equal(slugMismatch?.partner.status, "identity_mismatch", "a same-ID slug mismatch must not be downgraded to not_observed");

console.log("operator shop projection: PASS");
