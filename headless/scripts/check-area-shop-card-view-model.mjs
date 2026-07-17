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
      jsx: ts.JsxEmit.ReactJSX,
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
    { module: loaded, exports: loaded.exports, require, URL, Date, console },
    { filename: `${path}.cjs` }
  );
  return loaded.exports;
}

const factNormalization = compileModule("lib/shop-fact-normalization.ts");
const priceNormalization = compileModule("lib/price-normalization.ts");
const promotionDisclosure = compileModule("lib/promotion-disclosure.ts");
const cardViewModel = compileModule("lib/area-shop-card-view-model.ts", {
  "@/lib/design-constants": {
    DEFAULT_SHOP_IMAGE: "/images/eskomi-shop-fallback.svg",
    SHOP_FALLBACK_IMAGE_ALT: "Eskomi 店舗画像準備中"
  },
  "@/lib/price-normalization": priceNormalization,
  "@/lib/promotion-disclosure": promotionDisclosure,
  "@/lib/shop-fact-normalization": factNormalization
});
const { buildAreaShopCardViewModel } = cardViewModel;

assert.equal(typeof buildAreaShopCardViewModel, "function");

const organicPromotion = {
  promotionType: "organic",
  isPaid: null,
  requiresDisclosure: false,
  isEligibleForNaturalRanking: true,
  canReceiveNaturalRankNumber: true,
  disclosureLabel: "",
  sourceField: null,
  sourceValue: null,
  outboundRel: "noreferrer",
  reason: "fixture"
};
const paidPromotion = {
  promotionType: "paid-placement",
  isPaid: true,
  requiresDisclosure: true,
  isEligibleForNaturalRanking: false,
  canReceiveNaturalRankNumber: false,
  disclosureLabel: "PR",
  sourceField: "is_pr",
  sourceValue: "1",
  outboundRel: "sponsored nofollow noreferrer",
  reason: "fixture"
};
const targetArea = { slug: "sakaisujihonmachi", name: "堺筋本町" };

function fixture(overrides = {}) {
  const ranking = overrides.ranking ?? {};
  return {
    id: 101,
    slug: "fixture-shop",
    link: "",
    title: "Fixture Shop",
    contentHtml: "",
    excerpt: "",
    imageUrl: "",
    terms: [],
    acf: {},
    officialUrl: "",
    areaSlug: targetArea.slug,
    ...overrides,
    ranking: {
      manualRank: null,
      rankingPriority: null,
      isRankingEnabled: true,
      rankingReason: "",
      isPr: false,
      rankingLabel: "",
      promotion: organicPromotion,
      ...ranking
    },
    acf: { ...(overrides.acf ?? {}) }
  };
}

const fullShop = fixture({
  slug: "full-shop",
  title: "<b>Full &amp; Verified</b>",
  contentHtml: "<p>WordPressに保存された紹介文です。</p>",
  excerpt: "この抜粋より本文が優先されます。",
  imageUrl: "https://images.example.test/full.jpg",
  officialUrl: "https://official.example.test/",
  acf: {
    price_90: "14,000円",
    shop_station: "<b>堺筋本町駅</b>&nbsp;徒歩2分",
    shop_hours: "10:00〜翌5:00",
    shop_address: "大阪府大阪市中央区本町1-2",
    shop_features: [" 完全個室 ", { name: "シャワー完備" }, "完全個室"],
    shop_booking_url: "https://reserve.example.test/",
    shop_line: "https://line.me/R/ti/p/example",
    shop_tel: "080-0000-0000"
  }
});
const full = buildAreaShopCardViewModel(fullShop, targetArea, {
  rank: 2,
  showRank: true,
  summarySource: "wordpress-only",
  maxActions: 2
});
assert.equal(full.rank, 2);
assert.equal(full.image.src, "https://images.example.test/full.jpg");
assert.equal(full.image.alt, "Full & Verified");
assert.equal(full.image.isFallback, false);
assert.equal(full.title.text, "Full & Verified");
assert.equal(full.title.href, "/shops/full-shop/");
assert.equal(full.summary, "WordPressに保存された紹介文です。");
assert.deepEqual(
  Array.from(full.tags, ({ label, kind }) => ({ label, kind })),
  [
    { label: "完全個室", kind: "feature" },
    { label: "シャワー完備", kind: "feature" }
  ]
);
assert.deepEqual(
  Array.from(full.facts, ({ key, value }) => ({ key, value })),
  [
    { key: "price", value: "14,000円〜" },
    { key: "station", value: "堺筋本町駅 徒歩2分" },
    { key: "hours", value: "10:00〜翌5:00" }
  ]
);
assert.deepEqual(
  Array.from(full.actions, ({ kind, href, primary }) => ({ kind, href, primary })),
  [
    { kind: "reservation", href: "https://reserve.example.test/", primary: true },
    { kind: "official", href: "https://official.example.test/", primary: false }
  ]
);
assert.deepEqual(
  Array.from(full.quickLinks, ({ label, href }) => ({ label, href })),
  [
    { label: "料金", href: "/shops/full-shop/#prices" },
    { label: "基本情報", href: "/shops/full-shop/#hours-access" },
    { label: "口コミ", href: "/shops/full-shop/#reviews" }
  ]
);

