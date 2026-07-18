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
assert.match(reviewsCptSource, /transition_post_status/);

assert.ok(
  packageJson.scripts["test:public-reviews"]?.includes("check-public-review-contract.mjs"),
  "public review contract must have a dedicated package script",
);
assert.ok(
  packageJson.scripts.test?.includes("test:public-reviews"),
  "normal npm test must include the public review contract",
);

function loadReviewModule(wpFetchImpl) {
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
      return { cacheLife: () => undefined, cacheTag: () => undefined };
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

execFileSync("php", [join(repositoryRoot, "tests/php/check-public-review-contract.php")], {
  cwd: repositoryRoot,
  stdio: "inherit",
});

console.log("Public approved review contract: PASS");
