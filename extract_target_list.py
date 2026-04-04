#!/usr/bin/env python3
"""
ポータルサイトから店舗名と公式サイトURLを抽出し、sites.json を作成するスクリプト（強化版）。

- 複数URL対応（target_urls）
- 重複チェック・マージ
- 既存WP店舗との照合（shop_post_id 紐付け）
- 店名正規化（記号削除、全角半角統一）
"""

import asyncio
import json
import os
import re
import unicodedata
from pathlib import Path
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv
from google import genai

# 環境変数の読み込み（.env は ai-site-monitor に集約）
_BASE = Path(__file__).resolve().parent
load_dotenv(_BASE / ".env")
load_dotenv(_BASE / "tools" / ".env")
load_dotenv(_BASE / "ai-site-monitor" / ".env", override=True)

# ============================================================
# 設定（ここを変更）
# ============================================================
target_urls = [
    "https://mens-esthe-kuchikomi.com/area/nihonbashi/",
    # "https://mens-esthe-kuchikomi.com/area/umeda/",
]
output_path = _BASE / "sites.json"
wp_shops_path = _BASE / "wp_shops.json"  # 既存WP店舗リスト（手動作成 or fetch_wp_shops で取得）


def normalize_name(name: str) -> str:
    """店名を比較用に正規化（記号削除、全角→半角、空白統一）"""
    if not name:
        return ""
    # 全角英数・記号を半角に
    s = unicodedata.normalize("NFKC", str(name))
    # 比較不要な記号を削除（括弧・スペース・ピリオド等）
    s = re.sub(r"[　\s\.\-・（）()［］\[\]【】『』「」''""、,，.．]", "", s)
    s = re.sub(r"[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]", "", s)  # 英数字・ひらがな・カタカナ・漢字のみ
    return s.lower().strip()


def load_existing_sites() -> list[dict]:
    """既存の sites.json を読み込み"""
    if not output_path.exists():
        return []
    try:
        with open(output_path, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, IOError):
        return []


def load_wp_shops() -> dict[str, int]:
    """既存WP店舗リストを読み込み。{正規化店名: shop_post_id} を返す"""
    result: dict[str, int] = {}

    # 1. wp_shops.json から読み込み
    if wp_shops_path.exists():
        try:
            with open(wp_shops_path, encoding="utf-8") as f:
                data = json.load(f)
            for item in data if isinstance(data, list) else []:
                name = item.get("name") or item.get("title", "")
                pid = item.get("shop_post_id") or item.get("id")
                if name and pid is not None:
                    result[normalize_name(name)] = int(pid)
        except (json.JSONDecodeError, IOError):
            pass

    # 2. WordPress REST API から取得（.env に WP_BASE_URL 等があれば）
    wp_base = os.environ.get("WP_BASE_URL")
    wp_user = os.environ.get("WP_USER")
    wp_pw = os.environ.get("WP_APP_PASSWORD")
    if wp_base and wp_user and wp_pw:
        try:
            parsed = urlparse(wp_base)
            base = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
            url = f"{base}/wp-json/wp/v2/shop?per_page=100"
            resp = requests.get(url, auth=(wp_user, wp_pw), timeout=15)
            if resp.status_code == 200:
                for post in resp.json():
                    title = post.get("title", {}).get("rendered", "")
                    if title:
                        from html import unescape
                        title = unescape(title)
                    pid = post.get("id")
                    if title and pid:
                        result[normalize_name(title)] = int(pid)
        except Exception:
            pass

    return result


def merge_shops(
    existing: list[dict],
    new_shops: list[dict],
    wp_shops: dict[str, int],
) -> list[dict]:
    """新規抽出と既存をマージ。重複はURL等を更新、WP一致時は shop_post_id を紐付け"""
    by_key: dict[str, dict] = {}

    for s in existing:
        key = normalize_name(s.get("name", ""))
        if key:
            by_key[key] = dict(s)

    for s in new_shops:
        name = s.get("name", "")
        url = (s.get("url") or "").strip()
        if not name or not url:
            continue
        key = normalize_name(name)
        if not key:
            continue

        if key in by_key:
            # 重複: 新しいURLがあればマージ
            cur = by_key[key]
            if url and url != cur.get("url"):
                cur["url"] = url
            if key in wp_shops and "shop_post_id" not in cur:
                cur["shop_post_id"] = wp_shops[key]
        else:
            # 新規
            entry = {"name": name, "url": url}
            if key in wp_shops:
                entry["shop_post_id"] = wp_shops[key]
            by_key[key] = entry

    return list(by_key.values())


