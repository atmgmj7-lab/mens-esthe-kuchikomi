import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");
const require = createRequire(import.meta.url);

function loadTsxModule(file, stubs = {}) {
  const result = ts.transpileModule(read(file), {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    },
    fileName: file,
    reportDiagnostics: true
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
  );
  assert.equal(errors.length, 0, `${file} must transpile for rendered contract checks`);

  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.hasOwn(stubs, specifier)) return stubs[specifier];
    if (specifier === "@/lib/shop-slug") {
      return loadTsxModule("lib/shop-slug.ts");
    }
    if (specifier === "@/lib/json-ld") {
      return loadTsxModule("lib/json-ld.ts");
    }
    if (specifier === "./ShopDetail.module.css") {
      return new Proxy({}, { get: (_target, property) => String(property) });
    }
    return require(specifier);
  };
  new Function("require", "module", "exports", result.outputText)(
    localRequire,
    module,
    module.exports
  );
  return module.exports;
}

function assertMarkupOrder(html, markers, label) {
  let previousIndex = -1;
  for (const marker of markers) {
    const index = html.indexOf(marker);
    assert.ok(index >= 0, `${label} must render ${marker}`);
    assert.ok(index > previousIndex, `${label} must render ${marker} in the approved order`);
    previousIndex = index;
  }
}

function renderShopDetailIntegrationFixture({
  shop,
  parentArea,
  allAreas,
  model,
  extractedReviews,
  schema,
  rel,
  reviewSubmitUrl
}) {
  const captures = {
    actionProps: [],
    areaHubProps: [],
    areaQuickProps: [],
    extractedReviewShops: [],
    galleryProps: [],
    heroProps: [],
    modelBuilds: [],
    ownerProps: [],
    promotionInputs: [],
    reviewSubmitSlugs: [],
    schemaShops: [],
    sectionsProps: []
  };

  const { ShopDetail } = loadTsxModule("components/ShopDetail.tsx", {
    "next/link": {
      __esModule: true,
      default: ({ children, href, ...props }) =>
        React.createElement("a", { href, ...props }, children)
    },
    "@/components/AreaQuickLinks": {
      AreaQuickLinks: (props) => {
        captures.areaQuickProps.push(props);
        return React.createElement("nav", { "data-shop-integration": "area-quick" });
      }
    },
    "@/components/common/ShopAreaHubLinks": {
      ShopAreaHubLinks: (props) => {
        captures.areaHubProps.push(props);
        return React.createElement("section", { "data-shop-integration": "area-hub" });
      }
    },
    "@/components/shop-detail/ShopDetailActions": {
      ShopDetailActions: (props) => {
        captures.actionProps.push(props);
        return React.createElement("div", {
          "data-shop-integration": `actions-${props.position}`,
          "data-fixed": props.fixed ? "true" : "false"
        });
      }
    },
    "@/components/shop-detail/ShopDetailGallery": {
      ShopDetailGallery: (props) => {
        captures.galleryProps.push(props);
        return React.createElement("section", { "data-shop-integration": "gallery" });
      }
    },
    "@/components/shop-detail/ShopDetailHero": {
      ShopDetailHero: (props) => {
        captures.heroProps.push(props);
        return React.createElement("header", { "data-shop-integration": "hero" }, props.model.title);
      }
    },
    "@/components/shop-detail/ShopDetailSections": {
      ShopDetailSections: (props) => {
        captures.sectionsProps.push(props);
        const children = [];
        if (props.model.prices.length > 0) {
          children.push(React.createElement("section", { id: "shop-price", key: "price" }));
        }
        if (props.model.infoRows.length > 0) {
          children.push(React.createElement("section", { id: "shop-data", key: "data" }));
        }
        children.push(
          React.createElement("section", { id: "shop-reviews", key: "reviews" }),
          React.createElement(
            "a",
            { href: props.reviewSubmitUrl, key: "review-submit" },
            "この店舗の口コミを投稿する"
          )
        );
        return React.createElement(
          "div",
          { "data-shop-integration": "sections" },
          children
        );
      }
    },
    "@/components/shop-detail/ShopOwnerCta": {
      ShopOwnerCta: (props) => {
        captures.ownerProps.push(props);
        return React.createElement("section", { "data-shop-integration": "owner" });
      }
    },
    "@/components/shop-detail/ShopDetail.module.css": {
      page: "shop-detail-page",
      shell: "shop-detail-shell",
      visual: "shop-detail-visual",
      visualAside: "shop-detail-visual-aside",
      kicker: "shop-detail-kicker",
      quickLinks: "shop-detail-quick-links"
    },
    "@/lib/area-shop-utils": {
      extractShopUserReviewItems: (inputShop) => {
        captures.extractedReviewShops.push(inputShop);
        return extractedReviews;
      }
    },
    "@/lib/promotion-disclosure": {
      outboundRelForPromotion: (promotion) => {
        captures.promotionInputs.push(promotion);
        return rel;
      }
    },
    "@/lib/review-links": {
      buildReviewSubmitUrl: (slug) => {
        captures.reviewSubmitSlugs.push(slug);
        return reviewSubmitUrl;
      }
    },
    "@/lib/seo": {
      shopLocalBusinessJsonLd: (inputShop) => {
        captures.schemaShops.push(inputShop);
        return schema;
      }
    },
    "@/lib/shop-detail-view-model": {
      buildShopDetailViewModel: (inputShop, areaName) => {
        captures.modelBuilds.push({ shop: inputShop, areaName });
        return model;
      }
    }
  });

  const html = renderToStaticMarkup(
    React.createElement(ShopDetail, { shop, parentArea, allAreas })
  );

  return {
    allAreas,
    captures,
    extractedReviews,
    html,
    model,
    parentArea,
    rel,
    reviewSubmitUrl,
    schema,
    shop
  };
}

