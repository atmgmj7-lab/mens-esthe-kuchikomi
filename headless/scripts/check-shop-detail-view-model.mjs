import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

const unknownPrice = { status: "unknown", amount: null };
const confirmedPrice = { status: "confirmed", amount: 14000 };
const module = { exports: {} };
const require = (id) => {
  if (id === "@/lib/design-constants") {
    return { DEFAULT_SHOP_IMAGE: "/shop-default-image.webp" };
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
  throw new Error(`Unexpected require: ${id}`);
};

vm.runInNewContext(
  compiled,
  { module, exports: module.exports, require, URL, Date, console },
  { filename: "shop-detail-view-model.cjs" }
);
const { buildShopDetailViewModel } = module.exports;

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
assert.equal(full.introductionHtml, "<p>店舗紹介</p>");

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
assert.equal(sparse.images[0].url, "/shop-default-image.webp");
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

console.log("shop detail view model check passed");
