import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = readFileSync(join(root, "lib/shop-detail-view-model.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true
  }
}).outputText;

const factNormalizationSource = readFileSync(join(root, "lib/shop-fact-normalization.ts"), "utf8");
const factNormalizationCompiled = ts.transpileModule(factNormalizationSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true
  }
}).outputText;
const factNormalizationModule = { exports: {} };
vm.runInNewContext(
  factNormalizationCompiled,
  { module: factNormalizationModule, exports: factNormalizationModule.exports },
  { filename: "shop-fact-normalization.cjs" }
);

const unknownPrice = { status: "unknown", amount: null };
const confirmedPrice = { status: "confirmed", amount: 14000 };
const module = { exports: {} };
const require = (id) => {
  if (id === "@/lib/design-constants") {
    return { DEFAULT_SHOP_IMAGE: "/images/eskomi-shop-fallback.svg" };
  }
  if (id === "@/lib/price-normalization") {
    return {
      resolveShopPrimaryPrice: (acf) => (acf.price_90 === "14,000円" ? confirmedPrice : unknownPrice),
      resolveShopCoursePrices: (acf) =>
        acf.price_90 === "14,000円"
          ? [{ key: "price_90", label: "90分", price: confirmedPrice }]
          : [],
      formatPriceForDisplay: (price, suffix = "") =>
        price.amount == null ? null : `${price.amount.toLocaleString("ja-JP")}円${suffix}`
    };
  }
  if (id === "@/lib/shop-fact-normalization") return factNormalizationModule.exports;
  throw new Error(`Unexpected require: ${id}`);
};

vm.runInNewContext(
  compiled,
  { module, exports: module.exports, require, URL, Date, console },
  { filename: "shop-detail-view-model.cjs" }
);
const { buildShopDetailViewModel, buildShopSectionLinks } = module.exports;

const base = {
  id: 123,
  slug: "c-r-e-a-m",
  title: "C.r.e.a.m（クリーム）",
  imageUrl: "https://example.jp/main.jpg",
  officialUrl: "https://example.jp/",
  contentHtml: "<p>店舗紹介</p>",
  excerpt: "",
  link: "https://mens-esthe-kuchikomi.com/shop/c-r-e-a-m/",
  areaSlug: "sakaisujihonmachi",
  terms: [{ id: 99, name: "一般タームの駅近", slug: "station-near", parent: 0, count: 1 }],
  ranking: { promotion: null },
  acf: {
    price_90: "14,000円",
    shop_station: "堺筋本町駅 徒歩2分",
    shop_hours: "10:00〜翌5:00",
    shop_updated_at: "2026-07-15",
    shop_tel: "080-0000-0000",
    shop_booking_url: "https://example.jp/reserve/"
  }
};

const full = buildShopDetailViewModel(base, "堺筋本町");
assert.deepEqual(Array.from(full.facts, (item) => item.key), ["price", "station", "hours", "booking"]);
assert.equal(full.facts.find((item) => item.key === "price")?.value, "14,000円〜");
assert.equal(full.prices.length, 1);
assert.equal(full.prices[0].key, "price_90");
assert.equal(full.prices[0].label, "90分");
assert.equal(full.prices[0].price.status, "confirmed");
assert.equal(full.prices[0].price.amount, 14000);
assert.equal(full.images[0].url, "https://example.jp/main.jpg");
assert.equal(full.images[0].isFallback, false);
assert.equal(full.verifiedAt, "2026年7月15日");
assert.deepEqual(
  Array.from(full.actions, ({ kind, href, external }) => ({ kind, href, external })),
  [
    { kind: "reservation", href: "https://example.jp/reserve/", external: true },
    { kind: "tel", href: "tel:08000000000", external: false },
    { kind: "official", href: "https://example.jp/", external: true }
  ]
);
assert.equal(full.introductionText, "店舗紹介");

const sparse = buildShopDetailViewModel(
  {
    ...base,
    imageUrl: "",
    officialUrl: "",
    terms: [{ id: 100, name: "深夜営業", slug: "late-night", parent: 0, count: 1 }],
    acf: {
      price_90: "0",
      shop_hours: 0,
      shop_holiday: "未確認",
      shop_booking: "",
      shop_parking: 0,
      shop_staff_count: 0
    }
  },
  "堺筋本町"
);
assert.equal(sparse.facts.length, 0);
assert.equal(sparse.infoRows.length, 0);
assert.equal(sparse.actions.length, 0);
assert.equal(sparse.images.length, 1);
assert.equal(sparse.images[0].url, "/images/eskomi-shop-fallback.svg");
assert.equal(sparse.images[0].isFallback, true);
assert.equal(sparse.verifiedAt, null);
assert.deepEqual(Array.from(sparse.featureNames), []);

