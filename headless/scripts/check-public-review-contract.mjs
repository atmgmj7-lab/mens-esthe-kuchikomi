import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const headlessRoot = fileURLToPath(new URL("..", import.meta.url));
const repositoryRoot = resolve(headlessRoot, "..");
const readHeadless = (file) => readFileSync(join(headlessRoot, file), "utf8");
const readRepository = (file) => readFileSync(join(repositoryRoot, file), "utf8");

const requiredFiles = [
  "reviews-public-rest.php",
  "tests/php/check-public-review-contract.php",
  "headless/lib/wp/reviews.ts",
  "headless/app/shops/[slug]/reviews/page.tsx",
];

for (const file of requiredFiles) {
  assert.ok(existsSync(join(repositoryRoot, file)), `${file} is required`);
}

const restSource = readRepository("reviews-public-rest.php");
const functionsSource = readRepository("functions.php");
const reviewsCptSource = readRepository("reviews-cpt.php");
const nextSource = readHeadless("lib/wp/reviews.ts");
const revalidateSource = readHeadless("app/api/revalidate/route.ts");
const shopPageSource = readHeadless("app/shops/[slug]/page.tsx");
const reviewPageSource = readHeadless("app/shops/[slug]/reviews/page.tsx");
const shopDetailSource = readHeadless("components/ShopDetail.tsx");
const sectionsSource = readHeadless("components/shop-detail/ShopDetailSections.tsx");
const packageJson = JSON.parse(readHeadless("package.json"));