const kansai = read("components/KansaiAreaGrid.tsx");
assert.ok(kansai.includes("KANSAI_AREAS.map"), "accordion must render every prefecture from KANSAI_AREAS");
assert.ok(kansai.startsWith('"use client";'), "accordion interactivity must stay localized to KansaiAreaGrid");
assert.ok(kansai.includes("aria-expanded"), "accordion must expose aria-expanded state");
assert.ok(kansai.includes("onFocus"), "accordion must react to keyboard focus");
assert.ok(kansai.includes("onPointerEnter"), "accordion must react to pointer hover");
assert.ok(kansai.includes("掲載準備中"), "zero-count prefectures must show preparing state");
assert.ok(!kansai.includes("DB:"), "implementation DB notes must not be rendered in public UI");

const constants = read("lib/design-constants.ts");
for (const slug of ["osaka", "kyoto", "hyogo", "nara", "shiga", "wakayama"]) {
  assert.ok(constants.includes(`${slug}:`), `${slug} image source must remain`);
}
assert.ok(constants.includes("AREA_FEATURES"), "featured area section must be reusable, not single hard-coded component data only");

const feature = read("components/AreaFeatureSection.tsx");
assert.ok(feature.includes("AREA_FEATURES"), "feature section must render from reusable AREA_FEATURES");
assert.ok(feature.includes("areas?: AreaView[]"), "feature section must accept data from WordPress area view");
assert.ok(feature.includes("AreaFeatureSlider"), "feature section must use the interactive featured area slider");
assert.ok(!feature.includes("DB:"), "feature section must not render DB notes");

const featureSlider = read("components/AreaFeatureSlider.tsx");
assert.ok(featureSlider.startsWith('"use client";'), "featured area slider interactivity must stay localized");
assert.ok(featureSlider.includes("<img"), "featured area slider must keep card images");
assert.ok(featureSlider.includes("scrollBy"), "featured area slider must provide slide controls");
assert.ok(featureSlider.includes("escomi-final-feature-slider__dots"), "featured area slider must expose slide dots");
assert.ok(!featureSlider.includes("DB:"), "featured area slider must not render DB notes");

const home = read("components/HomePageContent.tsx");
assert.ok(home.includes("<KansaiAreaGrid areas={areas} />"), "top page must keep image accordion");
assert.ok(home.includes("<AreaFeatureSection areas={areas} features={areaFeatures} />"), "top page must keep configurable image-based featured area section");
assert.ok(home.includes("編集部コメント・店舗提供情報・PRは口コミに含めません"), "top page must explain source separation");

const css = read("app/globals.css");
assert.ok(css.includes("Q-DESIGN final top accordion"), "final design CSS block must exist");
assert.ok(css.includes("prefers-reduced-motion"), "reduced motion support is required");
assert.ok(css.includes(":focus-visible"), "keyboard focus style is required");

const areaHub = read("components/area/AreaHubPageTemplate.tsx");
assert.ok(areaHub.includes("escomi-final-area-hero"), "area hub pages must use the final area hero layout");
assert.ok(areaHub.includes("AREA GUIDE"), "area hub hero must expose an area guide label");
assert.ok(areaHub.includes("shopCountLabel"), "area hub hero must use real area count state");
assert.ok(areaHub.includes("口コミ・編集部コメント・PR情報は分けて掲載"), "area hub hero must explain source separation");
assert.ok(!areaHub.includes("DB:"), "area hub page must not render implementation DB notes");

const areaHubContent = read("components/area/area-hub-content.tsx");
assert.ok(areaHubContent.includes("area-hub-ranking-context"), "area hub ranking must expose visible ranking basis copy");

const areaPage = read("components/AreaPageView.tsx");
assert.ok(areaPage.includes("escomi-final-area-summary"), "standard area pages must keep final summary block");
assert.ok(areaPage.includes("掲載準備中"), "standard area pages must handle zero-count states safely");
assert.ok(areaPage.includes("口コミ・編集部コメント・PR情報は分けて掲載"), "standard area pages must explain source separation");
assert.ok(!areaPage.includes("DB:"), "standard area page must not render implementation DB notes");

assert.ok(css.includes("Q-DESIGN final area pages"), "final area page CSS block must exist");
assert.ok(css.includes("escomi-final-area-hero"), "area hero styles must exist");
assert.ok(css.includes("escomi-final-area-summary"), "standard area summary styles must exist");

const areaShopList = read("components/area/hub/AreaShopList.tsx");
assert.ok(areaShopList.includes("parseShopListFiltersFromUrl"), "area shop list filters must be readable from the URL");
assert.ok(areaShopList.includes("parseShopListSortFromUrl"), "area shop list sort state must be readable from the URL");
assert.ok(areaShopList.includes("window.history.replaceState"), "area shop list controls must keep the URL in sync");
assert.ok(areaShopList.includes("area-shop-list-mobile-drawer"), "area shop list must expose mobile drawer controls");
assert.ok(areaShopList.includes("area-shop-list-zero-state__suggestions"), "area shop list zero state must show relaxation suggestions");

const areaShopListControls = read("lib/area-shop-list-controls.ts");
assert.ok(areaShopListControls.includes("getFilterRelaxationSuggestions"), "area shop list controls must calculate zero-result recovery suggestions");

