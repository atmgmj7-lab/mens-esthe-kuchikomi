# 進行ログ

**運用・自動実行コマンド:** `pm/RUNBOOK.md`（Claude / Cursor は手動指示ではなく **ここに書いたコマンドを実行**する）

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
| REST API 401「Missing API key.」修正 | ✅ 完了 | CloudSecure が書き換えた `permission_callback` をサーバー直接修正（2026-05-15） |
| Gemini モデル動的選択・JSON表示バグ修正 | ✅ 完了 | `ai_auto_updater.py` + `functions.php` 修正（2026-05-16） |
| ai-site-monitor稼働確認 | ✅ 一部完了 | mens-esthe-seo-tools: 実URL4件監視（`/area/namba/` はサイトに該当ページなしのため対象外） |
| agents/フォルダ構築 | ⏳ 未着手 | |
| エリア・店舗コンテンツ（ACF） | ✅ 一部完了（日本橋 WP-CLI 投入済） | その他エリア・`area_column_content` 等は `pm/CONTENT-IMPLEMENTATION-GUIDE.md` |
| 日本橋59店舗 `shop_ai_summary` JSON 投入 | ⏳ 待機 | JSON 未配置。配置後: `python3 tools/import_shop_ai_summaries.py`（`content/nihonbashi_shop_summaries.json` または引数でパス指定） |
| 店舗AI自動更新（全店舗） | ✅ パイロット完了 | `escomi/v1/update` 疎通確認済み（401→認証 OK）。手動1件実行 OK（2026-05-14）。詳細 `SHOP-AI-ROLLOUT.md` |

#### ブロッカー
- （自動デプロイ系）FTP Secrets 未登録は解除済み。REST `escomi/v1/update` は権限チェック済み（2026-05-10）
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
