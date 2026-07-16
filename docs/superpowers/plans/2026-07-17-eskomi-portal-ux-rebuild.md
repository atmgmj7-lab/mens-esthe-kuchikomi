# Eskomi 店舗一覧・店舗詳細 UX再構築 実装計画

> **実行方式:** `superpowers:subagent-driven-development` を使い、各タスクで実装担当 → 仕様・品質レビュー担当の順に進める。

**Goal:** 店舗名・順位・一覧・比較の表示崩れを解消し、WordPress公開データだけを使って、PC・スマホともに比較・予約・公式サイト確認がしやすいEskomiの店舗一覧・店舗詳細へ再構築する。

**Architecture:** WordPress RESTの`ShopView`を安全な表示用view modelへ変換し、店舗一覧は`components/common/AreaShopCard.tsx`、店舗詳細は`shop-detail/*`を正本にする。PCとスマホでDOMを複製せずCSS Gridとmedia queryで積み直す。文字、URL、料金、口コミ、順位の表示可否を共通関数で決め、SEO出力と画面表示を一致させる。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript 5、CSS Modules、WordPress REST、Node契約検査、Playwright/Chromiumによるローカル画面確認

## Global Constraints

- 公開店舗データはWordPressを読み続け、Supabaseの非公開候補をSSR・画面・schemaへ接続しない。
- 推測料金、架空口コミ、AI生成の体験談、固定更新日、静的OPENを追加しない。
- 可視ラテン表記だけ`Escomi → Eskomi`、`ESCOMI → ESKOMI`へ変更する。日本語「エスコミ」、ドメイン、公開URL、CSSクラス、WordPress関数・option・hook、REST `/escomi/v1/*`、`ESCOMI_*`、DB/npm/Vercel名は維持する。
- Hot Pepper固有の画像、文章、アイコン、ピンク色、商標表現、識別的な総合外観は複製しない。情報順、比率、文字階層、余白、ページ内移動、操作配置だけをEskomiへ再構成する。
- 1440pxの詳細シェルは1360px、`24 + 960 + 32 + 320 + 24`。1280pxは1200px、`24 + 800 + 32 + 320 + 24`。
- 店舗名は1440/1280px 38px、1024px 34px、768px 30px、500px 28px、390/375px 27px、320px 24px、行高1.24。
- 通常改行は`word-break:normal`と`line-break:strict`、空白なし単一語だけ`overflow-wrap:break-word`。店舗名全体へ`overflow-wrap:anywhere`を使わない。
- 一覧は1440pxで順位64/画像240/情報可変/操作164px・gap24、1280pxで順位64/画像220/情報可変/操作164px・gap24、1024pxで順位56/画像220/情報可変/操作148px・gap20とし、900px以下で同一DOMを積み上げる。
- 比較は761px以上で表、760px以下で同一DOMを比較カードへ変形する。`body{overflow-x:hidden}`だけで見切れを隠さない。
- 画像は4:3。店舗写真はcover、明示したサイト所有ロゴ・代替表示だけcontain。PC/SP画像DOMを二重生成しない。
- ページ内メニューは`nav`＋アンカーで実装し、`role=tab`を使わない。空セクションのリンクを作らない。
- 主操作の優先順はWeb予約 → 公式サイト → LINE → 電話。同一URLは1操作へ統合する。
- 住所文字から「最寄駅」「駅近」を断定しない。料金・営業時間・連絡先から「初心者向け」を自動判定しない。AI要約がない店舗の編集コメントを生成しない。
- 店舗本文・ACF文字列はHTML除去とentity復元後にReact文字列として出力する。申請URLは既存`buildShopOwnerRequestUrl()`と`URLSearchParams`を使う。
- 主要タップ領域44px以上、`focus-visible`あり、主要整列許容差±2px、余白±4px、画像比率誤差0.5%以内。
- 新規の軽量Node契約検査は個別の`test:*` scriptを作るだけで終えず、同じTask内で必ず`npm test`の直列実行へ追加する。production serverを必要とするTask 10のブラウザ検査は通常の`npm test`から分離する。
- 対象パスだけstageする。`git add -A`を使わない。
- push、PR、本番deploy、本番WordPressメディア差し替えを行わない。

## Baseline

- Branch start: `3f7f104`
- `npm install`: 成功。既存Moderate 2、High/Critical 0。
- `npm test`: 全30契約検査成功。

