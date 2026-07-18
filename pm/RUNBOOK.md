# 運用 Runbook（実行手順）

**目的:** 手順を迷わず再現する。Claude Code / Cursor のエージェントは、**ここに書いたコマンドをそのまま実行**し、**「手動のみ」と明記した項目以外**は人に任せない。

---

## 方針: ダッシュボードは Vercel / Next.js 側に統合

`/dashboard/` は Xserver や WordPress テーマ配下ではなく、`headless` の Next.js アプリとして Vercel から配信する。  
同じ本番ドメイン `https://mens-esthe-kuchikomi.com/dashboard/` で開くが、実体は Vercel 側なので、管理画面UIの改修は `headless/app/dashboard` と `headless/components/AnalyticsDashboard.tsx` を変更する。

別アプリとして `dashboard/` を Vercel / Cloudflare Pages に分けるのは、ドメイン切替・認証・環境変数・デプロイ経路が増えるため、現時点では標準にしない。独立運用が必要になった場合だけ別ワークフローを有効化する。

### Dashboard 本番反映

```bash
cd /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi
git add headless
git commit -m "feat: improve dashboard cockpit"
git push origin main
gh run watch --workflow "Deploy Headless to Vercel" --exit-status
curl -I -L https://mens-esthe-kuchikomi.com/dashboard/
```

期待:

- GitHub Actions `Deploy Headless to Vercel` が成功する
- `https://mens-esthe-kuchikomi.com/dashboard/` が HTTP 200
- `https://mens-esthe-kuchikomi.com/dashboard/analytics/` が HTTP 200

### Dashboard 認証

Vercel Project の Production Environment Variables に次を**必ず2項目セット**で登録する。

```text
DASHBOARD_BASIC_AUTH_USER
DASHBOARD_BASIC_AUTH_PASSWORD
```

認証は fail-closed。2項目の未設定・片方だけの設定は `503`、認証情報なし・不一致は `401` となり、どちらも `no-store` / `noindex` で返す。既存互換の `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` は、正式な2項目がどちらも存在せず、旧2項目が両方揃う場合だけ使う **pair-only** 互換とする。新旧の片方ずつを混ぜない。正式な環境変数が片方だけ存在する場合は旧設定へ戻さず `503` にする。

`proxy.ts` は入口の防御であり、唯一の認可根拠にしない。`/api/dashboard/*` に管理APIを追加するときは、各 Route Handler でも `authorizeDashboardRequest()` を直接実行する。

設定確認では値を画面・ログへ出さず、存在だけを確認する。

```bash
test -n "$DASHBOARD_BASIC_AUTH_USER" && echo "dashboard user: configured"
test -n "$DASHBOARD_BASIC_AUTH_PASSWORD" && echo "dashboard password: configured"
```

日次更新bridgeも `DAILY_UPDATE_PROXY_SECRET`、`WP_DAILY_UPDATE_USER`、`WP_DAILY_UPDATE_APP_PASSWORD` の3項目をserver-onlyで設定する。値は `printenv` やCIログへ出さず、同様に `test -n` で存在だけを確認する。

### Dashboard データ接続

標準は Supabase。Vercel Project の Production Environment Variables に次を登録する。

```text
NEXT_PUBLIC_DASHBOARD_DATA_SOURCE=supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY（既存互換。新規は `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` を優先）
NEXT_PUBLIC_SUPABASE_GA_DAILY_TABLE=dashboard_ga_daily
NEXT_PUBLIC_SUPABASE_GA_TOTALS_TABLE=dashboard_ga_totals
NEXT_PUBLIC_SUPABASE_GA_PAGES_TABLE=dashboard_ga_pages
NEXT_PUBLIC_SUPABASE_GA_CREATIVES_TABLE=dashboard_ga_creatives
NEXT_PUBLIC_SUPABASE_GA_CTA_TABLE=dashboard_ga_cta
NEXT_PUBLIC_SUPABASE_SC_KEYWORDS_TABLE=dashboard_sc_keywords
NEXT_PUBLIC_SUPABASE_SC_PAGES_TABLE=dashboard_sc_pages
NEXT_PUBLIC_SUPABASE_SC_AREAS_TABLE=dashboard_sc_areas
```