const areaHubConfig = read("lib/area-hub-config.ts");
for (const slug of ["sakaisujihonmachi", "shinosaka", "nihonbashi", "umeda", "sakai"]) {
  assert.ok(areaHubConfig.includes(`${slug}:`), `${slug} must use the shared area hub template`);
}
for (const label of ["堺筋本町メンズエステ", "新大阪メンズエステ", "大阪日本橋メンズエステ", "大阪梅田メンズエステ", "堺・堺東メンズエステ"]) {
  assert.ok(areaHubConfig.includes(label), `${label} area hub copy must exist`);
}

const shopDetail = read("components/ShopDetail.tsx");
const detailSections = read("components/shop-detail/ShopDetailSections.tsx");
assert.ok(shopDetail.includes("buildShopDetailViewModel"));
assert.ok(shopDetail.includes("ShopDetailHero"));
assert.ok(shopDetail.includes("ShopDetailGallery"));
assert.ok(shopDetail.includes("ShopDetailSections"));
assert.ok(shopDetail.includes("ShopOwnerCta"));
assert.ok(shopDetail.includes('id="shop-price"') || detailSections.includes('id="shop-price"'));
assert.ok(detailSections.includes('id="shop-reviews"'));
assert.ok(detailSections.includes('id="shop-data"'));
assert.ok(!shopDetail.includes("areaAvg60"));
assert.ok(!shopDetail.includes("shpc-badge-open"));
assert.ok(!shopDetail.includes("age_18_19"));

const detailHero = read("components/shop-detail/ShopDetailHero.tsx");
const detailGallery = read("components/shop-detail/ShopDetailGallery.tsx");
const detailActions = read("components/shop-detail/ShopDetailActions.tsx");
const ownerCta = read("components/shop-detail/ShopOwnerCta.tsx");
assert.ok(detailHero.includes("model.facts.map"), "shop detail hero must render only model facts");
assert.ok(!detailHero.includes("OPEN"), "shop detail hero must not claim live open status");
assert.ok(detailGallery.startsWith('"use client";'), "shop detail gallery fallback must stay client-side");
assert.ok(detailGallery.includes("model.images"), "shop detail gallery must use model images");
assert.ok(detailGallery.includes("width={960}"), "shop detail main image must keep 4:3 intrinsic width");
assert.ok(detailGallery.includes("height={720}"), "shop detail main image must keep 4:3 intrinsic height");
assert.ok(detailGallery.includes("width={240}"), "shop detail thumbnails must keep 4:3 intrinsic width");
assert.ok(detailGallery.includes("height={180}"), "shop detail thumbnails must keep 4:3 intrinsic height");
assert.ok(detailGallery.includes("onError"), "shop detail images must handle broken sources");
assert.ok(detailGallery.includes("DEFAULT_SHOP_IMAGE"), "shop detail images must use the approved fallback");
assert.ok(
  detailGallery.includes("useState(mainImage.isFallback)"),
  "shop detail gallery must track runtime main-image fallback state"
);
assert.ok(
  detailGallery.includes("replaceBrokenShopImage(event, () => setMainImageFallback(true))"),
  "main image fallback must update the caption state"
);
assert.ok(
  detailGallery.includes('alt={mainImageFallback ? "画像準備中" : mainImage.alt}'),
  "main image alt must remain tied to runtime fallback state after rerender"
);
assert.ok(
  detailGallery.includes('mainImageFallback ? "店舗画像は準備中です。"'),
  "shop detail caption must reflect runtime fallback state"
);
assert.ok(detailActions.includes("data-shop-cta-kind"), "shop actions must identify CTA kind");
assert.ok(detailActions.includes("data-shop-cta-position"), "shop actions must identify CTA position");
assert.ok(detailActions.includes("data-shop-slug"), "shop actions must expose a safe shop slug");
assert.ok(ownerCta.includes("buildShopOwnerRequestUrl"), "owner CTA must use the approved prefilled URL");
assert.ok(
  ownerCta.includes("このページを、公式情報で完成させませんか？"),
  "owner CTA must keep the approved heading"
);
assert.ok(ownerCta.includes("公開前に確認"), "owner CTA must state that submissions are reviewed before publication");
assert.ok(!ownerCta.includes("自動公開します"), "owner CTA must not promise automatic publication");
assert.ok(detailSections.includes("model.prices.length > 0"), "price section must require approved model prices");
assert.ok(detailSections.includes("model.infoRows.length > 0"), "information section must require approved model rows");
assert.ok(detailSections.includes("reviews.length > 0"), "review section must distinguish approved items from empty state");
assert.ok(
  detailSections.includes("掲載情報コメント、店舗紹介文、出自を確認できない文章は口コミとして表示しません"),
  "review section must visibly explain source separation"
);
for (const forbidden of ["0名", "不定休", "駐車場なし", "OPEN"]) {
  assert.ok(!detailSections.includes(forbidden), `shop detail sections must not invent ${forbidden}`);
}

const { ShopDetailActions } = loadTsxModule("components/shop-detail/ShopDetailActions.tsx");
const fixedActionsHtml = renderToStaticMarkup(
  React.createElement(ShopDetailActions, {
    fixed: true,
    model: {
      actions: [
        { kind: "reservation", label: "Web予約", href: "https://booking.example.test", external: true },
        { kind: "line", label: "LINE予約", href: "https://line.example.test", external: true },
        { kind: "official", label: "公式サイト", href: "https://official.example.test", external: true }
      ],
      slug: "safe-shop"
    },
    position: "fixed",
    rel: "nofollow sponsored noopener"
  })
);
assert.ok(fixedActionsHtml.includes(">Web予約<"), "fixed actions must keep one reservation-like action");
assert.ok(fixedActionsHtml.includes(">公式サイト<"), "fixed actions must keep the official action visible");
assert.ok(!fixedActionsHtml.includes(">LINE予約<"), "fixed actions must not hide official behind two reservation variants");
assert.ok(fixedActionsHtml.includes('role="group"'), "shop action container must expose a labelled link group");
assert.ok(fixedActionsHtml.includes('target="_blank"'), "external shop actions must open in a new tab");
assert.ok(
  fixedActionsHtml.includes('rel="nofollow sponsored noopener"'),
  "external shop actions must preserve the supplied promotion rel"
);
assert.ok(fixedActionsHtml.includes('data-shop-slug="safe-shop"'), "shop action slug data must be preserved safely");