const sparse = buildAreaShopCardViewModel(
  fixture({
    slug: "sparse-shop",
    title: "Sparse Shop",
    imageUrl: "javascript:alert(1)",
    officialUrl: "javascript:alert(1)",
    acf: {
      price_90: "0",
      shop_station: "未確認",
      shop_hours: 0,
      shop_features: ["", { name: "未掲載" }],
      shop_booking_url: "data:text/html,x",
      shop_line: "javascript:x",
      shop_tel: "---"
    }
  }),
  targetArea,
  { rank: null, showRank: true }
);
assert.equal(sparse.rank, null);
assert.equal(sparse.image.src, "/images/eskomi-shop-fallback.svg");
assert.equal(sparse.image.alt, "Eskomi 店舗画像準備中");
assert.equal(sparse.image.isFallback, true);
assert.equal(sparse.summary, null);
assert.equal(sparse.tags.length, 0);
assert.equal(sparse.facts.length, 0);
assert.equal(sparse.actions.length, 0);
assert.deepEqual(Array.from(sparse.quickLinks, (link) => link.label), ["口コミ"]);
for (const generated of ["情報確認中", "料金未確認", "店舗ページで確認", "未確認", "公式サイトあり"]) {
  assert.equal(JSON.stringify(sparse).includes(generated), false, `sparse card must not generate ${generated}`);
}

const pr = buildAreaShopCardViewModel(
  fixture({
    slug: "pr-shop",
    title: "PR Shop",
    officialUrl: "https://pr.example.test/",
    ranking: {
      isPr: true,
      promotion: paidPromotion
    }
  }),
  targetArea,
  { rank: 1, showRank: true }
);
assert.equal(pr.rank, null, "PR cards must not receive a natural rank number");
assert.deepEqual(
  Array.from(pr.tags, ({ label, kind }) => ({ label, kind })),
  [{ label: "PR", kind: "promotion" }]
);
assert.ok(pr.actions[0].rel.includes("sponsored"), "PR outbound actions must retain disclosure rel");

const noRank = buildAreaShopCardViewModel(fixture({ slug: "rankless-shop" }), targetArea, {
  rank: null,
  showRank: true
});
assert.equal(noRank.rank, null);
const hiddenRank = buildAreaShopCardViewModel(fixture({ slug: "hidden-rank-shop" }), targetArea, {
  rank: 3,
  showRank: false
});
assert.equal(hiddenRank.rank, null);

const longName = "堺筋本町リラクゼーションサロン・プレミアムロングネーム（完全個室プライベートサロン）";
const longTitle = buildAreaShopCardViewModel(
  fixture({ slug: "long-title-shop", title: longName }),
  targetArea,
  { rank: 4, showRank: true }
);
assert.equal(longTitle.title.text, longName, "long titles must stay intact for natural CSS wrapping");

const duplicateActionUrls = buildAreaShopCardViewModel(
  fixture({
    slug: "duplicate-actions",
    officialUrl: "https://same.example.test/",
    acf: {
      shop_booking_url: "https://same.example.test",
      shop_line: "https://line.me/R/ti/p/duplicate",
      shop_tel: "090-1111-2222"
    }
  }),
  targetArea,
  { maxActions: 2 }
);
assert.deepEqual(Array.from(duplicateActionUrls.actions, (action) => action.kind), ["reservation", "line"]);