---

### Task 1: 店舗名の自然改行と詳細シェル寸法

**Files:**
- Modify: `headless/scripts/check-shop-detail-responsive-contract.mjs`
- Modify: `headless/components/shop-detail/ShopDetail.module.css`

- [ ] **Step 1:** 長い英字＋日本語＋全角括弧、空白なし英字のfixtureを検査へ追加し、店舗名全体の`overflow-wrap:anywhere`、500px約43px、表示幅別サイズ不足で失敗させる。
- [ ] **Step 2:** `npm run test:shop-detail-responsive`を実行し、意図した失敗を記録する。
- [ ] **Step 3:** CSS custom propertyまたはmedia queryで設計書の8幅サイズ、行高1.24、`word-break:normal`、`line-break:strict`、緊急`break-word`を実装する。
- [ ] **Step 4:** スマホ左右16pxと店舗名コンテナ内の安全な収まりだけを同じ検査へ固定する。詳細グリッドはTask 9だけで実装する。
- [ ] **Step 5:** focused検査、typecheckを実行し、自己レビューする。
- [ ] **Step 6:** `fix: stabilize shop title responsive layout`として対象ファイルだけcommitする。

### Task 2: 順位位置と料金比較の見切れ修正

**Files:**
- Create: `headless/scripts/check-area-ranking-responsive-contract.mjs`
- Create: `headless/components/common/ShopRankCell.tsx`
- Create: `headless/components/common/ShopRankCell.module.css`
- Modify: `headless/package.json`
- Modify: `headless/components/area/hub/ShopCardLuxury.tsx`
- Modify: `headless/components/area/hub/RankingComparisonTable.tsx`
- Modify: `headless/app/globals.css`

- [ ] **Step 1:** 順位数字と「位」の中央揃え、上下差2px以内、760/761px切替、比較DOM1つ、表`min-width:640px`撤去を要求する失敗検査を追加し、`"test:area-ranking-responsive": "node scripts/check-area-ranking-responsive-contract.mjs"`として`npm test`へ接続する。
- [ ] **Step 2:** 新検査が現行baselineで失敗することを確認する。
- [ ] **Step 3:** `ShopRankCell({ rank, className? }: { rank: number; className?: string })`を作り、順位を画像への絶対配置から独立セルへ移す。数字と単位は同じ固定行高・中央揃えにし、Task 6の共通カードもこの部品を使う。
- [ ] **Step 4:** `RankingComparisonTable`を1つのrow DOMにし、761px以上は見出し付きgrid表、760px以下は各rowを比較カードへ積み直す。非表示DOMを複製しない。
- [ ] **Step 5:** focused検査、既存S-10、internal links、typecheckを実行する。
- [ ] **Step 6:** `fix: repair ranking and comparison responsiveness`としてcommitする。

### Task 3: 可視ブランド表記をEskomiへ統一

**Files:**
- Create: `headless/scripts/check-visible-eskomi-brand.mjs`
- Modify: `headless/package.json`
- Modify: `headless/components/SiteHeader.tsx`
- Modify: `headless/components/SiteFooter.tsx`
- Modify: `headless/lib/seo.ts`
- Modify: `headless/app/layout.tsx`
- Modify: `headless/app/page.tsx`
- Modify: `headless/app/column/page.tsx`
- Modify: `headless/lib/static-pages.ts`
- Modify: `headless/app/api/contact/route.ts`
- Modify: `headless/lib/contact-validation.ts`
- Modify: `headless/app/dashboard/page.tsx`
- Modify: `headless/components/area/hub/ShopImageThumb.tsx`
- Modify: `headless/lib/home-hero-config.ts`
- Modify: `area-seo-hooks.php`
- Modify: `front-page.php`
- Modify: `single-shop.php`