const encodedShopSlug =
  "c-rest%ef%bc%88%e3%82%b7%e3%83%bc%e3%83%ac%e3%82%b9%e3%83%88%ef%bc%89";
const encodedSlugHtml = renderToStaticMarkup(
  React.createElement(ShopDetailActions, {
    model: {
      actions: [{ kind: "official", label: "公式サイト", href: "https://official.example.test", external: true }],
      slug: encodedShopSlug
    },
    position: "hero",
    rel: "nofollow sponsored noopener"
  })
);
assert.ok(
  encodedSlugHtml.includes(`data-shop-slug="${encodedShopSlug}"`),
  "canonical percent-encoded WordPress slug must remain in shop action data"
);

const unsafeSlugHtml = renderToStaticMarkup(
  React.createElement(ShopDetailActions, {
    model: {
      actions: [{ kind: "official", label: "公式サイト", href: "https://official.example.test", external: true }],
      slug: 'unsafe" slug'
    },
    position: "hero",
    rel: "nofollow sponsored noopener"
  })
);
assert.ok(unsafeSlugHtml.includes('data-shop-slug=""'), "unsafe shop slug data must be reduced to an empty value");
assert.ok(!unsafeSlugHtml.includes("unsafe"), "unsafe shop slug text must not be exposed in CTA data");

const telActionHtml = renderToStaticMarkup(
  React.createElement(ShopDetailActions, {
    model: {
      actions: [{ kind: "tel", label: "電話予約", href: "tel:0612345678", external: false }],
      slug: "safe-shop"
    },
    position: "hero",
    rel: "nofollow sponsored noopener"
  })
);
assert.ok(telActionHtml.includes('href="tel:0612345678"'), "telephone action must keep its tel URL");
assert.ok(!telActionHtml.includes('target="_blank"'), "telephone action must stay in the same tab");
assert.ok(!telActionHtml.includes(" rel="), "telephone action must not receive external-link rel");

const { replaceBrokenShopImage } = loadTsxModule("components/shop-detail/ShopDetailGallery.tsx", {
  "@/lib/design-constants": { DEFAULT_SHOP_IMAGE: "/shop-default-image.webp" }
});
const brokenImage = {
  alt: "確認対象店舗",
  dataset: {},
  onerror: () => {},
  src: "https://images.example.test/broken.webp"
};
let mainFallbackCallbacks = 0;
const recordMainFallback = () => {
  mainFallbackCallbacks += 1;
};
replaceBrokenShopImage({ currentTarget: brokenImage }, recordMainFallback);
assert.equal(brokenImage.src, "/shop-default-image.webp", "broken image must switch to the approved fallback");
assert.equal(brokenImage.alt, "画像準備中", "runtime image fallback must replace the stale image alt");
assert.equal(brokenImage.onerror, null, "broken image must clear its native error handler");
assert.equal(mainFallbackCallbacks, 1, "main image fallback must notify caption state once");
brokenImage.src = "fallback-failed";
replaceBrokenShopImage({ currentTarget: brokenImage }, recordMainFallback);
assert.equal(brokenImage.src, "fallback-failed", "image fallback must run only once and never loop");
assert.equal(mainFallbackCallbacks, 1, "repeated image errors must not notify caption state again");