本番UIでは、Supabase未設定時にモック数値を本番値として見せない。未連携として表示し、実データが入った時だけ数値を出す。

---

## 作業の種類（先に分類する）

| 区分 | 意味 | 誰がやるか |
|------|------|------------|
| **A. エージェント自動** | ターミナル・Git・GitHub CLI・curl だけで完結 | **Cursor / Claude に実行させる** |
| **B. 秘密情報が要る自動** | `.env` や GitHub Secrets がローカル／CI に既にある前提 | 秘密が揃っていれば **エージェント実行可**。無ければ先に **人がファイル登録** |
| **C. 手動のみ** | WordPress 管理画面のクリック操作・口頭でしか渡せない情報 | **人**（エージェントは手順書とチェックリストだけ出す） |

---

## A. エージェントにそのまま実行させるコマンド

### 1. 子テーマ `mens-esthe-kuchikomi` をデプロイ（本番反映）

**原則:** `main` へ `push` すると GitHub Actions（FTP）が動く。エージェントは **commit まで一気に**やる。

```bash
cd ~/Desktop/dev/swell_child
git status
git add -A
git commit -m "feat: 変更内容を一言で"
git push origin main
```

**確認（自動）:**

```bash
curl -sS -o /dev/null -w "%{http_code}" "https://mens-esthe-kuchikomi.com/"
```

### 2. 本番 HTML の一部確認（例: 地図 iframe）

```bash
curl -sS "https://mens-esthe-kuchikomi.com/area/osaka/" | grep -E 'lux-map-iframe|MAP SEARCH' | head -5
```

### 3. REST `escomi` の生存確認（`/wp-json/escomi/v1/update`）

`POST` と `edit_posts` のみ。**匿名 GET はしない**。未認証 **POST が 401** ならルートは認識されている（404／`rest_no_route` はパーマリンク再保存など）。

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST \
  "https://mens-esthe-kuchikomi.com/wp-json/escomi/v1/update"
