# Shop Detail C Editorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 店舗詳細をC案「データ先行・編集型」へ作り直し、画像崩れと仮値を除去し、PC・スマホで予約・公式サイトへ進みやすくする。

**Architecture:** WordPressの `ShopView` を、表示可能な値だけを持つ `ShopDetailViewModel` へ変換する。ページは小さなserver componentへ分割し、店舗詳細専用CSS Moduleで最大1360px、画像4:3、スマホ左右16pxを保証する。クリック計測はdata属性を既存GA4のdocument listenerが一度だけ分類する。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript 5、CSS Modules、WordPress REST `ShopView`、GA4

## Global Constraints

- 先に `2026-07-16-shop-owner-request-flow.md` を実行し、`buildShopOwnerRequestUrl()` を利用可能にする。
- 公開店舗データはWordPressから取得し、Supabase候補値を店舗詳細へ混ぜない。
- 推測値、架空口コミ、静的OPEN、仮の12,000円、不定休、完全予約制、駐車場なし、0名を作らない。
- WordPressに明示的に保存された「不定休」「駐車場なし」等は、その値をそのまま表示してよい。
- PC本文幅は最大1360px、スマホ左右余白は最低16px、タップ領域は44px以上とする。
- メイン画像と追加画像は4:3。`width`、`height`、`min-height` の競合で縦へ引き伸ばさない。
- 角丸カードを並べず、余白、細い罫線、文字の強弱で構成する。
- 既存のLocalBusiness JSON-LD、パンくず、口コミ出自、PR関係属性、地域内部リンクを維持する。
- 外部URLはhttp/httpsだけ、電話は数字を含む場合だけ表示する。
- 画像直接アップロード、WordPress自動更新、Supabase公開参照先切替を行わない。
- ローカル検証後、push・本番公開前の完成品質95%で停止する。
- Git操作は対象パスだけに限定し、`git add -A` を使わない。

---

## File Structure

| Path | Responsibility |
|---|---|
| `headless/lib/shop-detail-view-model.ts` | WordPress値の表示可否、画像、料金、情報行、CTAを整理 |
| `headless/scripts/check-shop-detail-view-model.mjs` | 仮値禁止と表示条件の動的検査 |
| `headless/components/shop-detail/ShopDetailHero.tsx` | 店名、確認日、概要値、上部CTA |
| `headless/components/shop-detail/ShopDetailGallery.tsx` | 4:3画像と追加画像 |
| `headless/components/shop-detail/ShopDetailActions.tsx` | 予約・公式・電話・LINE、スマホ固定導線 |
| `headless/components/shop-detail/ShopOwnerCta.tsx` | 店舗責任者向け登録・修正導線 |
| `headless/components/shop-detail/ShopDetailSections.tsx` | 料金、紹介、特徴、基本情報、口コミ |
| `headless/components/shop-detail/ShopDetail.module.css` | 店舗詳細専用のPC・スマホ表示 |
| `headless/components/ShopDetail.tsx` | SEO、パンくず、ページ順序、地域リンク |
| `headless/components/GoogleAnalytics.tsx` | CTA種別と配置を1回だけGA4送信 |
| `headless/scripts/check-shop-detail-click-tracking.mjs` | data属性とイベント分類の検査 |
| `headless/scripts/check-shop-detail-responsive-contract.mjs` | 最大幅、余白、画像比率、固定導線のCSS検査 |
| `headless/scripts/check-final-design-preservation.mjs` | 旧店舗詳細契約をC案契約へ更新 |

### Task 1: 仮値を作らないShopDetailViewModel

**Files:**
- Create: `headless/lib/shop-detail-view-model.ts`
- Create: `headless/scripts/check-shop-detail-view-model.mjs`
- Modify: `headless/scripts/check-price-normalization.mjs`

**Interfaces:**
- Consumes: `ShopView`、`resolveShopPrimaryPrice()`、`resolveShopCoursePrices()`、`DEFAULT_SHOP_IMAGE`
- Produces: `buildShopDetailViewModel(shop, areaName)` → `ShopDetailViewModel`

- [ ] **Step 1: view modelの失敗する動的検査を書く**

Create `headless/scripts/check-shop-detail-view-model.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const source = readFileSync(join(root, "lib/shop-detail-view-model.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText;

const module = { exports: {} };
const require = (id) => {
  if (id === "@/lib/design-constants") return { DEFAULT_SHOP_IMAGE: "/shop-default-image.webp" };
  if (id === "@/lib/price-normalization") return {
    resolveShopPrimaryPrice: (acf) => acf.price_90 ? { status: "confirmed", amount: 14000 } : { status: "unknown", amount: null },
    resolveShopCoursePrices: (acf) => acf.price_90 ? [{ key: "price_90", label: "90分", price: { status: "confirmed", amount: 14000 } }] : [],
    formatPriceForDisplay: (price, suffix = "") => price.amount == null ? null : `${price.amount.toLocaleString("ja-JP")}円${suffix}`
  };
};
vm.runInNewContext(compiled, { module, exports: module.exports, require, URL, Date, console });
const { buildShopDetailViewModel } = module.exports;

const base = {
  id: 123,
  slug: "c-r-e-a-m",
  title: "C.r.e.a.m（クリーム）",
  imageUrl: "https://example.jp/main.jpg",
  officialUrl: "https://example.jp/",
  contentHtml: "",
  excerpt: "",
  link: "",
  terms: [],
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
assert.equal(full.images[0].url, "https://example.jp/main.jpg");
assert.equal(full.images[0].isFallback, false);
assert.equal(full.verifiedAt, "2026年7月15日");
assert.equal(full.actions[0].kind, "reservation");
assert.equal(full.actions.at(-1).kind, "official");

const sparse = buildShopDetailViewModel({ ...base, imageUrl: "", officialUrl: "", acf: {} }, "堺筋本町");
assert.equal(sparse.facts.length, 0);
assert.equal(sparse.infoRows.length, 0);
assert.equal(sparse.actions.length, 0);
assert.equal(sparse.images.length, 1);
assert.equal(sparse.images[0].isFallback, true);
assert.equal(sparse.verifiedAt, null);

const serialized = JSON.stringify(sparse);
for (const forbidden of ["12,000", "不定休", "完全予約制", "駐車場なし", "0名", "OPEN"]) {
  assert.equal(serialized.includes(forbidden), false, `sparse view must not invent ${forbidden}`);
}

const unsafe = buildShopDetailViewModel({
  ...base,
  officialUrl: "javascript:alert(1)",
  acf: { shop_booking_url: "data:text/html,x", shop_line: "javascript:x", shop_tel: "---" }
}, "堺筋本町");
assert.equal(unsafe.actions.length, 0);

console.log("shop detail view model check passed");
```