- [ ] **Step 1:** 本文、title、OG、Twitter、JSON-LD、メール、alt、fallbackの可視旧表記を検出し、内部識別子の許可リストを保護する失敗検査を書き、`"test:visible-eskomi-brand": "node scripts/check-visible-eskomi-brand.mjs"`として`npm test`へ接続する。
- [ ] **Step 2:** 現行で可視`Escomi`/`ESCOMI`を検出して失敗することを確認する。
- [ ] **Step 3:** 棚卸し済みの可視文字だけを`Eskomi`/`ESKOMI`へ置換する。小文字`escomi`は一括置換しない。
- [ ] **Step 4:** `/escomi/v1/*`、`ESCOMI_*`、CSSクラス、WordPress関数・option、npm名、URLの保持検査を通す。
- [ ] **Step 5:** focused検査、SEO metadata、schema、contact、typecheckを実行する。
- [ ] **Step 6:** `refactor: rename visible brand to Eskomi`としてcommitする。

### Task 4: 旧ロゴ画像の表示経路を正確なEskomi代替へ置換

**Files:**
- Create: `headless/public/images/eskomi-logo.svg`
- Create: `headless/public/images/eskomi-shop-fallback.svg`
- Create: `assets/img/eskomi-logo.svg`
- Create: `docs/brand/2026-07-17-eskomi-logo-replacement.md`
- Delete: `headless/public/shop-default-image.webp`
- Modify: `front-page.php`
- Modify: `headless/components/SiteHeader.tsx`
- Modify: `headless/components/area/hub/ShopImageThumb.tsx`
- Modify: `headless/lib/design-constants.ts`
- Modify: `headless/lib/seo.ts`
- Modify: `headless/scripts/check-visible-eskomi-brand.mjs`
- Modify: `headless/scripts/check-shop-detail-view-model.mjs`
- Modify: `headless/scripts/check-final-design-preservation.mjs`

- [ ] **Step 1:** `shop-default-image.webp`と旧WordPressロゴURLが公開DOMのfallbackへ出ないこと、代替の読み上げ名がEskomiであることを要求する失敗検査を書く。
- [ ] **Step 2:** 既存ラスタを無理に文字修正せず、濃紺/金/生成りと正確な`Eskomi`文字で構成する、script・外部参照なしのサイト所有SVGを実装する。
- [ ] **Step 3:** ヘッダー内で`display:none`の旧ロゴ`img`と旧URL定数を削除する。
- [ ] **Step 4:** `DEFAULT_SHOP_IMAGE = "/images/eskomi-shop-fallback.svg"`へ、Organization schema logoを`https://mens-esthe-kuchikomi.com/images/eskomi-logo.svg`へ、WordPress予備トップのロゴ参照を`assets/img/eskomi-logo.svg`へ切り替える。
- [ ] **Step 5:** 画像なし店舗は4:3、`contain`相当、width/height確保、alt/readable labelを維持する。
- [ ] **Step 6:** 旧fallbackラスタをリポジトリから削除し、旧WordPress upload URLの公開コード参照0を確認する。`docs/brand/2026-07-17-eskomi-logo-replacement.md`へ旧URL、使用箇所、新候補、今回本番WordPressメディア未変更を記録する。
- [ ] **Step 7:** 旧fallbackをmock・期待値に持つ2つの既存検査も`/images/eskomi-shop-fallback.svg`へ更新し、focused検査、schema、typecheck、目視用静的描画を実行する。
- [ ] **Step 8:** `refactor: replace legacy logo fallbacks`としてcommitする。

### Task 5: 推定・固定値を断定しない表示契約

**Files:**
- Create: `headless/scripts/check-shop-content-accuracy.mjs`
- Modify: `headless/package.json`
- Modify: `headless/lib/area-shop-utils.ts`
- Modify: `headless/lib/area-shop-list-controls.ts`
- Modify: `headless/lib/shop-ranking.ts`
- Modify: `headless/lib/seo.ts`
- Modify: `headless/lib/shop-detail-view-model.ts`
- Modify: `headless/components/area/AreaHubPageTemplate.tsx`
- Modify: `headless/components/area/area-hub-content.tsx`
- Modify: `headless/components/area/hub/RankingSpecialtyCards.tsx`
- Modify: `headless/components/area/hub/RankingComparisonTable.tsx`

