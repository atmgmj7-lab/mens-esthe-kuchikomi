# 進行ログ

**運用・自動実行コマンド:** `pm/RUNBOOK.md`（Claude / Cursor は手動指示ではなく **ここに書いたコマンドを実行**する）

### 2026-06-13 app-development Phase 1-3（WP revalidate 通知 + CSS 余白基盤）

#### 要件 A: WordPress 更新 → Next 即時反映
- `functions.php` に `escomi_headless_*` で revalidate 通知を追加
- フック: `save_post_shop/post/page`, `trashed_post`, `deleted_post`, `edited_area`, `created_area`, `delete_area`
- autosave / revision 除外、20 秒 transient throttle、shutdown で非同期送信
- `wp_remote_post` は `blocking => false` / `timeout => 0.1` の fire-and-forget とし、WP 保存画面を待たせない設計
- レビュー時に重複していた revalidate ブロックを削除し、フック登録は1セットのみに整理
- secret 取得順: `ESCOMI_REVALIDATE_SECRET` 定数 → 環境変数 → option `escomi_revalidate_secret`
- `pm/RUNBOOK.md` A-5、`pm/HEADLESS-CUTOVER-CHECKLIST.md` §14 に設定・テスト手順を追記

#### 要件 B: CSS / コンポーネント余白基盤
- `headless/app/globals.css`: デザイントークン（container / gutter / section gap / radius / shadow / 色系）と `.hl-page-inner` `.hl-section` `.hl-surface` `.hl-stack` `.hl-cluster` を追加
- 既存色 `--mep-navy` `--es-gold` `--es-turquoise` は維持
- `AreaPageView` / `ShopDetail` / `ShopContactCta` / `WpStaticPage` / `shops/page` に最小限 `hl-*` クラス適用
- スマホ向け overflow-wrap / gutter 縮小を追加

#### 検証
- `npm run lint` 成功
- `npm run build` 成功（Next.js 16.2.6 / Cache Components 有効 / 435 routes）
- `php -l functions.php` 成功
- ローカル `http://127.0.0.1:3030` で `/` `/area/nihonbashi/` `/shops/` `/about/` → 200
- Playwright で desktop/mobile の `/` `/area/nihonbashi/` `/shops/` `/shops/genie.../` `/about/` を確認。ページ全体の横スクロールなし（スマホのエリアチップ横スクロールは意図したUI）
- 本番 `GET /api/revalidate?tag=wp`（secret なし）→ `401 Invalid secret`（`REVALIDATE_SECRET` 設定済みを確認）
- ローカル同 API → 同上（secret 必須環境）。WP 連携の E2E は `wp-config.php` 設定後に実施

#### 変更ファイル
- `functions.php`
- `headless/app/globals.css`
- `headless/components/AreaPageView.tsx`
- `headless/components/ShopDetail.tsx`
- `headless/components/ShopContactCta.tsx`
- `headless/components/WpStaticPage.tsx`
- `headless/app/shops/page.tsx`
- `pm/RUNBOOK.md`
- `pm/HEADLESS-CUTOVER-CHECKLIST.md`
- `pm/PROGRESS.md`

#### 懸念・本番作業
- `wp-config.php` への `ESCOMI_REVALIDATE_SECRET` 登録は人手（RUNBOOK C / A-5）
- secret 未設定時は Next 側 `REVALIDATE_SECRET` も空なら revalidate は通るが、本番では両方設定推奨
- 初回 push 後の Xserver Action は FTP 425 で失敗。`deploy.yml` を安全化（`dangerous-clean-slate: false`、不要フォルダ除外、headless/pm 等のみの変更ではXserver deployを走らせない）して再実行対象にした

---

### 2026-06-12 本番反映（遷移空画面対策・店舗slug 404修正）

- main に `118b7d1`（遷移空画面対策）・`565c7c5`（店舗slug 404修正）を push 済み
- Vercel CLI `vercel deploy --prebuilt --prod --yes --archive=tgz` で本番 `https://mens-esthe-kuchikomi.com` に反映
- 本番確認: `/area/nihonbashi/` 200、空 fallback 未検出、`/shops/genie.../` と `/shops/zenith-spa.../` 200
- `npm run seo:cutover-check -- https://mens-esthe-kuchikomi.com` 合格、`npm run perf:check -- https://mens-esthe-kuchikomi.com` 合格
- 残課題: GitHub Actions Headless は VERCEL_TOKEN 無効 / Xserver は今回 FTP timeout（WP 側変更なし・Next 本番表示への影響なし）

---

### 2026-06-12 店舗詳細の日本語slug 404修正

- `getShopBySlug`: Next params（URLデコード済み）と WP REST `shop.slug`（percent-encoded）の不一致で404になる問題を修正
- 直接 slug クエリは複数バリアント（encode / 生値）を試行し、失敗時は search → 一覧で `decodeURIComponent` 正規化後の完全一致フォールバック
- `cacheTag` を `shop:h:{sha256先頭16}` に短縮（256文字制限対策）
- 対象: `headless/lib/wp/shops.ts`

#### 検証
- `npm run lint` 成功
- `npm run build` 成功
- ローカル `http://127.0.0.1:3025` で `/shops/genie%ef%bc%88.../`・`/shops/genie/`・zenith-spa エンコード slug → 200
- `npm run seo:cutover-check -- http://127.0.0.1:3025` の sitemap 店舗サンプルは本番 URL を叩くため未反映時は 404（コード側はローカルで確認済み）

---

### 2026-06-12 Headless 遷移中の空画面抑制

- 空の Suspense fallback（`<main class="..."></main>` のみ）を削除
- `area/[slug]` / `shops/[slug]` / `[slug]` / `column/[slug]` は `generateStaticParams` + async default export に変更（Suspense 不要化）
- `/shops/` のみ `searchParams` 都合で Suspense を維持し、`RoutePageFallback`（min-height 確保）に差し替え
- 目的: 画面遷移時にヘッダー＋フッターだけの一瞬の空白を出さない

#### 検証
- `npm run lint` 成功
- `npm run build` 成功（Cache Components 有効）
- ローカル `http://127.0.0.1:3023` で `/area/nihonbashi/` `/shops/` `/shops/genie/` `/about/` → 200
- curl HTML: 空の `<main class="l-main_content l-article"></main>` 系 fallback は未検出

---

### 2026-06-12 GitHub Actions Headless デプロイ（Vercel scope 固定を外した）

- `.github/workflows/deploy-headless.yml` から `VERCEL_SCOPE` 依存を削除（`vercel pull` / `vercel build` / `vercel deploy` は `.vercel/project.json` の orgId/projectId のみ使用）
- 原因: `scope-not-accessible`（run `27417847473`）

---

### 2026-06-12 店舗詳細CTAの細エリア導線を修正

- `shop.areaSlug` を最優先し、WP REST `_embed` で parent 欠落時も細エリア（例: 日本橋）へ CTA・エリア導線を向ける
- 対象: `shop-contact.ts` / `ShopDetail.tsx` / `shops/[slug]/page.tsx` / `seo.ts`（`areaServed`）

---

### 2026-06-12 Headless 回遊・CV改善（実装完了）

- `/shops/` を `searchParams` 対応（`q` / `area` / `available`）。GET フォームで URL に条件を保持
- WP API から最大500件をページング取得・キャッシュし、サーバー側で絞り込み（`getAllShopsForListing` + `shop-filter`）
- `AreaQuickLinks` を `/shops/` と店舗詳細下部に追加（`es-area-link-item` 系、`/area/[slug]/` リンク）
- 店舗詳細に「予約・問い合わせ」CTA パネルとモバイル固定 CTA バー（tel / LINE / 公式）を追加
- `headless/app/globals.css` にフィルター・結果表示・固定 CTA 用スタイルを追加