- [ ] **Step 2: 検査がview model不在で失敗することを確認する**

Run:

```bash
cd headless
node scripts/check-shop-detail-view-model.mjs
```

Expected: FAIL with missing `shop-detail-view-model.ts`.

- [ ] **Step 3: 型と安全な値取得helperを実装する**

Create `headless/lib/shop-detail-view-model.ts` beginning with:

```ts
import { DEFAULT_SHOP_IMAGE } from "@/lib/design-constants";
import { formatPriceForDisplay, resolveShopCoursePrices, resolveShopPrimaryPrice } from "@/lib/price-normalization";
import type { ShopView } from "@/lib/wp/types";

export type ShopDetailFact = {
  key: "price" | "station" | "hours" | "booking";
  label: string;
  value: string;
};

export type ShopDetailAction = {
  kind: "reservation" | "line" | "tel" | "official";
  label: string;
  href: string;
  external: boolean;
};

export type ShopDetailImage = { url: string; alt: string; isFallback: boolean };
export type ShopDetailInfoRow = { key: string; label: string; value: string; href?: string };

export type ShopDetailViewModel = {
  id: number;
  slug: string;
  title: string;
  areaName: string;
  verifiedAt: string | null;
  facts: ShopDetailFact[];
  actions: ShopDetailAction[];
  images: ShopDetailImage[];
  prices: ReturnType<typeof resolveShopCoursePrices>;
  infoRows: ShopDetailInfoRow[];
  introductionHtml: string;
  catchText: string;
  recommendText: string;
  summaryText: string;
  featureNames: string[];
};

const VISUAL_KEYS = [
  "shop_header_image", "header_image", "shop_top_image", "top_image",
  "shop_hero_image", "hero_image", "shop_main_visual", "main_visual",
  "shop_image", "shop_main_image", "main_image", "image", "shop_photo",
  "photo", "gallery_image", "store_image", "thumbnail"
] as const;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function firstText(acf: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = text(acf[key]);
    if (value) return value;
  }
  return "";
}

function httpUrl(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function assetUrl(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return httpUrl(raw);
}

function telUrl(value: unknown): string | null {
  const digits = text(value).replace(/[^0-9]/g, "");
  return digits ? `tel:${digits}` : null;
}

function verifiedDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const match = raw.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!match) return null;
  return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`;
}
```

- [ ] **Step 4: 画像、CTA、facts、infoRowsを実装する**

Add pure helpers and `buildShopDetailViewModel`:

```ts
function imageUrl(value: unknown): string | null {
  if (typeof value === "string") return assetUrl(value);
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  return assetUrl(item.url) || assetUrl(item.source_url);
}

function images(shop: ShopView): ShopDetailImage[] {
  const candidates = [assetUrl(shop.imageUrl), ...VISUAL_KEYS.map((key) => imageUrl(shop.acf[key]))]
    .filter((url): url is string => Boolean(url));
  const unique = [...new Set(candidates)].slice(0, 4);
  if (unique.length === 0) return [{ url: DEFAULT_SHOP_IMAGE, alt: `${shop.title} 画像準備中`, isFallback: true }];
  return unique.map((url, index) => ({ url, alt: index === 0 ? shop.title : `${shop.title} 店舗画像 ${index + 1}`, isFallback: false }));
}