const shopOwnerRequestLinks = loadTsxModule("lib/shop-owner-request-links.ts");
const capturedOwnerHrefs = [];
const { ShopOwnerCta } = loadTsxModule("components/shop-detail/ShopOwnerCta.tsx", {
  "@/lib/shop-owner-request-links": shopOwnerRequestLinks,
  "next/link": {
    __esModule: true,
    default: ({ children, href, ...props }) => {
      capturedOwnerHrefs.push(href);
      return React.createElement("a", { href, ...props }, children);
    }
  }
});
renderToStaticMarkup(
  React.createElement(ShopOwnerCta, {
    shop: { id: 42, slug: "safe-shop", title: "確認対象店舗" }
  })
);
renderToStaticMarkup(
  React.createElement(ShopOwnerCta, {
    shop: { id: 865, slug: encodedShopSlug, title: "C-REST（シーレスト）" }
  })
);
const ownerCtaHtml = renderToStaticMarkup(
  React.createElement(ShopOwnerCta, {
    shop: { id: 42, slug: 'unsafe" slug', title: "確認対象店舗" }
  })
);
const validOwnerUrl = new URL(capturedOwnerHrefs[0], "https://mens-esthe-kuchikomi.com");
assert.equal(validOwnerUrl.pathname, "/storelisting/", "valid owner CTA must use the request page");
assert.equal(validOwnerUrl.searchParams.get("shop_id"), "42", "valid owner CTA must prefill shop id");
assert.equal(validOwnerUrl.searchParams.get("shop_slug"), "safe-shop", "valid owner CTA must prefill safe slug");
assert.equal(validOwnerUrl.searchParams.get("shop_name"), "確認対象店舗", "valid owner CTA must prefill shop name");
assert.equal(
  validOwnerUrl.searchParams.get("target_url"),
  "https://mens-esthe-kuchikomi.com/shops/safe-shop/",
  "valid owner CTA must prefill its canonical target"
);
assert.equal(validOwnerUrl.searchParams.get("source"), "shop-detail", "valid owner CTA must identify its source");
assert.equal(validOwnerUrl.hash, "#shop-owner-request", "valid owner CTA must keep the form anchor");
const encodedOwnerUrl = new URL(capturedOwnerHrefs[1], "https://mens-esthe-kuchikomi.com");
assert.equal(
  encodedOwnerUrl.searchParams.get("shop_slug"),
  encodedShopSlug,
  "encoded WordPress owner CTA must prefill the canonical slug"
);
assert.equal(
  encodedOwnerUrl.searchParams.get("target_url"),
  `https://mens-esthe-kuchikomi.com/shops/${encodedShopSlug}/`,
  "encoded WordPress owner CTA must prefill the canonical public URL"
);
assert.equal(
  capturedOwnerHrefs[2],
  "/storelisting/#shop-owner-request",
  "unsafe owner CTA must use the unprefilled request fallback"
);
assert.ok(!capturedOwnerHrefs[2].includes("unsafe"), "unsafe owner CTA must not leak its raw slug into the URL");
assert.equal(
  new URL(capturedOwnerHrefs[2], "https://mens-esthe-kuchikomi.com").search,
  "",
  "unsafe owner CTA fallback must contain no prefilled query"
);
assert.ok(ownerCtaHtml.includes('data-shop-cta-kind="owner"'), "owner CTA must identify its kind");
assert.ok(ownerCtaHtml.includes('data-shop-cta-position="owner-band"'), "owner CTA must identify its position");
assert.ok(ownerCtaHtml.includes('data-shop-slug=""'), "owner CTA must not expose an unsafe shop slug");

const { ShopDetailSections } = loadTsxModule("components/shop-detail/ShopDetailSections.tsx", {
  "@/lib/price-normalization": {
    formatPriceForDisplay: (price) =>
      price.amount == null ? null : `${Number(price.amount).toLocaleString("ja-JP")}円`
  },
  "next/link": {
    __esModule: true,
    default: ({ children, href, ...props }) => React.createElement("a", { href, ...props }, children)
  }
});
const fullSectionsModel = {
  slug: "safe-shop",
  prices: [{ key: "price_90", label: "90分", price: { status: "confirmed", amount: 14000 } }],
  catchText: '<em data-source="catch">店舗提供のキャッチ</em>',
  introductionHtml:
    '<p data-source="wordpress-introduction"><strong>WordPress店舗紹介本文</strong></p>',
  recommendText: '<em data-source="recommend">編集部のおすすめ情報</em>',
  summaryText: '<em data-source="summary">公開情報から整理した掲載情報</em>',
  featureNames: ["個室あり", "駅から徒歩圏内"],
  infoRows: [
    {
      key: "address",
      label: "住所",
      value: "大阪市中央区本町1-2-3",
      href: "https://must-not-link.example.test"
    },
    {
      key: "official",
      label: "公式サイト",
      value: "公式サイトを見る",
      href: "https://official.example.test/safe"
    }
  ],
  verifiedAt: "2026年7月15日"
};
const fullSectionsHtml = renderToStaticMarkup(
  React.createElement(ShopDetailSections, {
    model: fullSectionsModel,
    reviews: [
      { id: 1, body: "<b>承認済み本文</b>", authorName: "   " },
      { id: 2, body: "2件目の承認済み本文", authorName: "投稿者A", submittedAt: "2026-07-15" }
    ],
    reviewSubmitUrl: "/review-form/?shop=safe-shop",
    rel: "nofollow sponsored noopener"
  })
);
for (const heading of ["料金プラン", "この店舗について", "特徴・設備", "アクセス・基本情報", "ユーザー口コミ"]) {
  assert.ok(fullSectionsHtml.includes(heading), `full shop detail sections must render ${heading}`);
}
assert.ok(fullSectionsHtml.includes("<td>14,000円</td>"), "full price row must render the approved 14,000 yen value");
assert.ok(
  fullSectionsHtml.includes(
    '<p data-source="wordpress-introduction"><strong>WordPress店舗紹介本文</strong></p>'
  ),
  "only the approved WordPress introduction HTML must render as real HTML"
);
for (const [source, text] of [
  ["catch", "店舗提供のキャッチ"],
  ["recommend", "編集部のおすすめ情報"],
  ["summary", "公開情報から整理した掲載情報"]
]) {
  const rawHtml = `<em data-source="${source}">${text}</em>`;
  const escapedHtml = `&lt;em data-source=&quot;${source}&quot;&gt;${text}&lt;/em&gt;`;
  assert.ok(fullSectionsHtml.includes(escapedHtml), `${source} copy must render as escaped React text`);
  assert.ok(!fullSectionsHtml.includes(rawHtml), `${source} copy must never render as real HTML`);
}
assert.ok(fullSectionsHtml.includes("<strong>掲載情報コメント</strong>"), "full sections must label non-user summary text");
assert.ok(
  fullSectionsHtml.includes(
    "&lt;em data-source=&quot;summary&quot;&gt;公開情報から整理した掲載情報&lt;/em&gt;"
  ),
  "full sections must render the summary body separately from the non-review label"
);
assert.ok(
  fullSectionsHtml.includes("公開情報をもとに整理した文章で、ユーザー口コミではありません。"),
  "full sections must explain that summary text is not a user review"
);
assert.ok(fullSectionsHtml.includes("&lt;b&gt;承認済み本文&lt;/b&gt;"), "approved review body must render as escaped React text");
assert.ok(!fullSectionsHtml.includes("<b>承認済み本文</b>"), "approved review body must never render as HTML");
assert.ok(fullSectionsHtml.includes("匿名"), "blank review author must normalize to anonymous");
assert.ok(fullSectionsHtml.includes("投稿者A / 2026-07-15"), "approved review metadata must remain visible");
assert.ok(fullSectionsHtml.includes("<td>大阪市中央区本町1-2-3</td>"), "full information table must render the address value");
assert.ok(
  fullSectionsHtml.includes("掲載情報の確認日 2026年7月15日"),
  "full information section must render the fixture confirmation date"
);
assert.ok(fullSectionsHtml.includes('<th scope="row">90分</th>'), "price rows must use scoped row headers");
assert.ok(fullSectionsHtml.includes('<th scope="row">公式サイト</th>'), "information rows must use scoped row headers");
assert.ok(
  fullSectionsHtml.includes('href="https://official.example.test/safe"'),
  "official information link must preserve the model-safe href"
);
assert.ok(fullSectionsHtml.includes('target="_blank"'), "official information link must remain keyboard-readable and external");
assert.ok(
  fullSectionsHtml.includes('rel="nofollow sponsored noopener"'),
  "official information link must preserve the supplied promotion rel"
);
assert.ok(fullSectionsHtml.includes('data-shop-cta-kind="official"'), "official information link must identify CTA kind");
assert.ok(fullSectionsHtml.includes('data-shop-cta-position="info"'), "official information link must identify CTA position");
assert.ok(fullSectionsHtml.includes('data-shop-slug="safe-shop"'), "official information link must preserve a safe slug");
const encodedSectionsHtml = renderToStaticMarkup(
  React.createElement(ShopDetailSections, {
    model: { ...fullSectionsModel, slug: encodedShopSlug },
    reviews: [],
    reviewSubmitUrl: "/review-form/",
    rel: "nofollow sponsored noopener"
  })
);
assert.ok(
  encodedSectionsHtml.includes(`data-shop-slug="${encodedShopSlug}"`),
  "canonical percent-encoded WordPress slug must remain in info CTA data"
);
assert.ok(
  !fullSectionsHtml.includes("must-not-link.example.test"),
  "non-official information rows must stay plain text even if an href is supplied"
);
assert.ok(
  fullSectionsHtml.includes('href="/review-form/?shop=safe-shop"'),
  "full sections must keep the review submission link"
);

