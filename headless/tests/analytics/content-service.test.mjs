import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import { registerServerOnly } from "./register-server-only.mjs";

registerServerOnly();

const content = await import("../../lib/analytics/content-service.ts");
const normalize = await import("../../lib/wp/normalize.ts");
const detail = await import("../../lib/shop-detail-view-model.ts");
const coverage = await import("../../lib/shop-information-coverage.ts");

const NOW = () => new Date("2026-08-23T00:00:00+09:00");
const hash = (value) => createHash("sha256").update(value, "utf8").digest("hex");

function provenance(field, value, reviewedAt = "2026-08-01") {
  return {
    field,
    sourceUrl: "https://source.example/current",
    sourceType: "official-site",
    observedAt: reviewedAt,
    reviewedAt,
    reviewStatus: "reviewed",
    publishedValueHash: hash(value),
  };
}

function shop({ id = 1, slug = "alpha", title = "Alpha", area = [10], facts = true, reviewedAt = "2026-08-01", mutate = {} } = {}) {
  const acf = {
    shop_price_60min: "12,000円",
    price_60: "12,000円",
    shop_hours: "10:00-22:00",
    shop_station: "梅田駅",
    shop_address: "大阪府大阪市北区1-1",
    official_url: "https://alpha.example/",
  };
  Object.assign(acf, mutate);
  const result = {
    id, slug, status: "publish", link: `https://mens-esthe-kuchikomi.com/shop/${slug}/`,
    title: { rendered: title }, content: { rendered: `<p>${title}</p>` }, date: "2026-01-01T00:00:00Z", modified: "2026-08-01T00:00:00Z",
    area, acf,
  };
  if (facts && !Object.hasOwn(mutate, "shop_fact_provenance")) {
    const model = detail.buildShopDetailViewModel(normalize.normalizeShop(result), "");
    result.acf.shop_fact_provenance = ["price", "hours", "access", "official"].map((field) => ({
      ...provenance(field, "fixture", reviewedAt),
      publishedValueHash: coverage.hashShopFactValue(field, model),
    }));
  }
  return result;
}

function area({ id = 10, slug = "umeda", name = "梅田", count = 1 } = {}) {
  return { id, slug, name, parent: 0, count };
}

function reviews({ areaSlug = "umeda", shopId = 1, shopSlug = "alpha", total = 1, items } = {}) {
  const reviewArea = { id: 10, slug: areaSlug, name: "梅田" };
  const rows = items ?? (total === 0 ? [] : [{
    id: 700, body: "user review that must not cross the boundary", submittedAt: "2026-08-02T10:00:00Z",
    ratingTotal: 5, ratingPrice: 4, ratingService: 5, ratingCleanliness: 4,
    shop: { id: shopId, slug: shopSlug, name: "Shop display name", primaryArea: reviewArea },
    areas: [reviewArea],
  }]);
  return { items: rows, total, totalPages: total === 0 ? 0 : 1, page: 1 };
}

function fakeClient(handler) {
  const calls = [];
  return {
    calls,
    client: {
      async request(path) {
        calls.push(path);
        return handler(path);
      },
    },
  };
}

function ok(body, total = Array.isArray(body) ? body.length : 1, totalPages = total === 0 ? 0 : 1) {
  return { status: 200, body, pagination: { total, totalPages } };
}

