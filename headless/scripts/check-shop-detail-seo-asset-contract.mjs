import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const failures = [];

function check(label, run) {
  try {
    run();
  } catch (error) {
    failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function load(file, stubs = {}, jsx = false) {
  const source = readFileSync(join(root, file), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: jsx ? ts.JsxEmit.ReactJSX : undefined,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: file,
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: (id) => {
      if (id === "server-only") return {};
      if (id === "react/jsx-runtime") return jsxRuntime;
      if (id in stubs) return stubs[id];
      throw new Error(`Unexpected ${file} import: ${id}`);
    },
    URL,
    Date,
    Intl,
    console,
  }, { filename: `${file}.cjs` });
  return module.exports;
}

const unknownPrice = { status: "unknown", amount: null };
const confirmedPrice = { status: "confirmed", amount: 14000 };
const priceStub = {
  resolveShopPrimaryPrice: (acf) => acf.price_90 ? confirmedPrice : unknownPrice,
  resolveShopCoursePrices: (acf) => acf.price_90
    ? [{ key: "price_90", label: "90分", price: confirmedPrice }]
    : [],
  formatPriceForDisplay: (price, suffix = "") => price.amount ? `14,000円${suffix}` : null,
  shouldOutputPriceSchema: (price) => price.status === "confirmed" && price.amount > 0,
};
const factStub = {
  normalizeShopAddress: (value) => typeof value === "string" && value.trim()
    ? { kind: "street-address", text: value.trim() }
    : null,
  normalizeShopDisplayText: (value) => typeof value === "string"
    ? value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    : "",
};

const shop = {
  id: 501,
  slug: "long-shop",
  title: "とても長い日本語店舗名でも安全に折り返す確認用店舗",
  link: "https://mens-esthe-kuchikomi.com/shops/long-shop/",
  contentHtml: "<p>店舗の公開紹介文です。</p>",
  excerpt: "",
  imageUrl: "https://legacy.example.test/wrong.jpg",
  media: {
    cardSquare: {
      mediaId: 9001,
      source: "legacy-featured",
      url: "https://cdn.example.test/card-square.jpg",
      alt: "確認用店舗の正方形画像",
      width: 1200,
      height: 1200,
    },
    detailBanner: null,
  },
  terms: [{ id: 99, slug: "wrong-area", name: "推測してはいけない地域", parent: 2 }],
  acf: {
    price_90: "14,000円",
    shop_hours: "11:00〜翌2:00",
    shop_address: "大阪府大阪市北区1-2-3",
    shop_station: "梅田駅",
    shop_access: "梅田駅から案内に従って来店",
    shop_header_image: "https://legacy.example.test/banner-shaped.jpg",
    shop_booking_url: "https://booking.example.test/long-shop",
    shop_features: ["個室"],
  },
  officialUrl: "https://official.example.test/long-shop",
  areaSlug: "wrong-area",
  primaryArea: { id: 4, slug: "umeda", name: "梅田" },
  ranking: { promotion: null },
  strictRanking: { status: "unavailable", reason: "storage-not-configured", scope: "shop" },
};

const viewModel = load("lib/shop-detail-view-model.ts", {
  "@/lib/design-constants": { DEFAULT_SHOP_IMAGE: "/images/eskomi-shop-fallback.svg" },
  "@/lib/price-normalization": priceStub,
  "@/lib/shop-fact-normalization": factStub,
});
const fullModel = viewModel.buildShopDetailViewModel(shop, shop.primaryArea.name);

check("A/C square top image uses only the formal card role", () => {
  assert.equal(fullModel.images.length, 1);
  assert.equal(fullModel.images[0].url, shop.media.cardSquare.url);
  assert.equal(fullModel.images[0].role, "shop_card_square");
  assert.equal(fullModel.images[0].width, 1200);
  assert.equal(fullModel.images[0].height, 1200);
});
check("D detail banner remains explicitly absent", () => {
  assert.equal(fullModel.detailBanner, null);
  assert.equal(JSON.stringify(fullModel).includes("banner-shaped"), false);
});
check("H access and address remain distinct", () => {
  assert.equal(fullModel.infoRows.find((row) => row.key === "address")?.value, "大阪府大阪市北区1-2-3");
  assert.equal(fullModel.infoRows.find((row) => row.key === "station")?.value, "梅田駅");
  assert.equal(fullModel.infoRows.find((row) => row.key === "access")?.value, "梅田駅から案内に従って来店");
});

const registry = load("lib/shop-detail-modules.ts");
const context = {
  model: fullModel,
  review: {
    status: "available",
    totalApproved: 4,
    showGraph: true,
    aggregateRating: 4.5,
    aggregateRatingCount: 3,
    metrics: [],
    latest: [],
    dateRange: { oldestSubmittedAt: null, latestSubmittedAt: null },
  },
  coverage: null,
  ranking: { rank: 1 },
  hasNearby: true,
};
const modules = registry.getVisibleShopDetailModules(context);
check("A/B module order keeps reviews second after the separate Shop Top", () => {
  assert.deepEqual(Array.from(modules, ({ id }) => id), [
    "reviews",
    "prices",
    "features",
    "shop-information",
    "map-access",
    "basic-information",
    "nearby",
  ]);
});
check("J strict ranking, coupon and therapist modules stay absent", () => {
  const renderedKinds = JSON.stringify(modules);
  for (const forbidden of ["ranking", "coupon", "therapist", "schedule"]) {
    assert.equal(renderedKinds.includes(forbidden), false, `${forbidden} module must stay absent`);
  }
});

const linkStub = ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children);
const cssStub = new Proxy({}, { get: (_target, key) => key === "__esModule" ? false : String(key) });
const stubSection = (id) => ({ model }) => React.createElement("section", { id, "data-title": model.title });
const moduleList = load("components/shop-detail/ShopDetailModuleList.tsx", {
  "next/link": { __esModule: true, default: linkStub },
  "@/lib/shop-slug": {
    normalizePublicShopSlug: (slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : "",
  },
  "./ShopDetail.module.css": cssStub,
  "./ShopAccessSection": { ShopAccessSection: stubSection("map-access") },
  "./ShopBasicInformationSection": { ShopBasicInformationSection: stubSection("basic-information") },
  "./ShopFeaturesSection": { ShopFeaturesSection: stubSection("features") },
  "./ShopOverviewSection": { ShopOverviewSection: stubSection("shop-information") },
  "./ShopPricesSection": { ShopPricesSection: stubSection("prices") },
  "./ShopReviewDashboard": { ShopReviewDashboard: () => React.createElement("div", { "data-approved-dashboard": "true" }) },
}, true);
const reviewResult = {
  status: "available",
  page: {
    reviews: [],
    total: 0,
    totalPages: 0,
    page: 1,
    metrics: {},
    dateRange: null,
  },
};
const moduleHtml = renderToStaticMarkup(React.createElement(moduleList.ShopDetailModuleList, {
  context,
  modules,
  nearbyContent: React.createElement("span", null, "関連"),
  rel: "noopener",
  reviewResult,
  reviewSubmitUrl: "/reviews/submit?shop=long-shop",
}));
const invalidSlugHtml = renderToStaticMarkup(React.createElement(moduleList.ShopDetailModuleList, {
  context: { ...context, model: { ...fullModel, slug: "unsafe slug" } },
  modules,
  nearbyContent: React.createElement("span", null, "関連"),
  rel: "noopener",
  reviewResult,
  reviewSubmitUrl: "/reviews/submit?shop=unsafe%20slug",
}));

const relatedLinks = load("components/shop-detail/ShopRelatedLinks.tsx", {
  "next/link": { __esModule: true, default: linkStub },
  "@/lib/shop-slug": { normalizePublicShopSlug: (slug) => slug.trim().toLowerCase() },
  "./ShopDetail.module.css": cssStub,
}, true);
const relatedHtml = renderToStaticMarkup(React.createElement(relatedLinks.ShopRelatedLinks, {
  primaryArea: shop.primaryArea,
  reviewSubmitUrl: "/reviews/submit?shop=long-shop",
  shopSlug: " LONG-SHOP ",
  shopTitle: shop.title,
}));
const unclassifiedRelatedHtml = renderToStaticMarkup(React.createElement(relatedLinks.ShopRelatedLinks, {
  primaryArea: null,
  reviewSubmitUrl: "/reviews/submit?shop=long-shop",
  shopSlug: " LONG-SHOP ",
  shopTitle: shop.title,
}));

check("E/F/G review and submission hub links remain present with zero reviews", () => {
  assert.match(moduleHtml, /<h2>口コミ・体験<\/h2>/);
  assert.match(moduleHtml, /href="\/reviews\/"/);
  assert.match(moduleHtml, /href="\/shops\/long-shop\/reviews\/"/);
  assert.match(moduleHtml, /href="\/reviews\/submit\?shop=long-shop"/);
});
check("K editorial copy remains visibly separate from approved reviews", () => {
  assert.match(moduleHtml, /承認済みユーザー口コミ/);
  assert.match(moduleHtml, /店舗紹介や掲載情報コメントとは分けて掲載/);
});
check("I related links use explicit Primary Area and normalized Shop routes", () => {
  assert.match(relatedHtml, /href="\/area\/umeda\/"/);
  assert.match(relatedHtml, /梅田のメンズエステを探す/);
  assert.match(relatedHtml, /href="\/shops\/long-shop\/reviews\/"/);
  assert.match(relatedHtml, /href="\/reviews\/"/);
  assert.match(relatedHtml, /href="\/reviews\/submit\?shop=long-shop"/);
  assert.doesNotMatch(unclassifiedRelatedHtml, /href="\/area\//);
});
check("I invalid Shop slug never creates a double-slash review list route", () => {
  assert.doesNotMatch(invalidSlugHtml, /href="\/shops\//);
});

const seo = load("lib/seo.ts", {
  "@/lib/shop-contact": { resolveShopAreaTerm: (value) => value.terms.at(-1) },
  "@/lib/price-normalization": priceStub,
  "@/lib/shop-fact-normalization": factStub,
  "@/lib/wp/client": { stripHtml: (value) => typeof value === "string" ? value.replace(/<[^>]+>/g, "") : "" },
});
const reviewModel = {
  status: "available",
  totalApproved: 4,
  showGraph: true,
  aggregateRating: 4.5,
  aggregateRatingCount: 3,
  metrics: [],
  latest: [1, 2, 3].map((id) => ({
    id,
    body: `承認済み口コミ${id}`,
    submittedAt: `2026-08-${10 + id}T09:00:00+09:00`,
    ratings: { total: 5 - (id % 2), price: null, service: null, cleanliness: null },
  })),
  dateRange: { oldestSubmittedAt: null, latestSubmittedAt: null },
};
const schema = seo.shopLocalBusinessJsonLd(shop, reviewModel);
check("L LocalBusiness uses only explicit Primary Area and formal square image", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(schema.areaServed)), { "@type": "Place", name: "梅田" });
  assert.equal(schema.image, shop.media.cardSquare.url);
});
check("L AggregateRating distinguishes approved reviews from valid rating responses", () => {
  assert.equal(schema.review, undefined, "author-less individual Review schema must stay absent");
  assert.deepEqual(JSON.parse(JSON.stringify(schema.aggregateRating)), {
    "@type": "AggregateRating",
    ratingValue: 4.5,
    ratingCount: 3,
    reviewCount: 4,
    bestRating: 5,
    worstRating: 1,
  });
});
check("L Primary-null shop cannot infer schema area from taxonomy order", () => {
  const withoutPrimary = seo.shopLocalBusinessJsonLd({ ...shop, primaryArea: null }, reviewModel);
  assert.equal("areaServed" in withoutPrimary, false);
});
check("L BreadcrumbList is generated from explicit Primary Area", () => {
  assert.equal(typeof seo.shopBreadcrumbJsonLd, "function");
  const breadcrumb = seo.shopBreadcrumbJsonLd(shop, null);
  assert.deepEqual(
    Array.from(breadcrumb.itemListElement, (item) => item.name),
    ["ホーム", "店舗情報", "梅田", shop.title],
  );
});

