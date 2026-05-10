import json
import os
import re
import time
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from google import genai
from urllib.parse import urlparse

# .envの読み込み（tools/.env または ai-site-monitor/.env）
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_BASE_DIR)
load_dotenv(os.path.join(_BASE_DIR, ".env"))
load_dotenv(os.path.join(_PROJECT_ROOT, "ai-site-monitor", ".env"), override=True)

def analyze_with_gemini(text):
    api_key = os.environ.get("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)

    models = ["models/gemini-2.5-flash", "models/gemini-flash-latest"]
    prompt = f"""以下のテキストは店舗「{os.environ.get('SHOP_NAME')}」の公式サイトから抽出した情報です。
以下のJSON形式のみで返してください（余計な説明は不要）:

{{
  "summary": "変更点・最新情報の要約（200文字程度）",
  "shop_address": "住所（見つからなければ空文字）",
  "shop_tel": "電話番号（見つからなければ空文字）",
  "shop_hours": "営業時間（見つからなければ空文字）",
  "basic_price": "最安料金の数字のみ（見つからなければ空文字）",
  "official_url": "公式サイトURL（見つからなければ空文字）"
}}

【抽出テキスト】
{text[:6000]}"""

    for model_name in models:
        try:
            print(f"Gemini解析中 ({model_name})...")
            response = client.models.generate_content(model=model_name, contents=prompt)
            raw = (response.text or "").strip()
            if "```" in raw:
                m = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
                raw = m.group(1).strip() if m else raw
            return json.loads(raw)
        except Exception as e:
            if "429" in str(e):
                print("制限エラー。15秒待機...")
                time.sleep(15)
                continue
            print(f"エラー: {e}")
    return {"summary": "解析失敗", "shop_address": "", "shop_tel": "", "shop_hours": "", "basic_price": "", "official_url": ""}

def post_to_wordpress(data):
    parsed = urlparse(os.environ.get("WP_BASE_URL"))
    base_url = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
    url = f"{base_url}/wp-json/escomi/v1/update"

    shop_post_id = int(os.environ.get("SHOP_POST_ID", 0))
    summary = data.get("summary", "")
    meta = {}
    for key in ("shop_address", "shop_tel", "shop_hours", "basic_price", "official_url"):
        if data.get(key):
            meta[key] = str(data[key]).strip()

    payload = {
        "shop_post_id": shop_post_id,
        "summary": summary,
        "log_type": "update",
        "meta": meta,
    }
    
    # ここがエラーの箇所でした。正しく認証情報を渡します。
    wp_user = os.environ.get("WP_USER")
    wp_pw = os.environ.get("WP_APP_PASSWORD")

    response = requests.post(url, json=payload, auth=(wp_user, wp_pw))
    
    if response.status_code == 201:
        print(f"成功！ (201 Created): {url}")
    else:
        print(f"失敗: {response.status_code}")
        print(f"詳細: {response.text}")

def main():
    print(f"[1/4] スクレイピング開始: {os.environ.get('TARGET_URL')}")
    res = requests.get(os.environ.get("TARGET_URL"))
    soup = BeautifulSoup(res.text, 'html.parser')
    text = soup.get_text()[:1500]
    
    print("[2/4] Gemini解析開始")
    data = analyze_with_gemini(text)

    print("[3/4] WordPressへ送信")
    post_to_wordpress(data)

if __name__ == "__main__":
    main()