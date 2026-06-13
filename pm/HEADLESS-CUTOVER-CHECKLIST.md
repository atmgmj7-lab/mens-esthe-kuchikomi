# Headless 本番切替チェックリスト

WordPress テーマ表示から Next.js headless 表示へ切り替える**前後**に実行する手順です。  
専門用語は少なめに書いています。上から順に進めてください。

---

## 事前準備（切替の数日前）

### 0. GitHub Actions（Vercel 自動デプロイ）の設定

`main` へ `headless/` 配下の変更が push されると、`.github/workflows/deploy-headless.yml` が Vercel 本番（プロジェクト `escomi-headless`）へデプロイします。手動実行は Actions タブ → **Deploy Headless to Vercel** → **Run workflow** でも可能です。

**Repository secrets（必須）**

| 名前 | 内容 |
|------|------|
| `VERCEL_TOKEN` | Vercel アカウントの Deploy 用トークン（[Account Tokens](https://vercel.com/account/tokens) で発行） |

**Repository variables または secrets（いずれか一方に登録。variables 推奨）**

| 名前 | 値（escomi-headless 用） |
|------|--------------------------|
| `VERCEL_ORG_ID` | `team_WBpmGGwLZPtutzOCsGN2lluQ` |
| `VERCEL_PROJECT_ID` | `prj_lgQwu8WqzjHvKLEGAGBh4Xyq38b8` |
| `VERCEL_SCOPE`（任意） | `narikiyos-projects`（未設定時は workflow が同値を使用） |

未設定の場合、workflow は日本語エラーで停止します（`VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID`）。

**workflow の流れ（概要）**

1. `headless/` で Node 24 → `npm ci` → `npm run lint`
2. Vercel CLI: プロジェクト link → `vercel pull --environment=production --scope …`（`.env.local` 生成）
3. `npm run build`（pull 済み env で本番ビルド検証）→ `npm run contact:check-env`（SMTP 等）
4. `vercel build --prod` → `vercel deploy --prebuilt --prod`（デプロイ URL は CLI 出力の最後の https を使用）
5. 返却されたデプロイ URL に対して `npm run seo:cutover-check`

**注意**

- アプリの環境変数（`NEXT_PUBLIC_WP_BASE_URL` 等）は **Vercel ダッシュボード**側に登録済みであること。GitHub には載せない。
- `.env` / `.vercel` はリポジトリに含めない（gitignore 済み）。
- **DNS 切替（`mens-esthe-kuchikomi.com` を Vercel の A レコード `76.76.21.21` へ向ける）は手動。** 本 workflow は Vercel へのデプロイと SEO チェックまで。ドメイン切替後は §8 の本番 URL チェックを再度実行する。

従来の Xserver 向け `deploy.yml`（SWELL 子テーマ FTP）は変更せず、引き続き `main` push で WP のみデプロイされます。

**`VERCEL_TOKEN` 失効時の復旧（詳細手順）**

1. Vercel **Account Settings → Tokens** で新トークン発行（例: `github-actions-escomi`）
2. GitHub **Settings → Secrets and variables → Actions → Repository secrets → `VERCEL_TOKEN`** を更新（**Project Environment Variables ではない**）
3. Actions → **Deploy Headless to Vercel** → 失敗 Run の **Re-run jobs** または **Run workflow**
4. 成功後: §8 相当の URL 確認（日本橋ハブ page=1/2/3）

運用の正本: `pm/RUNBOOK.md` **A-6**

---

### 1. 環境変数の確認

headless 本番環境に以下が入っているか確認します。

| 変数名 | 用途 |
|--------|------|
| `NEXT_PUBLIC_WP_BASE_URL` | 公開サイトの canonical ドメイン（既定: `https://mens-esthe-kuchikomi.com`） |
| `WP_API_BASE_URL` | サーバー側 WP REST API の接続先（既定: `http://85.131.213.108/wp-json`） |
| `WP_ORIGIN_HOST` | Xserver origin へ IP 直アクセス時に付与する `Host` ヘッダー（既定: `mens-esthe-kuchikomi.com`） |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4（`G-6XFMW5XKBW`） |
| `REVALIDATE_SECRET` | キャッシュ再検証 |
| `SMTP_HOST` など SMTP 一式 | お問い合わせメール送信 |
| `CONTACT_FROM_EMAIL` / `CONTACT_TO_EMAIL` | 送信元・宛先 |
| `CONTACT_FORM_DRY_RUN` | **本番では `false` または未設定**（`true` だとメールは送られません） |

**DNS 切替後の WP 接続（実装済み）**

- A レコードを Vercel に向けたあとも、Next.js は **Xserver origin（`85.131.213.108`）** へサーバー fetch し、`Host: mens-esthe-kuchikomi.com` を付けて WP REST API を取得します。
- ブラウザ向けの `/wp-content/*` と `/wp-json/*` は Next の Route Handler 経由で同じ origin へプロキシします（画像・テーマ CSS・必要時の REST 呼び出し）。
- 画面表示用の画像/CSS は `/wp-content/...` の同一ドメイン相対 URL に寄せています。

SMTP 設定の自動確認:

```bash
cd headless
npm run contact:check-env
```

`.env` と `.env.local` の両方を読み込み（後者が前者を上書き）。CI では `vercel pull` 後の `.env.local` も対象。  
未設定の変数があると exit 1。プレースホルダのままや `CONTACT_FORM_DRY_RUN=true` は WARN（exit 0）。

### 2. ビルド確認（ローカル or CI）

```bash
cd headless
npm run lint
npm run build
```

エラーが出ないことを確認します。

---

## 切替当日（DNS / ホスティング切替前）

### 3. ステージング URL で自動チェック

プレビュー URL またはローカル本番ビルド（`npm run build && npm run start`）に対して:

```bash
cd headless
npm run seo:cutover-check -- https://<プレビューまたは検証用URL>
```

ローカルの場合:

```bash
npm run seo:cutover-check -- http://localhost:3000
```

**確認される項目:**

- 主要ページが 200 で返ること（`/`, `/shops/`, `/column/`, `/contact/`, `/storelisting/`, `/about/`, `/sitemap/`, `/osaka-nihonbashi/`, `/area/osaka/`, `/area/nihonbashi/`）
- `/listing/` が `/storelisting/` へリダイレクトされること
- 旧 WP 用 `/wp-sitemap.xml` と `/sitemap_index.xml` が `/sitemap.xml` へリダイレクトされること
- 主要ページ HTML に canonical があり、`noindex` がないこと
- トップページ HTML に GA4（`G-6XFMW5XKBW` または gtag/js）があること
- `/robots.txt` が 200 で、`Sitemap:` 行があること
- `/sitemap.xml` が 200 で、店舗 URL が十分な件数含まれること（目安: 300件以上）
- sitemap 内の店舗 URL サンプル（最大5件）が 200 で返ること
- 存在しない URL が 404 になること

### 4. URL パリティ自動チェック（旧 WP と新 Next）

切替前に、現行 WordPress と候補 Next の URL・メタデータ・sitemap を自動比較します。**手動目視の前に**実行してください。

```bash
cd headless
npm run seo:url-parity -- \
  --current https://mens-esthe-kuchikomi.com \
  --candidate http://localhost:3000
```

ローカル候補を使う場合は、先に本番ビルドを起動します。

```bash
cd headless
npm run build && npm run start
# 別ターミナルで
npm run seo:url-parity -- \
  --current https://mens-esthe-kuchikomi.com \
  --candidate http://localhost:3000 \
  --sample-shops 20 \
  --output reports/url-parity-local.json
```

プレビュー URL（Vercel 等）を候補にする場合:

```bash
npm run seo:url-parity -- \
  --current https://mens-esthe-kuchikomi.com \
  --candidate https://<プレビューまたは検証用URL> \
  --output reports/url-parity-preview.json
```

**確認される項目:**

- 主要パス・エリア・固定ページ・店舗サンプル（既定20件）の HTTP ステータス比較
- 現行 200 に対し候補が 200 / 301 / 308 であること
- 候補 200 の HTML に canonical があり、`noindex` がないこと
- 現行 sitemap に含まれる検査対象パスが候補 sitemap にも含まれること
- `/sitemap.xml` と `/wp-sitemap.xml`（インデックス再帰含む）から URL 一覧を取得

**警告（exit 0）:** タイトル不一致、店舗の未サンプル件数、現行 sitemap 取得失敗など。

レポート JSON は `headless/reports/` 配下（gitignore 済み）。

### 5. URL 比較（旧 WP と新 Next）— 手動目視

自動チェックのあと、ブラウザで次のページを**旧サイト（現行 WP）**と**新サイト（headless）**の両方で開き、大きな差がないか目視します。

| ページ | 旧 URL 例 | 新 URL（同じパス） |
|--------|-----------|-------------------|
| トップ | `/` | `/` |
| 店舗一覧 | `/shops/` | `/shops/` |
| コラム | `/column/` | `/column/` |
| お問い合わせ | `/contact/` | `/contact/`（フォーム表示） |
| 掲載について | `/storelisting/` | `/storelisting/` |
| 運営者情報 | `/about/` | `/about/` |
| 日本橋ガイド | `/osaka-nihonbashi/` | `/osaka-nihonbashi/` |
| 大阪エリア | `/area/osaka/` | `/area/osaka/` |
| 日本橋エリア | `/area/nihonbashi/` | `/area/nihonbashi/` |
| 店舗詳細（数件） | `/shops/<slug>/` | 同じ slug で 200 |
| 旧掲載リンク | `/listing/` | `/storelisting/` へ飛ぶ |

**見るポイント:** タイトル・見出し・店舗数・リンク切れ・画像の有無。

### 6. お問い合わせフォームの動作確認

```bash
cd headless
npm run contact:check-env
```

SMTP 未設定時は exit 1。本番前にすべて OK にしてください。

```bash
# DRY_RUN 時（ローカル）
curl -s -X POST http://localhost:3000/api/contact/ \
  -H "Content-Type: application/json" \
  -d '{"type":"一般問い合わせ","name":"テスト","email":"test@example.com","message":"テスト送信","consent":true,"sourceUrl":"http://localhost:3000/contact/"}'
```

- `{"ok":true,...}` が返ること
- `/contact/` ページでフォームが表示され、送信後に完了メッセージが出ること
- 本番前に SMTP を設定し、テストメールが届くこと（`CONTACT_FORM_DRY_RUN` をオフにして確認）

### 7. GA4 の確認

1. ブラウザの開発者ツール → Network で `google-analytics.com` または `googletagmanager.com` へのリクエストがあるか
2. `/contact/` でフォーム送信後、`contact_form_submit` イベントが送られるか（GA4 DebugView 推奨）
3. 電話リンク・外部リンク・店舗詳細の既存イベントが壊れていないか

---

## 切替直後（DNS 反映後すぐ）

### 8. 本番 URL で再チェック

```bash
npm run seo:cutover-check -- https://mens-esthe-kuchikomi.com
```

失敗（✗）がゼロになるまで対応します。

### 9. robots / sitemap の再確認

- https://mens-esthe-kuchikomi.com/robots.txt  
  - `User-agent: *` と `Sitemap: https://mens-esthe-kuchikomi.com/sitemap.xml` があるか
- https://mens-esthe-kuchikomi.com/sitemap.xml  
  - 店舗・エリア・固定ページが含まれているか（件数メモを残す）

### 10. Google Search Console

1. [Search Console](https://search.google.com/search-console) でプロパティ `mens-esthe-kuchikomi.com` を開く
2. **サイトマップ** → **新しいサイトマップの追加**
3. `sitemap.xml` を送信（フル URL: `https://mens-esthe-kuchikomi.com/sitemap.xml`）
4. 数時間後、ステータスが「成功」になっているか確認
5. 旧 WP 用に別 sitemap を送っていた場合は、重複やエラーがないか確認

### 11. 404 の確認

Search Console の **ページ** → **インデックス作成** で、切替後に 404 が急増していないか見ます。  
あわせて、よく使う内部リンク（ヘッダー・フッター・トップ CTA）をクリックして 404 が出ないか確認します。

---

## 切替後 24〜72 時間

### 12. 検索・トラフィックの定点観測

| 確認項目 | どこで見るか | メモ |
|----------|--------------|------|
| インデックス状況 | Search Console → ページ | エラー増加なし |
| クリック・表示 | Search Console → 検索パフォーマンス | 急落がないか |
| リアルタイムアクセス | GA4 → リアルタイム | ページビューが記録されているか |
| 主要クエリの表示 | Search Console | 「日本橋 メンズエステ」など |

### 13. お問い合わせの本番確認

- 本番 `/contact/` からテスト送信し、メールが `CONTACT_TO_EMAIL` に届くか
- SMTP 未設定時は 503 になる設計のため、届かない場合は環境変数を再確認

### 14. キャッシュ・再検証

1. **初回（本番・手動）:** `wp-config.php` に `define('ESCOMI_REVALIDATE_SECRET', '…');` を追加（Vercel `REVALIDATE_SECRET` と同値）。任意で `ESCOMI_HEADLESS_REVALIDATE_URL`（例: `https://mens-esthe-kuchikomi.com/api/revalidate/`）。
2. 子テーマ `functions.php`（`escomi_headless_*`）が FTP 反映済みであること。
3. WP で店舗・投稿・エリアを 1 件更新 → 本番 Headless の表示が追従するか確認。
4. API 直接確認: `pm/RUNBOOK.md` **A-5** の curl（`?tag=wp` または `POST /api/revalidate/` + `x-revalidate-secret`）。

自動通知は 20 秒 throttle。autosave / revision は除外。

---

## 問題が出たとき

| 症状 | まず確認すること |
|------|------------------|
| 店舗ページが 404 | WP REST API・slug・`getShopBySlug` |
| sitemap 件数が少ない | WP `x-wp-totalpages`・API 認証 |
| お問い合わせが送れない | SMTP 環境変数・`CONTACT_FORM_DRY_RUN` |
| GA4 が動かない | `NEXT_PUBLIC_GA_MEASUREMENT_ID`・広告ブロッカー |
| 旧 `/listing/` が 404 | `next.config.ts` の redirect 設定 |

---

## 関連ファイル

- Vercel 自動デプロイ: `.github/workflows/deploy-headless.yml`
- 単体サイト自動チェック: `headless/scripts/seo-cutover-check.mjs`（`npm run seo:cutover-check`）
- URL パリティ比較（WP vs Next）: `headless/scripts/url-parity-check.mjs`（`npm run seo:url-parity`）
- SMTP 環境変数チェック: `headless/scripts/check-contact-env.mjs`（`npm run contact:check-env`）
- 進行ログ: `pm/PROGRESS.md`
- 運用手順: `pm/RUNBOOK.md`
- 要件: `pm/HEADLESS-WP-REQUIREMENTS.md`