async def crawl_with_crawl4ai(url: str) -> str:
    """crawl4ai でURLをスクレイピングし、Markdownを取得"""
    try:
        from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
        from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator
    except ImportError:
        raise ImportError("crawl4ai がインストールされていません。pip install crawl4ai を実行してください。")

    browser_cfg = BrowserConfig(
        browser_type="chromium",
        headless=True,
        verbose=False,
    )

    run_cfg = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        word_count_threshold=10,
        markdown_generator=DefaultMarkdownGenerator(),
    )

    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        result = await crawler.arun(url, config=run_cfg)

    if not result.success:
        raise RuntimeError(result.error_message or "クロールに失敗しました")

    md = result.markdown
    if hasattr(md, "raw_markdown"):
        md = md.raw_markdown or ""
    if md is None:
        md = result.cleaned_html or result.html or ""
    return str(md)[:50000]


def extract_shops_with_gemini(markdown: str) -> list[dict]:
    """Gemini で店舗名とURLを抽出（店名は比較用にクリーニング済みで出力）"""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY が設定されていません。")

    client = genai.Client(api_key=api_key)
    models = ["models/gemini-3.1-pro-preview", "models/gemini-2.5-flash"]

    prompt = f"""以下のMarkdownはメンズエステのポータルサイト（店舗一覧ページ）から取得したものです。
「店舗名」と「公式サイトURL」を抽出し、以下のJSON形式のみで返してください（余計な説明は不要）:

[
  {{"name": "店舗名1", "url": "https://公式サイトURL1"}},
  {{"name": "店舗名2", "url": "https://公式サイトURL2"}}
]

【重要】店名の出力ルール:
- 比較用にクリーニングして出力すること。記号（括弧・スペース・ピリオド・ハイフン等）は削除。
- 全角英数字は半角に統一。
- 例: 「C.R.E.A.M（クリーム）」→「CREAMクリーム」、「サロンＡ」→「サロンA」

- 公式サイトURLが不明な店舗は除外するか、urlを空文字にしてください。
- 必ず有効なJSON配列のみを返してください。

【Markdown】
{markdown[:40000]}
"""

    for model in models:
        try:
            response = client.models.generate_content(model=model, contents=prompt)
            raw = (response.text or "").strip()
            if "```" in raw:
                m = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
                raw = m.group(1).strip() if m else raw
            data = json.loads(raw)
            if isinstance(data, list):
                return [
                    {"name": str(s.get("name", "")).strip(), "url": str(s.get("url", "")).strip()}
                    for s in data
                ]
            return []
        except Exception as e:
            print(f"  [{model}] エラー: {e}")
            continue
    return []


async def main():
    existing = load_existing_sites()
    wp_shops = load_wp_shops()
    print(f"既存 sites.json: {len(existing)} 件 / WP店舗: {len(wp_shops)} 件")

    all_new: list[dict] = []
    for i, url in enumerate(target_urls):
        print(f"\n[1/{len(target_urls)}-{i+1}] クロール: {url}")
        markdown = await crawl_with_crawl4ai(url)
        print(f"      取得文字数: {len(markdown)}")

        print(f"  [2] Gemini で店舗リスト抽出...")
        shops = extract_shops_with_gemini(markdown)
        shops = [s for s in shops if s.get("url")]
        print(f"      抽出: {len(shops)} 件")
        all_new.extend(shops)

    # 重複除去（同一正規化名は最初の1件のみ）
    seen = set()
    unique_new: list[dict] = []
    for s in all_new:
        k = normalize_name(s.get("name", ""))
        if k and k not in seen:
            seen.add(k)
            unique_new.append(s)

    merged = merge_shops(existing, unique_new, wp_shops)
    merged.sort(key=lambda x: (x.get("name", "")))

    print(f"\n[3] 保存: {output_path}")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)

    wp_linked = sum(1 for s in merged if s.get("shop_post_id"))
    print(f"\n完了: 合計 {len(merged)} 件（WP紐付け {wp_linked} 件）")


if __name__ == "__main__":
    asyncio.run(main())

# ============================================================
# 実行: pip install -r requirements-extract.txt && crawl4ai-setup && python extract_target_list.py
# 複数URL: target_urls リストを編集。WP照合: wp_shops.json または .env の WP_* で自動取得。
# ============================================================