check("M-Q URL/canonical/sitemap and unsupported entities remain unchanged", () => {
  const serialized = JSON.stringify({ fullModel, modules, schema });
  for (const forbidden of ["priceCoupon", "employee", "therapist", "openingHoursSpecification", "QAPage", "rankingPosition"]) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} must not be invented`);
  }
  assert.equal(seo.canonicalUrl(`/shops/${shop.slug}/`), `https://mens-esthe-kuchikomi.com/shops/${shop.slug}/`);
});

const shopRouteSource = readFileSync(join(root, "app/shops/[slug]/page.tsx"), "utf8");
check("P metadata does not claim missing price, hours, access, or reservation data", () => {
  assert.match(shopRouteSource, /確認できる項目だけ表示/);
  assert.doesNotMatch(shopRouteSource, /口コミ・料金・予約情報/);
  assert.doesNotMatch(shopRouteSource, /確認できた料金・営業時間・予約先、アクセスと店舗情報を掲載/);
});

const areaContextPath = join(root, "lib/shop-detail-area.ts");
check("I/N explicit Primary Area owns visible Area context", () => {
  assert.equal(existsSync(areaContextPath), true, "shop-detail-area.ts must define the no-inference boundary");
  const areaContext = load("lib/shop-detail-area.ts");
  const areas = [
    { id: 2, slug: "osaka", name: "大阪", parent: 0, count: 1, description: "", acf: {} },
    { id: 4, slug: "umeda", name: "梅田", parent: 2, count: 1, description: "", acf: {} },
  ];
  assert.equal(areaContext.resolveShopDetailAreaContext(shop, areas).area?.slug, "umeda");
  assert.equal(areaContext.resolveShopDetailAreaContext({ ...shop, primaryArea: null }, areas).area, null);
});

assert.equal(
  failures.length,
  0,
  `Shop Detail SEO Asset contract failed:\n- ${failures.join("\n- ")}`,
);

console.log("Shop Detail SEO Asset contract: PASS");