#### 検証
- `npm run lint` 成功
- `npm run build` 成功
- ローカル `http://127.0.0.1:3022` で `npm run seo:cutover-check` 全合格
- ローカル `http://127.0.0.1:3022` で `npm run perf:check` 全合格（キャッシュ後 `/shops/` total 約48ms）
- Playwright確認: `/shops/?q=genie` で検索フォーム・結果1件・genie表示OK
- Playwright確認: genie店舗詳細で CONTACT が「日本橋エリア」、`/shops/?area=nihonbashi` 導線、モバイル固定CTA表示OK
- スクリーンショット: `/tmp/escomi-shops-filter.png`, `/tmp/escomi-shop-detail-desktop.png`, `/tmp/escomi-shop-detail-mobile.png`

---

### 2026-06-12 Headless 速度・運用品質改善（実装完了）

- `/wp-content/[...path]` の cache-control をパス種別ごとに最適化（uploads=1年 immutable / theme CSS・JS=短ブラウザ+長CDN+SWR / その他 wp-content も CDN 向け SWR）
- 画像読み込み属性を最適化（ヘッダーロゴは `loading="eager"`、LCP 候補（トップロゴ・コラム詳細アイキャッチ等）は `fetchPriority="high"`、一覧・特集・詳細は `loading`/`decoding`/寸法）
- `headless/scripts/performance-check.mjs` と `npm run perf:check` を追加（主要ページ・CSS・WP JSON の status/TTFB/サイズ閾値チェック）

#### 検証
- `npm run lint` 成功
- `npm run build` 成功
- ローカル本番 `http://127.0.0.1:3021` で `npm run seo:cutover-check` 全合格
- `npm run perf:check` 全合格
- CSS cache-control: `public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`
- uploads 画像 cache-control: `public, max-age=31536000, s-maxage=31536000, immutable`

#### 本番反映
- commit `969a283` を `main` に push 済み
- GitHub Actions: Deploy Headless to Vercel run `27408389607` 成功、Deploy to Xserver run `27408389612` 成功
- 本番 `https://mens-esthe-kuchikomi.com` で `npm run seo:cutover-check` 全合格
- `npm run perf:check` 全合格
- CSS と uploads 画像で `x-vercel-cache: HIT` を確認

---

### 2026-06-12 Headless DNS cutover 完了

- MX: 優先度 0 `sv16727.xserver.jp` に反映済み
- A レコード: `mens-esthe-kuchikomi.com` / `www` / wildcard → `76.76.21.21` に反映済み
- Vercel certs issue: `mens-esthe-kuchikomi.com` と `www` の証明書を発行済み
- `https://mens-esthe-kuchikomi.com` → HTTP/2 200、`/wp-json`・`/wp-content` → 200
- `npm run seo:cutover-check -- https://mens-esthe-kuchikomi.com` 全合格
- 次: Search Console で sitemap 送信と URL 検査

---

### 2026-06-12 Headless origin proxy 本番反映完了

- commit `2260655` を `main` に push 済み
- GitHub Actions: Deploy Headless to Vercel run `27403883247` 成功、Deploy to Xserver run `27403883246` 成功
- `https://escomi-headless.vercel.app` で `/wp-json`・`/wp-content`・SEO cutover check が成功
- DNS はまだ Xserver のまま（A=`85.131.213.108` / MX=`mens-esthe-kuchikomi.com`）。次は MX を `sv16727.xserver.jp` に変更してから A を Vercel へ切り替える

---

### 2026-06-12 Headless WP origin proxy（DNS 切替前）

- DNS 切替後も WP REST API / wp-content が壊れないよう、headless に origin proxy を実装
- Node fetch では `Host` ヘッダーが効かないため、origin proxy は `node:http` で中継（`lib/wp/origin-request.ts`）
- サーバー fetch: `WP_API_BASE_URL` 既定を `http://85.131.213.108/wp-json`、`WP_ORIGIN_HOST` で `Host` ヘッダー付与（`lib/wp/client.ts`）
- Route Handler: `/wp-content/[...path]` / `/wp-json/[[...path]]` → Xserver origin へプロキシ
- 表示用画像・CSS を `/wp-content/...` 相対 URL に変更（JSON-LD logo 等の canonical 絶対 URL は維持）
- テーマ CSS は Turbopack が `@import` の root 相対 URL を解決できないため `layout.tsx` の `<link href="/wp-content/...">` で読み込み
- `.env.example` に `WP_API_BASE_URL` / `WP_ORIGIN_HOST` を追記、`HEADLESS-CUTOVER-CHECKLIST.md` §1 を更新

---

### 2026-06-12 Headless Vercel CI SEOチェックURL固定

- Vercel deploy は成功したが、SEO check が DNS 未切替の `mens-esthe-kuchikomi.com` を見て失敗した
- GitHub Repository Variable `HEADLESS_CI_CHECK_URL` で `https://escomi-headless.vercel.app` を指定済み
- workflow は `HEADLESS_CI_CHECK_URL` を優先し、未設定時のみ deploy output URL を使う
- DNS 切替後はこの variable を本番ドメインへ変更または削除してもよい

---

### 2026-06-12 Headless Vercel CI workflow 修正（GitHub secrets 経由 SMTP）

- Vercel pull だけでは GitHub Actions 内の SMTP チェックに機密 env が渡らず失敗した
- GitHub Repository Secrets に SMTP/CONTACT 系の値を登録済み
- workflow の contact:check-env ステップへ secrets を env として渡すよう修正
- 検証予定: `npm run contact:check-env` / `npm run lint` / `npm run build` / main push 後の GitHub Actions 確認

---

### 2026-06-12 Headless Vercel CI workflow 修正（env 同期）

#### 失敗原因（run 27400076147）
- `vercel pull` は `.env.local` ではなく `.vercel/.env.production.local` を生成する（Vercel CLI 54.x）。
- `contact:check-env` は `.env` / `.env.local` のみ読むため、CI で SMTP 6 件すべて「未設定」で exit 1。

#### 修正
- `deploy-headless.yml`: `vercel pull` 直後に `.vercel/.env.production.local` → `.env.local` をコピー（`.env.local` は gitignore のまま）。どちらも無く `.env` も無い場合は日本語エラーで停止。

#### 検証
- ローカル: `npm run lint` / `npm run build` / `npm run contact:check-env`（headless/）
- GitHub Actions 再実行で green 確認（secrets/variables 登録済み前提）

---

### 2026-06-12 Headless Vercel CI workflow 修正

#### 内容
- `check-contact-env.mjs`: `.env` → `.env.local` の順で読み込み（後者優先）。読み込み前から存在した process.env は上書きしない。`SMTP_PASS` は引き続きマスク表示。
- `deploy-headless.yml`: `lint` → Vercel CLI install → link → `vercel pull --scope` → `npm run build` → `contact:check-env` → `vercel build` → `vercel deploy` → SEO check の順に整理。非対話 CI 向け `--scope`（既定 `narikiyos-projects`）と `--yes` を付与。デプロイ URL は CLI 出力の最後の https を抽出、空なら日本語エラー。
- `HEADLESS-CUTOVER-CHECKLIST.md` §0 の workflow 手順を上記順序に合わせて更新。

#### 検証（ローカル）
- `npm run lint` / `npm run build` / `npm run contact:check-env`（headless/）

#### 残課題
- GitHub secrets/variables 登録後、workflow 初回実行で green を確認。
- DNS A レコード切替 → 本番ドメインで §8 再チェック。

---

### 2026-06-12 Headless Vercel GitHub Actions CI/CD

