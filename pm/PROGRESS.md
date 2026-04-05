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
| GitHub Secrets登録 | ⏳ 待機 | FTPパスワード確認待ち |
| 自動デプロイ動作確認 | ⏳ 待機 | Secrets登録後 |
| エリア地図 iframe 化（area_map_nav ＋ taxonomy-area） | ✅ 完了 | Google Maps embed 6エリア |
| area-seo-hooks-optimized接続 | ⏳ 未着手 | |
| REST API権限強化 | ⏳ 未着手 | |
| ai-site-monitor稼働確認 | ✅ 一部完了 | mens-esthe-seo-tools: 実URL4件監視（`/area/namba/` はサイトに該当ページなしのため対象外） |
| agents/フォルダ構築 | ⏳ 未着手 | |

#### ブロッカー
- FTPパスワード未取得（自動デプロイ完成待ち）

#### 次のアクション
- [ ] FTPパスワード取得 → GitHub Secrets登録
- [ ] 自動デプロイ動作確認
- [x] デプロイ後 `/area/osaka/` で `lux-map-iframe` の表示確認（curl）
- [ ] SEOツールをRenderにデプロイ

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
- REST API疎通確認（/wp-json/ai-engine/v1/update 200 OK）
- ai-site-monitorをmens-esthe-seo-toolsリポジトリに移行
- daily_cron.yml稼働確認（GitHub Actions成功）
- sites.jsonをダミー1000件→実URLに差し替え（のち実URL4件に整理。namba は当該URLなしのため除外）
- FTPデプロイ復旧（FTP_USERNAMEをescomi@mens-esthe-kuchikomi.comに修正）

### 次回優先タスク
- daily_cron.yml新設定（5URL）での実行結果確認（total_sites: 5を確認）
- 日本橋エリアACFコンテンツ手動入力
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

### 2. 日本橋エリア ACF 手動入力 — 作業場所の整理（WP管理画面）
- **場所**: `タクソノミー area` → **日本橋** ターム編集（`/wp-admin/term.php?taxonomy=area&tag_ID=…`）。
- **入力するフィールド**（既存ガイド）: リポジトリ直下 `ACF-FIELDS-SETUP.md`（`area_intro_text` / `area_ranking_shops` / `area_column_content` / `area_faq_content`）。最適化版を使う場合は `SEO-OPTIMIZATION-GUIDE.md` の `area_characteristics` 等も参照。
- **本文は手動**（このリポジトリからは自動投入しない）。

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
