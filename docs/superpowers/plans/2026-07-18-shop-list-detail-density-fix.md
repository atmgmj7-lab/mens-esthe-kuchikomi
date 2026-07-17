# Eskomi 一覧ランキング・店舗詳細密度 再調整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ランキング付き一覧カードの位置ずれ、店舗詳細CTAの二重表示、過大な文字・余白を解消し、WordPressの確認済み情報だけで密度の高い店舗情報画面へ整える。

**Architecture:** 共通一覧カードの順位を画像内オーバーレイへ統合し、順位有無で変わらない3列契約にする。店舗詳細は既存部品を保ちながら上部グリッドを写真と情報の2列へ再配置し、画面幅ごとに見えるCTA群を一意化する。既存の非表示Playwright QAへ幾何条件を追加して実表示を固定する。

**Tech Stack:** Next.js 16、React 19、TypeScript、CSS Modules、Node契約検査、Playwright 1.61.1

## Global Constraints

- 現行カラーを維持する。
- 公開データ元はWordPressのまま維持する。
- Supabase非公開候補を公開画面へ接続しない。
- 推測値、架空口コミ、未確認のメニュー・スタッフ・設備・空席・評価を追加しない。
- Hot Pepper固有の配色、画像、文章、アイコン、商標を複製しない。
- 既存URL、canonical、sitemap、構造化データ、クリック計測分類を維持する。
- ブラウザQAはheadlessを既定とし、`PORTAL_QA_HEADED=1`を設定しない。
- push、deploy、本番WordPress・Supabase変更は行わない。

---

### Task 1: ランキング付き共通一覧カードの列ずれ解消

**Files:**
- Modify: `headless/components/common/AreaShopCard.tsx`
- Modify: `headless/components/common/AreaShopCard.module.css`
- Modify only if centering needs correction: `headless/components/common/ShopRankCell.module.css`
- Modify: `headless/scripts/check-area-ranking-responsive-contract.mjs`
- Modify: `headless/scripts/check-area-shop-card-view-model.mjs`

**Interfaces:**
- Consumes: `AreaShopCard({ shop, targetArea, rank, showRank })` と `ShopRankCell({ rank })`
- Produces: `data-area-shop-card="true"` 内で順位が画像領域に属し、順位有無で同じ列構造を使うDOM

- [ ] **Step 1: Write the failing test**

`check-area-ranking-responsive-contract.mjs` に、順位DOMがmediaラッパー内へ入り、`rankSlot`独立列と`cardNoRank`列差分が存在しないことを確認する。期待する主要条件は次のとおり。

```js
assert.ok(areaShopCardSource.indexOf("ShopRankCell") > areaShopCardSource.indexOf(`className={styles.mediaWrap}`));
assert.ok(!areaShopCardSource.includes("styles.rankSlot"));
assert.ok(!areaShopCardSource.includes("styles.cardNoRank"));
assert.match(areaShopCardCss, /\.mediaWrap\s*\{[^}]*position:\s*relative/s);
assert.match(areaShopCardCss, /\.rankOverlay\s*\{[^}]*position:\s*absolute/s);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:area-ranking-responsive`
Expected: `rankSlot`または`cardNoRank`が残っているためFAIL。

- [ ] **Step 3: Implement the invariant layout**

`AreaShopCard`を次の骨格へ変更し、順位を画像内へ置く。

```tsx
<div className={styles.mediaWrap}>
  <Link className={styles.media} href={model.title.href} aria-label={`${model.title.text}の詳細を見る`}>
    <AreaShopCardImage {...imageProps} />
  </Link>
  {model.rank ? <ShopRankCell rank={model.rank} className={styles.rankOverlay} /> : null}
</div>
```

PCの列は `240px minmax(0, 1fr) 164px`、1280px以下は `220px minmax(0, 1fr) 164px`、1024px以下は `220px minmax(0, 1fr) 148px` とし、順位有無で変えない。900px以下は店名、画像、本文、操作の1列へ積む。

- [ ] **Step 4: Run focused tests**

Run: `npm run test:area-ranking-responsive && npm run test:area-shop-card-view-model && npm run test:area-list-route-contract`
Expected: 3検査すべてPASS。

- [ ] **Step 5: Commit**

```bash
git add headless/components/common/AreaShopCard.tsx headless/components/common/AreaShopCard.module.css headless/components/common/ShopRankCell.module.css headless/scripts/check-area-ranking-responsive-contract.mjs headless/scripts/check-area-shop-card-view-model.mjs
git commit -m "fix: stabilize ranked shop cards"
```

### Task 2: 店舗詳細上部の2列化とCTA一意化

**Files:**
- Modify: `headless/components/ShopDetail.tsx`
- Modify: `headless/components/shop-detail/ShopDetailHero.tsx`
- Modify: `headless/components/shop-detail/ShopDetail.module.css`
- Create: `headless/scripts/check-shop-detail-density-contract.mjs`
- Modify: `headless/scripts/check-shop-detail-responsive-contract.mjs`
- Modify: `headless/scripts/check-final-design-preservation.mjs`
- Modify: `headless/package.json`

**Interfaces:**
- Consumes: `ShopDetailHero({ model, rel })`、`ShopDetailGallery({ model })`、`ShopDetailActions({ position, fixed })`
- Produces: PCは上部CTA群1つ、760px以下は固定CTA群1つ、写真と情報を並べる`data-shop-profile-grid`領域

- [ ] **Step 1: Write the failing density contract**

新しい検査を`package.json`の通常`test`列へ追加し、次を確認する。

