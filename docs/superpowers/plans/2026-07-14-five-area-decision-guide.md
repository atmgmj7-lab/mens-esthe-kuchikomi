# 重点5地域 SEO・視認性改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重点5地域のエリアHubを全幅画像ヘッダーへ直し、その直下に安全な事実だけを使う4要点カードと地域固有本文を追加する。

**Architecture:** 全幅背景と本文幅の内枠を`AreaHubPageTemplate`で分離する。地域固有文は`area-hub-config.ts`、動的な料金・深夜・口コミ件数は新しい`AreaHubDecisionGuide`へ集約し、既存の安全化関数を再利用する。

**Tech Stack:** Next.js 16、React 19、TypeScript、CSS、Node.js契約検査

## Global Constraints

- 公開データの正本はWordPressのまま維持する。
- Supabase公開参照先切替、WordPress停止、URL変更を行わない。
- 対象は`sakaisujihonmachi`、`sakai`、`nihonbashi`、`shinosaka`、`umeda`の5地域だけとする。
- 料金0円、未確認の深夜営業、未承認口コミ件数・評価値を表示しない。
- デスクトップは4列、スマートフォンは2列2段とする。
- title、description、canonical、robots、schema、sitemapを変更しない。
- push・本番デプロイは明示確認まで行わない。

---

### Task 1: 重点5地域の表示契約をテストで固定する

**Files:**
- Create: `headless/scripts/check-five-area-decision-guide.mjs`
- Modify: `headless/package.json`
- Test: `headless/scripts/check-five-area-decision-guide.mjs`

**Interfaces:**
- Consumes: `AreaHubPageTemplate.tsx`、`area-hub-config.ts`、`AreaHubDecisionGuide.tsx`、`globals.css`のソース
- Produces: `npm run test:five-area-decision-guide`と`npm test`へ接続された回帰検査

- [x] **Step 1: 失敗する契約検査を書く**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");
const config = read("lib/area-hub-config.ts");
const template = read("components/area/AreaHubPageTemplate.tsx");
const component = read("components/area/hub/AreaHubDecisionGuide.tsx");
const css = read("app/globals.css");

