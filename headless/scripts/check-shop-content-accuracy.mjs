import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

function loadTsModule(path, requireStub) {
  const compiled = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  }).outputText;
  const module = { exports: {} };

  vm.runInNewContext(
    compiled,
    {
      module,
      exports: module.exports,
      require: requireStub,
      URL,
      Date,
      console
    },
    { filename: `${path}.cjs` }
  );

  return module.exports;
}

const safeText = (value) => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
};
const stripHtml = (value) =>
  safeText(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

const areaUtils = loadTsModule("lib/area-shop-utils.ts", (id) => {
  if (id === "@/lib/area-hub-config") {
    return {
      fillHubPageToken: (value) => value,
      getHubTemplateConfig: () => null,
      NIHONBASHI_GUIDE_DESCRIPTION: "",
      NIHONBASHI_GUIDE_TITLE: "",
      NIHONBASHI_HUB_DESCRIPTION: "",
      NIHONBASHI_HUB_TITLE: ""
    };
  }
  if (id === "@/lib/wp/client") return { safeText };
  if (id === "@/lib/price-normalization") {
    return {
      formatPriceForDisplay: (price, suffix = "") =>
        price.status === "confirmed" ? `${price.amount.toLocaleString("ja-JP")}円${suffix}` : null,
      normalizePrice: (value) =>
        Number(value) > 0 ? { status: "confirmed", amount: Number(value) } : { status: "unknown", amount: null },
      PRIMARY_PRICE_FIELD_KEYS: ["basic_price"],
      resolveShopPrimaryPrice: (acf) =>
        Number(acf.basic_price) > 0
          ? { status: "confirmed", amount: Number(acf.basic_price) }
          : { status: "unknown", amount: null }
    };
  }
  if (id === "@/lib/content-provenance") return { normalizeContentItems: () => [] };
  if (id === "@/lib/review-rating") {
    return {
      resolveShopReviewSummary: () => ({ reviewCount: 0, aggregate: null }),
      shouldDisplayAggregateRating: () => false
    };
  }
  if (id === "@/lib/shop-ranking") {
    return { sortShopsForRanking: (shops) => shops, selectRankingTopShops: (shops) => shops };
  }
  throw new Error(`Unexpected area utility require: ${id}`);
});

const viewModel = loadTsModule("lib/shop-detail-view-model.ts", (id) => {
  if (id === "@/lib/design-constants") {
    return { DEFAULT_SHOP_IMAGE: "/images/eskomi-shop-fallback.svg" };
  }
  if (id === "@/lib/price-normalization") {
    return {
      resolveShopPrimaryPrice: () => ({ status: "unknown", amount: null }),
      resolveShopCoursePrices: () => [],
      formatPriceForDisplay: () => null
    };
  }
  throw new Error(`Unexpected view model require: ${id}`);
});

const seo = loadTsModule("lib/seo.ts", (id) => {
  if (id === "@/lib/wp/client") return { stripHtml };
  if (id === "@/lib/shop-contact") {
    return { resolveShopAreaTerm: (shop) => shop.terms?.[0] ?? null };
  }
  if (id === "@/lib/price-normalization") {
    return {
      resolveShopPrimaryPrice: () => ({ status: "unknown", amount: null }),
      shouldOutputPriceSchema: () => false,
      formatPriceForDisplay: () => null
    };
  }
  throw new Error(`Unexpected SEO require: ${id}`);
});

const baseShop = {
  id: 501,
  slug: "accuracy-fixture",
  title: "精度確認店舗",
  link: "",
  contentHtml: "",
  excerpt: "",
  imageUrl: "",
  officialUrl: "",
  areaSlug: "umeda",
  terms: [{ id: 1, name: "梅田", slug: "umeda", parent: 10, count: 1 }],
  ranking: {
    manualRank: null,
    rankingPriority: null,
    isRankingEnabled: true,
    rankingReason: "",
    isPr: false,
    rankingLabel: "",
    promotion: { isPromotion: false, requiresDisclosure: false, isEligibleForNaturalRanking: true }
  },
  acf: {}
};

const targetArea = { slug: "umeda", name: "梅田" };
const failures = [];
const passes = [];

function contract(name, run) {
  try {
    run();
    passes.push(name);
  } catch (error) {
    failures.push({ name, message: error instanceof Error ? error.message : String(error) });
  }
}

contract("fixed-update-date", () => {
  assert.equal(
    areaUtils.resolveLastUpdatedLabel([{ ...baseShop, acf: {} }]),
    null,
    "shop_updated_atがない場合は固定日を返さないでください"
  );
  assert.equal(
    areaUtils.resolveLastUpdatedLabel([
      { ...baseShop, id: 1, acf: { shop_updated_at: "2026-02-29" } },
      { ...baseShop, id: 2, acf: { shop_updated_at: "2026/07/14" } },
      { ...baseShop, id: 3, acf: { shop_updated_at: "2026年7月15日" } }
    ]),
    "2026年7月15日",
    "実在するshop_updated_atの最新日だけを表示してください"
  );
  assert.equal(
    areaUtils.resolveShopLastVerifiedLabel({ ...baseShop, acf: { shop_updated_at: "" } }),
    null,
    "店舗単位でも未確認日を生成しないでください"
  );
  for (const malformed of ["2026-07-15日", "2026/07/15日", "2026年07-15"]) {
    assert.equal(
      areaUtils.resolveShopLastVerifiedLabel({
        ...baseShop,
        acf: { shop_updated_at: malformed }
      }),
      null,
      `${malformed}は許可されたshop_updated_at形式ではありません`
    );
  }

  const template = read("components/area/AreaHubPageTemplate.tsx");
  assert.match(template, /lastUpdated\s*\?\s*\(/, "エリア確認日は値がある場合だけ行を表示してください");
  assert.match(template, /<dt>掲載情報の確認日<\/dt>/, "更新日の意味を画面で明示してください");
});

contract("address-derived-station", () => {
  const addressOnly = {
    ...baseShop,
    acf: { shop_address: "大阪府大阪市北区梅田1-2-3 梅田駅から徒歩3分" }
  };
  assert.equal(
    areaUtils.shopNearestStation(addressOnly),
    "未確認",
    "shop_addressから最寄駅を生成しないでください"
  );
  assert.equal(
    areaUtils.isStationNearShop(addressOnly, targetArea),
    false,
    "shop_addressだけでstation条件へ含めないでください"
  );

  const explicitStation = {
    ...baseShop,
    acf: { shop_address: "大阪府大阪市北区梅田1-2-3", shop_station: "梅田駅 徒歩3分" }
  };
  assert.equal(areaUtils.shopNearestStation(explicitStation), "梅田駅 徒歩3分");
  assert.equal(areaUtils.isStationNearShop(explicitStation, targetArea), true);
  assert.equal(
    areaUtils.shopNearestStation({
      ...baseShop,
      acf: { shop_station: "  <b>梅田駅</b>  徒歩3分  " }
    }),
    "梅田駅 徒歩3分",
    "駅専用値はHTMLと余分な空白を除いて表示してください"
  );
  assert.equal(
    areaUtils.shopNearestStation({ ...baseShop, acf: { shop_station: "   " } }),
    "未確認",
    "空白だけの駅専用値は未確認として扱ってください"
  );
  assert.equal(
    areaUtils.isStationNearShop(
      { ...baseShop, acf: { shop_station: "梅田駅 7番出口" } },
      targetArea
    ),
    false,
    "station条件は駅名だけでなく徒歩N分の明示も必要です"
  );

  const controls = read("lib/area-shop-list-controls.ts");
  assert.match(controls, /\{ id: "station", label: "駅名・徒歩案内あり" \}/);
  assert.match(controls, /ShopListSortId = "recommended" \| "updated" \| "price-asc" \| "late-night" \| "station"/);
});

contract("inferred-beginner", () => {
  const inferred = {
    ...baseShop,
    officialUrl: "https://example.jp/",
    acf: {
      basic_price: "12000",
      shop_hours: "10:00〜翌5:00",
      shop_booking: "電話予約",
      shop_ai_summary: "編集部コメント"
    }
  };
  assert.equal(
    areaUtils.isBeginnerFriendlyShop(inferred),
    false,
    "料金・営業時間・連絡先・AI要約から初心者向けを推定しないでください"
  );
  assert.equal(
    areaUtils.isBeginnerFriendlyShop({
      ...baseShop,
      acf: { shop_features: ["初心者向け"] }
    }),
    true,
    "明示された初心者向け特徴だけを採用してください"
  );
  assert.equal(
    areaUtils.shopBeginnerFeatureLabel({
      ...baseShop,
      acf: { shop_features: [" <span>初心者向け</span> "] }
    }),
    "初心者向け",
    "明示特徴はHTMLと余分な空白を除いて表示してください"
  );
  assert.doesNotMatch(
    read("components/area/hub/RankingSpecialtyCards.tsx"),
    /function beginnerChecks/,
    "初心者向けカードで情報量チェックを生成しないでください"
  );
});

contract("generated-editor-comment", () => {
  assert.equal(
    areaUtils.buildEditorCommentShort({
      ...baseShop,
      acf: { shop_hours: "10:00〜翌5:00", shop_address: "梅田" }
    }),
    "",
    "shop_ai_summaryがない場合は編集コメントを生成しないでください"
  );
  assert.equal(
    areaUtils.buildEditorCommentShort({
      ...baseShop,
      acf: { shop_ai_summary: "<p>WordPressにある 編集コメント</p>" }
    }),
    "WordPressにある 編集コメント",
    "編集コメントはshop_ai_summaryだけを表示してください"
  );
});

contract("access-text-street-address", () => {
  const accessOnly = { ...baseShop, acf: { shop_address: "梅田駅7番出口から徒歩3分" } };
  const accessSchema = seo.shopLocalBusinessJsonLd(accessOnly);
  assert.equal(accessSchema.address, undefined, "アクセス文をstreetAddressへ出力しないでください");

  const addressShop = {
    ...baseShop,
    acf: { shop_address: "大阪府大阪市北区梅田1-2-3" }
  };
  const addressSchema = seo.shopLocalBusinessJsonLd(addressShop);
  assert.equal(addressSchema.address?.streetAddress, "大阪府大阪市北区梅田1-2-3");

  const accessModel = viewModel.buildShopDetailViewModel(accessOnly, "梅田");
  assert.equal(
    accessModel.infoRows.find((row) => row.key === "address")?.label,
    "アクセス案内",
    "住所形式を確認できないshop_addressは画面でアクセス案内と表示してください"
  );
  const addressModel = viewModel.buildShopDetailViewModel(addressShop, "梅田");
  assert.equal(addressModel.infoRows.find((row) => row.key === "address")?.label, "住所");
});

if (failures.length > 0) {
  console.error(`shop content accuracy check failed (${failures.length}/5 contracts):`);
  for (const failure of failures) {
    console.error(`- ${failure.name}: ${failure.message}`);
  }
  process.exit(1);
}

console.log(`shop content accuracy checks passed (${passes.length}/5 contracts)`);