const imageComponentSource = read("components/common/AreaShopCardImage.tsx");
assert.ok(
  imageComponentSource,
  "AreaShopCard image load errors need a client-side onError handler"
);

const fallbackConstants = {
  DEFAULT_SHOP_IMAGE: "/images/eskomi-shop-fallback.svg",
  SHOP_FALLBACK_IMAGE_ALT: "Eskomi 店舗画像準備中",
  SHOP_FALLBACK_IMAGE_STYLE: {
    aspectRatio: "4 / 3",
    objectFit: "contain",
    height: "auto",
    minHeight: "0",
    maxHeight: "none"
  }
};
const jsxRuntime = {
  jsx: (type, props) => ({ type, props }),
  jsxs: (type, props) => ({ type, props })
};
let fallbackStateInitialized = false;
let fallbackState = false;
const reactRuntime = {
  useState: (initialValue) => {
    if (!fallbackStateInitialized) {
      fallbackState = initialValue;
      fallbackStateInitialized = true;
    }
    return [
      fallbackState,
      (nextValue) => {
        fallbackState = typeof nextValue === "function" ? nextValue(fallbackState) : nextValue;
      }
    ];
  }
};
const sharedImageSource = read("components/common/ShopImageWithFallback.tsx");
assert.ok(
  sharedImageSource,
  "top, ranking thumbs, and area cards need one shared client image fallback"
);
const areaCardSharedImageModule = compileModule("components/common/ShopImageWithFallback.tsx", {
  react: reactRuntime,
  "react/jsx-runtime": jsxRuntime,
  "@/lib/design-constants": fallbackConstants
});
const areaShopCardImageModule = compileModule("components/common/AreaShopCardImage.tsx", {
  react: reactRuntime,
  "react/jsx-runtime": jsxRuntime,
  "@/components/common/ShopImageWithFallback": areaCardSharedImageModule,
  "./AreaShopCard.module.css": {
    image: "areaImage",
    imageFallback: "areaImageFallback"
  }
});
const { AreaShopCardImage } = areaShopCardImageModule;
assert.equal(typeof AreaShopCardImage, "function");

const imageProps = {
  src: "https://images.example.test/returns-404.jpg",
  alt: "実在形式の店舗画像",
  isFallback: false
};
const areaCardImageElement = AreaShopCardImage(imageProps);
assert.equal(areaCardImageElement.type, areaCardSharedImageModule.ShopImageWithFallback);
const initialImageElement = areaCardImageElement.type(areaCardImageElement.props);
assert.equal(initialImageElement.type, "img");
assert.equal(initialImageElement.props.src, imageProps.src);
assert.equal(initialImageElement.props.alt, imageProps.alt);
assert.equal(initialImageElement.props.className, "areaImage");
assert.equal(initialImageElement.props.style, undefined);
assert.equal(typeof initialImageElement.props.onError, "function");

const appliedClasses = new Set(["areaImage"]);
let assignedSrc = imageProps.src;
let srcAssignmentCount = 0;
const brokenImage = {
  dataset: {},
  onerror: () => {},
  alt: imageProps.alt,
  style: {},
  classList: {
    add: (className) => appliedClasses.add(className)
  },
  get src() {
    return assignedSrc;
  },
  set src(value) {
    assignedSrc = value;
    srcAssignmentCount += 1;
  }
};

initialImageElement.props.onError({ currentTarget: brokenImage });
assert.equal(assignedSrc, fallbackConstants.DEFAULT_SHOP_IMAGE);
assert.equal(brokenImage.alt, fallbackConstants.SHOP_FALLBACK_IMAGE_ALT);
assert.equal(brokenImage.dataset.fallbackApplied, "true");
assert.equal(brokenImage.onerror, null);
assert.equal(brokenImage.style.objectFit, "contain");
assert.ok(appliedClasses.has("areaImageFallback"));
assert.equal(fallbackState, true);