```

本番での保存成功は **Application Password での認証済み POST** または GitHub Actions ログで確認する。

### 4. `mens-esthe-seo-tools` — リポジトリ更新＆サイト監視ワークフロー手動起動

**前提:** マシンに `gh`（GitHub CLI）が入り、`gh auth login` 済み。

#### ステップバイステップ（エージェントは上から順に実行）

| Step | 内容 | コマンド |
|------|------|----------|
| **A-4.1** | 監視リポジトリへ移動し、リモートを取り込む | `cd ~/Desktop/dev/mens-esthe-seo-tools && git pull origin main` |
| **A-4.2** | Daily Site Monitor を手動起動 | `gh workflow run "Daily Site Monitor" --ref main` |
| **A-4.3** | 直近の run ID を取得 | `gh run list --workflow="Daily Site Monitor" -L 1 --json databaseId,status` |
| **A-4.4** | 完了まで待つ（`<RUN_ID>` は A-4.3 の `databaseId`） | `gh run watch <RUN_ID> --exit-status` |
| **A-4.5** | Actions が push した成果物を取り込む | `cd ~/Desktop/dev/mens-esthe-seo-tools && git pull origin main` |
| **A-4.6** | 監視対象とハッシュを表示 | `cat ai-site-monitor/sites.json` と `cat ai-site-monitor/data/hashes.json` |
| **A-4.7** | 最新の変更レポートを確認 | `ls -t ai-site-monitor/results/changes_*.json \| head -1 \| xargs cat` |

**一括用（起動まで）:**

```bash
cd ~/Desktop/dev/mens-esthe-seo-tools
git pull origin main
gh workflow run "Daily Site Monitor" --ref main
```

**実行完了待ち:**

```bash
gh run list --workflow="Daily Site Monitor" -L 3
gh run watch <RUN_ID> --exit-status
```

**結果ファイル取得:**

```bash
cd ~/Desktop/dev/mens-esthe-seo-tools
git pull origin main
cat ai-site-monitor/sites.json
cat ai-site-monitor/data/hashes.json
ls -la ai-site-monitor/results/
```

**合格条件（実装確認）:**

1. `sites.json` 内の URL 本数 = `data/hashes.json` のオブジェクトキー数。
2. 最新の `results/changes_*.json` の `total_sites` が 1 と同じ数。
3. `gh run watch` が exit code 0（ワークフロー成功）。

---

## B. 秘密情報あり — 揃えばエージェント実行、無ければ人が先に準備

### 1. `ai-site-monitor` の `main.py`（監視のみ）をローカルで試す

**準備（人）:** `ai-site-monitor/.env` に `GEMINI_API_KEY`（任意: `DISCORD_WEBHOOK_URL`）。

**実行（エージェント可）:**

```bash
cd ~/Desktop/dev/mens-esthe-seo-tools/ai-site-monitor
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export GEMINI_API_KEY="（.env の値を使う場合は source ではなく dotenv）"
# または: set -a && source .env && set +a
python main.py
```

### 2. `ai_auto_updater.py`（Playwright + WordPress 更新）

**準備（人）:** 同じく `ai-site-monitor/.env` に  
`WP_SITE_URL`, `WP_USER`, `WP_APP_PASSWORD`, `GEMINI_API_KEY`。  
初回のみ Playwright ブラウザ。

```bash
cd ~/Desktop/dev/mens-esthe-seo-tools/ai-site-monitor
source .venv/bin/activate
playwright install chromium
set -a && source .env && set +a
python ai_auto_updater.py
```

**注意:** スクリプト内 `CRAWL_LIMIT` はテスト用に小さめ。本番前に値の確認を。

**GitHub Actions について:** エックスサーバー等では、外向きの `/wp-json` がWordPress に届く前に **エッジの 403**（ホスト固有 HTML、`Copyright XSERVER Inc.` 等）になることがあります。その場合は **サーバー内の cron** でこのスクリプトを実行する（サーバー内からの `curl`/Python は通ることが多い）、またはサーバーパネル・サポートで **ブロック／許可 IP（GitHub Actions は出口 IP が変わる）** を確認してください。

### 3. 本番反映・Daily Shop Update 初回チェックリスト（エージェントと人の分担）

[`ai-update-log.php`](../ai-update-log.php) の REST 強化済み状態を本番へ載せ、[`.github/workflows/daily_shop_update.yml`](../.github/workflows/daily_shop_update.yml) の初回手動運用までの流れです。

#### フェーズ A — PHP の本番反映（主に自動 / 結果は人が目視）

| 誰 | やること |
|----|----------|
| **エージェント／CI** | 変更済み `ai-update-log.php` と `functions.php` などを **`main` にマージ済みであること** を確認。そのうえで `deploy.yml`（FTP）が実行され、サーバー側 `themes/swell_child/` に転送されていること。※`.github/workflows/daily_shop_update.yml` と `pm/` は **FTP で除外される** が `ai-update-log.php` は子テーマ直下のため転送対象です。|
| **人（必須）** | アップロード（デプロイ）直後:**トップページ**と**`/wp-admin` ログイン**が白画面・Fatal error なく開けるか確認。**PHP構文エラーによる全消し**防止のためにここだけは必ず人がチェック。**独自 FTP で上げた場合**も同様。サーバーパス例: `/home/(ユーザー)/mens-esthe-kuchikomi.com/public_html/wp-content/themes/swell_child/ai-update-log.php` |

#### フェーズ B — Application Password と GitHub Secrets（人が実行・エージェントは名称どおり転記しない）

**WordPress（本番）**

1. `edit_posts` 以上のアカウントでログイン（**編集者**または**管理者**）。
2. **ユーザー → プロフィール** で **アプリケーションパスワード** を新規作成（名前例: `github-actions-ai-updater`）。
3. 表示される **XXXX XXXX XXXX XXXX**（スペース入り）は、Secret に入れるとき **スペースを除去して 16 連続文字** で登録することが多い。**WP が発行した文字列そのまま** で通る環境もあるが、Secrets 側で **トリム・余分空白なし** であることを確認。

**GitHub（Repository secrets）**

| Secret | 正しさの目安 |
|--------|----------------|
| `WP_SITE_URL` | 末尾スラッシュなし。**本番サイトの基底 URL**（例: `https://mens-esthe-kuchikomi.com`）。ステージングに向いていないか。 |
| `WP_USER` | 上記と同じ **ローカル part のログイン ID**（メール全文ではなく、WP でログインに使っているユーザー名）。 |
| `WP_APP_PASSWORD` | 上記手順の **アプリケーションパスワード**のみ（通常のログインパスワードではない）。 |
| `GEMINI_API_KEY` | 同上で利用する Gemini API キー。 |