#### 内容
- `.github/workflows/deploy-headless.yml` 新規: `main` へ `headless/**` 変更 push 時および `workflow_dispatch` で Vercel 本番（`escomi-headless`）へデプロイ。
- Node 24、`npm ci` → `lint` → Vercel pull → `build` → `contact:check-env` → Vercel prebuilt deploy。デプロイ URL に `npm run seo:cutover-check`。
- `VERCEL_TOKEN`（secret）と `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID`（variables または secrets）未設定時は日本語エラーで停止。
- `pm/HEADLESS-CUTOVER-CHECKLIST.md` §0 に GitHub 設定値と DNS 手動切替の注意を追記。
- 既存 `deploy.yml`（Xserver FTP / WP テーマ）は未変更。

#### GitHub 登録（運用者）
- Secret: `VERCEL_TOKEN`
- Variable（推奨）: `VERCEL_ORG_ID=team_WBpmGGwLZPtutzOCsGN2lluQ`, `VERCEL_PROJECT_ID=prj_lgQwu8WqzjHvKLEGAGBh4Xyq38b8`, `VERCEL_SCOPE=narikiyos-projects`（任意）

#### 残課題
- 上記 secrets/variables を GitHub に登録後、workflow 初回実行で green を確認。
- DNS A レコード切替 → 本番ドメインで §8 再チェック。

---

### 2026-06-12 Headless Vercel 本番デプロイ準備

#### 内容
- Vercel プロジェクト `escomi-headless` を `narikiyos-projects` 配下に作成。
- 本番用環境変数を Vercel に登録済み（値はログ・ドキュメントに記載しない）。
- 初回 Vercel デプロイは Framework が `Other` のため 404。プロジェクト設定を `nextjs` に修正後、再デプロイ成功。
- 本番エイリアス `https://escomi-headless.vercel.app` は **READY**。
- カスタムドメイン `mens-esthe-kuchikomi.com` を Vercel プロジェクトに追加済み。

#### 検証（2026-06-12）
- `npm run seo:cutover-check -- https://escomi-headless.vercel.app` … **PASS**
- `npm run seo:url-parity -- --current https://mens-esthe-kuchikomi.com --candidate https://escomi-headless.vercel.app` … **PASS**（WARN のみ、exit 0）

#### DNS / 切替
- 現行 DNS は Xserver `85.131.213.108` を向いたまま。**本番ドメイン切替前**に DNS プロバイダで `mens-esthe-kuchikomi.com` の A レコードを `76.76.21.21`（Vercel）へ変更すること。
- `www.mens-esthe-kuchikomi.com` も Vercel プロジェクトに追加済み。www を Vercel で配信する場合は、DNS プロバイダで `www.mens-esthe-kuchikomi.com` の A レコードを `76.76.21.21` へ設定すること。
- 現行 WP 本番ドメインは DNS 更新まで変更なし。

#### 残課題
- main への push / 現行 GitHub Actions は headless をデプロイしない（従来どおり WP のみ）。
- DNS A レコード切替 → Vercel 本番ドメイン反映 → 切替チェックリスト §5 以降。

---

### 2026-06-12 Headless SEO カットオーバー URL パリティ CLI

#### 内容
- `headless/` のみ編集。WP PHP/CSS は未変更。
- `url-parity-check.mjs` 新規: 現行 WP と候補 Next を `--current` / `--candidate` で比較。sitemap（`/sitemap.xml`・`/wp-sitemap.xml`・インデックス再帰）、主要パス・エリア・固定ページ・店舗サンプルのステータス / canonical / noindex / タイトルを検査。
- `npm run seo:url-parity` 追加。レポート出力は `headless/reports/`（ルート `.gitignore`）。
- `HEADLESS-CUTOVER-CHECKLIST.md` §4 に自動パリティ手順を追加（手動目視の前）。
- 検証（2026-06-12 成功）: `npm run lint` / `npm run build` / `npm run seo:cutover-check` / `npm run contact:check-env` / `npm run seo:url-parity`（本番 vs `localhost:3000`、`npm run start` 後）。候補 sitemap 425 URL、主要10パスは候補 200、タイトル差分は WARN のみ exit 0。現行 WP sitemap は本番で 404 のため WARN。

#### 変更ファイル（headless/）
- `scripts/url-parity-check.mjs`, `package.json`

#### 変更ファイル（pm/）
- `HEADLESS-CUTOVER-CHECKLIST.md`, `PROGRESS.md`

#### 残課題
- main への push・本番デプロイは未実施

---

### 2026-06-12 Headless 切替前完成度（legacy sitemap・SEO CLI・SMTPチェック）

#### 内容
- `headless/` のみ編集。WP PHP/CSS は未変更。
- `next.config.ts`: 旧 WP sitemap URL（`/wp-sitemap.xml`, `/sitemap_index.xml`, 代表子 sitemap, `/wp-sitemap-:slug`）を `/sitemap.xml` へ permanent redirect。
- `seo-cutover-check.mjs` 強化: legacy sitemap redirect、canonical/noindex、GA4、 sitemap 店舗 URL サンプル 200、件数 300 未満 WARN。
- `check-contact-env.mjs` 新規 + `npm run contact:check-env`。`.env.example` / `HEADLESS-CUTOVER-CHECKLIST.md` に追記。
- 問い合わせ: `targetUrl` は http/https 以外 400、`sourceUrl` は 2048 文字で切り詰め。

#### 変更ファイル（headless/）
- `next.config.ts`, `lib/contact-validation.ts`
- `scripts/seo-cutover-check.mjs`, `scripts/check-contact-env.mjs`
- `package.json`, `.env.example`

#### 変更ファイル（pm/）
- `HEADLESS-CUTOVER-CHECKLIST.md`, `PROGRESS.md`

#### 残課題
- 本番 SMTP 実値設定と実メール送信確認
- main への push・本番デプロイは未実施

---

### 2026-06-12 Headless [slug] 404 修正（PPR シェル 200 回避）

- `headless/app/[slug]/page.tsx`: 未知 slug は Suspense 前に `notFound()`。`generateMetadata` も同様。検証: `npm run lint` / `npm run build` / `seo:cutover-check` で 404 警告解消。

---

### 2026-06-12 Headless お問い合わせフォーム + 切替チェック整備

#### 内容
- `headless/` のみ編集。WP PHP/CSS は未変更。
- `/contact/` 固定ページ（`WpStaticPage`）内に Next 側 `ContactForm` を追加。種別・名前・メール・店舗名・対象URL・本文・同意・honeypot 対応。
- `POST /api/contact/` を追加。nodemailer 送信、バリデーション、メモリベースレート制限（同一IP 60秒5回）、`CONTACT_FORM_DRY_RUN`、本番 SMTP 未設定時 503。
- 送信成功時 GA4 `contact_form_submit` イベント。フォーム CSS を `globals.css` に追加（白・ネイビー・ゴールド）。
- 切替前チェック: `pm/HEADLESS-CUTOVER-CHECKLIST.md` 新規、`headless/scripts/seo-cutover-check.mjs` + `npm run seo:cutover-check`。
- `.env.example` に SMTP / 問い合わせ用 env を追記。`nodemailer` 依存追加。
- 検証: `npm run lint` / `npm run build` 成功。`CONTACT_FORM_DRY_RUN=true` で API 200、`seo:cutover-check` 主要URL 200・sitemap 425件・`/listing/` 308 確認。

#### 変更ファイル（headless/）
- `components/ContactForm.tsx`, `components/WpStaticPage.tsx`
- `app/api/contact/route.ts`, `app/globals.css`
- `lib/contact-validation.ts`, `lib/contact-rate-limit.ts`
- `scripts/seo-cutover-check.mjs`, `package.json`, `package-lock.json`, `.env.example`

#### 変更ファイル（pm/）
- `HEADLESS-CUTOVER-CHECKLIST.md`, `PROGRESS.md`

#### 残課題
- 本番 SMTP 設定と実メール送信確認（`CONTACT_FORM_DRY_RUN` を本番でオフ）
- main への push・本番デプロイは未実施
- Search Console への sitemap 再送信はドメイン切替後（チェックリスト参照）
- PPR 環境では存在しない URL が 200 シェルになる場合あり（404 警告は手動確認推奨）

