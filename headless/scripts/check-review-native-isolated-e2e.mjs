import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { chromium } from "@playwright/test";

const headlessRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(headlessRoot, "..");
const read = (path) => readFileSync(resolve(headlessRoot, path), "utf8");

function loadTypeScript(path, dependencies = {}, jsx = false) {
  const compilerOptions = {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  };
  if (jsx) compilerOptions.jsx = ts.JsxEmit.ReactJSX;
  const result = ts.transpileModule(read(path), {
    fileName: path,
    compilerOptions,
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, `${path} must transpile for isolated E2E`);
  const loaded = { exports: {} };
  new Function("require", "module", "exports", result.outputText)((specifier) => {
    if (specifier === "server-only") return {};
    if (specifier === "react/jsx-runtime") return jsxRuntime;
    if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
    if (specifier.startsWith("node:")) return requireBuiltin(specifier);
    throw new Error(`Unexpected isolated E2E dependency from ${path}: ${specifier}`);
  }, loaded, loaded.exports);
  return loaded.exports;
}

function requireBuiltin(specifier) {
  if (specifier === "node:crypto") return awaitImportCache.crypto;
  if (specifier === "node:net") return awaitImportCache.net;
  throw new Error(`Unsupported builtin: ${specifier}`);
}

const awaitImportCache = {
  crypto: await import("node:crypto"),
  net: await import("node:net"),
};

function localSupabaseEnvironment() {
  const output = execFileSync("supabase", ["status", "-o", "env"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const values = new Map();
  for (const line of output.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match) continue;
    values.set(match[1], match[2].replace(/^"|"$/g, ""));
  }
  const apiUrl = values.get("API_URL");
  const serviceRoleKey = values.get("SERVICE_ROLE_KEY");
  assert.ok(apiUrl && serviceRoleKey, "local Supabase API and service role must be available");
  const parsed = new URL(apiUrl);
  assert.equal(parsed.protocol, "http:");
  assert.ok(["127.0.0.1", "localhost"].includes(parsed.hostname), "E2E must target local Supabase only");
  return { apiUrl, serviceRoleKey };
}

const config = readFileSync(join(repositoryRoot, "supabase/config.toml"), "utf8");
const projectId = config.match(/^project_id\s*=\s*"([^"]+)"\s*$/m)?.[1];
assert.ok(projectId, "local Supabase project_id is required");
const database = `supabase_db_${projectId}`;
const containers = execFileSync("docker", ["ps", "--format", "{{.Names}}"], { encoding: "utf8" });
assert.ok(containers.split("\n").includes(database), "local Supabase database must be running");

function sql(input) {
  return execFileSync("docker", [
    "exec", "-i", database, "psql", "-X", "-q", "-A", "-t", "-F", "|",
    "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres",
  ], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

const SHOP_A = 99170001;
const SHOP_B = 99170002;
const shopA = {
  id: SHOP_A,
  slug: "isolated-review-e2e-a",
  title: "Isolated Review E2E Shop A",
  publicationStatus: "publish",
  primaryArea: { id: 4, slug: "umeda", name: "梅田" },
  terms: [{ id: 4, slug: "umeda", name: "梅田", taxonomy: "area" }],
};
const shopB = {
  id: SHOP_B,
  slug: "isolated-review-e2e-b",
  title: "Isolated Review E2E Shop B",
  publicationStatus: "publish",
  primaryArea: { id: 13, slug: "shinosaka", name: "新大阪" },
  terms: [{ id: 13, slug: "shinosaka", name: "新大阪", taxonomy: "area" }],
};

const setup = sql(`
insert into app.shops (wp_post_id, slug, canonical_path, name)
values
  (${SHOP_A}, '${shopA.slug}', '/shops/${shopA.slug}/', '${shopA.title}'),
  (${SHOP_B}, '${shopB.slug}', '/shops/${shopB.slug}/', '${shopB.title}');
insert into private.partner_workspaces (wp_shop_id, shop_slug, shop_name, canonical_url, state)
values
  (${SHOP_A}, '${shopA.slug}', '${shopA.title}', 'https://mens-esthe-kuchikomi.com/shops/${shopA.slug}/', 'free_official_partner'),
  (${SHOP_B}, '${shopB.slug}', '${shopB.title}', 'https://mens-esthe-kuchikomi.com/shops/${shopB.slug}/', 'free_official_partner');
insert into private.partner_review_campaigns (workspace_id, channel)
select id, 'counter_qr' from private.partner_workspaces where wp_shop_id in (${SHOP_A}, ${SHOP_B})
order by wp_shop_id;
select w.wp_shop_id, w.id, c.token
from private.partner_workspaces w
join private.partner_review_campaigns c on c.workspace_id = w.id
where w.wp_shop_id in (${SHOP_A}, ${SHOP_B})
order by w.wp_shop_id;
`);
const setupRows = setup.split("\n").filter(Boolean).map((line) => line.split("|"));
assert.equal(setupRows.length, 2);
const [, workspaceA, campaignA] = setupRows[0];
const [, , campaignB] = setupRows[1];

const { apiUrl, serviceRoleKey } = localSupabaseEnvironment();
process.env.SUPABASE_URL = apiUrl;
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;

const repositoryModule = loadTypeScript("lib/supabase/review-native.ts");
const repository = repositoryModule.createSupabaseReviewRepository({
  baseUrl: apiUrl,
  serviceRoleKey,
});
const security = loadTypeScript("lib/reviews/submission-security.ts");
const validation = loadTypeScript("lib/review-validation.ts");

class TestNextResponse extends Response {
  static json(value, init = {}) {
    return new TestNextResponse(JSON.stringify(value), {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  }
}

const route = loadTypeScript("app/api/reviews/submit/route.ts", {
  "next/server": { NextResponse: TestNextResponse },
  "@/lib/reviews/submission-security": security,
  "@/lib/supabase/review-native": { reviewNativeRepository: repository },
  "@/lib/review-validation": validation,
  "@/lib/wp/shops": {
    getShopBySlug: async (slug) => slug === shopA.slug ? shopA : slug === shopB.slug ? shopB : null,
  },
  "@/lib/seo": { SITE_URL: "https://mens-esthe-kuchikomi.com" },
});

function submitRequest({ idempotencyKey, body, rating, ip, campaignToken = null, shop = shopA }) {
  const payload = JSON.stringify({
    shopSlug: shop.slug,
    nickname: "Synthetic E2E Reviewer",
    usedPeriod: "今月",
    ratingTotal: rating,
    ratingPrice: rating,
    ratingService: rating,
    ratingCleanliness: rating,
    revisitIntent: rating >= 3 ? "また利用したい" : "利用しない",
    reviewBody: body,
    website: "",
    ...(campaignToken ? { campaignToken } : {}),
  });
  return {
    headers: new Headers({
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(payload)),
      origin: "https://mens-esthe-kuchikomi.com",
      host: "mens-esthe-kuchikomi.com",
      "sec-fetch-site": "same-origin",
      "x-eskomi-csrf": "review-submit-v1",
      "idempotency-key": idempotencyKey,
      "x-vercel-forwarded-for": ip,
    }),
    text: async () => payload,
  };
}

async function submit(input) {
  const keyHash = security.buildReviewIdempotencyKeyHash(input.idempotencyKey);
  const before = Number(sql(`
select count(*) from private.review_idempotency_keys where key_hash = '${keyHash}';
`));
  const response = await route.POST(submitRequest(input));
  const payload = await response.json();
  assert.equal(response.status, 200, JSON.stringify({ status: response.status, payload }));
  assert.deepEqual(Object.keys(payload).sort(), ["message", "ok"]);
  assert.equal(payload.ok, true);
  const rows = sql(`
select k.review_id
from private.review_idempotency_keys k
where k.key_hash = '${keyHash}';
`).split("\n").filter(Boolean);
  assert.equal(rows.length, 1, "successful API submission must have exactly one idempotency row");
  assert.match(rows[0], /^[0-9a-f-]{36}$/);
  return { reviewId: rows[0], created: before === 0 };
}

function reviewInput(index, rating, campaignToken = null) {
  return {
    idempotencyKey: randomUUID(),
    body: `Synthetic isolated Review ${index} validates the complete native workflow without Production data.`,
    rating,
    ip: `198.51.100.${20 + index}`,
    campaignToken,
  };
}

const campaignUrlModule = loadTypeScript("lib/partner/provisioning-service.ts", {
  "@/lib/shop-slug": { normalizePublicShopSlug: (value) => value },
});
assert.equal(
  campaignUrlModule.buildPartnerReviewCampaignUrl(campaignA),
  `https://mens-esthe-kuchikomi.com/r/${campaignA}/`,
);
sql(`
set role service_role;
select api.record_partner_review_campaign_event('${campaignA}', 'open');
select api.record_partner_review_campaign_event('${campaignA}', 'start');
`);

const firstInput = reviewInput(1, 5, campaignA);
const first = await submit(firstInput);
assert.equal(first.created, true);
const duplicate = await submit(firstInput);
assert.equal(duplicate.created, false);
assert.equal(duplicate.reviewId, first.reviewId);

const parallelInput = reviewInput(2, 4);
const parallel = await Promise.all([submit(parallelInput), submit(parallelInput)]);
assert.equal(new Set(parallel.map((item) => item.reviewId)).size, 1);
assert.equal(sql(`
select count(*) from private.review_idempotency_keys
where key_hash = '${security.buildReviewIdempotencyKeyHash(parallelInput.idempotencyKey)}';
`), "1");
const secondId = parallel[0].reviewId;
const negative = await submit(reviewInput(3, 1));
const rejected = await submit(reviewInput(4, 2));
const spam = await submit(reviewInput(5, 1));

const queue = await repository.listModerationQueue({ limit: 20, offset: 0 });
assert.equal(queue.status, "ok");
assert.equal(queue.data.filter((item) => item.shop.wpShopId === SHOP_A).length, 5);

for (const reviewId of [first.reviewId, secondId]) {
  const approved = await repository.moderate({
    reviewId,
    decision: "approved",
    actorLabel: "isolated-e2e",
    reason: "synthetic E2E approval",
  });
  assert.equal(approved.status, "ok");
  assert.equal(approved.data.publicationStatus, "draft");
  assert.equal(approved.data.isPublic, false);
  const published = await repository.publish({
    reviewId,
    actorLabel: "isolated-e2e",
    reason: "synthetic E2E publication",
  });
  assert.equal(published.status, "ok");
}

const publicAdapterModule = loadTypeScript("lib/reviews/public-adapter.ts", {
  "@/lib/supabase/review-native": { reviewNativeRepository: repository },
  "@/lib/wp/reviews": {
    getApprovedShopReviews: async () => { throw new Error("WordPress reader must not run"); },
    getApprovedReviewsPage: async () => { throw new Error("WordPress reader must not run"); },
  },
  "@/lib/wp/shops": { getAllShopsForListing: async () => [shopA, shopB] },
});
const adapter = publicAdapterModule.createPublicReviewAdapter({
  repository,
  readWordPressShopReviews: async () => { throw new Error("WordPress reader must not run"); },
  readWordPressGlobalReviews: async () => { throw new Error("WordPress reader must not run"); },
  listWordPressShops: async () => [shopA, shopB],
  environment: { REVIEW_READ_SOURCE: "supabase" },
});
const viewModelModule = loadTypeScript("lib/shop-review-view-model.ts");
const belowThreshold = await adapter.getShopReviews(shopA, 1, 20);
assert.equal(belowThreshold.status, "available");
assert.equal(belowThreshold.page.total, 2);
const belowModel = viewModelModule.buildShopReviewViewModel(belowThreshold);
assert.equal(belowModel.showGraph, false);
assert.equal(belowModel.aggregateRating, null);

await repository.moderate({
  reviewId: negative.reviewId,
  decision: "approved",
  actorLabel: "isolated-e2e",
  reason: "negative synthetic review is valid user feedback",
});
await repository.publish({
  reviewId: negative.reviewId,
  actorLabel: "isolated-e2e",
  reason: "publish valid negative synthetic review",
});
const rejectedResult = await repository.moderate({
  reviewId: rejected.reviewId,
  decision: "rejected",
  actorLabel: "isolated-e2e",
  reason: "synthetic rejection path",
});
assert.equal(rejectedResult.status, "ok");
assert.equal(rejectedResult.data.isPublic, false);
const spamResult = await repository.moderate({
  reviewId: spam.reviewId,
  decision: "spam",
  actorLabel: "isolated-e2e",
  reason: "synthetic spam path",
});
assert.equal(spamResult.status, "ok");
assert.equal(spamResult.data.isPublic, false);

const crossShop = await repository.recordCampaignAttribution({
  campaignToken: campaignB,
  reviewId: first.reviewId,
  shop: { wpShopId: SHOP_A },
});
assert.equal(crossShop.status, "ok");
assert.equal(crossShop.data.recorded, false);

const publicResult = await adapter.getShopReviews(shopA, 1, 20);
assert.equal(publicResult.status, "available");
assert.equal(publicResult.source, "supabase");
assert.equal(publicResult.page.total, 3);
assert.equal(publicResult.page.metrics.total.responseCount, 3);
assert.equal(publicResult.page.metrics.total.average, 3.3);
assert.ok(publicResult.page.reviews.every((review) => typeof review.id === "string"));
assert.ok(publicResult.page.reviews.some((review) => review.ratings.total === 1));
assert.equal(publicResult.page.reviews.some((review) => review.id === rejected.reviewId), false);
assert.equal(publicResult.page.reviews.some((review) => review.id === spam.reviewId), false);

const globalResult = await adapter.getGlobalReviews(1, 20, "umeda");
assert.equal(globalResult.status, "available");
assert.equal(globalResult.page.total, 3);
assert.ok(globalResult.page.reviews.every((review) => review.shop.id === SHOP_A));
const reviewModel = viewModelModule.buildShopReviewViewModel(publicResult);
assert.equal(reviewModel.showGraph, true);
assert.equal(reviewModel.totalApproved, 3);
assert.equal(reviewModel.aggregateRatingCount, 3);
assert.equal(reviewModel.aggregateRating, 3.3);
assert.equal(reviewModel.metrics.length, 4);

const seoModule = loadTypeScript("lib/seo.ts", {
  "@/lib/price-normalization": {
    resolveShopPrimaryPrice: () => null,
    shouldOutputPriceSchema: () => false,
    formatPriceForDisplay: () => "",
  },
  "@/lib/shop-fact-normalization": { normalizeShopAddress: () => null },
  "@/lib/wp/client": { stripHtml: (value) => typeof value === "string" ? value : "" },
});
const schemaShop = { ...shopA, acf: {}, media: { cardSquare: null } };
const belowSchema = seoModule.shopLocalBusinessJsonLd(schemaShop, belowModel);
assert.equal(belowSchema.aggregateRating, undefined);
const schema = seoModule.shopLocalBusinessJsonLd(schemaShop, reviewModel);
assert.deepEqual(schema.aggregateRating, {
  "@type": "AggregateRating",
  ratingValue: 3.3,
  ratingCount: 3,
  reviewCount: 3,
  bestRating: 5,
  worstRating: 1,
});

const counts = sql(`
select concat_ws('|',
  count(*) filter (where r.shop_id = s.id),
  count(*) filter (where r.shop_id = s.id and r.moderation_status = 'pending'),
  count(*) filter (where r.shop_id = s.id and r.is_public),
  (select count(*) from private.partner_review_campaign_submissions pcs
   join private.partner_review_campaigns c on c.id = pcs.campaign_id
   where c.token = '${campaignA}' and pcs.review_id is not null),
  (select open_count from private.partner_review_campaigns where token = '${campaignA}'),
  (select start_count from private.partner_review_campaigns where token = '${campaignA}')
)
from app.shops s
left join app.reviews r on r.shop_id = s.id
where s.wp_post_id = ${SHOP_A}
group by s.id;
`);
assert.equal(counts, "5|0|3|1|1|1");
const growth = sql(`
set role service_role;
select submitted_reviews || '|' || pending_reviews || '|' || public_reviews
from api.get_partner_review_growth_metrics('${workspaceA}');
`);
assert.equal(growth, "5|0|3");

const css = new Proxy({}, { get: (_target, key) => String(key) });
const dashboardModule = loadTypeScript("components/shop-detail/ShopReviewDashboard.tsx", {
  "./ShopDetail.module.css": css,
}, true);
const dashboard = renderToStaticMarkup(React.createElement(
  dashboardModule.ShopReviewDashboard,
  { model: reviewModel },
));
assert.match(dashboard, /承認済み口コミ/);
assert.match(dashboard, /aria-label="承認済み口コミの評価グラフ"/);
assert.match(dashboard, /Synthetic isolated Review/);

const style = read("components/shop-detail/ShopDetail.module.css");
const pageHtml = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${style}</style></head><body><main style="max-width:900px;margin:auto">${dashboard}</main></body></html>`;
const server = createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(pageHtml);
});
await new Promise((resolveServer) => server.listen(0, "127.0.0.1", resolveServer));
const address = server.address();
assert.ok(address && typeof address !== "string");
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const response = await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200);
    await page.locator('[aria-label="承認済み口コミの評価グラフ"]').waitFor({ state: "visible" });
    assert.equal(await page.getByText("承認済み口コミ", { exact: false }).count() >= 1, true);
    const geometry = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    assert.ok(geometry.body <= geometry.viewport + 1, `${width}px UI must not overflow`);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(pageErrors, []);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

assert.equal(sql(`
select count(*) from private.partner_review_campaign_submissions pcs
join private.partner_review_campaigns c on c.id = pcs.campaign_id
where c.token = '${campaignB}';
`), "0");

console.log(JSON.stringify({
  status: "PASS",
  target: "LOCAL_SUPABASE_ONLY",
  campaignUrl: "PASS",
  submit: 5,
  duplicateRetry: "PASS",
  parallelRetry: "PASS",
  campaignAttribution: 1,
  crossShopRejected: true,
  rejected: 1,
  spam: 1,
  publicReviews: 3,
  belowThreeGraph: false,
  atLeastThreeGraph: true,
  aggregateRating: schema.aggregateRating,
  viewports: [390, 1280],
  productionWrite: 0,
}, null, 2));
