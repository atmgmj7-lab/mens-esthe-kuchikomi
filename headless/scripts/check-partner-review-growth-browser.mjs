import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const fixtureShop = { id: 701, slug: "fixture-shop", title: "検証店舗", canonicalUrl: "https://mens-esthe-kuchikomi.com/shops/fixture-shop/" };
const fixtureToken = "11111111-1111-4111-8111-111111111111";

class TestNextResponse extends Response {
  static redirect(url, status = 307) {
    return new TestNextResponse(null, { status, headers: { location: String(url) } });
  }

  static json(value, init = {}) {
    return new TestNextResponse(JSON.stringify(value), {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  }
}

function loadTypeScript(relativePath, modules) {
  const source = readFileSync(resolve(root, relativePath), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
    },
    fileName: relativePath,
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)((specifier) => {
    if (specifier in modules) return modules[specifier];
    throw new Error(`Unexpected module in ${relativePath}: ${specifier}`);
  }, loaded, loaded.exports);
  return loaded.exports;
}

const nextServer = { NextResponse: TestNextResponse };
const campaignRoute = loadTypeScript("app/r/[token]/route.ts", {
  "next/server": nextServer,
  "@/lib/partner/provisioning-service": {
    openPartnerReviewCampaign: async (token) => token === fixtureToken ? fixtureShop : null,
  },
  "@/lib/supabase/partner-workspace": { partnerReviewGrowthRepository: {} },
});

const validation = loadTypeScript("lib/review-validation.ts", {});
let wordpressResult = { ok: true, id: 9981 };
let wordpressCalls = 0;
const conversionCalls = [];
const reviewApi = loadTypeScript("app/api/reviews/submit/route.ts", {
  "next/server": nextServer,
  "@/lib/review-rate-limit": { checkReviewRateLimit: () => ({ allowed: true, retryAfterSec: 0 }) },
  "@/lib/review-validation": validation,
  "@/lib/partner/provisioning-service": {
    openPartnerReviewCampaign: async (token) => token === fixtureToken ? fixtureShop : null,
    recordPartnerReviewCampaignSubmission: async (input) => { conversionCalls.push(input); return true; },
  },
  "@/lib/supabase/partner-workspace": { partnerReviewGrowthRepository: {} },
  "@/lib/wp/review-submit": { submitReviewToWordPress: async () => { wordpressCalls += 1; return wordpressResult; } },
  "@/lib/wp/shops": { getShopBySlug: async (slug) => slug === fixtureShop.slug
    ? { ...fixtureShop, publicationStatus: "publish" }
    : slug === "other-shop" ? { ...fixtureShop, id: 702, slug, publicationStatus: "publish" }
      : null },
});

const reviewPayload = {
  shopSlug: fixtureShop.slug,
  nickname: "投稿者",
  usedPeriod: "今月",
  ratingTotal: 5,
  reviewBody: "これは30文字以上ある口コミ本文です。キャンペーン送信の検証に使用します。",
  website: "",
};

async function submit(payload) {
  return reviewApi.POST({
    headers: new Headers({ "x-forwarded-for": "198.51.100.10" }),
    json: async () => payload,
  });
}

wordpressCalls = 0;
conversionCalls.length = 0;
wordpressResult = { ok: true, id: 9981 };
let response = await submit({ ...reviewPayload, campaignToken: fixtureToken });
assert.equal(response.status, 200);
assert.equal(wordpressCalls, 1, "campaign submission reaches WordPress once");
assert.deepEqual(conversionCalls, [{ token: fixtureToken, shopId: fixtureShop.id, wordpressReviewId: 9981 }], "conversion stores only token and WordPress identities");

wordpressCalls = 0;
conversionCalls.length = 0;
wordpressResult = { ok: false, error: "WordPress unavailable" };
response = await submit({ ...reviewPayload, campaignToken: fixtureToken });
assert.equal(response.status, 503);
assert.equal(wordpressCalls, 1);
assert.equal(conversionCalls.length, 0, "failed WordPress submission has no conversion");

wordpressCalls = 0;
conversionCalls.length = 0;
wordpressResult = { ok: true, id: 9982 };
response = await submit({ ...reviewPayload, shopSlug: "other-shop", campaignToken: fixtureToken });
assert.equal(response.status, 400);
assert.equal(wordpressCalls, 0, "campaign/shop mismatch never reaches WordPress");
assert.equal(conversionCalls.length, 0);

wordpressCalls = 0;
conversionCalls.length = 0;
response = await submit({ ...reviewPayload, campaignToken: "invalid-token" });
assert.equal(response.status, 200, "invalid campaigns fall back to the normal review path");
assert.equal(wordpressCalls, 1);
assert.equal(conversionCalls.length, 0);

const server = createServer(async (request, reply) => {
  const origin = `http://${request.headers.host}`;
  const url = new URL(request.url ?? "/", origin);
  if (url.pathname.startsWith("/r/")) {
    const token = url.pathname.split("/")[2] ?? "";
    const routeResponse = await campaignRoute.GET({ nextUrl: url }, { params: Promise.resolve({ token }) });
    reply.writeHead(routeResponse.status, Object.fromEntries(routeResponse.headers.entries()));
    reply.end(await routeResponse.text());
    return;
  }
  if (url.pathname === "/reviews/submit/") {
    const campaign = url.searchParams.get("campaign") ?? "";
    const shop = url.searchParams.get("shop") ?? "";
    const valid = !campaign || (campaign === fixtureToken && shop === fixtureShop.slug);
    reply.writeHead(valid ? 200 : 400, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
    reply.end(valid
      ? `<!doctype html><main><form data-review-submit-form data-shop="${shop}" data-campaign="${campaign}"><button>口コミを送信する</button></form></main>`
      : "<!doctype html><main role=alert>キャンペーンの投稿先店舗を確認できません。</main>");
    return;
  }
  reply.writeHead(404).end();
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const baseUrl = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
try {
  const invalid = await fetch(`${baseUrl}/r/invalid-token/`, { redirect: "manual" });
  assert.equal(invalid.status, 404);
  assert.equal(invalid.headers.get("cache-control"), "no-store");
  assert.equal(invalid.headers.get("x-robots-tag"), "noindex, nofollow");

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${baseUrl}/r/${fixtureToken}/`, { waitUntil: "domcontentloaded" });
  assert.equal(new URL(page.url()).pathname, "/reviews/submit/");
  assert.equal(new URL(page.url()).search, `?shop=${fixtureShop.slug}&campaign=${fixtureToken}`);
  await page.locator("[data-review-submit-form]").waitFor({ state: "visible" });
  assert.equal(await page.locator("[data-review-submit-form]").getAttribute("data-shop"), fixtureShop.slug);
  assert.equal(await page.locator("[data-review-submit-form]").getAttribute("data-campaign"), fixtureToken);

  await page.goto(`${baseUrl}/reviews/submit/?shop=${fixtureShop.slug}`, { waitUntil: "domcontentloaded" });
  assert.equal(await page.locator("[data-review-submit-form]").getAttribute("data-campaign"), "");
  await page.close();
  console.log("partner review growth changed-flow headless browser QA passed");
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
