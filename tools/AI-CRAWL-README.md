# AI巡回エンジン

WordPress REST API と Gemini API を連携させたスクレイピングスクリプト。
ターゲットURLの変更を検知し、`ai_update_log` に下書きで保存する。

## セットアップ

```bash
cd tools
pip install -r requirements-ai-crawl.txt
cp .env.example .env
# .env を編集して認証情報を設定
```

## 環境変数（.env）

| 変数 | 説明 |
|------|------|
| TARGET_URL | スクレイピング対象URL |
| SHOP_POST_ID | 対象店舗の WordPress post_id |
| SHOP_NAME | 店舗名（ログタイトル用） |
| WP_BASE_URL | WordPress サイトURL |
| WP_USER | Basic認証ユーザー名 |
| WP_APP_PASSWORD | アプリケーションパスワード |
| GEMINI_API_KEY | Gemini API キー |

## 実行

```bash
python ai_crawl_engine.py
```

## Cron での定期実行例

```cron
# 毎日 3:00 に実行
0 3 * * * cd /path/to/swell_child/tools && /usr/bin/python3 ai_crawl_engine.py >> /var/log/ai_crawl.log 2>&1
```

## 将来的な Playwright 対応

SPA 対応が必要な場合は `fetch_page_html()` を以下のように差し替える:

```python
from playwright.sync_api import sync_playwright

def fetch_page_html(url: str) -> str:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(url, wait_until="networkidle")
        html = page.content()
        browser.close()
    return html
```