const serialized = JSON.stringify(sparse);
for (const forbidden of ["12,000", "不定休", "完全予約制", "駐車場なし", "0名", "OPEN"]) {
  assert.equal(serialized.includes(forbidden), false, `sparse view must not invent ${forbidden}`);
}

const unsafe = buildShopDetailViewModel(
  {
    ...base,
    imageUrl: "javascript:alert(1)",
    officialUrl: "javascript:alert(1)",
    acf: {
      shop_booking_url: "data:text/html,x",
      shop_line: "javascript:x",
      shop_tel: "---",
      shop_header_image: "//evil.example/image.jpg"
    }
  },
  "堺筋本町"
);
assert.equal(unsafe.actions.length, 0);
assert.equal(unsafe.images.length, 1);
assert.equal(unsafe.images[0].isFallback, true);

const localAndDuplicateImages = buildShopDetailViewModel(
  {
    ...base,
    imageUrl: "/wp-content/uploads/main.jpg",
    acf: {
      shop_header_image: "/wp-content/uploads/main.jpg",
      gallery_image: { url: "https://example.jp/gallery.jpg" },
      store_image: { source_url: "https://example.jp/gallery.jpg" },
      thumbnail: "javascript:alert(1)"
    }
  },
  "堺筋本町"
);
assert.deepEqual(Array.from(localAndDuplicateImages.images, (image) => image.url), [
  "/wp-content/uploads/main.jpg",
  "https://example.jp/gallery.jpg"
]);

const explicit = buildShopDetailViewModel(
  {
    ...base,
    acf: {
      shop_holiday: "不定休",
      shop_booking: "完全予約制",
      shop_parking: "駐車場なし",
      shop_features: ["駅近", "駅近", { name: "個室" }],
      features: [{ name: "個室" }, " 深夜受付 "],
      shop_facilities: ["シャワー完備"]
    }
  },
  "堺筋本町"
);
assert.deepEqual(Array.from(explicit.infoRows, (row) => [row.key, row.value]), [
  ["holiday", "不定休"],
  ["booking", "完全予約制"],
  ["parking", "駐車場なし"],
  ["official", "公式サイトを見る"]
]);
assert.deepEqual(Array.from(explicit.featureNames), ["駅近", "個室", "深夜受付", "シャワー完備"]);
assert.equal(explicit.featureNames.includes("一般タームの駅近"), false);

const validLeapDay = buildShopDetailViewModel(
  { ...base, acf: { shop_updated_at: "2024-02-29" } },
  "堺筋本町"
);
assert.equal(validLeapDay.verifiedAt, "2024年2月29日");

for (const [dateText, expected] of [
  ["2026-07-15", "2026年7月15日"],
  ["2026/07/15", "2026年7月15日"],
  ["2026年7月15日", "2026年7月15日"]
]) {
  const valid = buildShopDetailViewModel(
    { ...base, acf: { shop_updated_at: dateText } },
    "堺筋本町"
  );
  assert.equal(valid.verifiedAt, expected, `${dateText} must be accepted as a verified date`);
}

for (const malformedDate of [
  "prefix2026-07-15",
  "2026-07-15suffix",
  "12026-07-15",
  "-2026-07-15",
  "2026-07-15Tinvalid"
]) {
  const malformed = buildShopDetailViewModel(
    { ...base, acf: { shop_updated_at: malformedDate } },
    "堺筋本町"
  );
  assert.equal(malformed.verifiedAt, null, `${malformedDate} must not be a verified date`);
}

for (const invalidDate of ["2026-02-29", "2026-04-31", "2026-13-01", "not-a-date"]) {
  const invalid = buildShopDetailViewModel(
    { ...base, acf: { shop_updated_at: invalidDate } },
    "堺筋本町"
  );
  assert.equal(invalid.verifiedAt, null, `${invalidDate} must not be a verified date`);
}

