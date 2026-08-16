import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));

function compileModule(path, requireMap = {}) {
  const absolutePath = join(root, path);
  assert.ok(existsSync(absolutePath), `${path} must exist`);
  const compiled = ts.transpileModule(readFileSync(absolutePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const loaded = { exports: {} };
  const require = (id) => {
    if (id in requireMap) return requireMap[id];
    throw new Error(`Unexpected require from ${path}: ${id}`);
  };
  vm.runInNewContext(compiled, { module: loaded, exports: loaded.exports, require, URL, console }, { filename: `${path}.cjs` });
  return loaded.exports;
}

const normalize = compileModule("lib/wp/normalize.ts", {
  "@/lib/shop-ranking": { normalizeShopRanking: () => ({}) },
  "@/lib/ux-production-data-boundary": { unavailableStrictRanking: () => ({ status: "unavailable" }) },
  "@/lib/wp/client": {
    rendered: (value) => value?.rendered ?? "",
    safeText: (value) => typeof value === "string" ? value : "",
    stripHtml: (value) => String(value).replace(/<[^>]+>/g, ""),
  },
  "@/lib/wp/path-encoding": { encodeBrowserWpContentPath: (value) => value },
});

const osaka = { id: 1, count: 2, name: "大阪", slug: "osaka", parent: 0, taxonomy: "area" };
const umeda = { id: 2, count: 1, name: "梅田", slug: "umeda", parent: 1, taxonomy: "area" };
const category = { id: 8, count: 1, name: "リラクゼーション", slug: "relaxation", parent: 0, taxonomy: "shop_category" };

function shopFixture(overrides = {}) {
  return {
    id: 101,
    date: "2026-08-16T00:00:00+09:00",
    modified: "2026-08-16T00:00:00+09:00",
    slug: "fixture-shop",
    link: "https://mens-esthe-kuchikomi.com/shops/fixture-shop/",
    title: { rendered: "同名店舗" },
    content: { rendered: "" },
    excerpt: { rendered: "" },
    area: [1, 2],
    area_slug: "osaka",
    acf: { shop_primary_area_term_id: 2 },
    _embedded: { "wp:term": [[osaka, umeda], [category]] },
    ...overrides,
  };
}

const explicit = normalize.normalizeShop(shopFixture());
assert.deepEqual(JSON.parse(JSON.stringify(explicit.primaryArea)), { id: 2, slug: "umeda", name: "梅田" });
assert.equal(explicit.areaSlug, "osaka", "legacy areaSlug must remain unchanged");
assert.equal(explicit.terms.length, 3, "legacy relation array must remain unchanged");

const reversed = normalize.normalizeShop(shopFixture({ _embedded: { "wp:term": [[umeda, osaka], [category]] } }));
assert.deepEqual(JSON.parse(JSON.stringify(reversed.primaryArea)), { id: 2, slug: "umeda", name: "梅田" }, "term order must not matter");

for (const fixture of [
  shopFixture({ acf: {} }),
  shopFixture({ acf: { shop_primary_area_term_id: 3 } }),
  shopFixture({ acf: { shop_primary_area_term_id: 8 } }),
  shopFixture({ acf: { shop_primary_area_term_id: "2.0" } }),
  shopFixture({ area: [1, 2], acf: {}, _embedded: { "wp:term": [[osaka, umeda]] } }),
  shopFixture({ _embedded: { "wp:term": [[osaka, { ...umeda, slug: "" }]] } }),
  shopFixture({ _embedded: { "wp:term": [[osaka, { ...umeda, name: "" }]] } }),
]) {
  assert.equal(normalize.normalizeShop(fixture).primaryArea, null, "missing or invalid explicit value must not be inferred");
}

const sameNameBranch = normalize.normalizeShop(shopFixture({ id: 202, slug: "fixture-shop-branch", area: [1], acf: { shop_primary_area_term_id: 1 } }));
assert.notEqual(explicit.id, sameNameBranch.id, "same display name with distinct WP IDs must remain distinct shops");
assert.equal(sameNameBranch.primaryArea.id, 1, "each branch must carry its own explicit primary");

const classifierPath = join(root, "scripts/lib/shop-primary-area-candidates.mjs");
assert.ok(existsSync(classifierPath), "scripts/lib/shop-primary-area-candidates.mjs must exist");
const { buildShopPrimaryAreaCandidate, buildShopPrimaryAreaReport } = await import(pathToFileURL(classifierPath));

const areas = [
  { id: 1, slug: "osaka", name: "大阪", parent: 0, taxonomy: "area" },
  { id: 2, slug: "umeda", name: "梅田", parent: 1, taxonomy: "area" },
  { id: 3, slug: "nihonbashi", name: "大阪日本橋", parent: 1, taxonomy: "area" },
  { id: 9, slug: "sakai", name: "堺東", parent: 0, taxonomy: "area" },
];
const candidateShop = (area, overrides = {}) => ({ id: 101, slug: "fixture-shop", title: { rendered: "同名店舗" }, area, area_slug: "must-not-be-used", acf: { shop_address: "must-not-be-used" }, ...overrides });

const single = buildShopPrimaryAreaCandidate(candidateShop([2]), areas);
assert.equal(single.classification, "AUTO_SAFE");
assert.equal(single.proposedPrimaryArea.id, 2);

const leafWithAncestor = buildShopPrimaryAreaCandidate(candidateShop([1, 2]), areas);
assert.equal(leafWithAncestor.classification, "AUTO_SAFE");
assert.equal(leafWithAncestor.proposedPrimaryArea.id, 2);
assert.equal(buildShopPrimaryAreaCandidate(candidateShop([2, 1]), areas).proposedPrimaryArea.id, 2, "relation order must not matter");

assert.equal(buildShopPrimaryAreaCandidate(candidateShop([2, 3]), areas).classification, "NEEDS_REVIEW");
assert.equal(buildShopPrimaryAreaCandidate(candidateShop([2, 9]), areas).classification, "NEEDS_REVIEW");
assert.equal(buildShopPrimaryAreaCandidate(candidateShop([]), areas).classification, "UNCLASSIFIED");
assert.equal(buildShopPrimaryAreaCandidate(candidateShop([999]), areas).classification, "NEEDS_REVIEW");
assert.notEqual(
  buildShopPrimaryAreaCandidate(candidateShop([8]), [...areas, { id: 8, slug: "relaxation", name: "リラクゼーション", parent: 0, taxonomy: "shop_category" }]).classification,
  "AUTO_SAFE",
  "non-area taxonomy must never become an automatic primary",
);
assert.equal(
  buildShopPrimaryAreaCandidate(candidateShop([40]), [...areas, { id: 40, slug: "orphan", name: "孤立", parent: 999, taxonomy: "area" }]).classification,
  "NEEDS_REVIEW",
);
assert.equal(
  buildShopPrimaryAreaCandidate(candidateShop([30, 31]), [...areas, { id: 30, slug: "cycle-a", name: "循環A", parent: 31, taxonomy: "area" }, { id: 31, slug: "cycle-b", name: "循環B", parent: 30, taxonomy: "area" }]).classification,
  "NEEDS_REVIEW",
);

const renamed = buildShopPrimaryAreaCandidate(candidateShop([1, 2], { title: { rendered: "別名" }, slug: "different", area_slug: "nihonbashi", acf: { shop_address: "別住所" } }), areas);
assert.equal(renamed.proposedPrimaryArea.id, leafWithAncestor.proposedPrimaryArea.id, "shop strings must not influence classification");

const report = buildShopPrimaryAreaReport({
  shops: [candidateShop([1, 2]), candidateShop([2, 3], { id: 102, slug: "review" }), candidateShop([], { id: 103, slug: "none" })],
  areas,
  generatedAt: "2026-08-16T00:00:00.000Z",
  source: "fixture",
});
assert.deepEqual(report.summary, { totalShops: 3, autoSafe: 1, needsReview: 1, unclassified: 1, multiArea: 2, noArea: 1 });
assert.deepEqual(report.shops.map((shop) => shop.wpShopId), [101, 102, 103], "report must be stable by WP ID");
assert.throws(
  () => buildShopPrimaryAreaReport({ shops: [candidateShop(undefined, { area: undefined })], areas, generatedAt: "fixture", source: "fixture" }),
  /area relations/i,
  "missing shop.area must fail instead of becoming a legitimate unclassified shop",
);
assert.throws(
  () => buildShopPrimaryAreaReport({ shops: [candidateShop([8])], areas: [...areas, { id: 8, slug: "relaxation", name: "リラクゼーション", parent: 0, taxonomy: "shop_category" }], generatedAt: "fixture", source: "fixture" }),
  /taxonomy/i,
  "non-area rows must make the canonical report fail closed",
);

const sourceContractPath = join(root, "scripts/lib/shop-primary-area-candidate-source.mjs");
assert.ok(existsSync(sourceContractPath), "pagination source contract must exist");
const { fetchAllWordPressPages } = await import(pathToFileURL(sourceContractPath));
const response = ({ rows, total = 2, totalPages = 2 }) => ({
  status: 200,
  headers: { "x-wp-total": String(total), "x-wp-totalpages": String(totalPages), date: "Sun, 16 Aug 2026 00:00:00 GMT" },
  body: JSON.stringify(rows),
});
const completePages = await fetchAllWordPressPages({
  apiBase: "https://example.test/wp-json/wp/v2",
  path: "/shop/?per_page=1",
  requestPage: async (url) => url.endsWith("page=1") ? response({ rows: [{ id: 1 }] }) : response({ rows: [{ id: 2 }] }),
});
assert.deepEqual(completePages.rows, [{ id: 1 }, { id: 2 }]);
await assert.rejects(
  fetchAllWordPressPages({ apiBase: "https://example.test", path: "/shop/?per_page=1", requestPage: async () => ({ status: 200, headers: {}, body: "[]" }) }),
  /x-wp-total/i,
);
let changingPage = 0;
await assert.rejects(
  fetchAllWordPressPages({
    apiBase: "https://example.test",
    path: "/shop/?per_page=1",
    requestPage: async () => response({ rows: [{ id: ++changingPage }], total: changingPage === 1 ? 2 : 3, totalPages: 2 }),
  }),
  /pagination changed/i,
);
await assert.rejects(
  fetchAllWordPressPages({ apiBase: "https://example.test", path: "/shop/?per_page=100", requestPage: async () => response({ rows: [{ id: 1 }], total: 2, totalPages: 1 }) }),
  /incomplete/i,
);

const generatorPath = join(root, "scripts/prepare-shop-primary-area-candidates.mjs");
assert.ok(existsSync(generatorPath), "read-only candidate generator must exist");
const generatorSource = readFileSync(generatorPath, "utf8");
assert.ok(generatorSource.includes('method: "GET"'), "candidate generator must explicitly use GET only");
assert.equal(/method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']/.test(generatorSource), false, "candidate generator must not use a write method");
assert.equal(/["'](?:Authorization|Cookie)["']\s*:/.test(generatorSource), false, "candidate generator must not send credential headers");

const artifactPath = join(root, "..", "docs/data/shop-primary-area-candidates-2026-08-16.json");
assert.ok(existsSync(artifactPath), "candidate artifact must exist");
const artifactText = readFileSync(artifactPath, "utf8");
const artifact = JSON.parse(artifactText);
function assertNoCredentialKeys(value, path = "artifact") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoCredentialKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(/authorization|cookie|password|secret|application_password/i.test(key), false, `${path}.${key} must not be a credential field`);
    assertNoCredentialKeys(child, `${path}.${key}`);
  }
}
assertNoCredentialKeys(artifact);
const artifactApiBase = new URL(artifact.source.apiBase);
assert.equal(artifactApiBase.username, "", "artifact source URL must not include a username");
assert.equal(artifactApiBase.password, "", "artifact source URL must not include a password");
assert.equal(artifact.summary.totalShops, artifact.shops.length, "artifact total must equal its rows");
assert.equal(
  artifact.summary.autoSafe + artifact.summary.needsReview + artifact.summary.unclassified,
  artifact.summary.totalShops,
  "every shop must have exactly one classification",
);
assert.equal(new Set(artifact.shops.map((shop) => shop.wpShopId)).size, artifact.shops.length, "artifact must not duplicate WP shop IDs");
for (const shop of artifact.shops) {
  for (const key of ["wpShopId", "shopSlug", "shopName", "currentAreaRelations", "proposedPrimaryArea", "classification", "reason"]) {
    assert.ok(Object.hasOwn(shop, key), `candidate row must include ${key}`);
  }
  assert.ok(["AUTO_SAFE", "NEEDS_REVIEW", "UNCLASSIFIED"].includes(shop.classification));
  if (shop.classification !== "AUTO_SAFE") assert.equal(shop.proposedPrimaryArea, null);
}

console.log("Shop primary area Next/classifier contract: PASS");