test("WordPressAdapter implements every ContentService method through the injected production network seam", async () => {
  const source = fakeClient((path) => {
    const url = new URL(path, "https://test.invalid");
    if (url.pathname === "/wp/v2/area") return ok(url.searchParams.has("slug") ? [area()] : [area()]);
    if (url.pathname === "/wp/v2/shop") return ok([shop()]);
    if (url.pathname === "/wp/v2/shop/1") return ok(shop());
    if (url.pathname === "/escomi/v1/reviews") return ok(reviews());
    throw new Error(`unexpected ${path}`);
  });
  const service = new content.WordPressAdapter({ client: source.client, now: NOW });

  assert.deepEqual((await service.getAreas()).data.map((item) => item.slug), ["umeda"]);
  assert.equal((await service.getArea("umeda")).data.id, 10);
  assert.equal((await service.getShops({ areaSlug: "umeda", limit: 1, page: 1 })).data.shops[0].slug, "alpha");
  assert.equal((await service.getShop(1)).data.slug, "alpha");
  const reviewResult = await service.getApprovedReviews({ areaSlug: "umeda", limit: 20 });
  assert.deepEqual(reviewResult.data.reviews, [{ id: 700, shopId: 1, shopSlug: "alpha", areaSlugs: ["umeda"] }]);
  assert.equal(JSON.stringify(reviewResult.data).includes("user review"), false);
  assert.equal((await service.getContentHealth({ areaSlug: "umeda" })).data.areas[0].approvedReviewCount, 1);
  assert.equal(source.calls.every((path) => path.startsWith("/")), true);
});

test("WordPressAdapter enforces publish-only options, bounded pagination, exact lookups, and duplicate fail-closed behavior", async () => {
  const source = fakeClient((path) => {
    const url = new URL(path, "https://test.invalid");
    if (url.pathname === "/wp/v2/area") return ok([area()]);
    if (url.pathname === "/wp/v2/shop") return ok([shop(), shop({ id: 2, slug: "beta" })], 2, 1);
    if (url.pathname === "/wp/v2/shop/1") return ok(shop());
    return ok(reviews());
  });
  const service = new content.WordPressAdapter({ client: source.client, now: NOW });
  assert.equal((await service.getShops({ status: "draft" })).state, "invalid_response");
  assert.equal((await service.getShops({ page: 101 })).state, "invalid_response");
  assert.equal((await service.getShops({ limit: 101 })).state, "invalid_response");
  assert.equal((await service.getArea("bad slug")).state, "invalid_response");
  assert.equal((await service.getShop("bad/slug")).state, "invalid_response");
  const listed = await service.getShops({ limit: 2, page: 1 });
  assert.deepEqual(listed.data.shops.map((item) => item.slug), ["alpha", "beta"]);

  const duplicate = new content.WordPressAdapter({ client: fakeClient((path) => {
    if (path.startsWith("/wp/v2/shop")) return ok([shop(), shop({ id: 1, slug: "other" })], 2, 1);
    return ok([area()]);
  }).client });
  assert.equal((await duplicate.getShops({ limit: 2 })).state, "invalid_response");

  const pagedReviews = new content.WordPressAdapter({ client: fakeClient((path) => {
    const page = new URL(path, "https://test.invalid").searchParams.get("page");
    const first = reviews();
    const second = reviews({ items: [{ ...first.items[0], id: 701 }], total: 1 });
    return {
      status: 200,
      body: page === "2" ? { ...second, total: 2, totalPages: 2, page: 2 } : { ...first, total: 2, totalPages: 2 },
    };
  }).client });
  const shopReviews = await pagedReviews.getApprovedReviews({ shopId: 1, limit: 1 });
  assert.deepEqual(shopReviews.data.reviews.map((review) => review.id), [700, 701]);

  const firstPage = Array.from({ length: 100 }, (_, index) => shop({ id: index + 1, slug: `shop-${index + 1}`, facts: false }));
  const crossPageDuplicate = new content.WordPressAdapter({ client: fakeClient((path) => {
    const url = new URL(path, "https://test.invalid");
    if (url.pathname === "/wp/v2/area") return ok([area()]);
    if (url.pathname === "/wp/v2/shop") return url.searchParams.get("page") === "2"
      ? ok([firstPage[0]], 101, 2)
      : ok(firstPage, 101, 2);
    if (url.pathname === "/escomi/v1/reviews") return ok(reviews({ total: 0 }));
    throw new Error(path);
  }).client });
  assert.equal((await crossPageDuplicate.getContentHealth({ areaSlug: "umeda" })).state, "invalid_response");
});