const sparseSectionsHtml = renderToStaticMarkup(
  React.createElement(ShopDetailSections, {
    model: {
      slug: "safe-shop",
      prices: [],
      catchText: "",
      introductionHtml: "",
      recommendText: "",
      summaryText: "",
      featureNames: [],
      infoRows: [],
      verifiedAt: null
    },
    reviews: [],
    reviewSubmitUrl: "/review-form/?shop=safe-shop",
    rel: "nofollow sponsored noopener"
  })
);
for (const omitted of ["料金プラン", "この店舗について", "特徴・設備", "アクセス・基本情報"]) {
  assert.ok(!sparseSectionsHtml.includes(omitted), `sparse shop detail sections must omit ${omitted}`);
}
assert.ok(sparseSectionsHtml.includes("ユーザー口コミ"), "sparse sections must keep the review section");
assert.ok(
  sparseSectionsHtml.includes("この店舗の承認済みユーザー口コミはまだありません。"),
  "sparse sections must render the explicit approved-review empty state"
);
assert.ok(
  sparseSectionsHtml.includes('href="/review-form/?shop=safe-shop"'),
  "sparse sections must keep the review submission link"
);
for (const forbidden of ["0名", "不定休", "駐車場なし", "OPEN"]) {
  assert.ok(!sparseSectionsHtml.includes(forbidden), `sparse rendered sections must not invent ${forbidden}`);
}

const unsafeSectionsHtml = renderToStaticMarkup(
  React.createElement(ShopDetailSections, {
    model: { ...fullSectionsModel, slug: 'unsafe" slug' },
    reviews: [],
    reviewSubmitUrl: "/review-form/",
    rel: "nofollow sponsored noopener"
  })
);
assert.ok(unsafeSectionsHtml.includes('data-shop-slug=""'), "unsafe info CTA slug must be reduced to an empty value");
assert.ok(!unsafeSectionsHtml.includes("unsafe"), "unsafe shop slug text must not be exposed in info CTA data");

const fullIntegrationPromotion = {
  isPromotion: true,
  label: "PR",
  rel: "nofollow sponsored noopener"
};
const fullIntegrationArea = { id: 10, slug: "osaka", name: "大阪", parent: 0 };
const fullIntegrationParentArea = { id: 1, slug: "kansai", name: "関西", parent: 0 };
const fullIntegrationShop = {
  id: 501,
  slug: "integration-shop",
  title: "統合検査店",
  link: "",
  contentHtml: "",
  excerpt: "",
  imageUrl: "",
  terms: [fullIntegrationArea],
  officialUrl: "https://official.example.test/integration-shop",
  areaSlug: "osaka",
  acf: {},
  ranking: {
    manualRank: null,
    rankingPriority: null,
    isRankingEnabled: false,
    rankingReason: "",
    isPr: true,
    rankingLabel: "PR",
    promotion: fullIntegrationPromotion
  }
};
const fullIntegrationModel = {
  id: 501,
  slug: "integration-shop",
  title: "統合検査店",
  areaName: "大阪",
  verifiedAt: "2026年7月16日",
  facts: [{ key: "price", label: "料金目安", value: "14,000円" }],
  actions: [
    {
      kind: "official",
      label: "公式サイトを見る",
      href: "https://official.example.test/integration-shop",
      external: true
    }
  ],
  images: [{ url: "/shop.webp", alt: "統合検査店", isFallback: false }],
  prices: [
    {
      key: "price_90",
      label: "90分",
      price: { status: "confirmed", amount: 14000 }
    }
  ],
  infoRows: [{ key: "address", label: "住所", value: "大阪市" }],
  introductionHtml: "",
  catchText: "",
  recommendText: "",
  summaryText: "",
  featureNames: []
};
const fullIntegrationReviews = [
  {
    id: "approved-review",
    body: "承認済み口コミ",
    authorName: "投稿者",
    submittedAt: "2026-07-16"
  }
];
const fullIntegrationSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "統合検査店"
};

