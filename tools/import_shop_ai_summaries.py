#!/usr/bin/env python3
"""
bulk update shop_ai_summary from JSON (array of { post_id, shop_ai_summary }).

Usage:
  python3 import_shop_ai_summaries.py [/path/to/nihonbashi_shop_summaries.json]

Defaults (if path omitted): theme_dir/content/nihonbashi_shop_summaries.json
Runs wp from ~/mens-esthe-kuchikomi.com/public_html (override with WP_ROOT env).

Requires WP-CLI available as `wp`.
"""
import json
import os
import subprocess
import sys


def main() -> int:
    theme_tools = os.path.dirname(os.path.abspath(__file__))
    theme_dir = os.path.dirname(theme_tools)
    default_json = os.path.join(theme_dir, "content", "nihonbashi_shop_summaries.json")
    json_path = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else default_json)

    if not os.path.isfile(json_path):
        print(f"エラー: JSON が見つかりません: {json_path}", file=sys.stderr)
        print(
            "例: SCP 後 ~/nihonbashi_shop_summaries.json に置くか、テーマ直下 content/ にファイルを用意してください。",
            file=sys.stderr,
        )
        return 2

    wp_root = os.environ.get("WP_ROOT", os.path.expanduser("~/mens-esthe-kuchikomi.com/public_html"))

    with open(json_path, encoding="utf-8") as fp:
        shops = json.load(fp)

    if not isinstance(shops, list):
        print("エラー: JSON は配列である必要があります", file=sys.stderr)
        return 2

    success = 0
    errors = []

    for shop in shops:
        if not isinstance(shop, dict):
            errors.append(str(shop))
            continue
        post_id = shop.get("post_id")
        summary = shop.get("shop_ai_summary")
        if post_id is None or summary is None:
            errors.append(f"bad row (need post_id, shop_ai_summary): {shop!r}")
            continue
        pid = str(int(post_id))
        summary_text = summary if isinstance(summary, str) else str(summary)

        FIELD_KEY = os.environ.get("SHOP_AI_SUMMARY_FIELD_KEY", "field_69a122aad31bf")
        meta_res = subprocess.run(
            ["wp", "post", "meta", "update", pid, "shop_ai_summary", summary_text, "--allow-root"],
            cwd=wp_root,
            capture_output=True,
            text=True,
        )
        ref_res = subprocess.run(
            ["wp", "post", "meta", "update", pid, "_shop_ai_summary", FIELD_KEY, "--allow-root"],
            cwd=wp_root,
            capture_output=True,
            text=True,
        )
        if meta_res.returncode != 0 or ref_res.returncode != 0:
            err_parts = []
            if meta_res.returncode != 0:
                err_parts.append((meta_res.stderr or meta_res.stdout or "").strip())
            if ref_res.returncode != 0:
                err_parts.append((ref_res.stderr or ref_res.stdout or "").strip())
            errors.append("ID=%s: %s" % (pid, " / ".join((e for e in err_parts if e))))
            continue

        success += 1

    print(f"完了: {success}件成功 / {len(errors)}件エラー / 総行={len(shops)}")
    for e in errors[:50]:
        print(e)
    if len(errors) > 50:
        print(f"... ほか {len(errors) - 50}件")

    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
