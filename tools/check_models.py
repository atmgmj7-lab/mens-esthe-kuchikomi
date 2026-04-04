#!/usr/bin/env python3
"""
利用可能なGeminiモデル一覧を取得するスクリプト。
GEMINI_API_KEY で利用可能なモデルの正確な文字列を確認する。
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai

# .env をスクリプト配置ディレクトリから読み込む
load_dotenv(Path(__file__).resolve().parent / ".env", override=True)

api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

print("=== 利用可能なモデル一覧 ===")
try:
    for model in client.models.list():
        # supported_generation_methods (旧API) または supported_actions (新API) で generateContent 対応をフィルタ
        methods = getattr(model, "supported_generation_methods", None) or getattr(model, "supported_actions", None) or []
        if not methods or any("generate" in str(m).lower() for m in methods):
            if model.name:
                print(model.name)
except Exception as e:
    print(f"エラーが発生しました: {e}")