---

### 2026-06-12 Headless SEO/URL事故防止（sitemap全件・固定ページ・listingリダイレクト）

#### 内容
- `headless/` のみ編集。WP PHP/CSS は未変更。
- sitemap: `getShopsForSitemap` / `getPostsForSitemap` を `x-wp-totalpages` ベースの順次ページングに変更（店舗382件=4ページを全件取得）。
- 固定ページ `/contact/` `/about/` `/sitemap/` `/storelisting/` `/osaka-nihonbashi/` を `app/[slug]/page.tsx` で表示。REST `content.rendered` 空時は用途別フォールバック本文+CTA。
- metadata: 固定ページに title / description / canonical / OGP を付与（canonical は `https://mens-esthe-kuchikomi.com/{slug}/`）。
- `/listing/` → `/storelisting/` へ permanent redirect。ヘッダー/フッター/トップCTA のリンクを `/storelisting/` に統一。
- GA4: `listing_click` を `/listing` と `/storelisting` の両方で判定。
- sitemap static routes に固定ページ5件を追加。固定ページ用 CSS を `globals.css` に追加。
- 検証: `npm run lint` / `npm run build` 成功。dev server で `/sitemap.xml` 200・店舗URL 382件、`/listing/` → 308 `/storelisting/`、`/contact/` `/storelisting/` 200 を確認。

#### 変更ファイル（headless/）
- `lib/wp/client.ts`, `lib/wp/shops.ts`, `lib/wp/posts.ts`, `lib/wp/pages.ts`, `lib/static-pages.ts`
- `app/[slug]/page.tsx`, `app/sitemap.ts`, `next.config.ts`, `app/globals.css`
- `components/WpStaticPage.tsx`, `GoogleAnalytics.tsx`, `SiteHeader.tsx`, `SiteFooter.tsx`, `HomePageContent.tsx`

#### 残課題
- 本番デプロイ・ドメイン切替は未実施
- Search Console への headless 用 sitemap 再送信は切替後
- contact 固定ページは WP 側本文空のため、フォーム連携（CF7等）の REST 公開は別途検討

---

### 2026-06-12 Headless SEO/GA4基盤 実装

#### 内容
- `headless/` のみ編集。WP PHP/CSS は参照のみ・未変更。
- GA4: `G-6XFMW5XKBW`（`NEXT_PUBLIC_GA_MEASUREMENT_ID` で上書き可）。`send_page_view: false` + 手動 `page_view`。pathname/searchParams 監視で SPA 遷移計測。tel・外部リンク・問い合わせ/掲載・店舗詳細のイベント委譲。
- GA4 補強: `URL(href, origin)` 正規化後の pathname で `/contact` `/listing` を判定し、同一ドメインリンクでも `contact_click` / `listing_click` を送信。
- SEO: layout + 全主要ページに canonical（末尾スラッシュ統一）、openGraph、twitter、robots。`trailingSlash: true`。
- `app/sitemap.ts` / `app/robots.ts` 追加（エリア・店舗100件・コラム100件まで）。
- JSON-LD: トップ WebSite+Organization、エリア BreadcrumbList、店舗 HealthAndBeautyBusiness。既存 FAQ JSON-LD は維持。
- `npm run lint` / `npm run build` 成功。`curl` で `/sitemap.xml` `/robots.txt` 200 確認。

#### 変更ファイル（headless/）
- `app/layout.tsx`, `app/page.tsx`, `app/sitemap.ts`, `app/robots.ts`
- `app/area/[slug]/page.tsx`, `app/shops/page.tsx`, `app/shops/[slug]/page.tsx`
- `app/column/page.tsx`, `app/column/[slug]/page.tsx`
- `components/GoogleAnalytics.tsx`, `components/AreaPageView.tsx`, `components/ShopDetail.tsx`
- `lib/seo.ts`, `lib/gtag.ts`, `lib/wp/shops.ts`, `lib/wp/posts.ts`
- `types/gtag.d.ts`, `next.config.ts`, `.env.example`

#### 残課題
- 本番デプロイ・ドメイン切替は未実施（別タスク）
- sitemap 店舗/コラムは `per_page=100` 上限（全件化は WP 件数確認後）
- Search Console への headless 用 sitemap 再送信は切替後

---

### 2026-06-12 Headless デザイン再現 追加修正

#### 内容
- フォントを Shippori Mincho + Playfair Display に変更（WP `functions.php` と同方向）。
- ヘッダー: ネイビー上線、ロゴ画像、薄い高さ。
- トップ見出し（人気エリア・新着店舗・新着コラム）: 絵文字除去、中央 + 金色短線。WP 赤線を上書き。
- 関西タイル画像（奈良・滋賀・和歌山）を WP 本番 URL に統一。
- AREA FEATURE カード PC 高さ ~280px、本文余白調整。
- `getShopBySlug`: slug 直取得失敗時に search フォールバック（`/shops/genie` 対応）。
- MAP SEARCH: iframe 非表示時用の地図風 CSS 背景を `lux-map-frame` に追加。
- MAP SEARCH: フォールバックを iframe 上に薄く重ね、中央に赤ピン追加（白紙 iframe 対策）。
- `npm run lint` / `npm run build` 成功（cacheComponents 維持）。

#### 変更ファイル（headless/）
- `app/globals.css`
- `components/SiteHeader.tsx`, `HomePageContent.tsx`, `KansaiAreaGrid.tsx`
- `lib/design-constants.ts`, `lib/wp/shops.ts`

---

### 2026-06-12 Headless デザイン再現（WPスクショ準拠）

#### 内容
- `headless/` のみ編集。WP PHP/CSS は参照のみ。
- トップ: AREA FEATURE、6分割エリアタイル、新着店舗3カラム+CTA、コラム/About、フッター（ターコイズ罫線）を実装。
- エリア: ヒーロー画像、MAP SEARCH（大阪親エリア）、導入文ボックス、SHOP LIST、ページネーション、OTHER AREAS を実装。
- 店舗詳細: OPEN/WEBバッジ、星評価、編集部Review、出勤枠（静的プレースホルダ）、AGE/PRICE/SHOP INFO/AREA LIST セクションを実装。
- フォント（Noto Serif JP）、色（#143d4d / #d4af37 / #00a4a6）、fade-in / card hover アニメーション追加。
- `npm run lint` / `npm run build` 成功（Next.js 16.2 cacheComponents 維持）。

#### 変更ファイル（headless/）
- `app/page.tsx`, `app/globals.css`, `app/area/[slug]/page.tsx`, `app/shops/[slug]/page.tsx`
- `components/HomePageContent.tsx`, `AreaFeatureSection.tsx`, `KansaiAreaGrid.tsx`, `AreaHero.tsx`, `SectionTitle.tsx`, `Pagination.tsx`, `SiteHeader.tsx`, `SiteFooter.tsx`, `ShopCard.tsx`, `ShopDetail.tsx`, `AreaPageView.tsx`
- `lib/design-constants.ts`, `lib/wp/areas.ts`

#### 残課題
- AI出勤: REST 連携後に本格実装（現状は静的プレースホルダ）
- エリアページネーション: UI のみ（API ページング未接続）
- 店舗 `shop_feature` タクソノミーの REST 分離表示

---