```js
assert.ok(shopDetailSource.includes('data-shop-profile-grid="true"'));
assert.ok(!shopDetailSource.includes("visualAside"));
assert.equal((shopDetailSource.match(/<ShopDetailActions/g) ?? []).length, 1);
assert.ok(heroSource.includes("<ShopDetailActions"));
assert.match(cssSource, /\.detailGrid\s*\{[^}]*grid-template-areas:[\s\S]*"visual hero"[\s\S]*"content content"/);
assert.match(cssSource, /\.title\s*\{[\s\S]*--shop-title-size:\s*34px/);
assert.match(cssSource, /@media \(max-width:\s*760px\)[\s\S]*\.hero \.actions\s*\{\s*display:\s*none/);
```

`ShopDetail.tsx`側の1件は固定CTA、`ShopDetailHero.tsx`側の1件は上部CTAとし、同じ画面幅でCSSにより片方だけ見える契約にする。

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/check-shop-detail-density-contract.mjs`
Expected: `data-shop-profile-grid`欠落、`visualAside`残存、CTA重複によりFAIL。

- [ ] **Step 3: Rebuild the top profile layout**

`ShopDetail`の上部を次の順序へ変更する。

```tsx
<article className={styles.detailGrid} data-shop-profile-grid="true">
  <section className={styles.visual} aria-label="店舗画像">
    <ShopDetailGallery model={model} />
  </section>
  <ShopDetailHero model={model} rel={officialRel} />
  <div className={styles.detailContent}>...</div>
</article>
<ShopDetailActions model={model} rel={officialRel} position="fixed" fixed />
```

PCは`visual hero`、`content content`の2列、1024px以下は`hero`→`visual`→`content`の1列にする。`visualAside`とそのCTAは削除する。

- [ ] **Step 4: Tune typography and information density**

- 店名34px、1024px以下30px、760px以下26px、360px以下23px。
- factsは右列内で2列、値18px以下、長文は単語・括弧単位で改行する。
- 上部画像は余白なしの4:3、詳細ナビは上部2列の直後に本文全幅で置く。
- 詳細セクションは見出し列220px、隙間32px、見出し24px、スマホ20pxにする。
- 760px以下では`.hero .actions`を隠し、`.fixedActions`だけを表示する。

- [ ] **Step 5: Run focused tests**

Run: `node scripts/check-shop-detail-density-contract.mjs && npm run test:shop-detail-responsive && npm run test:final-design-preservation && npm run test:shop-detail-click-tracking`
Expected: 4検査すべてPASSし、クリック分類は変更なし。

- [ ] **Step 6: Commit**

```bash
git add headless/components/ShopDetail.tsx headless/components/shop-detail/ShopDetailHero.tsx headless/components/shop-detail/ShopDetail.module.css headless/scripts/check-shop-detail-density-contract.mjs headless/scripts/check-shop-detail-responsive-contract.mjs headless/scripts/check-final-design-preservation.mjs headless/package.json
git commit -m "fix: densify shop detail profile"
```

### Task 3: 実ブラウザ回帰検査・独立レビュー・停止記録

**Files:**
- Modify: `headless/scripts/check-portal-browser-layout.mjs`
- Modify: `task_plan.md`
- Modify: `findings.md`
- Modify: `progress.md`
- Modify: `pm/PROGRESS.md`

**Interfaces:**
- Consumes: 最新production build、`data-area-shop-card`、`data-shop-profile-grid`、`aria-label="予約・公式情報"`
- Produces: PC/SP/境界幅の順位整列、CTA一意性、文字上限、横はみ出しを自動確認するheadless QA

- [ ] **Step 1: Add failing browser assertions**

既存4経路×14条件へ次を追加する。

```js
// 同じ一覧内の順位あり・なしでmediaとtitleのx座標差を2px以内にする。
// 順位バッジの矩形がmediaWrapの矩形内に収まる。
// 店舗詳細で表示中の予約・公式情報group数は各画面幅で1。
// detail H1はPC 34px以下、760px以下26px以下、facts値18px以下。
// documentElement.scrollWidth === clientWidth、CTA高さ44px以上。
```

- [ ] **Step 2: Verify RED against the pre-fix commit if needed**

実装前REDはTask 1・2の契約検査で証明する。ブラウザ検査をTask 1・2後に追加する場合は、追加assertionを一時的に旧DOM条件へ向けて失敗を確認し、確認内容をreportへ記録してから最終条件へ戻す。

- [ ] **Step 3: Run full verification**

Run in order:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:portal-browser-layout
npm audit --audit-level=high
git diff --check
```

Expected: 全コマンドexit 0。ブラウザはheadless、横はみ出し0、順位位置差2px以内、可視CTA群1、High/Critical 0。

- [ ] **Step 4: Independent final review**

merge-baseからHEADのreview packageを作成し、実装担当とは別の担当が仕様準拠と品質をレビューする。Critical/Importantがあれば1担当へまとめて修正させ、focused検査と再レビューを行う。

- [ ] **Step 5: Update durable records and stop**

`task_plan.md` Phase 16、`progress.md`、`pm/PROGRESS.md`へ実装・検査・未実施操作を記録する。push、deploy、本番WordPress/Supabase変更は行わない。

- [ ] **Step 6: Commit records**

```bash
git add task_plan.md findings.md progress.md pm/PROGRESS.md headless/scripts/check-portal-browser-layout.mjs
git commit -m "docs: record shop layout refinement"
```

## 完了基準

- Task 1〜3が個別レビュー済みで、最終Critical/Importantが0。
- 順位あり・なしで画像・店名開始位置の差が2px以内。
- PC/SPとも見える予約・公式情報群が1つ。
- 店名、facts、詳細見出しが設計上限内。
- 4経路×既存14条件のheadless QAが成功。
- WordPress-only、SEO、クリック計測、推測情報なしを維持。
- push・deploy・本番変更前で停止。