- [ ] **Step 1:** 固定`2026年6月13日`、住所からの最寄駅断定、推定初心者向け、AI要約なし定型コメント、アクセス文の`streetAddress`出力を拒否する失敗検査を書き、`"test:shop-content-accuracy": "node scripts/check-shop-content-accuracy.mjs"`として`npm test`へ接続する。
- [ ] **Step 2:** 現行実装で各禁止条件が失敗することを確認する。
- [ ] **Step 3:** 更新日は有効`shop_updated_at`だけを表示し、なければ日付欄を省略する。
- [ ] **Step 4:** `station` IDは維持し、明示的な駅＋徒歩表記だけを「駅名・徒歩案内あり」とする。住所だけから駅近を作らない。
- [ ] **Step 5:** 初心者向けは明示特徴だけ、編集コメントは`shop_ai_summary`がある場合だけ表示する。
- [ ] **Step 6:** 住所形式を確認できない`shop_address`は画面で「アクセス案内」とし、LocalBusinessの`streetAddress`へ入れない。
- [ ] **Step 7:** Task 5では共通の事実判定・正規化関数、SEO、詳細view model、比較・条件別表示だけを直し、一覧カード本体は変更しない。focused検査、price、schema、area integrity、typecheckを実行する。
- [ ] **Step 8:** `fix: remove inferred shop facts from public UI`としてcommitする。

### Task 6: 共通店舗一覧view modelとAreaShopCard正本

**Files:**
- Create: `headless/lib/area-shop-card-view-model.ts`
- Create: `headless/scripts/check-area-shop-card-view-model.mjs`
- Modify: `headless/package.json`
- Rewrite: `headless/components/common/AreaShopCard.tsx`
- Create: `headless/components/common/AreaShopCard.module.css`
- Modify: `headless/components/area/hub/ShopCardLuxury.tsx`
- Modify: `headless/components/ShopCard.tsx`

- [ ] **Step 1:** full/sparse/PR/rankなし/長い店名のfixtureで、存在する値だけ、操作優先順、紹介文非生成、順位表示条件を要求する失敗検査を書き、`"test:area-shop-card-view-model": "node scripts/check-area-shop-card-view-model.mjs"`として`npm test`へ接続する。
- [ ] **Step 2:** view model不在または現行カード差で失敗することを確認する。
- [ ] **Step 3:** Task 5の事実判定・正規化関数を利用して`buildAreaShopCardViewModel(shop, targetArea, options): AreaShopCardViewModel`を実装する。`options`は`{ rank?: number | null; showRank?: boolean; summarySource?: "wordpress-only"; maxActions?: 2 }`とし、WordPress値からrank、image、title、summary、tags、facts、actions、quick linksだけを作る。
- [ ] **Step 4:** `AreaShopCard({ shop, targetArea, rank, showRank })`を、1440px=`64/240/可変/164・gap24`、1280px=`64/220/可変/164・gap24`、1024px=`56/220/可変/148・gap20`、900px以下=同一DOM積み上げで実装する。順位はTask 2の`ShopRankCell`を再利用し、主操作1＋補助操作1、内部quick linkを配置する。
- [ ] **Step 5:** `ShopCard`と`ShopCardLuxury`を互換ラッパーに縮小し、独自レイアウトを持たせない。
- [ ] **Step 6:** focused検査に`npm run test:shop-content-accuracy`を含め、promotion、price、internal links、typecheckも実行する。
- [ ] **Step 7:** `refactor: centralize area shop card presentation`としてcommitする。

### Task 7: ハブ・通常エリア・店舗一覧を共通カードへ統合

**Files:**
- Modify: `headless/components/area/hub/AreaShopList.tsx`
- Modify: `headless/components/AreaPageView.tsx`
- Modify: `headless/app/shops/page.tsx`
- Modify: `headless/lib/area-shop-list-controls.ts`
- Modify: `headless/components/area/hub/AreaSortTabs.tsx`
- Modify: `headless/app/globals.css`
- Create/Modify: `headless/scripts/check-area-list-route-contract.mjs`
- Modify: `headless/package.json`

- [ ] **Step 1:** 6ハブ、通常`/area/[slug]`、`/shops/`の3経路が共通カードを使い、通常一覧・非おすすめsortでは順位を出さない失敗検査を書き、`"test:area-list-route-contract": "node scripts/check-area-list-route-contract.mjs"`として`npm test`へ接続する。
- [ ] **Step 2:** 現行の3経路分岐で失敗することを確認する。
- [ ] **Step 3:** hubのfilter/sort/load-moreとURL queryを維持したまま共通カードへ切り替える。
- [ ] **Step 4:** `AreaPageView`と`/shops/`も同じカードへ切り替え、順位propsと操作propsだけを経路別に渡す。
- [ ] **Step 5:** ラベル「駅近」を「駅名・徒歩案内あり」へ変え、`recommended/updated/price-asc/late-night/station`のIDを維持する。
- [ ] **Step 6:** 参照0になった旧一覧CSSを削除し、`document`横overflowを原因箇所で解消する。
- [ ] **Step 7:** focused検査、S-10、internal links、final design、typecheckを実行する。
- [ ] **Step 8:** `refactor: unify area and shop listing routes`としてcommitする。