#### 内容
- WordPress を CMS として残し、表側を Next.js で段階的に再構築する方針で要件定義を作成。
- 現行の `front-page.php` / `taxonomy-area.php` / `single-shop.php` / `functions.php` / `ai-update-log.php` / `dashboard/` / `ai-site-monitor/` を確認し、再現対象の画面・ACF項目・API要件・SEO要件・工数・リスクを整理。
- 公式情報として WordPress REST API、Next.js ISR、WPGraphQL の前提を確認。現行 `dashboard` の `output: "export"` では ISR が使えないため、本体サイトは Node.js 実行環境を前提にする必要あり。
- Gemini にも全体分析を依頼し、API戦略、ACF公開、ルーティング、レンダリング、プレビュー、ショートコード棚卸し、AI更新ログ、ダッシュボード統合の観点を確認。シェル変数名の衝突でコマンド終了コードは1になったが、分析本文は取得できた。
- Cursor Agent 調査は2回実行したが、どちらもセッション作成直後に空出力で失敗。ローカル調査と既存資料をもとに作成。
- `docs/ai-skills.md` は見つからなかった。

#### 変更ファイル
- `pm/HEADLESS-WP-REQUIREMENTS.md`（新規）
- `pm/PROGRESS.md`

---

### 2026-06-11 Headless Phase 1 実装準備

#### 内容
- 作業ブランチ `codex/headless-phase1` を作成。
- Phase 1 実装計画 `docs/superpowers/plans/2026-06-11-headless-phase1.md` を作成。
- 方針: 既存 WordPress 本番表示は維持し、`headless/` に Next.js アプリを別建てで追加する。公開切り替えは全ページ比較・SEO確認後。
- Cursor Agent へ実装依頼を3回実行:
  - Phase 1 Task 1〜4 一括: 空出力で失敗。
  - Task 1のみ、`gpt-5.3-codex-low-fast`: 空出力で失敗。
  - `--status` / `--models` は成功し、ログインと利用可能モデルは確認済み。
- 現時点では Cursor Agent ブリッジが初期化後に実行へ進まないため、コード実装は未着手。

#### 変更ファイル
- `docs/superpowers/plans/2026-06-11-headless-phase1.md`（新規）
- `pm/PROGRESS.md`

---

### 2026-06-11 Headless Phase 1 初期実装

#### 内容
- `headless/` に Next.js App Router アプリを新規作成。
- WordPress REST API 取得層を追加し、`shop` / `area` / 通常投稿を取得できるようにした。
- トップ、エリア詳細 `/area/[slug]/`、店舗一覧 `/shops/`、店舗詳細 `/shops/[slug]/`、コラム一覧 `/column/`、コラム詳細 `/column/[slug]/` を実装。
- 既存 WordPress 本番FTPデプロイに混ざらないよう `.github/workflows/deploy.yml` の exclude に `headless/**` を追加。
- ローカル表示確認:
  - `http://localhost:3001/` 表示OK。
  - `http://localhost:3001/area/nihonbashi/` 表示OK、店舗24件取得。
  - 日本橋の店舗詳細1件（アテナ）表示OK。
  - `http://localhost:3001/column/` と記事詳細 `hello-world` 表示OK。
- `npm run lint` 成功。
- `npm run build` 成功。

#### 注意
- REST API上で ACF の全項目が返っていないため、FAQ / エリアコラム / 店舗AIサマリー等は未表示のページがある。完全再現には WordPress 側で headless 用 REST 拡張または WPGraphQL 導入が必要。
- Browser のスクリーンショット取得は CDP タイムアウトで失敗。DOMベースの表示確認は完了。

#### 変更ファイル
- `.github/workflows/deploy.yml`
- `headless/`
- `pm/PROGRESS.md`

---

### 2026-06-11 23:39 Headless デザイン再現・Next.js 16.2 キャッシュ対応

#### 内容
- Cursor Agent へ headless 側のデザイン再現とキャッシュ実装を依頼。初回は長時間停止したが、最終的に headless 側の一部編集・lint/build まで実行された。
- 既存ファイル `css/base.css` / `css/front-page.css` / `css/single.css` と `front-page.php` / `taxonomy-area.php` / `single-shop.php` を参照し、Next側のマークアップを既存クラスへ寄せた。
- トップページを `mep-homeNightLux` / `mep-hero-estama mep-hero-nightlux` / `mep-hero-glass` / `mep-feature-card` 中心の構造へ変更。
- エリアページを `area-archive-header` / `wolfman-list-container` / `shop-list-row` 中心の構造へ変更。
- 店舗詳細を `shpc-header-box` / `shpc-intro-section` / `shop-info-section` / `mod-customColor` 中心の構造へ変更。
- 本番WordPressの子テーマCSSを `headless/app/globals.css` から読み込む形に変更し、Next側で不足していたヘッダー横並び、フッター、エリアカード、No Image の補完CSSを追加。
- `next.config.ts` に `cacheComponents: true` を追加。
- WordPress取得関数に Next.js 16.2 の `"use cache"` / `cacheLife()` / `cacheTag()` を追加。
- キャッシュタグは全体 `wp`、カテゴリ `areas` / `shops` / `posts`、個別タグの3段構成にした。
- WordPress更新後にNextキャッシュを更新できるよう `/api/revalidate?tag=wp` を追加。
- 動的ページは `params` を Promise として扱い、`Suspense` 内で取得する構造に修正。同期 `params` 化による 404 と、`cacheComponents` の build エラーを解消。

#### 検証
- `npm run lint` 成功。
- `npm run build` 成功。Next.js 16.2.6 / Cache Components enabled。
- `http://localhost:3001/` 200。
- `http://localhost:3001/area/nihonbashi/` 200。
- `http://localhost:3001/shops/アテナ/` 200。
- ブラウザで主要CSS変数 `--mep-red` / `--mep-navy` / `--accent-gold` と、主要パネルの背景色・角丸・影を確認。
- `/api/revalidate?tag=wp` は `{ "ok": true, "tag": "wp" }` を返すことを確認。

#### 注意
- 親テーマSWELLのCSSすべてをNextへ移植しているわけではないため、現時点では子テーマ主要CSS + Next補完CSSでの再現。
- REST APIに出ていないACF項目は引き続き未表示。完全再現には WordPress側の headless REST 拡張または WPGraphQL が必要。

#### 変更ファイル
- `headless/app/globals.css`
- `headless/app/page.tsx`
- `headless/app/api/revalidate/route.ts`
- `headless/app/area/[slug]/page.tsx`
- `headless/app/shops/[slug]/page.tsx`
- `headless/app/column/[slug]/page.tsx`
- `headless/components/ShopCard.tsx`
- `headless/components/ShopDetail.tsx`
- `headless/lib/wp/areas.ts`
- `headless/lib/wp/shops.ts`
- `headless/lib/wp/posts.ts`
- `headless/next.config.ts`
- `headless/.env.example`
- `headless/public/no-image.svg`
- `pm/PROGRESS.md`

---