export function buildShopDetailViewModel(shop: ShopView, areaName: string): ShopDetailViewModel {
  const acf = shop.acf;
  const primaryPrice = resolveShopPrimaryPrice(acf);
  const priceLabel = formatPriceForDisplay(primaryPrice, "〜");
  const station = firstText(acf, ["shop_station", "nearest_station", "station", "shop_access"]);
  const hours = firstText(acf, ["shop_hours"]);
  const bookingUrl = ["shop_booking_url", "booking_url", "reservation_url", "shop_reservation_url"]
    .map((key) => httpUrl(acf[key])).find(Boolean) || null;
  const lineUrl = httpUrl(acf.shop_line);
  const phone = telUrl(acf.shop_tel);
  const officialUrl = httpUrl(shop.officialUrl) || httpUrl(acf.official_url);

  const actions: ShopDetailAction[] = [];
  if (bookingUrl) actions.push({ kind: "reservation", label: "空き状況・Web予約", href: bookingUrl, external: true });
  if (lineUrl) actions.push({ kind: "line", label: "LINE予約", href: lineUrl, external: true });
  if (phone) actions.push({ kind: "tel", label: "電話予約", href: phone, external: false });
  if (officialUrl) actions.push({ kind: "official", label: "公式サイトを見る", href: officialUrl, external: true });

  const bookingAction = actions.find((action) => action.kind !== "official");
  const facts: ShopDetailFact[] = [];
  if (priceLabel) facts.push({ key: "price", label: "料金目安", value: priceLabel });
  if (station) facts.push({ key: "station", label: "アクセス", value: station });
  if (hours) facts.push({ key: "hours", label: "営業時間", value: hours });
  if (bookingAction) facts.push({ key: "booking", label: "予約方法", value: bookingAction.label });

  const infoRows: ShopDetailInfoRow[] = [];
  for (const [key, label, value] of [
    ["address", "住所", firstText(acf, ["shop_address"])],
    ["station", "最寄駅・アクセス", station],
    ["hours", "営業時間", hours],
    ["holiday", "定休日", firstText(acf, ["shop_holiday"])],
    ["booking", "予約", firstText(acf, ["shop_booking"])],
    ["parking", "駐車場", firstText(acf, ["shop_parking"])]
  ] as const) {
    if (value) infoRows.push({ key, label, value });
  }
  if (officialUrl) infoRows.push({ key: "official", label: "公式サイト", value: "公式サイトを見る", href: officialUrl });

  const featureNames = [acf.shop_features, acf.features, acf.shop_facilities]
    .flatMap((value) => Array.isArray(value) ? value : [])
    .map((value) => typeof value === "string" ? value.trim() : value && typeof value === "object" ? text((value as Record<string, unknown>).name) : "")
    .filter(Boolean);

  return {
    id: shop.id,
    slug: shop.slug,
    title: shop.title,
    areaName,
    verifiedAt: verifiedDate(acf.shop_updated_at),
    facts,
    actions,
    images: images(shop),
    prices: resolveShopCoursePrices(acf),
    infoRows,
    introductionHtml: shop.contentHtml.trim(),
    catchText: firstText(acf, ["shop_catch"]),
    recommendText: firstText(acf, ["recommend_text"]),
    summaryText: firstText(acf, ["shop_ai_summary"]),
    featureNames: [...new Set(featureNames)]
  };
}
```

- [ ] **Step 5: view model検査を成功させ、旧仮値検査を強化する**

Run:

```bash
cd headless
node scripts/check-shop-detail-view-model.mjs
```

Expected: PASS。

Modify `headless/scripts/check-price-normalization.mjs` to read the new view model and assert:

```js
const shopDetailViewModelSource = readFileSync(join(root, "lib/shop-detail-view-model.ts"), "utf8");
assert.ok(!shopDetailViewModelSource.includes("?? 12000"));
assert.ok(!shopDetailViewModelSource.includes('"不定休"'));
assert.ok(!shopDetailViewModelSource.includes('"完全予約制"'));
assert.ok(!shopDetailViewModelSource.includes('"駐車場なし"'));
```

- [ ] **Step 6: 型と既存料金検査を実行する**

Run:

```bash
npm run test:price-normalization
npm run typecheck
```

Expected: price normalization PASS、type error 0。

### Task 2: Hero、画像、予約導線、責任者導線

**Files:**
- Create: `headless/components/shop-detail/ShopDetailHero.tsx`
- Create: `headless/components/shop-detail/ShopDetailGallery.tsx`
- Create: `headless/components/shop-detail/ShopDetailActions.tsx`
- Create: `headless/components/shop-detail/ShopOwnerCta.tsx`

**Interfaces:**
- Consumes: `ShopDetailViewModel`、`buildShopOwnerRequestUrl(shop)`、promotion rel
- Produces: 上部概要、4:3画像、データ属性付きCTA、店舗責任者導線

- [ ] **Step 1: component契約の失敗する検査を追加する**

Extend `headless/scripts/check-final-design-preservation.mjs`:

```js
const detailHero = read("components/shop-detail/ShopDetailHero.tsx");
const detailGallery = read("components/shop-detail/ShopDetailGallery.tsx");
const detailActions = read("components/shop-detail/ShopDetailActions.tsx");
const ownerCta = read("components/shop-detail/ShopOwnerCta.tsx");
assert.ok(detailHero.includes("model.facts.map"));
assert.ok(!detailHero.includes("OPEN"));
assert.ok(detailGallery.includes("model.images"));
assert.ok(detailGallery.startsWith('"use client";'));
assert.ok(detailGallery.includes("onError"));
assert.ok(detailActions.includes("data-shop-cta-kind"));
assert.ok(detailActions.includes("data-shop-cta-position"));
assert.ok(ownerCta.includes("buildShopOwnerRequestUrl"));
assert.ok(ownerCta.includes("このページを、公式情報で完成させませんか？"));
```

- [ ] **Step 2: 検査がcomponent不在で失敗することを確認する**

Run:

```bash
cd headless
npm run test:final-design-preservation
```

Expected: FAIL with missing `ShopDetailHero.tsx`.

- [ ] **Step 3: Heroと上部CTAを実装する**

Create `headless/components/shop-detail/ShopDetailHero.tsx`:

```tsx
import type { CSSProperties } from "react";
import { ShopDetailActions } from "@/components/shop-detail/ShopDetailActions";
import type { ShopDetailViewModel } from "@/lib/shop-detail-view-model";
import styles from "./ShopDetail.module.css";