const sparseIntegrationPromotion = {
  isPromotion: false,
  label: "",
  rel: "noopener"
};
const sparseIntegrationShop = {
  ...fullIntegrationShop,
  id: 502,
  slug: "sparse-shop",
  title: "最小データ店",
  terms: [],
  officialUrl: "",
  areaSlug: "",
  ranking: {
    ...fullIntegrationShop.ranking,
    isPr: false,
    rankingLabel: "",
    promotion: sparseIntegrationPromotion
  }
};
const sparseIntegrationModel = {
  ...fullIntegrationModel,
  id: 502,
  slug: "sparse-shop",
  title: "最小データ店",
  areaName: "エリア",
  verifiedAt: null,
  facts: [],
  actions: [],
  images: [{ url: "/fallback.webp", alt: "画像準備中", isFallback: true }],
  prices: [],
  infoRows: []
};
const sparseIntegrationReviews = [];
const sparseIntegrationSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "最小データ店"
};

const fullShopDetailIntegration = renderShopDetailIntegrationFixture({
  shop: fullIntegrationShop,
  parentArea: fullIntegrationParentArea,
  allAreas: [fullIntegrationArea],
  model: fullIntegrationModel,
  extractedReviews: fullIntegrationReviews,
  schema: fullIntegrationSchema,
  rel: "nofollow sponsored noopener",
  reviewSubmitUrl: "/reviews/submit/?shop=integration-shop"
});
const sparseShopDetailIntegration = renderShopDetailIntegrationFixture({
  shop: sparseIntegrationShop,
  parentArea: null,
  allAreas: [],
  model: sparseIntegrationModel,
  extractedReviews: sparseIntegrationReviews,
  schema: sparseIntegrationSchema,
  rel: "noopener",
  reviewSubmitUrl: "/reviews/submit/?shop=sparse-shop"
});

for (const [label, fixture] of [
  ["full shop detail", fullShopDetailIntegration],
  ["sparse shop detail", sparseShopDetailIntegration]
]) {
  assert.equal(fixture.captures.heroProps.length, 1, `${label} must compose Hero exactly once`);
  assert.equal(fixture.captures.galleryProps.length, 1, `${label} must compose Gallery exactly once`);
  assert.equal(fixture.captures.sectionsProps.length, 1, `${label} must compose Sections exactly once`);
  assert.equal(fixture.captures.ownerProps.length, 1, `${label} must compose Owner CTA exactly once`);
  assert.equal(fixture.captures.actionProps.length, 2, `${label} must compose body and fixed Actions once each`);
  assert.deepEqual(
    fixture.captures.actionProps.map((props) => props.position),
    ["body", "fixed"],
    `${label} actions must keep body then fixed placement`
  );
  assert.equal(fixture.captures.actionProps[0].fixed, undefined, `${label} body actions must not be fixed`);
  assert.equal(fixture.captures.actionProps[1].fixed, true, `${label} fixed actions must be explicitly fixed`);
  assert.equal(fixture.captures.areaQuickProps.length, 1, `${label} must compose area quick links once`);
  assert.equal(fixture.captures.modelBuilds.length, 1, `${label} must build one view model`);
  assert.equal(fixture.captures.extractedReviewShops.length, 1, `${label} must extract reviews once`);
  assert.equal(fixture.captures.reviewSubmitSlugs.length, 1, `${label} must build one review URL`);
  assert.equal(fixture.captures.schemaShops.length, 1, `${label} must build one LocalBusiness schema`);
  assert.equal(fixture.captures.promotionInputs.length, 1, `${label} must resolve one promotion rel`);
  assert.equal(
    fixture.html.split('type="application/ld+json"').length - 1,
    1,
    `${label} must render LocalBusiness JSON-LD exactly once`
  );
  assert.ok(
    fixture.html.includes('<section id="shop-reviews"></section>'),
    `${label} must always render the user-review section`
  );
  assert.ok(
    fixture.html.includes(`href="${fixture.reviewSubmitUrl.replaceAll("&", "&amp;")}"`),
    `${label} must render the built review submission URL`
  );
  assert.strictEqual(
    fixture.captures.modelBuilds[0].shop,
    fixture.shop,
    `${label} view model must receive the WordPress shop`
  );
  assert.strictEqual(
    fixture.captures.extractedReviewShops[0],
    fixture.shop,
    `${label} review extraction must receive the WordPress shop`
  );
  assert.strictEqual(
    fixture.captures.sectionsProps[0].reviews,
    fixture.extractedReviews,
    `${label} sections must receive only the extracted review array`
  );
  assert.strictEqual(
    fixture.captures.sectionsProps[0].reviewSubmitUrl,
    fixture.reviewSubmitUrl,
    `${label} sections must receive the built review URL`
  );
  assert.equal(
    fixture.captures.reviewSubmitSlugs[0],
    fixture.shop.slug,
    `${label} review URL must use the current shop slug`
  );
  assert.strictEqual(
    fixture.captures.promotionInputs[0],
    fixture.shop.ranking.promotion,
    `${label} rel resolver must receive the current promotion state`
  );
  for (const props of [
    fixture.captures.heroProps[0],
    fixture.captures.sectionsProps[0],
    ...fixture.captures.actionProps
  ]) {
    assert.equal(props.rel, fixture.rel, `${label} must forward the promotion-aware rel`);
  }
  for (const props of [
    fixture.captures.heroProps[0],
    fixture.captures.galleryProps[0],
    fixture.captures.sectionsProps[0],
    ...fixture.captures.actionProps
  ]) {
    assert.strictEqual(props.model, fixture.model, `${label} must forward one shared view model`);
  }
  assert.strictEqual(
    fixture.captures.ownerProps[0].shop,
    fixture.shop,
    `${label} owner CTA must receive the current WordPress shop`
  );
  assert.strictEqual(
    fixture.captures.schemaShops[0],
    fixture.shop,
    `${label} schema builder must receive the current WordPress shop`
  );
  assert.ok(
    fixture.html.includes(JSON.stringify(fixture.schema)),
    `${label} must render the computed schema object`
  );
}