## ステータスサマリー
| 項目 | 状態 | 備考 |
|------|------|------|
| GA4実装 | ✅ 完了 | G-6XFMW5XKBW |
| Search Console | ✅ 完了 | サイトマップ送信済み |
| GitHubリポジトリ | ✅ 完了 | atmgmj7-lab/mens-esthe-kuchikomi |
| GitHub Actions | ✅ 完了 | deploy.yml作成済み |
| CLAUDE.md整理 | ✅ 完了 | スリム化・ファイル分担構成 |
| .gitignore | ✅ 完了 | |
| GitHub Secrets登録 | ✅ 完了 | FTP_HOST / FTP_USERNAME / FTP_PASSWORD / FTP_PATH（2026-05-09） |
| 自動デプロイ動作確認 | ✅ 完了 | dry-run 成功後に本番転送へ切替（2026-05-09） |
| エリア地図 iframe 化（area_map_nav ＋ taxonomy-area） | ✅ 完了 | SP でも iframe 表示（2026-04） |
| area-seo-hooks-optimized接続 | ✅ 完了 | `functions.php` で `area-seo-hooks-optimized.php` を読込 |
| 日本橋SEO／エリアページ ACF の HTML 出力 | ✅ 完了 | `taxonomy-area.php` に特性・コラム・FAQ・JSON-LD を直接出力（SWELL フック非対応分の補完）（2026-04-29） |
| REST API権限強化 | ✅ 完了 | `escomi/v1/update` は POST + `edit_posts`（2026-05-10） |
| REST API 401「Missing API key.」修正 | ⏳ 再調査中 | `functions.php` v4/v5 デプロイ済みだが本番匿名 POST は依然 `Missing API key.`（2026-05-21） |
| Gemini モデル動的選択・JSON表示バグ修正 | ✅ 完了 | `ai_auto_updater.py` + `functions.php` 修正（2026-05-16） |
| ai-site-monitor稼働確認 | ✅ 一部完了 | mens-esthe-seo-tools: 実URL4件監視（`/area/namba/` はサイトに該当ページなしのため対象外） |
| Agent Foundation（ローカル監視） | ✅ 一部完了 | `agent-foundation/` Flask + `start.sh` で Dashboard 連携起動（2026-05-21） |
| ダッシュボード 静的書き出し + GA4連携 | ✅ 完了 | `dashboard/` Next.js 16 静的書き出し。GA4プロキシ・モックUI・CIビルド設定済み（2026-05-17） |
| エリア・店舗コンテンツ（ACF） | ✅ 一部完了（日本橋 WP-CLI 投入済） | その他エリア・`area_column_content` 等は `pm/CONTENT-IMPLEMENTATION-GUIDE.md` |
| 日本橋59店舗 `shop_ai_summary` JSON 投入 | ⏳ 待機 | JSON 未配置。配置後: `python3 tools/import_shop_ai_summaries.py`（`content/nihonbashi_shop_summaries.json` または引数でパス指定） |
| 店舗AI自動更新（全店舗） | ✅ パイロット完了 | `escomi/v1/update` 疎通確認済み（401→認証 OK）。手動1件実行 OK（2026-05-14）。詳細 `SHOP-AI-ROLLOUT.md` |

#### ブロッカー
- （自動デプロイ系）FTP Secrets 未登録は解除済み。REST `escomi/v1/update` は権限チェック済み（2026-05-10）
- **本番 REST `Missing API key.` 再発**: ローカルに該当文字列なし → サーバー側 `mu-plugins/proxy-app-passwords.php` 再生成、OPcache、または `rest_pre_dispatch` 経路の切り分けが必要。確認: `GET /wp-json/escomi/v1/debug`（`deployed: v5` か）
- `.htaccess` Authorization ヘッダー転送: サーバー直接作業が必要。Xserver ファイルマネージャーで `/public_html/.htaccess` 先頭付近（`# BEGIN WordPress` の上）に `SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1` を追加する。

#### 次のアクション
- [x] FTP Secrets 登録・自動デプロイ疎通（dry-run → 本番転送）（2026-05-09）
- [x] デプロイ後 `/area/osaka/` で `lux-map-iframe` の表示確認（curl）
- [x] REST API 401「Missing API key.」解消（2026-05-15）
- [x] Gemini モデル自動選択・JSON 生表示バグ修正（2026-05-16）
- [ ] `.htaccess` Authorization ヘッダー設定（Xserver ファイルマネージャーで手動）
- [ ] 日本橋エリア SEO ギャップ埋め（`area_column_content` 等・競合対策）
- [x] 店舗 AI 自動更新パイロット（`daily_shop_update.yml` 1件実行成功・`escomi/v1/update` 疎通確認 2026-05-14）
- [ ] SEOツールをRenderにデプロイ
- [ ] 本番 `Missing API key.` 解消（`/escomi/v1/debug` → mu-plugins 確認 → 認証付き POST 再テスト）

### 2026-05-21 REST API 再調査 + Agent Foundation ローカル起動

#### 内容
- **REST 401 再調査**: デプロイ後も `POST /wp-json/escomi/v1/update`（認証なし）が `rest_forbidden` + `Missing API key.` のまま。OPcache 単独説は不十分。`functions.php` では `rest_authentication_errors` と `rest_pre_dispatch` の両方で遮断、`init` で `proxy-app-passwords.php` 自動削除、`GET /escomi/v1/debug`（v5・OPcache reset）を実装済み。
- **Agent Foundation**: `agent-foundation/`（Flask 監視 UI・Obsidian エクスポート・WP/GA モック連携）と `start.sh`（Dashboard + Agent Foundation 一括起動）を追加。
- **作業メモ**: 別チャット相談用に調査ログを整理済み。

#### 変更ファイル
- `agent-foundation/`（新規）
- `start.sh`（新規）
- `pm/PROGRESS.md`

---

### 2026-05-10 店舗AI自動更新: SQLite キャッシュ・REST 認可・異常終了

#### 内容
- **GitHub Actions**（`daily_shop_update.yml`）: `actions/cache@v4` で `ai-site-monitor/escomi_crawler.db` を保存・復元。キー `${{ runner.os }}-escomi-db-${{ github.run_id }}` + `restore-keys: ${{ runner.os }}-escomi-db-` で直近キャッシュ継承。
- **REST**（`ai-update-log.php`）: `permission_callback` を `current_user_can('edit_posts')` に変更。メソッドは POST のみ。
- **Python**（`ai_auto_updater.py`）: `/update` は既存どおり Basic 認証（`requests` の `auth=`）。ループ終了時に WP 更新の成功／失敗件数を出力し、成功 0・失敗ありのときは `sys.exit(1)`。

#### 変更ファイル
- `.github/workflows/daily_shop_update.yml`
- `ai-update-log.php`
- `ai-site-monitor/ai_auto_updater.py`
- `pm/BLOCKER.md` / `pm/PROGRESS.md`

---

### 2026-05-09 GitHub Actions 自動デプロイ（本番化）

#### 内容
- Repository secrets（`FTP_HOST` / `FTP_USERNAME` / `FTP_PASSWORD` / `FTP_PATH`）を用いた `SamKirkland/FTP-Deploy-Action@v4.3.4` によるデプロイを構築済み。
- **exclude**: `.git` / `.github` / `*.md` / `pm/` / `ai-site-monitor/` / `tools/` / `content/` / インポート用 PHP・CSV・秘密系パターン等を転送対象外に設定。
- **検証**: `dry-run: true` で GitHub Actions 上のテストデプロイがエラーなし完了 → `dry-run` をコメントアウトし **本番ファイル転送を有効化**。
- **トリガー**: `main` への push および `workflow_dispatch`。
- **SEO／テンプレ整合**: `area_characteristics` の二重表示を解消し本文は `taxonomy-area.php` に一本化済み。メタディスクリプションは Yoast／Rank Math 未入力時に ACF から自動要約を供給。コラム・FAQ は `taxonomy-area.php` のみ出力（`swell_after_post_list` 側の重複を除去）。

#### 変更ファイル（当ログ対応コミット時）
- `.github/workflows/deploy.yml`
- `pm/PROGRESS.md`

---

### 2026-04-05 06:01
#### コミット
test: auto log hook動作確認

#### 変更ファイル
.DS_Store
---

### 2026-04-05 06:54
#### コミット
test: 自動デプロイ動作確認

#### 変更ファイル

---

### 2026-04-05 07:04
#### コミット
fix: correct deploy.yml secret variable names

#### 変更ファイル
.DS_Store
.github/workflows/deploy.yml
pm/PROGRESS.md
---

### 2026-04-05 エリア地図 iframe 化
#### コミット
fix: replace img with iframe in area map nav

#### 変更内容
- `functions.php` の `area_map_nav`: 6エリア Google Maps embed URL、`lux-map-bg`（img）を `lux-map-iframe`（iframe）に変更
- `taxonomy-area.php`: 親エリアの地図を同じ6 URL・同じ iframe マークアップに統一
- `css/single.css`: `.lux-map-frame iframe.lux-map-iframe` を追加（画像用の回転・ブレンドは iframe では無効化）

