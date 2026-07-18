import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const viewModelPath = join(root, "lib/shop-review-view-model.ts");

assert.ok(
  existsSync(viewModelPath),
  "production shop review view model must exist before the dashboard contract can pass",
);

function loadViewModelModule() {
  const source = readFileSync(viewModelPath, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "lib/shop-review-view-model.ts",
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, "production shop review view model must transpile");

  const module = { exports: {} };
  new Function("require", "module", "exports", result.outputText)(
    (specifier) => {
      if (specifier === "server-only") return {};
      throw new Error(`Unexpected shop review view model import: ${specifier}`);
    },
    module,
    module.exports,
  );
  return { source, ...module.exports };
}

const toPlain = (value) => JSON.parse(JSON.stringify(value));

const review = (id, submittedAt, ratings = {}) => ({
  id,
  body: `承認済み口コミ${id}`,
  submittedAt,
  ratings: {
    total: null,
    price: null,
    service: null,
    cleanliness: null,
    ...ratings,
  },
});

const metric = (average = null, responseCount = 0) => ({ average, responseCount });

function available({
  reviews = [],
  total = reviews.length,
  totalPages = total === 0 ? 0 : 1,
  metrics = {},
  dateRange = null,
} = {}) {
  return {
    status: "available",
    page: {
      reviews,
      total,
      totalPages,
      page: 1,
      metrics: {
        total: metric(),
        price: metric(),
        service: metric(),
        cleanliness: metric(),
        ...metrics,
      },
      dateRange,
    },
  };
}

const { source, buildShopReviewViewModel } = loadViewModelModule();
assert.equal(typeof buildShopReviewViewModel, "function");
assert.match(source, /import\s+["']server-only["']/, "view model must stay server-only");

assert.deepEqual(
  toPlain(buildShopReviewViewModel({ status: "unavailable", reason: "request-failed" })),
  { status: "unavailable", reason: "request-failed" },
  "request failures must not become a zero-review state",
);
assert.deepEqual(
  toPlain(buildShopReviewViewModel({ status: "unavailable", reason: "invalid-response" })),
  { status: "unavailable", reason: "invalid-response" },
  "invalid responses must remain unavailable",
);

assert.deepEqual(toPlain(buildShopReviewViewModel(available())), {
  status: "available",
  totalApproved: 0,
  showGraph: false,
  aggregateRating: null,
  aggregateRatingCount: 0,
  metrics: [],
  latest: [],
  dateRange: { oldestSubmittedAt: null, latestSubmittedAt: null },
});

const twoOverallRatings = buildShopReviewViewModel(
  available({
    reviews: [review(1, null), review(2, null), review(3, null)],
    total: 3,
    metrics: {
      total: metric(4.5, 2),
      price: metric(4.3, 3),
    },
  }),
);
assert.equal(twoOverallRatings.status, "available");
assert.equal(twoOverallRatings.totalApproved, 3);
assert.equal(twoOverallRatings.aggregateRatingCount, 2);
assert.equal(twoOverallRatings.aggregateRating, null);
assert.equal(twoOverallRatings.showGraph, false);
assert.deepEqual(toPlain(twoOverallRatings.metrics), [
  { key: "price", label: "料金満足度", value: 4.3, count: 3 },
]);

const inputOrder = [
  review(11, null, { total: 3 }),
  review(12, "2026-07-17T03:00:00+00:00", { total: 4 }),
  review(13, "2026-07-18T03:00:00+00:00", { total: 5 }),
  review(14, "2026-07-18T03:00:00+00:00", { total: 4 }),
  review(15, "not-a-date", { total: 5 }),
];
const threeOverallRatings = buildShopReviewViewModel(
  available({
    reviews: inputOrder,
    total: 5,
    metrics: {
      total: metric(4.46, 3),
      price: metric(4.5, 2),
      service: metric(4.04, 3),
      cleanliness: metric(5, 3),
    },
    dateRange: {
      oldestSubmittedAt: "2026-07-17T03:00:00+00:00",
      latestSubmittedAt: "2026-07-18T03:00:00+00:00",
    },
  }),
);
assert.equal(threeOverallRatings.status, "available");
assert.equal(threeOverallRatings.totalApproved, 5);
assert.equal(threeOverallRatings.aggregateRating, 4.5);
assert.equal(threeOverallRatings.aggregateRatingCount, 3);
assert.equal(threeOverallRatings.showGraph, true);
assert.deepEqual(toPlain(threeOverallRatings.metrics), [
  { key: "total", label: "総合評価", value: 4.5, count: 3 },
  { key: "service", label: "接客満足度", value: 4, count: 3 },
  { key: "cleanliness", label: "清潔感", value: 5, count: 3 },
]);
assert.deepEqual(
  threeOverallRatings.latest.map(({ id }) => id),
  [13, 14, 12],
  "latest reviews must sort by valid date descending and remain stable on ties",
);
assert.deepEqual(
  inputOrder.map(({ id }) => id),
  [11, 12, 13, 14, 15],
  "building the view model must not mutate the WordPress response",
);
assert.deepEqual(toPlain(threeOverallRatings.dateRange), {
  oldestSubmittedAt: "2026-07-17T03:00:00+00:00",
  latestSubmittedAt: "2026-07-18T03:00:00+00:00",
});

const latestOnly = buildShopReviewViewModel(
  available({
    dateRange: {
      oldestSubmittedAt: "not-a-date",
      latestSubmittedAt: "2026-07-18T03:00:00+00:00",
    },
  }),
);
assert.deepEqual(toPlain(latestOnly.dateRange), {
  oldestSubmittedAt: null,
  latestSubmittedAt: "2026-07-18T03:00:00+00:00",
});

for (const invalidTotal of [
  metric(Number.NaN, 3),
  metric(0.9, 3),
  metric(5.1, 3),
  metric(4.5, -1),
  metric(4.5, 2.5),
  metric(4.5, 4),
]) {
  const invalidModel = buildShopReviewViewModel(
    available({
      reviews: [review(1, null), review(2, null), review(3, null)],
      total: 3,
      metrics: { total: invalidTotal },
    }),
  );
  assert.equal(invalidModel.status, "available");
  assert.equal(invalidModel.aggregateRating, null);
  assert.equal(invalidModel.aggregateRatingCount, 0);
  assert.equal(invalidModel.showGraph, false);
  assert.deepEqual(toPlain(invalidModel.metrics), []);
}

const dashboardSource = readFileSync(
  join(root, "components/shop-detail/ShopReviewDashboard.tsx"),
  "utf8",
);
const cssSource = readFileSync(join(root, "components/shop-detail/ShopDetail.module.css"), "utf8");
assert.doesNotMatch(dashboardSource, /^\s*["']use client["'];?/m);
assert.match(dashboardSource, /<svg/);
assert.match(dashboardSource, /aria-label=/);
assert.match(dashboardSource, /評価グラフは承認済み評価3件以上で表示します/);
assert.match(dashboardSource, /model\.latest/);
assert.doesNotMatch(dashboardSource, /recharts|chart\.js|framer-motion|tooltip/i);
assert.match(dashboardSource, /\(value\s*\/\s*5\)\s*\*\s*100/);
assert.match(dashboardSource, /Number\.isFinite\(value\)/);
assert.match(cssSource, /max-width:\s*960px/);
assert.doesNotMatch(cssSource, /@keyframes[\s\S]{0,500}review/i);

console.log("shop review dashboard contract: PASS");