### Task 8: 店舗詳細の安全な本文と条件付きページ内メニュー

**Files:**
- Modify: `headless/lib/shop-detail-view-model.ts`
- Modify: `headless/scripts/check-shop-detail-view-model.mjs`
- Create: `headless/components/shop-detail/ShopSectionNav.tsx`
- Modify: `headless/components/shop-detail/ShopDetailSections.tsx`
- Modify: `headless/components/ShopDetail.tsx`
- Modify: `headless/components/shop-detail/ShopDetail.module.css`

- [ ] **Step 1:** HTML/script/event属性/javascript URL、日本語・`&`入り店舗名、空セクションのmenu非表示を要求する失敗検査を書く。
- [ ] **Step 2:** 現行`dangerouslySetInnerHTML`と固定quick linksで失敗することを確認する。
- [ ] **Step 3:** view modelを`introductionText`へ変更し、HTML除去・entity復元後の文字列をReactで表示する。
- [ ] **Step 4:** `ShopSectionLink = { id: "overview" | "prices" | "hours-access" | "features" | "reviews" | "nearby"; label: string }`、`buildShopSectionLinks(model, { hasReviews, hasNearby }): ShopSectionLink[]`、`ShopSectionNav({ links }: { links: ShopSectionLink[] })`を実装し、存在する項目だけの`nav`＋アンカーを作る。
- [ ] **Step 5:** `aria-current=location`、`focus-visible`、`scroll-margin-top`、横スクロール可能なスマホmenuを実装する。
- [ ] **Step 6:** 既存パンくず、LocalBusiness、口コミ、PR、地域内部リンク、owner CTAを維持する。
- [ ] **Step 7:** focused検査、schema、internal links、typecheckを実行する。
- [ ] **Step 8:** `refactor: add conditional shop section navigation`としてcommitする。

### Task 9: 店舗詳細のPC2列・スマホ1列と予約導線

**Files:**
- Modify: `headless/components/shop-detail/ShopDetailActions.tsx`
- Modify: `headless/components/shop-detail/ShopDetailGallery.tsx`
- Modify: `headless/components/shop-detail/ShopDetailHero.tsx`
- Modify: `headless/components/ShopDetail.tsx`
- Modify: `headless/components/shop-detail/ShopDetail.module.css`
- Modify: `headless/scripts/check-shop-detail-responsive-contract.mjs`
- Modify: `headless/scripts/check-shop-detail-click-tracking.mjs`

- [ ] **Step 1:** 1440/1280の正確な列、1024以下1列、4:3、固定UI変数、safe area、CTA優先順・最大数を要求する失敗検査を追加する。
- [ ] **Step 2:** 現行レイアウトとの差で失敗することを確認する。
- [ ] **Step 3:** Hero/要点/画像/本文/補助操作を設計順へ再配置し、PCは960/320または800/320、1024以下は1列にする。
- [ ] **Step 4:** メイン画像だけ初期優先、サムネイル・近隣画像はlazy、width/height/aspect-ratio/sizesを設定する。
- [ ] **Step 5:** 上部は実在操作最大4、スマホ固定は主1＋補助1。同一URLを統合し、本文下余白と`env(safe-area-inset-bottom)`を確保する。
- [ ] **Step 6:** 既存GA4分類が1クリック1回のままか確認する。
- [ ] **Step 7:** focused検査、click tracking、typecheckを実行する。
- [ ] **Step 8:** `refactor: complete shop detail responsive shell`としてcommitする。

### Task 10: 実ブラウザ8幅QAと視覚差分修正

