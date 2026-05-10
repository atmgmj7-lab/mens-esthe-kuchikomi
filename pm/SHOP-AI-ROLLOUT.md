# 店舗「公式URLから最新情報更新」全店舗展開計画

## ゴール

- **エリアページ:** `area_characteristics` → 厳選/ランキング → `area_column_content` → `area_faq_content`（手動・ACF。手順は `CONTENT-IMPLEMENTATION-GUIDE.md`）。
- **店舗ページ:** 各店舗の **`official_url`** を起点に、**本日出勤・空き状況等**を定期的に取得して WP に反映（**AI 自動化**＋不足分は手動）。

---

## 進捗（フェーズ）

| フェーズ | 内容 | 状態 |
|----------|------|------|
| **A. AI 基盤** | `ai_auto_updater.py`・`POST /wp-json/escomi/v1/update`・`shop_today_*` 連携 | コード済み（本リポジトリ） |
| **B. 件数制御** | `CRAWL_LIMIT` / `--all` / `--limit` / `SHOP_DELAY_SECONDS` でテスト〜全店舗へ段階移行 | 実装済み（`ai_auto_updater.py`） |
| **C. パイロット** | 少数店舗（例: `--limit 10`）で本番実行・REST・表示確認 | 運用側で実施 |
| **D. 全店舗** | `CRAWL_LIMIT=all` または `--all`、必要なら cron / GitHub Actions で日次 | 運用側で有効化 |
| **E. 手動** | エリア ACF、`shop_ai_summary`（月次コンセプト）、`official_url` 未設定店の URL 登録、ドメイン別 `SCRAPING_RULES` | 並行で着手 |

---

## AI が自動でできること（先に実装済みの範囲）

1. WP REST で `shop` 一覧取得（`official_url` があるもの）。
2. Playwright で公式サイトのテキスト/HTML 取得。
3. 変更検知（SQLite `shop_logs` のハッシュ）。
4. BeautifulSoup ルート（`SCRAPING_RULES`）または Gemini で **本日出勤・分析文・空き状況・年齢層**を生成。
5. `escomi/v1/update` へ POST（`shop_today_analysis`, `shop_availability`, `shop_today_therapists`, `age_*` 等）。

**自動でやらない（手動・別フロー）**

- エリア SEO 用 ACF（`area_characteristics` など）。
- `shop_ai_summary` の**意図的な**月次更新（スクリプトは送信しない設計）。
- 公式サイト構造が特殊な店舗への **ドメイン別セレクタ追加**（`SCRAPING_RULES`）。

---

## 実行例（`ai-site-monitor/`）

```bash
# テスト: 3 件（環境変数未設定時の既定）
python ai_auto_updater.py

# 最大 10 件だけ
python ai_auto_updater.py --limit 10

# 公式URL がある店舗をすべて（全店舗採用時）
python ai_auto_updater.py --all

# 環境変数で全店舗（CLI なし）
export CRAWL_LIMIT=all
python ai_auto_updater.py

# 負荷緩和（秒。全店舗バッチ向け）
export SHOP_DELAY_SECONDS=2
python ai_auto_updater.py --all
```

前提: `.env` に `WP_SITE_URL`, `WP_USER`, `WP_APP_PASSWORD`, `GEMINI_API_KEY`。

---

## 注意

- **全店舗一括**は実行時間・Gemini 課金・相手サーバ負荷が増える。`SHOP_DELAY_SECONDS` の利用を推奨。
- **REST が未認証のまま**だとセキュリティ上のリスク → `pm/BLOCKER.md` の REST 強化とセットで検討。
- 取得できない店舗は `official_url` の確認・`SCRAPING_RULES` の追加が必要。

---

## 参照

| ファイル | 内容 |
|----------|------|
| `ai-site-monitor/ai_auto_updater.py` | 本パイプライン本体 |
| `ai-site-monitor/README.md` | セットアップ・CLI |
| `ai-update-log.php` | REST で受け取る meta 一覧 |
| `pm/CONTENT-IMPLEMENTATION-GUIDE.md` | エリア・店舗の役割分担 |