**備考:** エージェントは **チャットやログに Secrets を出力しない**。更新は Repo の Secrets 編集または「既に設定済み」の確認のみ人がブラウザで行う。

#### フェーズ C — パイロット運転（workflow_dispatch で件数限定）

おすすめ:**いきなり cron の全店舗に頼らず**、GitHub の **Actions** タブで **Daily Shop Update** を **Run workflow** から手動起動します（`.github/workflows/daily_shop_update.yml`）。

| 入力 | 推奨 |
|------|------|
| `max_shops` | 初回は **`1`**。空欄のまま手動実行すると **`--all`（全店舗）** になるので初回チェックには使わない。 |
| （スケジュール cron） | 手動入力は無視され、常に `python ai_auto_updater.py --all`。 |

##### ログで見るポイント（人が確認）

ジョブの **Run ai_auto_updater** ステップの標準出力を開く。

1. **店舗一覧 GET**: 冒頭〜取得までで、`ERROR: API エラー (HTTP ...)` が出ていない。**200 で shop が返っている**こと。**403 + XSERVER 等の文言** が出ればエッジ止め→本节の前文のサーバー側対応を検討。
2. **AI〜POST**: `save 失敗` や例外がなく、**`✓ WordPress に保存完了`** があるか。**`--- 集計: WordPress 更新 成功 … 件 / 失敗 … 件 ---`** で成功が想定どおりか。
3. **終了コード**: 取得成功 0 かつ失敗ありのみ **`sys.exit(1)`** でジョブ失敗になる。

##### ブラウザ外の補助（オプション・人のみ・秘密はコンソールのみ）

一覧が 200 になるかのみ HTTP コードで確認する例。**`WP_USER` と `WP_APP_PASSWORD` は自分の環境の値で置換しログに載せない。**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -u 'WP_USER:WP_APP_PASSWORD' \
  'https://例のドメイン/wp-json/wp/v2/shop?per_page=1&area=7'
```

更新 API は **POST と Basic 認証のみ**。本番データを書き換えるため本番での curl 検証は、テスト投稿 ID と最小ペイロードなど**事故防止の準備後**で行う。

フェーズ C が緑になり、問題なければ **`max_shops` 空の手動**や **cron（毎朝 JST）** で本番運用に移れる。

---

## A-5. WordPress → Headless キャッシュ再検証（即時反映）

店舗・投稿・固定ページ・`area` タクソノミーを WordPress で保存すると、子テーマ `functions.php` の `escomi_headless_*` が Next の `/api/revalidate/` へ POST します（20 秒 throttle・同一リクエストは 1 回）。

### C. 初回設定（`wp-config.php`・手動）

本番 Xserver の `wp-config.php`（`/* That's all, stop editing! */` の直前）に追加します。**値は Vercel の `REVALIDATE_SECRET` と同一**にしてください（秘密値はリポジトリにコミットしない）。

```php
define('ESCOMI_REVALIDATE_SECRET', 'VercelのREVALIDATE_SECRETと同じ値');
// 任意: プレビュー URL や別ドメイン向け
// define('ESCOMI_HEADLESS_REVALIDATE_URL', 'https://mens-esthe-kuchikomi.com/api/revalidate/');
```

代替: 環境変数 `ESCOMI_REVALIDATE_SECRET`、または WP option `escomi_revalidate_secret`（定数が最優先）。

子テーマ `functions.php` を FTP デプロイ後、WP 管理画面で店舗またはエリアを 1 件更新し、Headless 側の表示が追従するか確認します。

### A. API 疎通確認（エージェント実行可・secret は環境から）

```bash
# `REVALIDATE_SECRET` は事前にローカル環境へ読み込み、画面やログへ表示しない
test -n "$REVALIDATE_SECRET" && echo "revalidate secret: configured"
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "https://mens-esthe-kuchikomi.com/api/revalidate/" \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: ${REVALIDATE_SECRET}" \
  -d '{"tag":"wp","reason":"manual_test"}'