test("Content Health counts only current safely-provenanced facts, keeps missing distinct, and applies deterministic 180 completed-day staleness", async () => {
  const stale = shop({ id: 2, slug: "stale", reviewedAt: "2026-02-23" });
  const threshold = shop({ id: 5, slug: "threshold", reviewedAt: "2026-02-24" });
  const missing = shop({ id: 3, slug: "missing", facts: false });
  const mismatched = shop({ id: 4, slug: "mismatch", mutate: { shop_fact_provenance: [provenance("price", "wrong")] } });
  const source = fakeClient((path) => {
    const url = new URL(path, "https://test.invalid");
    if (url.pathname === "/wp/v2/area") return ok([area()]);
    if (url.pathname === "/wp/v2/shop") return ok([stale, missing, mismatched, shop(), threshold], 5, 1);
    if (url.pathname === "/escomi/v1/reviews") return ok(reviews({ total: 0 }));
    throw new Error(path);
  });
  const health = await new content.WordPressAdapter({ client: source.client, now: NOW }).getContentHealth({ areaSlug: "umeda" });
  assert.equal(health.state, "ok");
  const row = health.data.areas[0];
  assert.deepEqual([row.publishedShops, row.verifiedPriceCount, row.verifiedHoursCount, row.verifiedOfficialUrlCount, row.verifiedAccessCount], [5, 3, 3, 3, 3]);
  assert.equal(row.staleConfirmedDateShopCount, 1);
  assert.equal(row.missingRate, 0.4);
  assert.equal(row.approvedReviewCount, 0);
});

test("Content Health preserves successful zero counts and null missingRate, with deterministic area ordering", async () => {
  const source = fakeClient((path) => {
    const url = new URL(path, "https://test.invalid");
    if (url.pathname === "/wp/v2/area") return ok([area({ id: 20, slug: "zeta", name: "Z", count: 0 }), area({ id: 10, slug: "alpha", name: "A", count: 0 })]);
    if (url.pathname === "/wp/v2/shop") return ok([], 0, 0);
    if (url.pathname === "/escomi/v1/reviews") return ok(reviews({ total: 0 }));
    throw new Error(path);
  });
  const health = await new content.WordPressAdapter({ client: source.client, now: NOW }).getContentHealth();
  assert.equal(health.state, "ok");
  assert.deepEqual(health.data.areas.map((item) => item.area.slug), ["alpha", "zeta"]);
  for (const row of health.data.areas) {
    assert.equal(row.publishedShops, 0);
    assert.equal(row.missingRate, null);
    assert.equal(row.approvedReviewCount, 0);
  }
});

test("WordPress failures distinguish no_data, auth/API errors, timeout, body failure, and malformed successful payloads", async () => {
  const cases = [
    [{ status: 401, body: null }, "auth_error"],
    [{ status: 500, body: null }, "api_error"],
    [{ status: 200, body: null, pagination: { total: 0, totalPages: 0 } }, "invalid_response"],
  ];
  for (const [response, state] of cases) {
    const service = new content.WordPressAdapter({ client: fakeClient(() => response).client });
    assert.equal((await service.getAreas()).state, state);
  }
  const empty = new content.WordPressAdapter({ client: fakeClient(() => ok([])).client });
  assert.equal((await empty.getAreas()).state, "no_data");
  const timeout = new content.WordPressAdapter({ client: fakeClient(() => { throw new content.WordPressAnalyticsRequestError("timeout", "synthetic"); }).client });
  assert.equal((await timeout.getAreas()).state, "timeout");
  const bodyFailure = new content.WordPressAdapter({ client: fakeClient(() => { throw new Error("body read failed"); }).client });
  assert.equal((await bodyFailure.getAreas()).state, "api_error");
});