**Files:**
- Create: `headless/scripts/check-portal-browser-layout.mjs`
- Modify: `headless/package.json`
- Modify: `headless/package-lock.json`
- Modify only after an assertion proves the failure, and record the exact path before editing: `headless/components/shop-detail/ShopDetail.module.css`, `headless/components/common/AreaShopCard.module.css`, `headless/app/globals.css`, `headless/components/area/hub/RankingComparisonTable.tsx`, `headless/components/common/ShopRankCell.tsx`, `headless/components/common/ShopRankCell.module.css`
- Create: local ignored screenshots under `headless/reports/portal-ux-2026-07-17/`

- [ ] **Step 1:** `npm install --save-dev --save-exact @playwright/test@1.61.1`と`npx playwright install chromium`を実行し、通常の`npm test`とは分離した`"test:portal-browser-layout": "node scripts/check-portal-browser-layout.mjs"`を追加する。検査は最新build後に`npm run start -- --hostname 127.0.0.1 --port 3100`をspawnするか`PORTAL_BASE_URL`を使い、終了時は`finally`で子プロセスを止める。DPR1、zoom100%、ja-JP、Asia/Tokyo、reduced motionを固定する。
- [ ] **Step 2:** `milk-tea（ミルクティー）`実slug、`/area/sakaisujihonmachi/`、`/area/osaka/`、`/shops/`を1440/1280/1024/768/500/390/375/320で撮影する。
- [ ] **Step 3:** 760/761、900/901、1024/1025、320×568、スマホ横向きを追加測定する。
- [ ] **Step 4:** `scrollWidth === clientWidth`、順位上下差≤2、主要開始位置±2、余白±4、画像比率誤差≤0.5%、CTA44px以上、見出し非隠蔽を自動計測する。
- [ ] **Step 5:** 失敗項目だけを再現テストへ追加して修正し、全幅を再撮影する。
- [ ] **Step 6:** keyboard focus、menu anchor、fixed actions、画像失敗fallback、長い店名を目視する。
- [ ] **Step 7:** `npm run build`を新しく完了した直後に`npm run test:portal-browser-layout`を実行し、全assertion成功と`portal browser layout check passed`を確認する。browser QA結果を`progress.md`へ件数付きで記録する。
- [ ] **Step 8:** `test: add portal responsive browser coverage`として必要な検査・修正をcommitする。

### Task 11: 全体検証・最終レビュー・停止記録

**Files:**
- Modify: `task_plan.md`
- Modify: `progress.md`
- Modify: `pm/PROGRESS.md`
- Modify: `findings.md`（新しい恒久的所見がある場合のみ）
- Modify only a named existing test tied directly to a final-review finding; the exact path and failing assertion must be written in the Task 11 report before editing

- [ ] **Step 1:** `npm test`、`npm run lint`、`npm run typecheck`、`npm run build`、`npm run test:portal-browser-layout`、`npm audit --audit-level=high`の順で新しい出力を取得し、ブラウザ検査が同じStepの最新buildを使うことを確認する。
- [ ] **Step 2:** 可視ブランド、内部識別子、WordPress-only、canonical/sitemap/schema、口コミ出自、PR、owner CTA、クリック分類を横断確認する。
- [ ] **Step 3:** merge-baseからHEADのreview packageを作り、別担当の全体コードレビューを実行する。
- [ ] **Step 4:** Critical/Importantを1つの修正担当へ渡し、focused検査と再レビューを完了する。
- [ ] **Step 5:** `git diff --check`、`git status`、commit一覧を確認する。
- [ ] **Step 6:** `task_plan.md` Phase 15、`progress.md`、`pm/PROGRESS.md`へ実装・検査・未実施操作を記録する。
- [ ] **Step 7:** `docs: record Eskomi portal UX rebuild`として文書だけcommitする。
- [ ] **Step 8:** push、PR、deploy、本番WordPress/Supabase変更を行わず停止する。

## 完了基準

- 11タスクが個別レビュー済みで、最終横断レビューのCritical/Importantが0。
- 対象4経路の8画面幅と切替境界で横見切れ・重なり・不自然な改行が0。
- 一覧・比較・詳細が設計書の構造達成項目10個中9個以上に合格。
- 可視旧ラテン表記と公開DOMの旧ロゴ参照が0。内部識別子と日本語表記は維持。
- 固定更新日、推定駅近、推定初心者向け、定型生成コメント、架空口コミ・料金が公開画面へ出ない。
- WordPressが公開データ元のまま。
- 全test、lint、typecheck、production build、High/Critical依存監査が成功。
- push・本番公開前で停止。