initialImageElement.props.onError({ currentTarget: brokenImage });
assert.equal(srcAssignmentCount, 1, "a fallback image error must not restart the replacement loop");

const fallbackImageElement = areaCardImageElement.type(areaCardImageElement.props);
assert.equal(fallbackImageElement.props.src, fallbackConstants.DEFAULT_SHOP_IMAGE);
assert.equal(fallbackImageElement.props.alt, fallbackConstants.SHOP_FALLBACK_IMAGE_ALT);
assert.ok(fallbackImageElement.props.className.includes("areaImageFallback"));
assert.equal(fallbackImageElement.props.style.objectFit, "contain");

let sharedFallbackStateInitialized = false;
let sharedFallbackState = false;
const sharedReactRuntime = {
  useState: (initialValue) => {
    if (!sharedFallbackStateInitialized) {
      sharedFallbackState = initialValue;
      sharedFallbackStateInitialized = true;
    }
    return [
      sharedFallbackState,
      (nextValue) => {
        sharedFallbackState =
          typeof nextValue === "function" ? nextValue(sharedFallbackState) : nextValue;
      }
    ];
  }
};
const sharedImageModule = compileModule("components/common/ShopImageWithFallback.tsx", {
  react: sharedReactRuntime,
  "react/jsx-runtime": jsxRuntime,
  "@/lib/design-constants": fallbackConstants
});
const { ShopImageWithFallback } = sharedImageModule;
assert.equal(typeof ShopImageWithFallback, "function");

const sharedImageProps = {
  src: "https://images.example.test/shared-404.jpg",
  alt: "共有画像fallback検査",
  className: "sharedImage",
  fallbackClassName: "sharedImageFallback",
  width: 400,
  height: 300
};
const sharedImageElement = ShopImageWithFallback(sharedImageProps);
assert.equal(sharedImageElement.type, "img");
assert.equal(sharedImageElement.props.src, sharedImageProps.src);
assert.equal(sharedImageElement.props.alt, sharedImageProps.alt);
assert.equal(typeof sharedImageElement.props.onError, "function");

let sharedAssignedSrc = sharedImageProps.src;
let sharedSrcAssignmentCount = 0;
const sharedClasses = new Set(["sharedImage"]);
const sharedBrokenImage = {
  dataset: {},
  onerror: () => {},
  alt: sharedImageProps.alt,
  style: {},
  classList: { add: (className) => sharedClasses.add(className) },
  get src() {
    return sharedAssignedSrc;
  },
  set src(value) {
    sharedAssignedSrc = value;
    sharedSrcAssignmentCount += 1;
  }
};

sharedImageElement.props.onError({ currentTarget: sharedBrokenImage });
assert.equal(sharedAssignedSrc, fallbackConstants.DEFAULT_SHOP_IMAGE);
assert.equal(sharedBrokenImage.alt, fallbackConstants.SHOP_FALLBACK_IMAGE_ALT);
assert.equal(sharedBrokenImage.dataset.fallbackApplied, "true");
assert.equal(sharedBrokenImage.onerror, null);
assert.equal(sharedBrokenImage.style.aspectRatio, "4 / 3");
assert.equal(sharedBrokenImage.style.objectFit, "contain");
assert.ok(sharedClasses.has("sharedImageFallback"));
assert.equal(sharedFallbackState, true);

sharedImageElement.props.onError({ currentTarget: sharedBrokenImage });
assert.equal(
  sharedSrcAssignmentCount,
  1,
  "shared fallback must replace a broken URL only once"
);

const sharedFallbackElement = ShopImageWithFallback(sharedImageProps);
assert.equal(sharedFallbackElement.props.src, fallbackConstants.DEFAULT_SHOP_IMAGE);
assert.equal(sharedFallbackElement.props.alt, fallbackConstants.SHOP_FALLBACK_IMAGE_ALT);
assert.ok(sharedFallbackElement.props.className.includes("sharedImageFallback"));
assert.equal(sharedFallbackElement.props.style.aspectRatio, "4 / 3");
assert.equal(sharedFallbackElement.props.style.objectFit, "contain");