assert.match(restSource, /register_rest_route\s*\(\s*['"]escomi\/v1['"]\s*,\s*['"]\/shops\/\(\?P<shop_id>/);
assert.match(restSource, /['"]methods['"]\s*=>\s*array\s*\(\s*['"]GET['"]\s*\)/);
assert.doesNotMatch(restSource, /['"]methods['"]\s*=>[\s\S]{0,80}(?:POST|PUT|PATCH|DELETE)/);
assert.match(restSource, /['"]post_type['"]\s*=>\s*['"]reviews['"]/);
assert.match(restSource, /['"]post_status['"]\s*=>\s*['"]publish['"]/);
assert.match(restSource, /approval_status/);
assert.match(restSource, /review_shop_id/);
assert.match(restSource, /get_url_params\(\)/);
assert.match(restSource, /get_query_params\(\)/);
assert.doesNotMatch(restSource, /reviewer_email|reviewer_name|moderation_note|reviewer_ip|ip_address/i);

assert.match(nextSource, /["']use cache["']/);
assert.match(nextSource, /cacheLife\(\s*["']minutes["']\s*\)/);
assert.match(nextSource, /cacheTag\(\s*["']wp["']\s*,\s*`reviews:\$\{shopId\}`\s*\)/);
assert.match(nextSource, /status:\s*["']available["']/);
assert.match(nextSource, /status:\s*["']unavailable["']/);

assert.match(shopPageSource, /Promise\.all\s*\(/);
assert.match(shopPageSource, /getApprovedShopReviews\(\s*shop\.id\s*,\s*1\s*,\s*3\s*\)/);
assert.doesNotMatch(shopPageSource, /getAreaById|getParentArea/);
assert.match(shopDetailSource, /reviewResult:\s*ApprovedShopReviewResult/);
assert.doesNotMatch(shopDetailSource, /extractShopUserReviewItems/);
assert.match(sectionsSource, /reviewResult:\s*ApprovedShopReviewResult/);
assert.match(reviewPageSource, /getApprovedShopReviews\(\s*shop\.id\s*,\s*page\s*,\s*20\s*\)/);
assert.ok(
  (reviewPageSource.match(/getApprovedShopReviews\(\s*shop\.id\s*,\s*page\s*,\s*20\s*\)/g) ?? []).length >= 2,
  "metadata and page content must share the same cached review request",
);
assert.match(reviewPageSource, /approvedShopReviewRobots\(\s*reviewResult\s*,\s*page\s*\)/);
assert.match(reviewPageSource, /pageMetadata\([\s\S]{0,600}\brobots\b/);
assert.match(reviewPageSource, /口コミ情報を現在取得できません/);
assert.match(reviewPageSource, /この店舗の承認済みユーザー口コミはまだありません/);
assert.match(reviewPageSource, /alternates:[\s\S]*canonical:/);
assert.match(reviewPageSource, /rel="prev"/);
assert.match(reviewPageSource, /rel="next"/);

assert.match(functionsSource, /require_once[\s\S]{0,120}reviews-public-rest\.php/);
assert.match(functionsSource, /save_post_reviews/);
assert.match(functionsSource, /untrashed_post/);
assert.match(functionsSource, /add_action\(\s*["']added_term_relationship["']\s*,\s*["']escomi_headless_on_area_relationship_added["']/);
assert.match(functionsSource, /add_action\(\s*["']deleted_term_relationships["']\s*,\s*["']escomi_headless_on_area_relationship_deleted["']/);
for (const hook of ["added_post_meta", "updated_post_meta", "deleted_post_meta"]) {
  assert.match(
    functionsSource,
    new RegExp(`add_action\\(\\s*["']${hook}["']\\s*,\\s*["']escomi_headless_on_primary_area_meta_change["']`),
    `${hook} must invalidate Area-scoped review caches when explicit Primary changes`,
  );
}
assert.doesNotMatch(functionsSource, /add_action\(\s*["']set_object_terms["']/);
assert.match(functionsSource, /add_action\(\s*["']before_delete_post["']\s*,\s*["']escomi_headless_on_before_delete_post["']/);
assert.match(reviewsCptSource, /transition_post_status/);

assert.ok(
  packageJson.scripts["test:public-reviews"]?.includes("check-public-review-contract.mjs"),
  "public review contract must have a dedicated package script",
);
assert.ok(
  packageJson.scripts.test?.includes("test:public-reviews"),
  "normal npm test must include the public review contract",
);

function loadReviewModule(wpFetchImpl, cacheTagImpl = () => undefined) {
  const result = ts.transpileModule(nextSource, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "lib/wp/reviews.ts",
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, "production review adapter must transpile for runtime fixtures");

  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === "@/lib/wp/client") return { wpFetch: wpFetchImpl };
    if (specifier === "next/cache") {
      return { cacheLife: () => undefined, cacheTag: cacheTagImpl };
    }
    throw new Error(`Unexpected review adapter import: ${specifier}`);
  };
  new Function("require", "module", "exports", result.outputText)(
    localRequire,
    module,
    module.exports,
  );
  return module.exports;
}

function loadRevalidateRoute(revalidateTagImpl) {
  const result = ts.transpileModule(revalidateSource, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "app/api/revalidate/route.ts",
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, "production revalidate route must transpile for cache fixtures");

  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === "next/cache") return { revalidateTag: revalidateTagImpl };
    if (specifier === "next/server") {
      return { NextResponse: { json: (body, init) => Response.json(body, init) } };
    }
    if (specifier === "@/lib/server/secure-secret") {
      return { secretsMatch: (expected, actual) => expected === actual };
    }
    throw new Error(`Unexpected revalidate route import: ${specifier}`);
  };
  new Function("require", "module", "exports", "process", result.outputText)(
    localRequire,
    module,
    module.exports,
    { env: { REVALIDATE_SECRET: "fixture-secret" } },
  );
  return module.exports;
}

const validPayload = {
  items: [
    {
      id: 10,
      body: "確認済みの本文",
      submittedAt: "2026-07-18T03:00:00+00:00",
      ratingTotal: 5,
      ratingPrice: 4,
      ratingService: null,
      ratingCleanliness: 3,
    },
  ],
  total: 1,
  totalPages: 1,
  page: 1,
  metrics: {
    total: { average: 5, responseCount: 1 },
    price: { average: 4, responseCount: 1 },
    service: { average: null, responseCount: 0 },
    cleanliness: { average: 3, responseCount: 1 },
  },
  dateRange: {
    oldestSubmittedAt: "2026-07-18T03:00:00+00:00",
    latestSubmittedAt: "2026-07-18T03:00:00+00:00",
  },
};

const {
  approvedShopReviewRobots,
  getApprovedShopReviews,
  resolveApprovedShopReviewRequest,
  validateApprovedShopReviewPage,
} = loadReviewModule(async () => validPayload);
const validated = validateApprovedShopReviewPage(validPayload, 1, 20);
assert.ok(validated, "valid WordPress payload must pass the production validator");
assert.deepEqual(validated.reviews[0].ratings, {
  total: 5,
  price: 4,
  service: null,
  cleanliness: 3,
});

const emptyPayload = {
  items: [],
  total: 0,
  totalPages: 0,
  page: 1,
  metrics: {
    total: { average: null, responseCount: 0 },
    price: { average: null, responseCount: 0 },
    service: { average: null, responseCount: 0 },
    cleanliness: { average: null, responseCount: 0 },
  },
  dateRange: null,
};
assert.ok(validateApprovedShopReviewPage(emptyPayload, 1, 20), "a valid zero-review response is available");

const invalidPayloads = [
  null,
  [],
  { ...validPayload, total: -1 },
  { ...validPayload, totalPages: 1.2 },
  { ...validPayload, page: 0 },
  { ...validPayload, page: Number.MAX_SAFE_INTEGER + 1 },
  { ...validPayload, items: [{ ...validPayload.items[0], ratingTotal: 6 }] },
  { ...validPayload, items: [{ ...validPayload.items[0], ratingPrice: "4" }] },
  { ...validPayload, items: [{ ...validPayload.items[0], submittedAt: "not-a-date" }] },
  { ...validPayload, items: [{ ...validPayload.items[0], submittedAt: "2026-02-30T03:00:00+00:00" }] },
  { ...validPayload, metrics: { ...validPayload.metrics, total: { average: 5, responseCount: 0 } } },
  { ...validPayload, dateRange: { oldestSubmittedAt: "bad", latestSubmittedAt: "bad" } },
];
for (const payload of invalidPayloads) {
  assert.equal(validateApprovedShopReviewPage(payload, 1, 20), null, "invalid payload must fail closed");
}

const twoItems = {
  ...validPayload,
  items: [validPayload.items[0], { ...validPayload.items[0], id: 11 }],
  total: 2,
  totalPages: 2,
};
assert.equal(
  validateApprovedShopReviewPage(twoItems, 1, 1),
  null,
  "a response must not contain more reviews than the requested page size",
);
assert.equal(
  validateApprovedShopReviewPage({ ...validPayload, page: 1 }, 2, 20),
  null,
  "a response page must exactly match the requested page",
);
assert.equal(
  validateApprovedShopReviewPage({ ...validPayload, totalPages: 2 }, 1, 20),
  null,
  "totalPages must be derived from total and perPage",
);

const outOfRangePayload = { ...validPayload, items: [], page: 2 };
assert.ok(
  validateApprovedShopReviewPage(outOfRangePayload, 2, 20),
  "an empty out-of-range response must remain available so the route can return 404",
);

assert.deepEqual(await resolveApprovedShopReviewRequest(async () => emptyPayload, 1, 20), {
  status: "available",
  page: validateApprovedShopReviewPage(emptyPayload, 1, 20),
});
assert.deepEqual(await resolveApprovedShopReviewRequest(async () => ({ items: [] }), 1, 20), {
  status: "unavailable",
  reason: "invalid-response",
});
assert.deepEqual(await resolveApprovedShopReviewRequest(async () => {
  throw new Error("network down");
}, 1, 20), {
  status: "unavailable",
  reason: "request-failed",
});
assert.deepEqual(
  await resolveApprovedShopReviewRequest(async () => validPayload, 2, 20),
  { status: "unavailable", reason: "invalid-response" },
  "a mismatched response page must become unavailable",
);
assert.deepEqual(
  await getApprovedShopReviews(42, 2, 20),
  { status: "unavailable", reason: "invalid-response" },
  "getApprovedShopReviews must pass the requested page and page size to the validator",
);

const availableValid = { status: "available", page: validated };
const availableEmpty = {
  status: "available",
  page: validateApprovedShopReviewPage(emptyPayload, 1, 20),
};
const availableOutOfRange = {
  status: "available",
  page: validateApprovedShopReviewPage(outOfRangePayload, 2, 20),
};
assert.deepEqual(approvedShopReviewRobots(availableValid, 1), { index: true, follow: true });
assert.deepEqual(approvedShopReviewRobots(availableEmpty, 1), { index: false, follow: true });
assert.deepEqual(
  approvedShopReviewRobots({ status: "unavailable", reason: "request-failed" }, 1),
  { index: false, follow: true },
);
assert.deepEqual(approvedShopReviewRobots(availableOutOfRange, 2), { index: false, follow: true });

const globalPayload = {
  items: [{
    ...validPayload.items[0],
    shop: {
      id: 42,
      slug: "shop-forty-two",
      name: "公開店舗42",
      primaryArea: { id: 11, slug: "umeda", name: "梅田" },
    },
    areas: [
      { id: 10, slug: "osaka", name: "大阪" },
      { id: 11, slug: "umeda", name: "梅田" },
    ],
  }],
  total: 1,
  totalPages: 1,
  page: 1,
};
const legacyGlobalPayload = {
  ...globalPayload,
  items: globalPayload.items.map((item) => ({
    ...item,
    shop: { id: item.shop.id, slug: item.shop.slug, name: item.shop.name },
  })),
};
const globalRequests = [];
const globalCacheTags = [];
const globalReader = loadReviewModule(
  async (path) => {
    globalRequests.push(path);
    return path.includes("primary_area_slug=") ? globalPayload : legacyGlobalPayload;
  },
  (...tags) => globalCacheTags.push(tags),
);
assert.equal(typeof globalReader.validateApprovedGlobalReviewPage, "function", "global payload validator must exist");
const validatedGlobal = globalReader.validateApprovedGlobalReviewPage(globalPayload, 1, 20);
assert.ok(validatedGlobal, "valid global approved-review payload must pass");
assert.equal(validatedGlobal.reviews[0].shop.id, 42);
assert.equal(validatedGlobal.reviews[0].shop.primaryArea.slug, "umeda");
assert.deepEqual(validatedGlobal.reviews[0].areas.map((area) => area.slug), ["osaka", "umeda"]);
const validatedLegacyGlobal = globalReader.validateApprovedGlobalReviewPage(legacyGlobalPayload, 1, 20);
assert.ok(validatedLegacyGlobal, "the deployed unfiltered payload must remain valid during independent rollout");
assert.equal(validatedLegacyGlobal.reviews[0].shop.primaryArea, null, "missing unfiltered Primary must normalize to null");
assert.equal(
  globalReader.validateApprovedGlobalReviewPage(legacyGlobalPayload, 1, 20, "umeda"),
  null,
  "Area-filtered validation must still require explicit Primary identity",
);

const invalidGlobalPayloads = [
  { ...globalPayload, items: [{ ...globalPayload.items[0], reviewerEmail: "private@example.test" }] },
  { ...globalPayload, items: [{ ...globalPayload.items[0], shop: { ...globalPayload.items[0].shop, id: 0 } }] },
  { ...globalPayload, items: [{ ...globalPayload.items[0], shop: { ...globalPayload.items[0].shop, slug: "" } }] },
  { ...globalPayload, items: [{ ...globalPayload.items[0], shop: { ...globalPayload.items[0].shop, primaryArea: { id: 99, slug: "umeda", name: "梅田" } } }] },
  { ...globalPayload, items: [{ ...globalPayload.items[0], shop: { ...globalPayload.items[0].shop, primaryArea: { id: 11, slug: "missing-relation", name: "梅田" } } }] },
  { ...globalPayload, items: [{ ...globalPayload.items[0], areas: [{ id: 10, slug: "osaka", name: "大阪" }, { id: 10, slug: "umeda", name: "梅田" }] }] },
  { ...globalPayload, items: [{ ...globalPayload.items[0], areas: [{ id: 10, slug: "bad/slug", name: "大阪" }] }] },
  { ...globalPayload, totalPages: 2 },
];
for (const payload of invalidGlobalPayloads) {
  assert.equal(globalReader.validateApprovedGlobalReviewPage(payload, 1, 20), null, "invalid global relation must fail closed");
}
assert.equal(globalReader.validateApprovedGlobalReviewPage(globalPayload, 1, 21), null, "global per-page upper bound must be enforced");
const requestCountBeforeRejectedPage = globalRequests.length;
assert.deepEqual(
  await globalReader.getApprovedReviewsPage(1001, 20),
  { status: "unavailable", reason: "invalid-response" },
  "global reader must reject pages that would create excessive WordPress offsets",
);
assert.equal(globalRequests.length, requestCountBeforeRejectedPage, "rejected pages must not reach WordPress");
assert.equal(await globalReader.getApprovedReviewsPageWithSource(1001, 20), null, "invalid pages must not receive a source identity");

const globalResult = await globalReader.getApprovedReviewsPage(1, 20);
assert.equal(globalResult.status, "available");
assert.deepEqual(globalRequests, ["/escomi/v1/reviews?page=1&per_page=20"], "global reader must make one request and never call shop endpoints");
assert.deepEqual(globalCacheTags, [["wp", "reviews:global"]]);

const areaRequestCountBeforeInvalid = globalRequests.length;
for (const invalidAreaSlug of ["../umeda", "UMEDA", "-umeda", "umeda-", "ume_da", "%2e"]) {
  assert.deepEqual(
    await globalReader.getApprovedReviewsPage(1, 20, invalidAreaSlug),
    { status: "unavailable", reason: "invalid-response" },
    "invalid Area slugs must fail before reaching WordPress",
  );
}
assert.equal(globalRequests.length, areaRequestCountBeforeInvalid, "invalid Area slugs must not create a request or cache entry");

const umedaResult = await globalReader.getApprovedReviewsPage(1, 20, "umeda");
assert.equal(umedaResult.status, "available", "matching Primary Area payload must be accepted");
assert.equal(
  globalRequests.at(-1),
  "/escomi/v1/reviews?page=1&per_page=20&primary_area_slug=umeda",
  "Area reader must use the existing global endpoint exactly once",
);
assert.deepEqual(globalCacheTags.at(-1), ["wp", "reviews:global"], "Area cache must keep the common freshness tags");

assert.deepEqual(
  await globalReader.getApprovedReviewsPage(1, 20, "shinosaka"),
  { status: "unavailable", reason: "invalid-response" },
  "a response whose Primary Area does not match the request must fail closed",
);
assert.ok(
  globalRequests.every((path) => !path.includes("/shops/")),
  "global and Area reads must never call one endpoint per Shop",
);
assert.match(
  nextSource,
  /getApprovedReviewsPageCached\s*\(\s*page:\s*number,\s*perPage:\s*number,\s*primaryAreaSlug:/,
  "the Area slug must be an input to the cached function so Area cache keys cannot collide",
);
assert.equal(
  typeof globalReader.freezeApprovedGlobalReviewResult,
  "function",
  "global reader must expose the cache-boundary deep-freeze helper",
);
const cacheRoundTrippedGlobalResult = JSON.parse(JSON.stringify(globalResult));
const refrozenGlobalResult = globalReader.freezeApprovedGlobalReviewResult(cacheRoundTrippedGlobalResult);
assert.equal(Object.isFrozen(refrozenGlobalResult), true, "cache-restored global result must be frozen");
assert.equal(Object.isFrozen(refrozenGlobalResult.page), true, "cache-restored global page must be frozen");
assert.equal(Object.isFrozen(refrozenGlobalResult.page.reviews), true, "cache-restored review list must be frozen");
assert.equal(Object.isFrozen(refrozenGlobalResult.page.reviews[0]), true, "cache-restored review must be frozen");
assert.equal(Object.isFrozen(refrozenGlobalResult.page.reviews[0].ratings), true, "cache-restored ratings must be frozen");
assert.equal(Object.isFrozen(refrozenGlobalResult.page.reviews[0].shop), true, "cache-restored shop relation must be frozen");
assert.equal(Object.isFrozen(refrozenGlobalResult.page.reviews[0].shop.primaryArea), true, "cache-restored Primary Area must be frozen");
assert.equal(Object.isFrozen(refrozenGlobalResult.page.reviews[0].areas), true, "cache-restored area list must be frozen");
assert.equal(Object.isFrozen(refrozenGlobalResult.page.reviews[0].areas[0]), true, "cache-restored area relation must be frozen");
const refrozenUnavailable = globalReader.freezeApprovedGlobalReviewResult({
  status: "unavailable",
  reason: "request-failed",
});
assert.equal(Object.isFrozen(refrozenUnavailable), true, "cache-restored unavailable result must be frozen");
const globalSource = await globalReader.getApprovedReviewsPageWithSource(1, 20);
assert.equal(globalReader.isApprovedGlobalReviewSource(globalSource), true, "real global reader source must be authenticated locally");
assert.throws(
  () => {
    globalSource.result.page.reviews[0].shop.id = 99;
  },
  TypeError,
  "authenticated global source relations must be deeply immutable",
);
assert.equal(globalSource.result.page.reviews[0].shop.id, 42);
assert.equal(
  globalReader.isApprovedGlobalReviewSource({ result: globalSource.result }),
  false,
  "caller-assembled global source must be rejected",
);
assert.equal(
  globalReader.approvedGlobalReviewFromSource(globalSource, 10, 42)?.shop.id,
  42,
  "matching review and canonical shop IDs must resolve from an authenticated source",
);
assert.equal(globalReader.approvedGlobalReviewFromSource(globalSource, 10, 99), null, "shop identity mismatch must be rejected");

const emptyGlobalPayload = { items: [], total: 0, totalPages: 0, page: 1 };
let currentGlobalPayload = emptyGlobalPayload;
let currentShopPayload = emptyPayload;
let activeCacheTags = [];
const taggedCache = new Map();
const cacheReader = loadReviewModule(
  async (path) => path.startsWith("/escomi/v1/reviews?") ? currentGlobalPayload : currentShopPayload,
  (...tags) => activeCacheTags.push(...tags),
);
async function readTaggedCache(key, reader) {
  if (taggedCache.has(key)) return taggedCache.get(key).value;
  activeCacheTags = [];
  const value = await reader();
  taggedCache.set(key, { tags: [...activeCacheTags], value });
  return value;
}
function invalidateFixtureTag(tag) {
  for (const [key, entry] of taggedCache.entries()) {
    if (entry.tags.includes(tag)) taggedCache.delete(key);
  }
}
async function sendWpRevalidation() {
  const invalidations = [];
  const route = loadRevalidateRoute((tag, profile) => {
    invalidations.push({ tag, profile });
    invalidateFixtureTag(tag);
  });
  const response = await route.POST({
    headers: new Headers({ "x-revalidate-secret": "fixture-secret" }),
    json: async () => ({ tag: "wp" }),
  });
  assert.equal(response.status, 200, "authenticated WordPress revalidation must succeed");
  assert.deepEqual(invalidations, [{ tag: "wp", profile: { expire: 0 } }]);
}

const readGlobalFixture = () => readTaggedCache(
  "reviews:global",
  () => cacheReader.getApprovedReviewsPage(1, 20),
);
const readShopFixture = () => readTaggedCache(
  "reviews:42",
  () => cacheReader.getApprovedShopReviews(42, 1, 20),
);
assert.equal((await readGlobalFixture()).page.total, 0);
assert.equal((await readShopFixture()).page.total, 0);
assert.deepEqual(taggedCache.get("reviews:global").tags, ["wp", "reviews:global"]);
assert.deepEqual(taggedCache.get("reviews:42").tags, ["wp", "reviews:42"]);

currentGlobalPayload = globalPayload;
currentShopPayload = validPayload;
assert.equal((await readGlobalFixture()).page.total, 0, "approved review must remain hidden until the mutation invalidates cache");
await sendWpRevalidation();
assert.equal((await readGlobalFixture()).page.total, 1, "approved review must appear on the next global read after wp invalidation");
assert.equal((await readShopFixture()).page.total, 1, "shop and global review caches must refresh from the same wp invalidation");

currentGlobalPayload = emptyGlobalPayload;
currentShopPayload = emptyPayload;
assert.equal((await readGlobalFixture()).page.total, 1, "cached approved review must exist before removal invalidation");
await sendWpRevalidation();
assert.equal((await readGlobalFixture()).page.total, 0, "non-approved or non-public review must not remain in the global cache");
assert.equal((await readShopFixture()).page.total, 0, "shop review cache must remove the same no-longer-public review");

execFileSync("php", [join(repositoryRoot, "tests/php/check-public-review-contract.php")], {
  cwd: repositoryRoot,
  stdio: "inherit",
});
for (const scenario of [
  "new_publish",
  "new_publish_pending",
  "approval",
  "pending_to_rejected",
  "added_approval_meta",
  "added_pending_meta",
  "deleted_approval_meta",
  "deleted_pending_meta",
  "rating_update",
  "rating_pending",
  "body_update",
  "pending_submission",
  "nonpublic",
  "nonapproval",
  "trash",
  "restore",
  "delete",
  "delete_pending",
  "multi_hook_publish",
  "shop_change_after_throttle",
  "area_change_after_throttle",
  "area_relation_add",
  "area_relation_remove",
  "area_relation_replace",
  "area_relation_unrelated",
  "primary_area_meta_added",
  "primary_area_meta_updated",
  "primary_area_meta_deleted",
]) {
  execFileSync(
    "php",
    [join(repositoryRoot, "tests/php/check-review-cache-invalidation.php"), scenario],
    { cwd: repositoryRoot, stdio: "inherit" },
  );
}

console.log("Public approved review contract: PASS");