assert.equal(fullShopDetailIntegration.captures.modelBuilds[0].areaName, "大阪");
assert.equal(sparseShopDetailIntegration.captures.modelBuilds[0].areaName, "エリア");

assertMarkupOrder(
  fullShopDetailIntegration.html,
  [
    'type="application/ld+json"',
    'aria-label="パンくず"',
    'data-shop-integration="hero"',
    'data-shop-integration="gallery"',
    'data-shop-integration="sections"',
    'data-shop-integration="owner"',
    'data-shop-integration="area-hub"',
    'data-shop-integration="area-quick"'
  ],
  "full shop detail"
);
assertMarkupOrder(
  sparseShopDetailIntegration.html,
  [
    'type="application/ld+json"',
    'aria-label="パンくず"',
    'data-shop-integration="hero"',
    'data-shop-integration="gallery"',
    'data-shop-integration="sections"',
    'data-shop-integration="owner"',
    'data-shop-integration="area-quick"'
  ],
  "sparse shop detail"
);

for (const href of [
  'href="#shop-price"',
  'href="#shop-data"',
  'href="#shop-reviews"',
  'href="/area/osaka/#ranking"',
  'href="/area/osaka/#price-table"'
]) {
  assert.ok(fullShopDetailIntegration.html.includes(href), `full shop detail must render ${href}`);
}
assert.ok(!sparseShopDetailIntegration.html.includes('href="#shop-price"'));
assert.ok(!sparseShopDetailIntegration.html.includes('href="#shop-data"'));
assert.ok(sparseShopDetailIntegration.html.includes('href="#shop-reviews"'));
assert.ok(!sparseShopDetailIntegration.html.includes("#ranking"));
assert.ok(!sparseShopDetailIntegration.html.includes("#price-table"));

assert.equal(fullShopDetailIntegration.captures.areaHubProps.length, 1);
assert.strictEqual(fullShopDetailIntegration.captures.areaHubProps[0].area, fullIntegrationArea);
assert.strictEqual(
  fullShopDetailIntegration.captures.areaHubProps[0].parentArea,
  fullIntegrationParentArea
);
assert.equal(fullShopDetailIntegration.captures.areaQuickProps[0].current, "osaka");
assert.equal(sparseShopDetailIntegration.captures.areaHubProps.length, 0);
assert.equal(sparseShopDetailIntegration.captures.areaQuickProps[0].current, undefined);
assert.ok(!sparseShopDetailIntegration.html.includes('data-shop-integration="area-hub"'));

export const shopDetailIntegrationEvidence = {
  full: fullShopDetailIntegration,
  sparse: sparseShopDetailIntegration
};

const shopContact = read("components/ShopContactCta.tsx");
assert.ok(shopContact.includes('id="shop-contact"'), "shop contact CTA must expose contact anchor");

const siteHeader = read("components/SiteHeader.tsx");
assert.ok(siteHeader.includes("escomi-final-site-header"), "site header must use final shared shell");
for (const label of ["店舗を探す", "エリアから探す", "口コミについて", "掲載について", "検索"]) {
  assert.ok(siteHeader.includes(label), `site header must keep ${label} navigation`);
}
assert.ok(!siteHeader.includes("DB:"), "site header must not render implementation DB notes");

const siteFooter = read("components/SiteFooter.tsx");
assert.ok(siteFooter.includes("escomi-final-site-footer"), "site footer must use final shared shell");
assert.ok(siteFooter.includes("ユーザー口コミ、編集部コメント、店舗提供情報、PR情報は分けて掲載"), "site footer must explain source separation");
for (const label of ["店舗を探す", "エリアから探す", "口コミ投稿", "お問い合わせ", "掲載について", "運営者情報"]) {
  assert.ok(siteFooter.includes(label), `site footer must keep ${label} navigation`);
}
assert.ok(!siteFooter.includes("DB:"), "site footer must not render implementation DB notes");

assert.ok(css.includes("Q-DESIGN final shared shell"), "final shared shell CSS block must exist");
assert.ok(css.includes("escomi-final-site-header"), "final site header styles must exist");
assert.ok(css.includes("escomi-final-site-footer"), "final site footer styles must exist");

console.log("final design preservation checks passed");