for (const slug of ["sakaisujihonmachi", "sakai", "nihonbashi", "shinosaka", "umeda"]) {
  assert.match(config, new RegExp(`${slug}:[\\s\\S]*?decisionGuide:`));
}
for (const href of ["#shop-list", "#price-table", "#late-night", "#reviews"]) {
  assert.ok(component.includes(`href: "${href}"`));
}
assert.ok(template.includes("escomi-final-area-hero__inner"));
assert.ok(template.includes("AreaHubDecisionGuide"));
assert.ok(!template.includes("NEXT CHECK"));
assert.ok(!template.includes("SECTION_NAV_CHIPS"));
assert.match(css, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
assert.match(css, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
assert.match(css, /\.escomi-final-area-hero\.escomi-final-area-hero--photo[\s\S]*?border-radius:\s*0/);
```

- [x] **Step 2: REDを確認する**

Run: `cd headless && node scripts/check-five-area-decision-guide.mjs`

Expected: `ENOENT`で`AreaHubDecisionGuide.tsx`が存在しないため終了コード1。

- [x] **Step 3: package.jsonへ検査を接続する**

```json
"test:five-area-decision-guide": "node scripts/check-five-area-decision-guide.mjs"
```

既存`test`の最後へ`&& npm run test:five-area-decision-guide`を追加する。

- [x] **Step 4: テスト追加だけをコミットする**

```bash
git add headless/scripts/check-five-area-decision-guide.mjs headless/package.json
git commit -m "test: guard five area decision guide"
```

### Task 2: 固有本文と安全な4要点カードを実装する

**Files:**
- Modify: `headless/lib/area-hub-config.ts`
- Create: `headless/components/area/hub/AreaHubDecisionGuide.tsx`
- Test: `headless/scripts/check-five-area-decision-guide.mjs`

**Interfaces:**
- Consumes: `AreaHubContext`、`ShopView[]`、`hasPublishedPrice`、`isLateNightShop`、`aggregateReviewCountLabel`
- Produces: `decisionGuide?: { selectionTitle: string; intro: string }`と`AreaHubDecisionGuide({ hubContext, shops })`

- [x] **Step 1: 地域固有設定型を追加する**

```ts
export type AreaHubDecisionGuideConfig = {
  selectionTitle: string;
  intro: string;
};
```

`AreaHubSeoConfig`の`shopLinks: AreaHubShopLinks;`直後へ`decisionGuide?: AreaHubDecisionGuideConfig;`を追加する。

- [x] **Step 2: 重点5地域へ承認済み本文を追加する**

各地域の`seo`へ仕様書記載の`selectionTitle`と`intro`を完全一致で追加する。`nanba`には追加しない。

- [x] **Step 3: 4カードの表示データを実装する**

```tsx
const pricedCount = shops.filter(hasPublishedPrice).length;
const lateNightCount = shops.filter(isLateNightShop).length;
const reviewLabel = aggregateReviewCountLabel(shops);

const cards = [
  { key: "choice", title: "選び方", value: guide.selectionTitle, href: "#shop-list" },
  { key: "price", title: "料金", value: pricedCount > 0 ? `料金掲載 ${pricedCount}店舗` : "料金情報を確認中", href: "#price-table" },
  { key: "late-night", title: "深夜", value: lateNightCount > 0 ? `深夜候補 ${lateNightCount}店舗` : "営業時間から確認", href: "#late-night" },
  { key: "reviews", title: "口コミ", value: reviewLabel, href: "#reviews" }
] as const;
```

各カードには推測ではないことが分かる補足文と「一覧を見る」「料金を比べる」「営業時間を見る」「口コミを見る」のCTAを付ける。星評価、価格金額、未確認件数は出さない。

- [x] **Step 4: GREENを確認する**

Run: `cd headless && npm run test:five-area-decision-guide`

Expected: テンプレートとCSSが未実装なので、`AreaHubDecisionGuide`または全幅・グリッド契約で終了コード1。

- [x] **Step 5: 固有本文とカードをコミットする**

```bash
git add headless/lib/area-hub-config.ts headless/components/area/hub/AreaHubDecisionGuide.tsx
git commit -m "feat: add five area decision guide content"
```

### Task 3: 全幅ヘッダーと重複導線統合を実装する

**Files:**
- Modify: `headless/components/area/AreaHubPageTemplate.tsx`
- Modify: `headless/app/globals.css`
- Test: `headless/scripts/check-five-area-decision-guide.mjs`
- Test: `headless/scripts/check-internal-link-map.mjs`
- Test: `headless/scripts/check-final-design-preservation.mjs`

**Interfaces:**
- Consumes: `AreaHubDecisionGuide`
- Produces: 全幅`.escomi-final-area-hero--photo`、本文幅`.escomi-final-area-hero__inner`、4列・2列`.area-decision-guide__grid`

- [x] **Step 1: テンプレートの幅制限を分離する**

パンくず用本文枠、幅制限のないhero、hero内本文枠、hero後本文枠の順にDOMを分ける。

```tsx
<div className="l-main_content__inner hl-page-inner escomi-final-area-shell escomi-final-area-breadcrumb-shell">
  <nav className="area-hub-breadcrumb" aria-label="パンくず">
    <Link href="/">ホーム</Link>
    <span aria-hidden="true"> &gt; </span>
    {hubContext.parentSlug && hubContext.parentName ? (
      <>
        <Link href={`/area/${hubContext.parentSlug}/`}>{hubContext.parentName}</Link>
        <span aria-hidden="true"> &gt; </span>
      </>
    ) : null}
    <span>{hubContext.breadcrumbLabel}</span>
  </nav>
</div>
<section
  className="escomi-final-area-hero escomi-final-area-hero--photo hl-fade-in"
  aria-labelledby="area-final-title"
  aria-label={heroVisual.imageAlt}
  style={heroStyle}
>
  <div className="escomi-final-area-hero__inner escomi-final-area-shell">
    <header className="area-hub-header escomi-final-area-hero__body">
      <p className="escomi-final-area-hero__eyebrow">AREA GUIDE</p>
      <h1 id="area-final-title" className="area-hub-hero__title">{hubContext.hubTitle}</h1>
      <p className="area-hub-hero__lead">{hubContext.hubDescription}</p>
      <dl className="area-hub-hero__stats escomi-final-area-hero__stats">
        <div><dt>掲載店舗数</dt><dd>{shopCountLabel}</dd></div>
        <div><dt>確認済み口コミ</dt><dd>{reviewCountLabel}</dd></div>
        <div><dt>最終更新日</dt><dd>{lastUpdated}</dd></div>
        <div><dt>対応エリア</dt><dd>{hubContext.coverageLabel}</dd></div>
      </dl>
      <p className="escomi-final-area-hero__source-note">
        口コミ・編集部コメント・PR情報は分けて掲載しています。料金や営業時間は予約前に公式情報で確認してください。
      </p>
    </header>
  </div>
</section>
<div className="l-main_content__inner hl-page-inner escomi-final-area-shell escomi-final-area-content-shell">
  <AreaHubDecisionGuide hubContext={hubContext} shops={allShops} />
  <AreaHubLocalGuideSection hubContext={hubContext} />
  <AreaHubRankingTop rankingShops={allShops} targetArea={area} hubContext={hubContext} rankingEntries={rankingEntries} />
</div>
```

- [x] **Step 2: 重複ナビを削除する**

`SECTION_NAV_CHIPS`、`PAGE_ANCHOR_LINKS`、hero内チップ、`area-hub-anchor-nav`、`escomi-s40-area-link-map`を削除する。各コンテンツ本体と既存アンカーIDは残す。

- [x] **Step 3: 全幅とカードグリッドをスタイルする**

```css
.escomi-final-area-hero.escomi-final-area-hero--photo {
  border: 0;
  border-radius: 0;
  margin-inline: 0;
  padding: 0;
  width: 100%;
}

.escomi-final-area-hero__inner {
  margin-inline: auto;
  min-height: inherit;
  padding-inline: var(--hl-gutter);
  width: 100%;
}

.area-decision-guide__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

@media (max-width: 767px) {
  .area-decision-guide__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

カードは既存のクリーム、ネイビー、ゴールド、ティールを使い、`:focus-visible`と`prefers-reduced-motion`を追加する。

- [x] **Step 4: GREENを確認する**

Run: `cd headless && npm run test:five-area-decision-guide`

Expected: `five area decision guide checks passed`、終了コード0。

- [x] **Step 5: 関連回帰検査を確認する**

Run: `cd headless && npm run test:internal-links && npm run test:final-design-preservation && npm run test:s10-sakaisujihonmachi-hub`

Expected: 3検査すべて終了コード0。削除した重複ナビを前提にする既存検査があれば、新しい4カードの同一リンク契約へ更新する。

- [x] **Step 6: UI実装をコミットする**

```bash
git add headless/components/area/AreaHubPageTemplate.tsx headless/app/globals.css headless/scripts/check-internal-link-map.mjs headless/scripts/check-final-design-preservation.mjs headless/scripts/check-s10-sakaisujihonmachi-hub.mjs
git commit -m "feat: improve five area seo decision flow"
```

### Task 4: 全体検証と進行記録を完了する

**Files:**
- Modify: `pm/PROGRESS.md`
- Modify: `pm/NEXT_ACTIONS.md`
- Modify: `docs/superpowers/plans/2026-07-14-five-area-decision-guide.md`

**Interfaces:**
- Consumes: Task 1〜3の実装と検査結果
- Produces: 公開前の再現可能な検査記録と次アクション

- [x] **Step 1: 品質検査を実行する**

Run: `cd headless && npm run lint && npm run typecheck && npm test && npm run build`

Expected: lint・型・全検査・440ページbuildが終了コード0。

- [x] **Step 2: 差分安全検査を実行する**

Run: `git diff --check && git status --short && git diff --stat origin/main...HEAD`

Expected: 空白エラーなし。変更が本計画のファイルだけに限定される。

- [x] **Step 3: 進行文書へ実装内容と検査結果を記録する**

重点5地域、全幅ヘッダー、4カード、WordPress継続、Supabase未切替、push・デプロイ未実施を進行文書へ記録する。ルート直下に`progress.md`と`task_plan.md`は存在しないため、新規作成せず本計画と`pm/`の正本2文書を更新する。

- [x] **Step 4: 文書と最終差分をコミットする**

```bash
git add docs/superpowers/plans/2026-07-14-five-area-decision-guide.md pm/PROGRESS.md pm/NEXT_ACTIONS.md
git commit -m "docs: record five area seo implementation"
```

- [x] **Step 5: push・デプロイ前で停止する**

`codex/seo-visibility-cards`のコミット一覧、検査結果、未実施事項を報告し、本番公開の明示確認を待つ。