#### 確認メモ
- 本番を `curl` で取得した時点（このコミットのデプロイ前）: 旧 `<img class="lux-map-bg">` のHTMLのまま
- **大阪（親）** `/area/osaka/`: デプロイ後、PC表示（`u-pc-only`）で iframe が出る想定
- **日本橋（子）** `/area/nihonbashi/` 等: `taxonomy-area.php` は `is_parent_area` のときだけ地図セクションを出すため、**子エリアには地図＋ピンは表示されない**（店舗一覧アーカイブ）。ピン重ねは親エリアページのみ

#### デプロイ後確認（2026-04-05、本番 HTML を curl で取得）
- `/area/osaka/`: `class="lux-map-iframe"` の iframe が出力されていることを確認
- `/area/nihonbashi/`: `MAP SEARCH` / `lux-map-frame` は含まれず（子エリアは地図ブロック非表示で仕様どおり）

---

### 2026-04-05 07:22
#### コミット
docs: dedupe PROGRESS log entries

Made-with: Cursor

#### 変更ファイル
pm/PROGRESS.md
---

## 2026-04-06

### 完了タスク
- area_map_nav iframeに変更（functions.php・taxonomy-area.php・css/single.css）
- MCP設定完了（fetch/filesystem/github）
- ai_auto_updater.pyのバグ修正（result.appendインデント修正）
- REST API疎通確認（`/wp-json/escomi/v1/update` が匿名 POST で 401、`edit_posts` 付きユーザーで認証済み POST が貫通するか）
- ai-site-monitorをmens-esthe-seo-toolsリポジトリに移行
- daily_cron.yml稼働確認（GitHub Actions成功）
- sites.jsonをダミー1000件→実URLに差し替え（のち実URL4件に整理。namba は当該URLなしのため除外）
- FTPデプロイ復旧（FTP_USERNAMEをescomi@mens-esthe-kuchikomi.comに修正）
- `functions.php` で `area-seo-hooks-optimized.php` を読込（BLOCK-003 解除）

### 次回優先タスク
- daily_cron（4URL）の定期実行確認（`total_sites` と `sites.json` の一致）
- ✅ 日本橋エリア ACF：`area_characteristics` / FAQ（term meta） / `area_ranking_shops`（59店）を本番 WP-CLI で反映（2026-04-29）
- ai_auto_updater.pyの本番テスト実行

---

### 2026-04-06 04:25
#### コミット
docs: update progress log 2026-04-06

Made-with: Cursor

#### 変更ファイル
pm/PROGRESS.md
---

## 2026-04-07 優先タスクフォロー（1→2→3）

### 1. daily_cron（5URL）実行結果確認 — 実施済み
- **Actions**: `Daily Site Monitor` を `workflow_dispatch` で実行（run 成功・約48秒）。
- **成果物**: `mens-esthe-seo-tools` の `ai-site-monitor/results/changes_20260405_192907.json`
  - `total_sites`: **5**
  - `changed_count`: 0（初回ベースライン／変更なし）
- **`data/hashes.json`**: 当時 **4 URL**（`/area/namba/` はサイト側にページが無く取得できないため **`sites.json` から除外**し、致命度はなし）。

### 2. 日本橋エリア ACF — 投入済み（WP-CLI）（2026-04-29）
- **対象ターム**: `tag_ID=7`（slug `nihonbashi`）
- **反映済みメタ**: `area_characteristics`、FAQ 配列 `area_faq_content`（7件、`get_field()` 確認済）、子ターム側 `area_ranking_shops`（59 IDs・`_area_ranking_shops`= `field_6984c71ca23e5`）
- **補足**: `_area_faq_content` がリレーション用フィールドキーを指すと `get_field()` が投稿オブジェクト側に寄るため、この投入では削除し Q&A 配列のみ保持する形にしている。親エリアの「厳選」表示はコード上 `area_ranking_pickup` や親のランキングを参照する。**未入力**: `area_column_content`。

### 3. ai_auto_updater.py 本番テスト — 手順のみ（未実行）
- **前提**: `ai-site-monitor/.env` に `WP_SITE_URL`, `WP_USER`, `WP_APP_PASSWORD`, `GEMINI_API_KEY`。Playwright の `chromium` インストール済み。
- **コマンド**（リポジトリ: `mens-esthe-seo-tools/ai-site-monitor/` または `swell_child/ai-site-monitor/`）:
  - `pip install -r requirements.txt && playwright install chromium`
  - `python ai_auto_updater.py`
- スクリプトは **CRAWL_LIMIT=3** のテスト仕様。本番で店舗メタ更新できるか WP 側で確認。

---

### 2026-04-07 進行メモ
#### 内容
優先タスク1の検証（workflow 手動実行・total_sites:5・hashes 4件の記録）。タスク2・3は手順整理。

#### 変更ファイル
pm/PROGRESS.md
---

### 追記（namba 除外）
- 本サイトに `/area/namba/` 相当ページが無いため、**監視対象から削除**して問題なし（致命ではない）。
- `mens-esthe-seo-tools/ai-site-monitor/sites.json` は **実URL4件**に更新。

### RUNBOOK A-4 再実行（エージェント・Cursor）
- `git pull` → `gh workflow run "Daily Site Monitor" --ref main` → `gh run watch` まで実施。
- **GitHub Actions run ID:** `24009000520`（成功・約1分10秒）。
- **検証:** `total_sites` **4** = `sites.json` の URL 数 **4** = `data/hashes.json` のキー数 **4**（一致）。
- **成果物:** `ai-site-monitor/results/changes_20260405_194233.json`（`changed_count`: 0）。

### RUNBOOK A-4 ステップ実装（番号手順・最新）
- **A-4.1〜A-4.7** を `pm/RUNBOOK.md` に表形式で追記済み。合格条件3項目を明記。
- **実行 run ID:** `24009070604`（成功・約48秒）。
- **検証:** URL 数 4 = hashes 4 = `total_sites` 4 → **合格**。
- **成果物:** `changes_20260405_194610.json`（`changed_count`: 0）。

---

### 2026-04-06 04:29
#### コミット
docs: log daily_cron 5-URL verification and task 2-3 follow-up

Made-with: Cursor

#### 変更ファイル
pm/PROGRESS.md
---

### 2026-04-06 04:37
#### コミット
docs: note namba URL removed from monitor list

Made-with: Cursor

#### 変更ファイル
pm/PROGRESS.md
---

### 2026-04-06 04:39
#### コミット
docs: add RUNBOOK for agent-executable ops and clarify manual boundary

Made-with: Cursor

#### 変更ファイル
CLAUDE.md
pm/ARCHITECTURE.md
pm/PROGRESS.md
pm/RUNBOOK.md
---

### 2026-04-06 04:43
#### コミット
docs: log RUNBOOK A-4 Daily Site Monitor run (total_sites 4)

Made-with: Cursor

#### 変更ファイル
pm/PROGRESS.md
---

### 2026-04-06 04:46
#### コミット
docs: RUNBOOK A-4 step table + log latest Daily Site Monitor run

Made-with: Cursor

#### 変更ファイル
pm/PROGRESS.md
pm/RUNBOOK.md
---

### 2026-04-05
#### コミット
feat(seo): load area-seo-hooks-optimized; chore: deploy, map CSS, updater, BLOCKER

Made-with: Cursor

#### 変更内容
- `functions.php`: `area-seo-hooks-optimized.php` を require（旧 `area-seo-hooks.php` は未読込）
- `.gitignore`: `ai-site-monitor/venv/` 等を追加
- `pm/BLOCKER.md`: BLOCK-002/003 を解除済みに移動
- その他: `deploy.yml`, `ai_auto_updater.py`, `css/single.css`, `taxonomy-area.php`（先行差分のまとめ）