const task8Failures = [];
function task8Contract(label, run) {
  try {
    run();
  } catch (error) {
    task8Failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

task8Contract("safe-introduction-text", () => {
  const safeIntroduction = buildShopDetailViewModel(
    {
      ...base,
      title: "難波 & 癒し処",
      contentHtml: [
        '<p onclick="alert(1)">難波 &amp; 癒し処</p>',
        "<script>window.__unsafe = true</script>",
        '<a href="javascript:alert(2)" onmouseover="alert(3)">ご案内</a>',
        '<img src="x" onerror="alert(4)">'
      ].join(" ")
    },
    "難波"
  );

  assert.equal(safeIntroduction.title, "難波 & 癒し処", "日本語と&を含む店舗名を変えないでください");
  assert.equal(
    safeIntroduction.introductionText,
    "難波 & 癒し処 ご案内",
    "本文はentityを復元し、HTML、script、event属性、javascript URLを除いた純文字列にしてください"
  );
  assert.equal(
    Object.hasOwn(safeIntroduction, "introductionHtml"),
    false,
    "安全でないHTML本文のview-model fieldを残さないでください"
  );
  for (const forbidden of ["<script", "onclick", "onmouseover", "onerror", "javascript:"]) {
    assert.equal(
      JSON.stringify(safeIntroduction).toLowerCase().includes(forbidden),
      false,
      `view modelへ${forbidden}を残さないでください`
    );
  }
});

task8Contract("conditional-section-links", () => {
  assert.equal(
    typeof buildShopSectionLinks,
    "function",
    "buildShopSectionLinks(model, { hasReviews, hasNearby })をexportしてください"
  );
  assert.deepEqual(
    Array.from(
      buildShopSectionLinks(
        {
          ...full,
          introductionText: "店舗紹介",
          featureNames: ["個室"],
          infoRows: [{ key: "hours", label: "営業時間", value: "10:00〜24:00" }]
        },
        { hasReviews: true, hasNearby: true }
      ),
      ({ id, label }) => ({ id, label })
    ),
    [
      { id: "overview", label: "概要" },
      { id: "prices", label: "料金" },
      { id: "hours-access", label: "営業時間・アクセス" },
      { id: "features", label: "特徴" },
      { id: "reviews", label: "口コミ" },
      { id: "nearby", label: "近隣店舗" }
    ]
  );
  assert.deepEqual(
    Array.from(
      buildShopSectionLinks(
        {
          ...sparse,
          introductionText: "",
          catchText: "",
          recommendText: "",
          summaryText: "",
          prices: [],
          infoRows: [],
          featureNames: []
        },
        { hasReviews: false, hasNearby: false }
      )
    ),
    [],
    "空セクションのmenu linkを作らないでください"
  );
});

task8Contract("safe-react-rendering", () => {
  const sectionsSource = readFileSync(join(root, "components/shop-detail/ShopDetailSections.tsx"), "utf8");
  assert.equal(
    sectionsSource.includes("dangerouslySetInnerHTML"),
    false,
    "店舗紹介本文をdangerouslySetInnerHTMLで描画しないでください"
  );
  assert.ok(
    sectionsSource.includes("model.introductionText"),
    "店舗紹介本文はintroductionTextをReact文字列として描画してください"
  );
  for (const id of ["overview", "prices", "hours-access", "features", "reviews"]) {
    assert.ok(sectionsSource.includes(`id=\"${id}\"`), `実在sectionへ#${id}を付けてください`);
  }
});

task8Contract("section-navigation-accessibility", () => {
  const componentPath = join(root, "components/shop-detail/ShopSectionNav.tsx");
  assert.ok(existsSync(componentPath), "ShopSectionNav.tsxを作成してください");
  const navSource = readFileSync(componentPath, "utf8");
  const detailSource = readFileSync(join(root, "components/ShopDetail.tsx"), "utf8");
  const cssSource = readFileSync(join(root, "components/shop-detail/ShopDetail.module.css"), "utf8");
  const areaCardSource = readFileSync(join(root, "lib/area-shop-card-view-model.ts"), "utf8");

  assert.match(
    navSource,
    /export function ShopSectionNav\(\{ links \}: \{ links: ShopSectionLink\[\] \}\)/,
    "ShopSectionNav({ links }: { links: ShopSectionLink[] })のexact signatureを維持してください"
  );
  assert.ok(navSource.includes("IntersectionObserver"), "実際の現在地を観測してください");
  assert.match(
    navSource,
    /aria-current=\{activeId === link\.id \? "location" : undefined\}/,
    "aria-currentは実際の現在地だけへ付けてください"
  );
  assert.equal(navSource.includes('role="tab"'), false, "ページ内anchorへrole=tabを付けないでください");
  assert.equal(detailSource.includes("styles.quickLinks"), false, "固定quick linksを残さないでください");
  assert.ok(detailSource.includes("buildShopSectionLinks"), "存在情報からmenu linksを組み立ててください");
  assert.ok(detailSource.includes("<ShopSectionNav links={sectionLinks}"), "条件付きmenuだけを描画してください");
  assert.match(cssSource, /\.sectionNav[^}]*position:\s*sticky/s, "ページ内menuを固定表示にしてください");
  assert.match(cssSource, /\.sectionNavList[^}]*overflow-x:\s*auto/s, "スマホmenuを横スクロール可能にしてください");
  assert.match(cssSource, /\.sectionNavLink[^}]*min-height:\s*44px/s, "menu操作を44px以上にしてください");
  assert.match(cssSource, /\.sectionNavLink:focus-visible[^}]*outline:/s, "menuのfocus-visibleを表示してください");
  assert.match(cssSource, /\.section[^}]*scroll-margin-top:/s, "sectionに固定header分のscroll marginを付けてください");
  for (const id of ["prices", "hours-access", "reviews"]) {
    assert.ok(areaCardSource.includes(`#${id}`), `Task 6 quick linkを#${id}へ同期してください`);
  }
  for (const staleId of ["#shop-price", "#shop-data", "#shop-reviews"]) {
    assert.equal(areaCardSource.includes(staleId), false, `旧quick link ${staleId}を残さないでください`);
  }
});

