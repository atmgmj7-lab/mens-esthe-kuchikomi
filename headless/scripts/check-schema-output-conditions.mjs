import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { shopDetailIntegrationEvidence } from "./check-final-design-preservation.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

const factNormalizationSource = readFileSync(join(root, "lib/shop-fact-normalization.ts"), "utf8");
const factNormalizationCompiled = ts.transpileModule(factNormalizationSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const factNormalizationModule = { exports: {} };
vm.runInNewContext(
  factNormalizationCompiled,
  { module: factNormalizationModule, exports: factNormalizationModule.exports },
  { filename: "shop-fact-normalization.cjs" }
);

const stripHtml = (value) =>
  typeof value === "string"
    ? value
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim()
    : "";

const seoSource = readFileSync(join(root, "lib/seo.ts"), "utf8");
const seoCompiled = ts.transpileModule(seoSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const seoModule = { exports: {} };

vm.runInNewContext(
  seoCompiled,
  {
    module: seoModule,
    exports: seoModule.exports,
    console,
    require: (id) => {
      if (id === "@/lib/wp/client") return { stripHtml };
      if (id === "@/lib/shop-contact") {
        return {
          resolveShopAreaTerm: (shop) => shop.terms?.find((term) => term.slug === shop.areaSlug) ?? shop.terms?.[0]
        };
      }
      if (id === "@/lib/price-normalization") {
        return {
          resolveShopPrimaryPrice: () => ({ status: "unknown", amount: null }),
          shouldOutputPriceSchema: () => false,
          formatPriceForDisplay: () => null
        };
      }
      if (id === "@/lib/shop-fact-normalization") return factNormalizationModule.exports;
      throw new Error(`Unsupported test require: ${id}`);
    }
  },
  { filename: "seo.cjs" }
);

const { asFaqRows, faqJsonLd, shopLocalBusinessJsonLd } = seoModule.exports;

const emptyHtmlFaqRows = asFaqRows([{ question: "有効な質問", answer: "<br />" }]);
assert.deepEqual(
  JSON.parse(JSON.stringify(emptyHtmlFaqRows)),
  [],
  "Visible FAQ rows must exclude answers that contain only empty HTML"
);
assert.equal(
  faqJsonLd(emptyHtmlFaqRows),
  null,
  "Visible FAQ rows and FAQPage schema must use the same valid row set"
);

const emptyEntityFaqCases = [
  { label: "answer &nbsp;", row: { question: "有効な質問", answer: "&nbsp;" } },
  { label: "answer &#160;", row: { question: "有効な質問", answer: "&#160;" } },
  { label: "question &nbsp;", row: { question: "&nbsp;", answer: "有効な回答" } },
  { label: "question &#160;", row: { question: "&#160;", answer: "有効な回答" } },
  { label: "answer &NBSP;", row: { question: "有効な質問", answer: "&NBSP;" } },
  { label: "question &#xA0;", row: { question: "&#xA0;", answer: "有効な回答" } },
  { label: "answer Unicode NBSP", row: { question: "有効な質問", answer: "\u00a0" } }
];

for (const { label, row } of emptyEntityFaqCases) {
  assert.deepEqual(
    JSON.parse(JSON.stringify(asFaqRows([row]))),
    [],
    `Visible FAQ rows must exclude ${label}`
  );
  assert.equal(faqJsonLd([row]), null, `FAQPage schema must exclude ${label}`);
}

assert.equal(faqJsonLd([]), null, "FAQPage schema must not be emitted when there are no visible FAQ rows");
assert.equal(
  faqJsonLd([{ question: "", answer: "回答だけ" }]),
  null,
  "FAQPage schema must not be emitted for invalid FAQ rows"
);
assert.equal(
  faqJsonLd([{ question: "<span></span>", answer: "<br />" }]),
  null,
  "FAQPage schema must not be emitted when FAQ rows contain only empty HTML"
);

const faqSchema = faqJsonLd([{ question: "<b>料金は確認できますか？</b>", answer: "<p>店舗ページで確認できます。</p>" }]);
assert.equal(faqSchema["@type"], "FAQPage");
assert.deepEqual(JSON.parse(JSON.stringify(faqSchema.mainEntity)), [
  {
    "@type": "Question",
    name: "料金は確認できますか？",
    acceptedAnswer: {
      "@type": "Answer",
      text: "店舗ページで確認できます。"
    }
  }
]);

const hiddenReviewShop = {
  id: 101,
  slug: "schema-test-shop",
  title: "schema test shop",
  link: "",
  contentHtml: "",
  excerpt: "",
  imageUrl: "",
  terms: [],
  officialUrl: "",
  areaSlug: "",
  acf: {
    review_count: "99",
    review_star: "5.0",
    shop_ai_summary: "編集部コメントです。"
  },
  ranking: {
    manualRank: null,
    rankingPriority: null,
    isRankingEnabled: false,
    rankingReason: "",
    isPr: false,
    rankingLabel: "",
    promotion: { isPromotion: false, label: "", rel: "" }
  }
};
const shopSchema = shopLocalBusinessJsonLd(hiddenReviewShop);

assert.equal(shopSchema.aggregateRating, undefined, "LocalBusiness schema must not output AggregateRating from ACF counts or editor ratings");
assert.equal(shopSchema.review, undefined, "LocalBusiness schema must not output hidden/editorial comments as Review schema");
assert.equal(shopSchema.telephone, undefined, "LocalBusiness schema must not output missing telephone");
assert.equal(shopSchema.address, undefined, "LocalBusiness schema must not output missing address");
assert.equal(shopSchema.priceRange, undefined, "LocalBusiness schema must not output unconfirmed price");

const unavailableReviewModel = { status: "unavailable", reason: "request-failed" };
assert.equal(
  shopLocalBusinessJsonLd(hiddenReviewShop, unavailableReviewModel).aggregateRating,
  undefined,
  "LocalBusiness schema must not output AggregateRating while approved reviews are unavailable"
);

const underThresholdReviewModel = {
  status: "available",
  totalApproved: 2,
  showGraph: false,
  aggregateRating: null,
  aggregateRatingCount: 2,
  metrics: [],
  latest: [],
  dateRange: { oldestSubmittedAt: null, latestSubmittedAt: null }
};
assert.equal(
  shopLocalBusinessJsonLd(hiddenReviewShop, underThresholdReviewModel).aggregateRating,
  undefined,
  "LocalBusiness schema must stay disabled below three valid overall ratings"
);

const eligibleReviewModel = {
  status: "available",
  totalApproved: 4,
  showGraph: true,
  aggregateRating: 4.5,
  aggregateRatingCount: 3,
  metrics: [{ key: "total", label: "総合評価", value: 4.5, count: 3 }],
  latest: [],
  dateRange: {
    oldestSubmittedAt: "2026-07-15T03:00:00+00:00",
    latestSubmittedAt: "2026-07-18T03:00:00+00:00"
  }
};
assert.deepEqual(
  JSON.parse(JSON.stringify(shopLocalBusinessJsonLd(hiddenReviewShop, eligibleReviewModel).aggregateRating)),
  {
    "@type": "AggregateRating",
    ratingValue: 4.5,
    reviewCount: 3,
    bestRating: 5,
    worstRating: 1
  },
  "LocalBusiness schema must use the same eligible approved-review aggregate shown on the page"
);

for (const invalidReviewModel of [
  { ...eligibleReviewModel, aggregateRating: Number.NaN },
  { ...eligibleReviewModel, aggregateRating: 0 },
  { ...eligibleReviewModel, aggregateRating: 6 },
  { ...eligibleReviewModel, aggregateRatingCount: 2 },
  { ...eligibleReviewModel, aggregateRatingCount: 3.5 }
]) {
  assert.equal(
    shopLocalBusinessJsonLd(hiddenReviewShop, invalidReviewModel).aggregateRating,
    undefined,
    "LocalBusiness schema must fail closed for an inconsistent review view model"
  );
}

const areaHubSource = readFileSync(join(root, "components/area/AreaHubPageTemplate.tsx"), "utf8");
assert.ok(
  areaHubSource.includes("faqSchema ?"),
  "Area hub pages must render FAQPage JSON-LD only when faqJsonLd returns a schema"
);

const areaPageSource = readFileSync(join(root, "components/AreaPageView.tsx"), "utf8");
assert.ok(
  areaPageSource.includes("const faqSchema = faqJsonLd(faqRows)"),
  "Area pages must compute FAQPage JSON-LD separately from visible FAQ rows"
);
assert.ok(
  areaPageSource.includes("faqSchema ?"),
  "Area pages must render FAQPage JSON-LD only when faqJsonLd returns a schema"
);
assert.ok(
  !areaPageSource.includes("JSON.stringify(faqJsonLd(faqRows))"),
  "Area pages must not stringify a nullable FAQPage schema directly"
);

const areaHubContentSource = readFileSync(join(root, "components/area/area-hub-content.tsx"), "utf8");
assert.ok(
  areaHubContentSource.includes("items.length === 0"),
  "Visible FAQ section must not render when there are no FAQ rows"
);

const shopDetailSource = [
  readFileSync(join(root, "components/ShopDetail.tsx"), "utf8"),
  readFileSync(join(root, "components/shop-detail/ShopDetailSections.tsx"), "utf8")
].join("\n");
assert.ok(
  shopDetailSource.includes("const reviewModel = buildShopReviewViewModel(reviewResult)"),
  "Shop pages must build one approved-review view model before rendering"
);
assert.ok(
  shopDetailSource.includes("const shopSchema = shopLocalBusinessJsonLd(shop, reviewModel)"),
  "Shop pages must compute LocalBusiness JSON-LD from the same approved-review view model"
);
assert.ok(
  shopDetailSource.includes("serializeJsonLd(shopSchema)"),
  "Shop pages must safely serialize only the computed LocalBusiness JSON-LD object"
);
assert.ok(
  !shopDetailSource.includes("JSON.stringify(shopSchema)"),
  "Shop pages must not leave script-boundary characters unescaped"
);

for (const [label, fixture] of [
  ["full shop detail", shopDetailIntegrationEvidence.full],
  ["sparse shop detail", shopDetailIntegrationEvidence.sparse]
]) {
  const schemaIndex = fixture.html.indexOf('type="application/ld+json"');
  const breadcrumbIndex = fixture.html.indexOf('aria-label="パンくず"');
  assert.ok(schemaIndex >= 0, `${label} must render LocalBusiness JSON-LD`);
  assert.ok(breadcrumbIndex >= 0, `${label} must render visible breadcrumb content`);
  assert.ok(
    schemaIndex < breadcrumbIndex,
    `${label} must render LocalBusiness JSON-LD before visible content`
  );
  assert.strictEqual(
    fixture.captures.schemaInputs[0].shop,
    fixture.shop,
    `${label} schema must be computed from the rendered WordPress shop`
  );
  assert.strictEqual(
    fixture.captures.schemaInputs[0].reviewModel,
    fixture.reviewModel,
    `${label} schema must use the same review model as the visible review dashboard`
  );
  assert.ok(
    fixture.html.includes(JSON.stringify(fixture.schema)),
    `${label} must render exactly the computed schema payload`
  );
}

console.log("schema output condition checks passed");