#### 変更ファイル
.github/workflows/deploy.yml
.gitignore
ai-site-monitor/ai_auto_updater.py
css/single.css
functions.php
pm/BLOCKER.md
pm/PROGRESS.md
taxonomy-area.php
---

### 2026-04-06 店舗AI全店舗展開（CLI・ドキュメント）
#### コミット
feat(ai): crawl limit --all/--limit, SHOP_DELAY_SECONDS, SHOP-AI-ROLLOUT doc

#### 変更内容
- `ai_auto_updater.py`: `--all`, `--limit N`, `CRAWL_LIMIT=all`, `SHOP_DELAY_SECONDS`
- `pm/SHOP-AI-ROLLOUT.md`: フェーズ表・AI/手動分担・実行例
- `ai-site-monitor/README.md` / `.env.example` 更新、`CONTENT-IMPLEMENTATION-GUIDE.md` 追記、`CLAUDE.md` 読む順追加

#### 変更ファイル
ai-site-monitor/ai_auto_updater.py
ai-site-monitor/README.md
ai-site-monitor/.env.example
pm/SHOP-AI-ROLLOUT.md
pm/CONTENT-IMPLEMENTATION-GUIDE.md
pm/PROGRESS.md
CLAUDE.md
---

### 2026-04-06 コンテンツ実装指示書
#### コミット
docs: add CONTENT-IMPLEMENTATION-GUIDE for area and shop pages

#### 変更内容
- `pm/CONTENT-IMPLEMENTATION-GUIDE.md` 新設（エリア ACF・店舗手動/AI 分担・チェックリスト）
- `pm/ARCHITECTURE.md` の optimized 接続状況を更新、`CLAUDE.md` に読む順へ追記

#### 変更ファイル
pm/CONTENT-IMPLEMENTATION-GUIDE.md
pm/ARCHITECTURE.md
CLAUDE.md
pm/PROGRESS.md
---

### 2026-04-06 MAP SEARCH 見出しを SP で確実に表示
#### コミット
fix(css): reset area-map full-bleed on mobile so MAP SEARCH + map are visible

#### 変更内容
- 768px 以下で `body.tax-area .area-map-section` の `100vw` / 負マージンを解除（親 overflow で欠ける対策）
- ショートコードのフルブリードも同様に SP でリセット
- `.lux-heading` を `display:block` / `z-index` で明示

#### 変更ファイル
css/single.css
pm/PROGRESS.md
---

### 2026-04-06 地図 iframe を SP 表示
#### コミット
fix(area-map): show Google map iframe on mobile

#### 変更内容
- `taxonomy-area.php`: `wp_is_mobile()` 条件と `u-pc-only` を外し、親エリアで地図を SP でも出力
- `single.css`: 768px 以下で `.lux-map-section` を非表示にしていたルールを削除

#### 変更ファイル
taxonomy-area.php
css/single.css
pm/PROGRESS.md
---

### 2026-04-06 地名ピンと iframe の重なり
#### コミット
fix(css): hide legacy lux-pin overlays when Google map iframe is present

#### 変更内容
- `.lux-map-frame` 内に `.lux-map-iframe` があるとき、旧静止画用の **`.lux-pin`（地名タブ）を非表示**（Google 地図と重なる二重表示の解消）
- iframe に `z-index: 1` を付与

#### 変更ファイル
css/single.css
pm/PROGRESS.md
---

### 2026-04-06 u-pc-only グリッド修正
#### コミット
fix(css): u-pc-only use block instead of grid to avoid narrow map layout

#### 変更内容
- `.u-pc-only` の `display: grid` を `block` に変更（地図 `section` がグリッド1カラム化して細長く見える問題）
- `.es-area-grid.u-pc-only` は `flex` を明示してエリアチップ一覧を維持

#### 変更ファイル
css/single.css
pm/PROGRESS.md
---

### 2026-04-05 地図枠・埋め込み調整
#### コミット
fix(area-map): widen layout, coord+zoom embed, optional area list in shortcode

Made-with: Cursor

#### 変更内容
- 親エリア地図 URL を府県名クエリから **都市中心座標＋ z=11** に変更（表示範囲を絞る。ラベル完全消去は embed では不可）
- `body.tax-area` の **inner 最大幅 1400px**、地図ブロック **100vw フルブリード**
- `.lux-map-frame` を **2:1・min-height 大** で枠を広げる
- `[area_map_nav]` の **AREA LIST は既定非表示**（`list="1"` で表示）

#### 変更ファイル
css/single.css
functions.php
taxonomy-area.php
pm/PROGRESS.md
---

### 2026-04-06 04:48
#### コミット
feat(seo): load area-seo-hooks-optimized; chore: deploy, map, updater, docs

Made-with: Cursor

#### 変更ファイル
.github/workflows/deploy.yml
.gitignore
ai-site-monitor/ai_auto_updater.py
css/single.css
functions.php
pm/BLOCKER.md
pm/PROGRESS.md
taxonomy-area.php
---

### 2026-04-06 04:59
#### コミット
fix(area-map): widen layout, coord+zoom embed, optional shortcode list

Made-with: Cursor

#### 変更ファイル
css/single.css
functions.php
pm/PROGRESS.md
taxonomy-area.php
---

### 2026-04-06 05:06
#### コミット
fix(css): u-pc-only use block instead of grid to avoid narrow map layout

Made-with: Cursor

#### 変更ファイル
css/single.css
---

### 2026-04-06 05:06
#### コミット
docs: log u-pc-only grid fix in PROGRESS

Made-with: Cursor

#### 変更ファイル
pm/PROGRESS.md
---

### 2026-04-06 05:08
#### コミット
fix(css): hide legacy lux-pin overlays when Google map iframe is present

Made-with: Cursor

#### 変更ファイル
css/single.css
---

### 2026-04-06 05:08
#### コミット
docs: log lux-pin iframe overlap fix

Made-with: Cursor

#### 変更ファイル
pm/PROGRESS.md
---

### 2026-04-06 05:21
#### コミット
fix(area-map): show Google map iframe on mobile

Made-with: Cursor

#### 変更ファイル
css/single.css
pm/PROGRESS.md
taxonomy-area.php
---

### 2026-04-06 05:36
#### コミット
fix(css): reset area-map full-bleed on mobile for MAP SEARCH visibility

Made-with: Cursor

#### 変更ファイル
css/single.css
pm/PROGRESS.md
---

### 2026-04-06 05:38
#### コミット
docs: add CONTENT-IMPLEMENTATION-GUIDE for area and shop WP content

Made-with: Cursor

#### 変更ファイル
CLAUDE.md
pm/ARCHITECTURE.md
pm/CONTENT-IMPLEMENTATION-GUIDE.md
pm/PROGRESS.md
---

### 2026-04-06 05:42
#### コミット
feat(ai): shop auto-updater --all/--limit, rollout doc and env hints

Made-with: Cursor

#### 変更ファイル
CLAUDE.md
ai-site-monitor/.env.example
ai-site-monitor/README.md
ai-site-monitor/ai_auto_updater.py
pm/CONTENT-IMPLEMENTATION-GUIDE.md
pm/PROGRESS.md
pm/SHOP-AI-ROLLOUT.md
---

### 2026-04-16
#### コミット
fix(css): 店舗「最新ニュース・動向」リストのレスポンシブ（コンテナクエリ＋任意メモ列）

#### 変更内容
- `css/single.css`: `.ai-intel-news-list` に `container-type`、狭い幅で行を縦積み。本文・メモに `min-width:0` と `overflow-wrap` で1文字縦積み回避
- `single-shop.php`: ACF リピーターで `memo` / `note` / `status` 等があれば第3列 `.ai-intel-news-meta` として表示

#### 変更ファイル
single-shop.php
css/single.css
pm/PROGRESS.md
---