task8Contract("shared-responsive-sticky-offset", () => {
  const navSource = readFileSync(join(root, "components/shop-detail/ShopSectionNav.tsx"), "utf8");
  const detailSource = readFileSync(join(root, "components/ShopDetail.tsx"), "utf8");
  const cssSource = readFileSync(join(root, "components/shop-detail/ShopDetail.module.css"), "utf8");

  assert.ok(detailSource.includes("data-shop-detail-root"), "shop detail rootを測定値の共有先にしてください");
  assert.ok(navSource.includes(".escomi-final-site-header"), "実在SiteHeader classを測定してください");
  assert.ok(navSource.includes("getBoundingClientRect"), "headerとnavの実寸を測定してください");
  assert.ok(navSource.includes("ResizeObserver"), "2段headerの高さ変化を追跡してください");
  assert.ok(navSource.includes('addEventListener("resize"'), "ResizeObserver未対応時もresize再測定してください");
  assert.ok(navSource.includes('setProperty("--shop-site-header-offset"'), "header実測値をroot CSS変数へ共有してください");
  assert.match(navSource, /setProperty\(\s*"--shop-section-scroll-offset"/, "section移動量をroot CSS変数へ共有してください");
  assert.ok(navSource.includes("rootMargin: `-${sectionScrollOffset}px"), "Observerも共有section offsetを使ってください");
  assert.match(
    cssSource,
    /\.sectionNav[^}]*top:\s*var\(--shop-site-header-offset\)/s,
    "nav topはheader実測CSS変数を使ってください"
  );
  assert.match(
    cssSource,
    /\.section[^}]*scroll-margin-top:\s*var\(--shop-section-scroll-offset\)/s,
    "section scroll marginは共有offsetを使ってください"
  );
  assert.match(
    cssSource,
    /\.sectionAnchor[^}]*scroll-margin-top:\s*var\(--shop-section-scroll-offset\)/s,
    "nearby scroll marginも共有offsetを使ってください"
  );
  assert.equal(/\.sectionNav\s*\{[^}]*top:\s*0\s*;/s.test(cssSource), false, "nav top:0を残さないでください");
  assert.equal(cssSource.includes("scroll-margin-top: 112px"), false, "固定112pxを残さないでください");
  assert.equal(navSource.includes('rootMargin: "-112px'), false, "Observer固定112pxを残さないでください");
});

task8Contract("observer-fallback-and-cleanup", () => {
  const navSource = readFileSync(join(root, "components/shop-detail/ShopSectionNav.tsx"), "utf8");
  const emptyGuardIndex = navSource.indexOf("links.length === 0");
  const observerCreationIndex = navSource.indexOf("new IntersectionObserver");

  assert.ok(emptyGuardIndex >= 0 && emptyGuardIndex < observerCreationIndex, "links 0件ではObserverを作らないでください");
  assert.match(navSource, /typeof IntersectionObserver\s*[!=]==?\s*"undefined"/, "IntersectionObserver未対応環境を分岐してください");
  assert.ok(navSource.includes('addEventListener("hashchange"'), "hash fallbackを維持してください");
  assert.ok(navSource.includes("onClick={() => setActiveId(link.id)}"), "clickで現在地を更新してください");
  assert.ok(navSource.includes("resizeObserver?.disconnect()"), "ResizeObserverをcleanupしてください");
  assert.ok(navSource.includes('removeEventListener("resize"'), "resize listenerをcleanupしてください");
  assert.ok(navSource.includes('removeProperty("--shop-site-header-offset"'), "header CSS変数をcleanupしてください");
  assert.ok(navSource.includes('removeProperty("--shop-section-scroll-offset"'), "section CSS変数をcleanupしてください");
});

if (task8Failures.length > 0) {
  console.error(`shop detail task 8 check failed (${task8Failures.length}/6 contracts):`);
  for (const failure of task8Failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("shop detail view model check passed");
