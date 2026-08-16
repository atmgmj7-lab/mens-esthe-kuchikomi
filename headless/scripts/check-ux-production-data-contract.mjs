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

function assertLegacyRankingTypeContract() {
  const virtualPath = join(root, "scripts/ux-production-ranking-type-contract.ts");
  const virtualSource = `
    import type { ShopView } from "@/lib/wp/types";
    import {
      normalizeShopRanking,
      type LegacyShopRecommendationRanking,
      type ShopRankingMeta
    } from "@/lib/shop-ranking";

    type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
      (<T>() => T extends B ? 1 : 2) ? true : false;
    type Assert<T extends true> = T;
    type IsLegacyDistinct = Assert<Equal<ShopRankingMeta extends LegacyShopRecommendationRanking ? true : false, false>>;
    type NormalizeReturnsLegacy = Assert<Equal<ReturnType<typeof normalizeShopRanking> extends LegacyShopRecommendationRanking ? true : false, true>>;
    type ShopViewUsesLegacy = Assert<Equal<ShopView["ranking"] extends LegacyShopRecommendationRanking ? true : false, true>>;
  `;
  const configPath = join(root, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined, "headless tsconfig must load for the type contract");
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, { noEmit: true }, configPath);
  const options = parsed.options;
  const host = ts.createCompilerHost(options);
  const defaultFileExists = host.fileExists.bind(host);
  const defaultReadFile = host.readFile.bind(host);
  const defaultGetSourceFile = host.getSourceFile.bind(host);
  host.fileExists = (path) => path === virtualPath || defaultFileExists(path);
  host.readFile = (path) => path === virtualPath ? virtualSource : defaultReadFile(path);
  host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) =>
    path === virtualPath
      ? ts.createSourceFile(path, virtualSource, languageVersion, true)
      : defaultGetSourceFile(path, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([
    join(root, "node_modules/next/types/global.d.ts"),
    virtualPath
  ], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(
    diagnostics.length,
    0,
    diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")).join("\n")
  );
}

assertLegacyRankingTypeContract();

const promotion = {
  requiresDisclosure: false,
  isEligibleForNaturalRanking: true,
  canReceiveNaturalRankNumber: true
};
const shopRanking = compileModule("lib/shop-ranking.ts", {
  "@/lib/promotion-disclosure": { resolvePromotionDisclosure: () => promotion },
  "@/lib/area-shop-utils": {
    areaRankingScore: () => 0,
    classifyShopRelation: () => "core",
    shopUpdatedTimestamp: () => 0
  },
  "@/lib/wp/client": { safeText: (value) => typeof value === "string" ? value : "" }
});
const wpClient = {
  rendered: (value) => value?.rendered ?? "",
  safeText: (value) => typeof value === "string" ? value : "",
  stripHtml: (value) => value.replace(/<[^>]+>/g, "")
};
const boundary = compileModule("lib/ux-production-data-boundary.ts");
const normalize = compileModule("lib/wp/normalize.ts", {
  "@/lib/shop-ranking": shopRanking,
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
    acf: {
      area_rank: 2,
      ranking_enabled: "1",
      ranking_reason: "既存表示順"
    },
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
assert.equal(featured.ranking.manualRank, 2);
assert.equal(featured.ranking.isRankingEnabled, true);
assert.equal(featured.ranking.rankingReason, "既存表示順");
assert.equal(featured.ranking.promotion, promotion, "legacy ranking runtime behavior must remain connected to the existing normalizer");

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

console.log("UX production data contract: PASS");