```

期待: 正しいheader secretは `200`、secret 不一致・headerなしは `401`、サーバー側未設定は `503`。GETは使わず、queryへsecretを付けない。

`WP_DEBUG` 有効時のみ、WP の `error_log` に `[escomi_headless] revalidate queued request ...` または失敗ログが出ます。WordPress側secret未設定時は外部送信せず、`revalidate secret not configured; request skipped` を記録します。

---

## A-6. Headless Vercel 本番反映が失敗したとき（`VERCEL_TOKEN` 復旧）

**対象 workflow:** `.github/workflows/deploy-headless.yml`（**Deploy Headless to Vercel**）

**典型エラー:** `The token provided via --token argument is not valid.`

**原因:** GitHub **Repository Secret** の `VERCEL_TOKEN` が失効・削除・誤入力。**Vercel プロジェクトの Environment Variables ではない。**

**ローカル CLI の注意:** `vercel deploy` で `Too many requests - try again in 24 hours`（`api-upload-free`）が出る場合、**24 時間待つか GitHub Actions 経由でデプロイ**する。ローカル CLI は今回の復旧手段にしない。

### フェーズ A — Vercel で新しい Access Token を発行（人・手動）

1. [Vercel](https://vercel.com/) にログイン
2. **Account Settings** → **Tokens**
3. **Create Token**（名前例: `github-actions-escomi`）
4. 表示されたトークンを**その場でコピー**（再表示不可）

### フェーズ B — GitHub Repository Secret を更新（人・手動）

1. 対象リポジトリ（`atmgmj7-lab/mens-esthe-kuchikomi`）を開く
2. **Settings** → **Secrets and variables** → **Actions**
3. **Repository secrets** の **`VERCEL_TOKEN`** を **Update secret**
4. フェーズ A でコピーした新トークンを保存

**更新しないもの（混同注意）**

| 更新する | 更新しない |
|----------|------------|
| GitHub Actions の Repository Secret **`VERCEL_TOKEN`** | Vercel ダッシュボードの Project Environment Variables |
| （失効時のみ人が確認）`VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | `NEXT_PUBLIC_*` 等のアプリ env（別途 Vercel 側） |

`VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` は Repository **variables**（または secrets）に登録済みであること。workflow は vars を優先し、未設定時のみ secrets を参照する。

### フェーズ C — GitHub Actions を再実行（人・手動）

1. **Actions** タブ → **Deploy Headless to Vercel**
2. 失敗した Run（例: run `27463201049`）を開く → **Re-run jobs**  
   または **Run workflow**（`workflow_dispatch`）で `main` から再実行

**エージェントは Re-run / deploy を勝手に実行しない。** 人が Secret 更新後に再実行する。

### フェーズ D — 成功後の確認（エージェント実行可）

**デプロイ URL（Vercel プロジェクト直）**

- https://escomi-headless.vercel.app/area/nihonbashi/
- https://escomi-headless.vercel.app/area/nihonbashi/?page=2
- https://escomi-headless.vercel.app/area/nihonbashi/?page=3

**カスタムドメイン（DNS 切替済みの本番）**

