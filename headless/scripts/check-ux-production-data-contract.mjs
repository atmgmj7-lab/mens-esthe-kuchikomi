import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => {
  const absolutePath = join(root, path);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
};

function compileModule(path, requireMap = {}) {
  const source = read(path);
  assert.ok(source, `${path} must exist`);
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  }).outputText;
  const loaded = { exports: {} };
  const require = (id) => {
    if (id in requireMap) return requireMap[id];
    throw new Error(`Unexpected require from ${path}: ${id}`);
  };
  vm.runInNewContext(
    compiled,
    { module: loaded, exports: loaded.exports, require, URL, console },
    { filename: `${path}.cjs` }
  );
  return loaded.exports;
}

const legacyRanking = {
  manualRank: 2,
  rankingPriority: null,
  isRankingEnabled: true,
  rankingReason: "既存表示順",
  isPr: false,
  rankingLabel: "",
  promotion: { requiresDisclosure: false }
};
const wpClient = {
  rendered: (value) => value?.rendered ?? "",
  safeText: (value) => typeof value === "string" ? value : "",
  stripHtml: (value) => value.replace(/<[^>]+>/g, "")
};
const boundary = compileModule("lib/ux-production-data-boundary.ts");
const normalize = compileModule("lib/wp/normalize.ts", {
  "@/lib/shop-ranking": { normalizeShopRanking: () => legacyRanking },
  "@/lib/ux-production-data-boundary": boundary,
  "@/lib/wp/client": wpClient,
  "@/lib/wp/path-encoding": { encodeBrowserWpContentPath: (value) => value }
});

function shopFixture(overrides = {}) {
  return {
    id: 101,
    date: "2026-08-15T00:00:00+09:00",
    modified: "2026-08-15T00:00:00+09:00",
    slug: "fixture-shop",
    link: "https://mens-esthe-kuchikomi.com/shops/fixture-shop/",
    title: { rendered: "Fixture Shop" },
    content: { rendered: "" },
    excerpt: { rendered: "" },
    acf: {},
    ...overrides
  };
}

const featured = normalize.normalizeShop(shopFixture({
  featured_media: 1009,
  _embedded: {
    "wp:featuredmedia": [{
      source_url: "https://mens-esthe-kuchikomi.com/wp-content/uploads/shop.jpg",
      alt_text: "Fixture Shop 店舗写真",
      media_details: {
        width: 1200,
        height: 1200,
        sizes: {
          large: {
            source_url: "https://mens-esthe-kuchikomi.com/wp-content/uploads/shop-1024.jpg",
            width: 1024,
            height: 1024
          }
        }
      }
    }]
  }
}));

assert.equal(featured.imageUrl, "/wp-content/uploads/shop-1024.jpg", "legacy imageUrl must remain unchanged");
assert.equal(featured.media.cardSquare.mediaId, 1009, "featured media ID must survive normalization");
assert.equal(featured.media.cardSquare.source, "legacy-featured");
assert.equal(featured.media.cardSquare.url, featured.imageUrl, "all consumers must receive the same normalized card media URL");
assert.equal(featured.media.cardSquare.alt, "Fixture Shop 店舗写真");
assert.equal(featured.media.cardSquare.width, 1024);
assert.equal(featured.media.cardSquare.height, 1024);
assert.equal(featured.media.detailBanner, null, "legacy featured media must not be promoted to an approved banner");
assert.equal(featured.strictRanking.status, "unavailable");
assert.equal(featured.strictRanking.reason, "storage-not-configured");
assert.equal(featured.ranking, legacyRanking, "legacy ranking API must remain available without strict promotion");

const acfOnly = normalize.normalizeShop(shopFixture({
  acf: {
    shop_header_image: {
      url: "https://cdn.example.test/legacy-acf.jpg",
      alt: "Legacy ACF image",
      width: 900,
      height: 700
    }
  }
}));
assert.equal(acfOnly.imageUrl, "https://cdn.example.test/legacy-acf.jpg");
assert.equal(acfOnly.media.cardSquare.mediaId, null, "ACF URL has no canonical media ID");
assert.equal(acfOnly.media.cardSquare.source, "legacy-acf", "ACF URL must remain explicitly legacy");
assert.equal(acfOnly.media.detailBanner, null);

const fallback = normalize.normalizeShop(shopFixture());
assert.equal(fallback.imageUrl, "", "existing consumer fallback trigger must remain unchanged");
assert.equal(fallback.media.cardSquare.mediaId, null);
assert.equal(fallback.media.cardSquare.source, "fallback");

for (const scope of ["overall", "area", "shop"]) {
  const strictRanking = boundary.unavailableStrictRanking(scope);
  assert.equal(strictRanking.status, "unavailable");
  assert.equal(strictRanking.reason, "storage-not-configured");
  assert.equal(strictRanking.scope, scope);
  assert.equal("records" in strictRanking, false, "unconfigured strict ranking must not invent empty records");
}

const rankingSource = read("lib/shop-ranking.ts");
assert.match(rankingSource, /LegacyShopRecommendationRanking/, "legacy recommendation/snapshot ranking must be named as non-strict");
assert.doesNotMatch(rankingSource, /(?:convert|promote).*StrictRanking/i, "legacy ranking must not expose a strict-ranking conversion");

console.log("UX production data contract: PASS");