for (const [label, source] of [
  ["area card", read("components/common/AreaShopCardImage.tsx")],
  ["ranking thumbnail", read("components/area/hub/ShopImageThumb.tsx")],
  ["home updated shop", read("components/HomePageContent.tsx")]
]) {
  assert.ok(
    source.includes("ShopImageWithFallback"),
    `${label} must use the shared client image fallback`
  );
}

const viewModelSource = read("lib/area-shop-card-view-model.ts");
const cardSource = read("components/common/AreaShopCard.tsx");
const cardCss = read("components/common/AreaShopCard.module.css");
const legacyShopCard = read("components/ShopCard.tsx");
const luxuryWrapper = read("components/area/hub/ShopCardLuxury.tsx");
const packageJson = JSON.parse(read("package.json"));

assert.match(
  viewModelSource,
  /buildAreaShopCardViewModel\s*\(\s*shop[\s\S]*?,\s*targetArea[\s\S]*?,\s*options/,
  "view model must expose the briefed shop, targetArea, options signature"
);
for (const optionContract of [
  "rank?: number | null",
  "showRank?: boolean",
  'summarySource?: "wordpress-only"',
  "maxActions?: 2"
]) {
  assert.ok(viewModelSource.includes(optionContract), `view model options must include ${optionContract}`);
}
assert.equal(
  packageJson.scripts["test:area-shop-card-view-model"],
  "node scripts/check-area-shop-card-view-model.mjs"
);
assert.ok(packageJson.scripts.test.includes("npm run test:area-shop-card-view-model"));

assert.ok(cardSource.includes('data-area-shop-card="true"'), "AreaShopCard needs one measurable shared DOM");
assert.equal((cardSource.match(/<article\b/g) ?? []).length, 1, "AreaShopCard must have one card DOM");
assert.ok(cardSource.includes("ShopRankCell"), "AreaShopCard must reuse ShopRankCell");
assert.ok(cardSource.includes("styles.rankSlot"), "rank must use an independent card column");
assert.ok(cardSource.includes("model.quickLinks.map"), "card must render only view-model quick links");
assert.ok(cardSource.includes("model.actions.map"), "card must render at most the view-model actions");

for (const exactLayout of [
  "64px 240px minmax(0, 1fr) 164px",
  "64px 220px minmax(0, 1fr) 164px",
  "56px 220px minmax(0, 1fr) 148px"
]) {
  assert.ok(cardCss.includes(exactLayout), `responsive columns must include ${exactLayout}`);
}
assert.ok(cardCss.includes("gap: 24px"), "1440/1280 layout needs a 24px gap");
assert.ok(cardCss.includes("gap: 20px"), "1024 layout needs a 20px gap");
assert.ok(cardCss.includes("@media (max-width: 900px)"), "the shared DOM must stack at 900px");
assert.ok(cardCss.includes("aspect-ratio: 4 / 3"), "images must keep a 4:3 frame");
assert.ok(cardCss.includes("object-fit: cover"), "real photos must keep cover presentation");
assert.ok(cardCss.includes("object-fit: contain"), "fallback images must keep contain presentation");
assert.ok(cardCss.includes("min-height: 44px"), "actions and quick links need 44px targets");
assert.ok(cardCss.includes(":focus-visible"), "keyboard focus must remain visible");
assert.ok(cardCss.includes("word-break: normal"), "shop names must wrap naturally");
assert.ok(cardCss.includes("line-break: strict"), "Japanese shop names need strict line breaking");

for (const [label, source] of [
  ["ShopCard", legacyShopCard],
  ["ShopCardLuxury", luxuryWrapper]
]) {
  assert.ok(source.includes("<AreaShopCard"), `${label} must delegate to AreaShopCard`);
  assert.equal((source.match(/<article\b/g) ?? []).length, 0, `${label} must not own card markup`);
  assert.equal(source.includes("module.css"), false, `${label} must not own CSS layout`);
}
for (const propName of ["compact?: boolean", 'variant?: "default" | "new"', "rank?: number | null"]) {
  assert.ok(legacyShopCard.includes(propName), `ShopCard must preserve ${propName}`);
}
for (const propName of ["targetArea", "rank?: number | null"]) {
  assert.ok(luxuryWrapper.includes(propName), `ShopCardLuxury must preserve ${propName}`);
}

console.log("area shop card view model checks passed");