export function ShopDetailHero({ model, rel }: { model: ShopDetailViewModel; rel: string }) {
  return (
    <header className={styles.hero}>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.kicker}>SHOP PROFILE · {model.areaName.toUpperCase()}</p>
          <h1 className={styles.title}>{model.title}</h1>
          {model.verifiedAt ? <p className={styles.verified}>掲載情報の確認日 {model.verifiedAt}</p> : null}
        </div>
        <ShopDetailActions model={model} rel={rel} position="hero" />
      </div>
      {model.facts.length > 0 ? (
        <dl className={styles.facts} style={{ "--fact-count": model.facts.length } as CSSProperties}>
          {model.facts.map((fact) => <div key={fact.key}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
        </dl>
      ) : null}
    </header>
  );
}
```

Create `headless/components/shop-detail/ShopDetailActions.tsx`:

```tsx
import type { ShopDetailViewModel } from "@/lib/shop-detail-view-model";
import styles from "./ShopDetail.module.css";

export function ShopDetailActions({ model, rel, position, fixed = false }: {
  model: ShopDetailViewModel;
  rel: string;
  position: "hero" | "body" | "fixed";
  fixed?: boolean;
}) {
  if (model.actions.length === 0) return null;
  const actions = fixed
    ? [...model.actions.filter((action) => action.kind !== "official"), ...model.actions.filter((action) => action.kind === "official")].slice(0, 2)
    : model.actions;
  return (
    <div className={fixed ? styles.fixedActions : styles.actions} aria-label="予約・公式情報">
      {actions.map((action) => (
        <a
          key={`${position}-${action.kind}`}
          href={action.href}
          target={action.external ? "_blank" : undefined}
          rel={action.external ? rel : undefined}
          className={action.kind === "official" ? styles.secondaryAction : styles.primaryAction}
          data-shop-cta-kind={action.kind}
          data-shop-cta-position={position}
          data-shop-slug={model.slug}
        >{action.label}</a>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 4:3画像を実装する**

Create `headless/components/shop-detail/ShopDetailGallery.tsx`:

```tsx
"use client";

import type { SyntheticEvent } from "react";
import { DEFAULT_SHOP_IMAGE } from "@/lib/design-constants";
import type { ShopDetailViewModel } from "@/lib/shop-detail-view-model";
import styles from "./ShopDetail.module.css";

export function ShopDetailGallery({ model }: { model: ShopDetailViewModel }) {
  function replaceBrokenImage(event: SyntheticEvent<HTMLImageElement>) {
    const image = event.currentTarget;
    image.onerror = null;
    image.src = DEFAULT_SHOP_IMAGE;
  }
  return (
    <figure className={styles.gallery}>
      <div className={styles.mainImage}>
        <img src={model.images[0].url} alt={model.images[0].alt} width={960} height={720} loading="eager" fetchPriority="high" decoding="async" onError={replaceBrokenImage} />
      </div>
      {model.images.length > 1 ? <div className={styles.thumbnails}>{model.images.slice(1).map((image) => <div className={styles.thumbnail} key={image.url}><img src={image.url} alt={image.alt} width={240} height={180} loading="lazy" decoding="async" onError={replaceBrokenImage} /></div>)}</div> : null}
      <figcaption>{model.images[0].isFallback ? "店舗画像は準備中です。" : "店舗掲載画像"}</figcaption>
    </figure>
  );
}
```

- [ ] **Step 5: 店舗責任者導線を実装する**

Create `headless/components/shop-detail/ShopOwnerCta.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { buildShopOwnerRequestUrl } from "@/lib/shop-owner-request-links";
import type { ShopView } from "@/lib/wp/types";
import styles from "./ShopDetail.module.css";

export function ShopOwnerCta({ shop }: { shop: Pick<ShopView, "id" | "slug" | "title"> }) {
  const href = buildShopOwnerRequestUrl(shop);
  return (
    <section className={styles.ownerCta} aria-labelledby="shop-owner-heading">
      <div><p className={styles.kicker}>FOR SHOP OWNER</p><h2 id="shop-owner-heading">このページを、公式情報で完成させませんか？</h2><p>写真URL・料金・設備・店舗紹介・予約先を登録・修正できます。申請内容は確認前に公開されません。</p></div>
      <Link href={href} data-shop-cta-kind="owner" data-shop-cta-position="owner-band" data-shop-slug={shop.slug}>掲載情報を登録・修正する</Link>
    </section>
  );
}
```

- [ ] **Step 6: component契約を成功させる**

Run:

```bash
cd headless
npm run test:final-design-preservation
npm run typecheck
```

Expected: component assertions PASS、type error 0。CSS Module不在の型エラーはTask 4まで一時的に発生するため、先に空でないCSS ModuleをTask 4の冒頭内容で作成してからtypecheckする。

### Task 3: 料金・紹介・基本情報・口コミの編集型section

**Files:**
- Create: `headless/components/shop-detail/ShopDetailSections.tsx`

**Interfaces:**
- Consumes: `ShopDetailViewModel`、承認済み口コミ、口コミ投稿URL、PR rel
- Produces: 空セクションのない本文

- [ ] **Step 1: 空セクション禁止の失敗する検査を追加する**

Extend `headless/scripts/check-final-design-preservation.mjs`:

```js
const detailSections = read("components/shop-detail/ShopDetailSections.tsx");
assert.ok(detailSections.includes("model.prices.length > 0"));
assert.ok(detailSections.includes("model.infoRows.length > 0"));
assert.ok(detailSections.includes("reviews.length > 0"));
assert.ok(!detailSections.includes("0名"));
assert.ok(!detailSections.includes("不定休"));
assert.ok(!detailSections.includes("駐車場なし"));
assert.ok(detailSections.includes("掲載情報コメント、店舗紹介文、出自を確認できない文章は口コミとして表示しません"));
```

- [ ] **Step 2: 検査がcomponent不在で失敗することを確認する**

Run:

```bash
cd headless
npm run test:final-design-preservation
```

Expected: FAIL with missing `ShopDetailSections.tsx`.

- [ ] **Step 3: section componentを実装する**

Create `headless/components/shop-detail/ShopDetailSections.tsx`:

```tsx
import Link from "next/link";
import { formatPriceForDisplay } from "@/lib/price-normalization";
import type { ShopDetailViewModel } from "@/lib/shop-detail-view-model";
import styles from "./ShopDetail.module.css";

type ReviewItem = { id?: string | number; body: string; authorName?: string | null; submittedAt?: string | null };

function SectionHeading({ en, children }: { en: string; children: ReactNode }) {
  return <div className={styles.sectionHeading}><p className={styles.kicker}>{en}</p><h2>{children}</h2></div>;
}

export function ShopDetailSections({ model, reviews, reviewSubmitUrl, rel }: {
  model: ShopDetailViewModel;
  reviews: ReviewItem[];
  reviewSubmitUrl: string;
  rel: string;
}) {
  const hasDescription = Boolean(model.catchText || model.introductionHtml || model.recommendText || model.summaryText);
  return (
    <div className={styles.sections}>
      {model.prices.length > 0 ? <section id="shop-price" className={styles.section}><SectionHeading en="PRICE">料金プラン</SectionHeading><table className={styles.table}><tbody>{model.prices.map(({ key, label, price }) => <tr key={key}><th>{label}</th><td>{formatPriceForDisplay(price)}</td></tr>)}</tbody></table></section> : null}
      {hasDescription ? <section className={styles.section}><SectionHeading en="ABOUT">この店舗について</SectionHeading>{model.catchText ? <p className={styles.catch}>{model.catchText}</p> : null}{model.introductionHtml ? <div className={styles.richText} dangerouslySetInnerHTML={{ __html: model.introductionHtml }} /> : null}{model.recommendText ? <p>{model.recommendText}</p> : null}{model.summaryText ? <div className={styles.sourceSeparated}><strong>掲載情報コメント</strong><p>{model.summaryText}</p><small>公開情報をもとに整理した文章で、ユーザー口コミではありません。</small></div> : null}</section> : null}
      {model.featureNames.length > 0 ? <section className={styles.section}><SectionHeading en="FEATURES">特徴・設備</SectionHeading><ul className={styles.features}>{model.featureNames.map((name) => <li key={name}>{name}</li>)}</ul></section> : null}
      {model.infoRows.length > 0 ? <section id="shop-data" className={styles.section}><SectionHeading en="ACCESS & INFO">アクセス・基本情報</SectionHeading><table className={styles.infoTable}><tbody>{model.infoRows.map((row) => <tr key={row.key}><th>{row.label}</th><td>{row.href ? <a href={row.href} target="_blank" rel={rel} data-shop-cta-kind={row.key === "official" ? "official" : undefined} data-shop-cta-position={row.key === "official" ? "info" : undefined} data-shop-slug={row.key === "official" ? model.slug : undefined}>{row.value}</a> : row.value}</td></tr>)}</tbody></table>{model.verifiedAt ? <p className={styles.sourceNote}>掲載情報の確認日 {model.verifiedAt}</p> : null}</section> : null}
      <section id="shop-reviews" className={styles.section}><SectionHeading en="USER REVIEWS">ユーザー口コミ</SectionHeading>{reviews.length > 0 ? <div className={styles.reviews}>{reviews.map((review, index) => <article key={review.id ?? index}><p>{review.body}</p><small>{review.authorName ?? "匿名"}{review.submittedAt ? ` / ${review.submittedAt}` : ""}</small></article>)}</div> : <p>この店舗の承認済みユーザー口コミはまだありません。</p>}<p className={styles.sourceNote}>掲載情報コメント、店舗紹介文、出自を確認できない文章は口コミとして表示しません。</p><Link href={reviewSubmitUrl} className={styles.textLink}>この店舗の口コミを投稿する</Link></section>
    </div>
  );
}
```

- [ ] **Step 4: component契約と型を成功させる**

Run:

```bash
cd headless
npm run test:final-design-preservation
npm run typecheck
```

Expected: assertions PASS、type error 0。

### Task 4: C案専用CSS Module

**Files:**
- Create: `headless/components/shop-detail/ShopDetail.module.css`
- Create: `headless/scripts/check-shop-detail-responsive-contract.mjs`

**Interfaces:**
- Consumes: Tasks 2–3のclass名
- Produces: 最大1360px、4:3、スマホ16px、固定CTA、フラットな編集デザイン

- [ ] **Step 1: レスポンシブ契約の失敗する検査を書く**

Create `headless/scripts/check-shop-detail-responsive-contract.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("components/shop-detail/ShopDetail.module.css", "utf8");
assert.match(css, /max-width:\s*1360px/);
assert.match(css, /aspect-ratio:\s*4\s*\/\s*3/);
assert.match(css, /object-fit:\s*cover/);
assert.match(css, /padding-inline:\s*16px/);
assert.match(css, /min-height:\s*44px/);
assert.match(css, /grid-template-columns:\s*repeat\(var\(--fact-count\),\s*minmax\(0,\s*1fr\)\)/);
assert.match(css, /@media\s*\(max-width:\s*760px\)/);
assert.doesNotMatch(css, /\.mainImage\s+img[^}]*min-height/s);
assert.doesNotMatch(css, /\.thumbnail\s+img[^}]*min-height/s);
console.log("shop detail responsive contract passed");
```

- [ ] **Step 2: 検査がCSS不在または契約不足で失敗することを確認する**

Run:

```bash
cd headless
node scripts/check-shop-detail-responsive-contract.mjs
```

Expected: FAIL with missing CSS or first unmet assertion.

- [ ] **Step 3: desktopと共通CSSを実装する**

Create `headless/components/shop-detail/ShopDetail.module.css`:

```css
.page { --ink:#14211d; --sub:#66726e; --line:#d8dedb; --green:#17372e; --gold:#a4874c; width:100%; color:var(--ink); }
.shell { width:100%; max-width:1360px; margin-inline:auto; padding-inline:32px; }
.hero { padding:24px 0 0; }
.titleRow { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:32px; align-items:end; padding-bottom:28px; }
.kicker { margin:0 0 8px; color:var(--gold); font-size:.7rem; font-weight:800; letter-spacing:.17em; }
.title { margin:0; font:500 clamp(2.15rem,4vw,3.9rem)/1.12 Georgia,"Yu Mincho",serif; letter-spacing:-.035em; }
.verified,.sourceNote { margin:10px 0 0; color:var(--sub); font-size:.75rem; }
.facts { display:grid; grid-template-columns:repeat(var(--fact-count),minmax(0,1fr)); margin:0; border-top:1px solid var(--ink); border-bottom:1px solid var(--ink); }
.facts>div { min-width:0; padding:20px 24px; border-right:1px solid var(--line); }
.facts>div:first-child { padding-left:0; }.facts>div:last-child { border-right:0; }
.facts dt { color:var(--sub); font-size:.68rem; letter-spacing:.08em; }.facts dd { margin:7px 0 0; font:500 clamp(1rem,1.8vw,1.45rem)/1.35 Georgia,"Yu Mincho",serif; overflow-wrap:anywhere; }
.actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; }
.primaryAction,.secondaryAction,.ownerCta>a { min-height:50px; display:inline-grid; place-items:center; padding:0 22px; border:1px solid var(--green); font-size:.78rem; font-weight:800; text-decoration:none; }
.primaryAction { color:#fff; background:var(--green); }.secondaryAction { color:var(--green); background:#fff; }
.visual { display:grid; grid-template-columns:minmax(0,1.42fr) minmax(300px,.58fr); gap:42px; padding:42px 0 50px; border-bottom:1px solid var(--line); }
.gallery { margin:0; }.mainImage,.thumbnail { aspect-ratio:4/3; overflow:hidden; background:#e5e7e4; }.mainImage img,.thumbnail img { width:100%; height:100%; display:block; object-fit:cover; }.thumbnails { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:8px; }.gallery figcaption { margin-top:8px; color:var(--sub); font-size:.68rem; }
.visualAside { align-self:center; }.quickLinks { display:grid; border-top:1px solid var(--line); }.quickLinks a { min-height:44px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--line); color:var(--ink); font-size:.78rem; text-decoration:none; }.quickLinks a::after { content:"→"; color:var(--gold); }
.sections { display:grid; }.section { display:grid; grid-template-columns:290px minmax(0,1fr); gap:48px; padding:58px 0; border-bottom:1px solid var(--line); }.sectionHeading h2 { margin:0; font:500 1.8rem/1.3 Georgia,"Yu Mincho",serif; }.table,.infoTable { width:100%; border-collapse:collapse; }.table th,.table td,.infoTable th,.infoTable td { padding:17px 8px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }.table th,.infoTable th { width:34%; color:var(--sub); font-size:.72rem; font-weight:500; }.table td { color:var(--green); font:600 1.1rem Georgia,serif; text-align:right; }.richText,.section p { color:#4f5c57; }.catch { font-weight:700; }.features { display:grid; grid-template-columns:1fr 1fr; margin:0; padding:0; border-top:1px solid var(--line); list-style:none; }.features li { padding:16px 4px; border-bottom:1px solid var(--line); }.features li:nth-child(odd) { border-right:1px solid var(--line); }.features li:nth-child(even) { padding-left:24px; }.sourceSeparated { margin-top:24px; padding:18px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }.sourceSeparated small { color:var(--sub); }.reviews article { padding:18px 0; border-bottom:1px solid var(--line); }.reviews article p { margin:0 0 6px; }.reviews article small { color:var(--sub); }.textLink { min-height:44px; display:inline-flex; align-items:center; color:var(--green); font-weight:700; }
.ownerCta { display:grid; grid-template-columns:1.4fr .6fr; gap:40px; align-items:center; margin:58px 0 80px; padding:40px 48px; color:#fff; background:var(--green); }.ownerCta h2 { margin:0 0 10px; font:500 1.8rem Georgia,"Yu Mincho",serif; }.ownerCta p { color:#d7e0dc; }.ownerCta>a { color:var(--green); border-color:#fff; background:#fff; text-align:center; }
.fixedActions { display:none; }
```

- [ ] **Step 4: tabletとスマホCSSを実装する**

Append:

```css
@media (max-width:900px) {
  .titleRow,.visual,.section,.ownerCta { grid-template-columns:1fr; }
  .actions { justify-content:flex-start; }
  .section { gap:22px; }.ownerCta { gap:20px; padding:32px 24px; }
}
@media (max-width:760px) {
  .shell { padding-inline:16px; padding-bottom:78px; }
  .titleRow { gap:18px; padding-bottom:22px; }
  .title { font-size:clamp(2rem,10vw,2.7rem); overflow-wrap:anywhere; }
  .actions { display:grid; grid-template-columns:1fr 1fr; width:100%; }.actions a { padding-inline:10px; }
  .facts { grid-template-columns:repeat(2,minmax(0,1fr))!important; }.facts>div,.facts>div:first-child { padding:14px 12px; border-bottom:1px solid var(--line); }.facts>div:nth-child(2n) { border-right:0; }
  .visual { gap:24px; padding:24px 0 34px; }.thumbnails { grid-template-columns:repeat(3,minmax(0,1fr)); }
  .section { padding:38px 0; }.features { grid-template-columns:1fr; }.features li:nth-child(odd),.features li:nth-child(even) { padding:15px 0; border-right:0; }
  .table th,.infoTable th { width:42%; }.ownerCta { margin:38px 0 50px; }
  .fixedActions { position:fixed; z-index:50; left:0; right:0; bottom:0; min-height:64px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; padding:7px 16px calc(7px + env(safe-area-inset-bottom)); border-top:1px solid var(--line); background:rgba(255,255,255,.97); }.fixedActions a { min-height:50px; padding-inline:8px; }
}
@media (max-width:360px) {
  .actions { grid-template-columns:1fr; }.facts { grid-template-columns:1fr!important; }.facts>div { border-right:0; }
}
```

- [ ] **Step 5: CSS契約を成功させる**

Run:

```bash
cd headless
node scripts/check-shop-detail-responsive-contract.mjs
npm run typecheck
```

Expected: contract PASS、type error 0。

### Task 5: ShopDetailをC案へ組み替える

**Files:**
- Modify: `headless/components/ShopDetail.tsx`
- Modify: `headless/scripts/check-final-design-preservation.mjs`
- Modify: `headless/scripts/check-internal-link-map.mjs`
- Modify: `headless/scripts/check-schema-output-conditions.mjs`
- Modify: `headless/scripts/check-content-provenance.mjs`

**Interfaces:**
- Consumes: Tasks 1–4、既存 `shopLocalBusinessJsonLd`、地域リンク、口コミ抽出
- Produces: 全店舗共通のC案ページ

- [ ] **Step 1: 旧class依存を新契約へ変更して失敗させる**

In `check-final-design-preservation.mjs`, replace old shop detail assertions with:

```js
const shopDetail = read("components/ShopDetail.tsx");
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
```

Update internal-link, schema, and provenance checks to read both `ShopDetail.tsx` and `components/shop-detail/ShopDetailSections.tsx`, so moved markup remains covered instead of deleting the requirement.

- [ ] **Step 2: 検査が旧実装で失敗することを確認する**

Run:

```bash
cd headless
npm run test:final-design-preservation
npm run test:internal-links
npm run test:schema-output
npm run test:content-provenance
```

Expected: first command FAIL because new C案 components are not yet composed; remaining failures are recorded before implementation.

- [ ] **Step 3: ShopDetailのimportsとデータ組み立てを置換する**

Keep JSON-LD, area resolution, review extraction, `ShopAreaHubLinks`, and `AreaQuickLinks`. Replace visual imports and component body with these exact boundaries:

```tsx
import { ShopDetailActions } from "@/components/shop-detail/ShopDetailActions";
import { ShopDetailGallery } from "@/components/shop-detail/ShopDetailGallery";
import { ShopDetailHero } from "@/components/shop-detail/ShopDetailHero";
import { ShopDetailSections } from "@/components/shop-detail/ShopDetailSections";
import { ShopOwnerCta } from "@/components/shop-detail/ShopOwnerCta";
import styles from "@/components/shop-detail/ShopDetail.module.css";
import { buildShopDetailViewModel } from "@/lib/shop-detail-view-model";
```

After resolving `areaName`, build:

```ts
const model = buildShopDetailViewModel(shop, areaName);
const officialRel = outboundRelForPromotion(shop.ranking.promotion);
const userReviews = extractShopUserReviewItems(shop);
const reviewSubmitUrl = buildReviewSubmitUrl(shop.slug);
```

- [ ] **Step 4: C案のページ順序を実装する**

Use this composition inside the existing `<main>` and keep JSON-LD before visible content:

```tsx
<main id="main_content" className={`l-mainContent hl-shop-page ${styles.page}`}>
  <div className={styles.shell}>
    <nav className="shop-breadcrumb area-breadcrumb" aria-label="パンくず">
      <Link href="/">ホーム</Link> &gt; <Link href="/shops/">店舗情報</Link> &gt; {areaPath ? <><Link href={areaPath}>{areaName}</Link> &gt; </> : null}<span>{shop.title}</span>
    </nav>
    <article>
      <ShopDetailHero model={model} rel={officialRel} />
      <section className={styles.visual} aria-label="店舗画像とページ内メニュー">
        <ShopDetailGallery model={model} />
        <aside className={styles.visualAside}>
          <p className={styles.kicker}>AT A GLANCE</p>
          <h2>先に知りたい情報を、迷わず確認。</h2>
          <nav className={styles.quickLinks} aria-label="店舗詳細内メニュー">
            {model.prices.length > 0 ? <a href="#shop-price">料金プラン</a> : null}
            {model.infoRows.length > 0 ? <a href="#shop-data">アクセス・基本情報</a> : null}
            <a href="#shop-reviews">ユーザー口コミ</a>
            {areaPath ? <><Link href={`${areaPath}#ranking`}>同エリアランキング</Link><Link href={`${areaPath}#price-table`}>同エリア料金比較</Link></> : null}
          </nav>
          <ShopDetailActions model={model} rel={officialRel} position="body" />
        </aside>
      </section>
      <ShopDetailSections model={model} reviews={userReviews} reviewSubmitUrl={reviewSubmitUrl} rel={officialRel} />
      <ShopOwnerCta shop={shop} />
      {shopAreaForHub ? <ShopAreaHubLinks area={shopAreaForHub} parentArea={parentArea} /> : null}
      <AreaQuickLinks areas={allAreas} current={areaSlugForNav} title="エリアから探す" className="u-mt-50" />
    </article>
  </div>
  <ShopDetailActions model={model} rel={officialRel} position="fixed" fixed />
</main>
```

- [ ] **Step 5: 旧表示と競合CSSを削除する**

Remove from `ShopDetail.tsx`:

- Static `OPEN` badge.
- `ages` and 0-count graph.
- `areaAvg60 ?? 12000` and average comparison graph.
- Default `不定休`, `完全予約制`, `なし` rows.
- Old `ShopContactCtaPanel` and `ShopContactFixedBar` usage.
- Duplicate hero/visual/trust rail markup.

Remove only the two labeled legacy shop-detail CSS blocks from `headless/app/globals.css` after confirming no other component uses those class names:

```text
Q-DESIGN final shop detail pages
escomi-final-shop-visual-deck / escomi-final-shop-header / escomi-final-shop-intro related rules
```

Keep shared header, footer, area pages, forms, review, and general table rules.

- [ ] **Step 6: 全店舗詳細の回帰検査を成功させる**

Run:

```bash
cd headless
npm run test:price-normalization
npm run test:content-provenance
npm run test:schema-output
npm run test:internal-links
npm run test:final-design-preservation
npm run typecheck
npm run lint
```

Expected: all PASS、type/lint error 0。

### Task 6: 予約・公式・責任者クリックを一度だけ計測する

**Files:**
- Modify: `headless/components/GoogleAnalytics.tsx`
- Create: `headless/scripts/check-shop-detail-click-tracking.mjs`

**Interfaces:**
- Consumes: `data-shop-cta-kind`、`data-shop-cta-position`、`data-shop-slug`
- Produces: `shop_reservation_click`、`official_site_click`、`shop_owner_request_click`

- [ ] **Step 1: イベント分類の失敗する検査を書く**

Create `headless/scripts/check-shop-detail-click-tracking.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("components/GoogleAnalytics.tsx", "utf8");
for (const value of ["data-shop-cta-kind", "data-shop-cta-position", "data-shop-slug"]) {
  assert.ok(source.includes(value));
}
for (const event of ["shop_reservation_click", "official_site_click", "shop_owner_request_click"]) {
  assert.ok(source.includes(event));
}
assert.ok(source.includes("if (ctaKind)"));
assert.ok(source.includes("return;"), "shop CTA branch must return before generic outbound branch");
assert.ok(!source.includes("requesterEmail"));
console.log("shop detail click tracking check passed");
```

- [ ] **Step 2: 検査が旧分類で失敗することを確認する**

Run:

```bash
cd headless
node scripts/check-shop-detail-click-tracking.mjs
```

Expected: FAIL because data attributes are not classified.

- [ ] **Step 3: CTA専用分岐をgeneric outboundより前に実装する**

Inside `onClick`, after resolving `anchor` and `href`, add:

```ts
  const ctaKind = anchor.getAttribute("data-shop-cta-kind") || "";
  if (ctaKind) {
    const pathShopSlug = pathname.match(/^\/shops\/([^/]+)\/?$/)?.[1] || "";
    const shopSlug = anchor.getAttribute("data-shop-slug") || pathShopSlug;
  const ctaPosition = anchor.getAttribute("data-shop-cta-position") || "unknown";
  const eventName = ctaKind === "official"
    ? "official_site_click"
    : ctaKind === "owner"
      ? "shop_owner_request_click"
      : "shop_reservation_click";
  gaEvent(eventName, {
    shop_slug: shopSlug,
    cta_kind: ctaKind,
    cta_position: ctaPosition,
    link_url: href,
    page_path: pathname
  });
  return;
}
```

Do not include link text for owner submissions if it could later include user-entered content. Keep the existing generic contact and outbound classification for anchors without shop CTA data.

- [ ] **Step 4: 検査を成功させる**

Run:

```bash
cd headless
node scripts/check-shop-detail-click-tracking.mjs
npm run typecheck
npm run lint
```

Expected: tracking check PASS、type/lint error 0。

### Task 7: PC・スマホ実画面QAと95%停止

**Files:**
- Modify: `progress.md`
- Modify: `pm/PROGRESS.md`
- Modify: `task_plan.md`

**Interfaces:**
- Consumes: Tasks 1–6、owner request flow plan
- Produces: ローカル検証済み店舗詳細、push前の95%状態

- [ ] **Step 1: 全自動検査を実行する**

Run:

```bash
cd headless
node scripts/check-shop-detail-view-model.mjs
node scripts/check-shop-detail-responsive-contract.mjs
node scripts/check-shop-detail-click-tracking.mjs
node scripts/check-shop-owner-request-schema.mjs
node scripts/check-shop-owner-request-api.mjs
node scripts/check-shop-owner-request-form.mjs
npm test
npm run lint
npm run typecheck
npm run build
cd ..
git diff --check
```

Expected: every command exit 0、production build完了。

- [ ] **Step 2: 代表3店舗を選ぶ**

Use WordPress data to identify:

1. 画像・料金・公式URLがある店舗。
2. 画像がない店舗。
3. 料金または営業時間がない店舗。

Record shop slug and the missing/present conditions. Do not alter their data.

- [ ] **Step 3: PC表示を確認する**

Start `npm run dev` and inspect each representative shop at 1440×1000、1280×900、1024×768.

Expected for every width:

- content width never exceeds 1360px and has even outer margins.
- main image remains 4:3; no 420×315 image becomes a tall portrait.
- title, facts, CTA, image, tables do not overlap.
- no horizontal scrolling.
- only existing data rows and links are present.

- [ ] **Step 4: スマホ表示を確認する**

Inspect the same shops at 390×844、375×812、320×568.

Expected:

- page gutter is 16px at 390/375 and remains usable at 320.
- no horizontal scroll.
- facts use 2 columns, falling to 1 column at 320 when necessary.
- fixed CTA does not hide the final content because shell has bottom padding.
- every tap target is at least 44px.
- table rows reflow without clipped text.

- [ ] **Step 5: 予約・公式・責任者導線を確認する**

With GA disabled or debug mode, click each visible CTA and inspect event calls.

Expected:

- reservation/phone/LINE → `shop_reservation_click` once.
- official → `official_site_click` once.
- owner → `shop_owner_request_click` once and opens prefilled `/storelisting/`.
- no generic `outbound_click` duplicate for the same shop CTA.

- [ ] **Step 6: QAセルフレビューを行う**

Review exact changed files for:

- untrusted HTML beyond existing WordPress-rendered fields.
- invalid `target="_blank"` without promotion-aware `rel`.
- hidden empty headings or anchors.
- CSS selectors leaking outside the module.
- mobile fixed bar covering content.
- GA events containing PII.
- WordPress/Supabase public source boundary violations.

Fix any finding with a failing regression check first, then rerun Step 1.

- [ ] **Step 7: 進行文書を更新する**

Record:

```text
- 店舗詳細C案を全店舗共通でローカル実装した。
- PC 1440/1280/1024、スマホ390/375/320で代表3店舗を確認した。
- 仮値、静的OPEN、0名、画像縦伸ばしを除去した。
- 予約、公式、店舗責任者クリックを区別した。
- WordPressを公開データ元として維持した。
- 本番Supabase、push、deployは未実施。
- 完成品質95%で停止し、本番確認後を100%とする。
```

- [ ] **Step 8: push前で停止する**

Run:

```bash
git status --short
git diff --stat
git diff --check
```

Expected: 変更内容と既存Phase 4差分を区別して報告できる。`git push`、Vercel deploy、本番Supabase操作は実行しない。