- https://mens-esthe-kuchikomi.com/area/nihonbashi/
- https://mens-esthe-kuchikomi.com/area/nihonbashi/?page=2
- https://mens-esthe-kuchikomi.com/area/nihonbashi/?page=3

**確認項目**

| 項目 | 期待 |
|------|------|
| `?page=2` / `?page=3` | 旧 `AreaPageView` テンプレに戻らない（`hl-area-hub-page` 系の同一ハブ） |
| title / canonical | ページ別に正しい（2・3 ページ目は `?page=N` の self canonical） |
| 料金不明 | 単独の **0 円** 表示なし |
| 口コミ 0 件 | `AggregateRating` 構造化データなし |
| 編集部スコア | `Review` 構造化データとして扱わない |
| 出勤表現 | 「本日」「今すぐ」の自動断定なし（安全化済み） |

**自動チェック（headless/）**

```bash
cd headless
npm run seo:cutover-check -- https://mens-esthe-kuchikomi.com
npm run perf:check -- https://mens-esthe-kuchikomi.com
```

**Search Console:** 反映後に URL 検査（日本橋ハブ・page=2/3）を実施。

### workflow が参照する Secret / Variable（確認用・値は見えない）

| 名前 | 種別 | 用途 |
|------|------|------|
| `VERCEL_TOKEN` | Repository **secret**（必須） | `vercel pull` / `vercel build` / `vercel deploy` の `--token` |
| `VERCEL_ORG_ID` | variable または secret | `.vercel/project.json` の `orgId` |
| `VERCEL_PROJECT_ID` | variable または secret | `.vercel/project.json` の `projectId` |
| `HEADLESS_CI_CHECK_URL` | variable（任意） | SEO チェック URL（未設定時はデプロイ出力 URL） |
| `SMTP_*` / `CONTACT_*` | secrets | `contact:check-env` 用（Vercel env とは別に CI で注入） |

**working-directory:** ジョブ全体 `headless/`（`defaults.run.working-directory`）

**本番デプロイ指定:** `vercel build --prod` → `vercel deploy --prebuilt --prod`

---

## C. 手動のみ（エージェントは「指示・チェックリスト」まで）

- **WordPress 管理画面:** エリアタームの ACF（導入文・ランキング・コラム・FAQ 等）  
  → 手順の参照: **`pm/ACF-FIELDS-SETUP.md`（正本）**、索引はルート `ACF-FIELDS-SETUP.md`、競合視点は `SEO-OPTIMIZATION-GUIDE.md`
- **GitHub の Repository secrets**（FTP / GEMINI 等）の**初回登録**（ブラウザ）
- **Xserver パネル・ドメイン・メール**などホスティング固有の操作

**エージェント向け指示例（コピペ用）:**

> 「`pm/RUNBOOK.md` の **C** に該当する。コード変更は不要。人が WP の **エリア → 日本橋** のターム編集で ACF を入力する。フィールド名は `pm/ACF-FIELDS-SETUP.md` に従う。」

---

## エージェントへの依頼の書き方（テンプレ）

**悪い例:** 「デプロイして」（曖昧）  
**良い例:**  
「`~/Desktop/dev/swell_child` で変更をコミットし、`main` に push。続けて RUNBOOK **A-2** の curl で `/area/osaka/` を確認。」

**悪い例:** 「監視を確認して」（手動前提になりがち）  
**良い例:**  
「`mens-esthe-seo-tools` で `git pull` し、RUNBOOK **A-4** の `gh workflow run` で Daily Site Monitor を実行。終わったら `git pull` して `changes_*.json` の `total_sites` を読み取って報告。」

---

## 関連ファイル

| ファイル | 内容 |
|----------|------|
| `pm/PROGRESS.md` | 日付ログ・次タスク |
| `pm/BLOCKER.md` | ブロッカー |
| `pm/ARCHITECTURE.md` | 技術構成 |
| `headless/docs/shop-ranking.md` | **エリアランキング**（WP `area_rank`・将来 Supabase） |
| `CLAUDE.md` | 作業前に読む順序 |
