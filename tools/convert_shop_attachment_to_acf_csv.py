#!/usr/bin/env python3
"""
Convert attached shop CSVs into an ACF-friendly CSV with fixed headers.

Inputs:
- details (住所/料金/年齢など): CSV with columns like 「店舗名,住所,電話番号,...」
- portal  (詳細URL/WEB/画像リンク): CSV with columns like 「店舗名,詳細ページURL,Webサイトリンク,画像リンク」

Output:
- ./shop_import_acf.csv (in the current working directory)
"""

from __future__ import annotations

import csv
import html
import os
import re
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple


OUTPUT_COLUMNS: List[str] = [
    "post_title",
    "post_content",
    "tax_area",
    "shop_catch",
    "shop_tel",
    "shop_hours",
    "shop_address",
    "shop_line",
    "official_url",
    "review_star",
    "recommend_text",
    "shop_holiday",
    "shop_booking",
    "shop_parking",
    "basic_price",
    "price_textarea",
    "price_90",
    "price_120",
    "price_150",
    "price_50",
    "price_60",
    "price_70",
    "price_80",
    "price_100",
    "price_180",
    "price_200",
    "price_210",
    "price_extension",
    "price_nomination",
    "age_18",
    "age_20",
    "age_25",
    "age_30",
    "age_35",
    "age_40",
    "therapist_1_name",
    "therapist_1_img",
    "therapist_1_text",
    "therapist_1_url",
    "therapist_2_name",
    "therapist_2_img",
    "therapist_2_text",
    "therapist_2_url",
    "therapist_3_name",
    "therapist_3_img",
    "therapist_3_text",
    "therapist_3_url",
    "area_avg_90",
    "area_avg_120",
    "area_avg_150",
    "area_ranking_pickup",
]


DETAILS_CANDIDATES = [
    "/Users/narikiyotakashi/Desktop/ポータルリスト - 大阪メンエス のコピー.csv",
]
PORTAL_CANDIDATES = [
    "/Users/narikiyotakashi/Desktop/ポータルリスト - 大阪メンエス のコピー.csv",
    "/Users/narikiyotakashi/Desktop/python/shop_details.csv",
]


_RE_NUM = re.compile(r"(\d[\d,]*)")
_RE_URL = re.compile(r"https?://[^\s\"'<>]+", re.IGNORECASE)
_RE_QUOTED = re.compile(r"「([^」]+)」")


def _read_csv_dicts(path: str) -> Iterable[dict]:
    # Try UTF-8 (with/without BOM) first; fallback to CP932 if needed.
    for enc in ("utf-8-sig", "utf-8", "cp932"):
        try:
            with open(path, "r", encoding=enc, newline="") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    yield row
            return
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("unknown", b"", 0, 1, f"Unable to decode CSV: {path}")


def _s(v: Optional[str]) -> str:
    return (v or "").strip()


def _extract_int(v: Optional[str]) -> str:
    """
    Extract numeric-only value as a string integer.
    - "13,000円" -> "13000"
    - "1,000円～" -> "1000"
    - "無料" -> "0"
    - "" -> ""
    """
    t = _s(v)
    if not t:
        return ""
    if "無料" in t:
        return "0"
    m = _RE_NUM.search(t)
    if not m:
        return ""
    return m.group(1).replace(",", "")


def _normalize_shop_name_for_join(raw: str) -> str:
    """
    Join key:
    - Portal CSV often has '...「店舗名」' -> take inside quotes
    - Otherwise use the whole string
    - Normalize whitespace variants
    """
    s = _s(raw)
    m = _RE_QUOTED.search(s)
    if m:
        s = m.group(1)
    s = s.replace("\u3000", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _extract_urls(text: str) -> List[str]:
    urls = _RE_URL.findall(text or "")
    # Keep order, unique
    seen = set()
    out: List[str] = []
    for u in urls:
        if u in seen:
            continue
        seen.add(u)
        out.append(u)
    return out


def _line_id_to_url(v: Optional[str]) -> str:
    """
    Source has values like:
    - "10ct-kobe"
    - "@706wejpn Add Friends"
    - "－ Add Friends"
    Convert to a URL if it's an ID.
    """
    t = _s(v)
    if not t:
        return ""
    t = t.replace("Add Friends", "").strip()
    if t in {"-", "－", "ー"}:
        return ""
    # Already a URL
    if t.startswith("http://") or t.startswith("https://"):
        return t
    # Remove leading @
    t = t.lstrip("@").strip()
    if not t:
        return ""
    # LINE deep link format
    return f"https://line.me/R/ti/p/~{t}"


def _infer_tax_area(address: str, access: str) -> str:
    """
    Heuristic taxonomy term builder.
    Output format: "親>子" when we can guess, otherwise just "親".
    """
    hay = f"{address} {access}"
    parent = ""
    if "大阪" in hay or "Osaka" in hay:
        parent = "大阪"
    elif "神戸" in hay or "兵庫" in hay:
        parent = "兵庫"
    elif "奈良" in hay:
        parent = "奈良"

    # Common child areas (add more as needed)
    child_map = [
        ("日本橋", "日本橋"),
        ("梅田", "梅田"),
        ("新大阪", "新大阪"),
        ("西中島", "西中島"),
        ("堺筋本町", "堺筋本町"),
        ("心斎橋", "心斎橋"),
        ("難波", "難波"),
        ("京橋", "京橋"),
        ("天神橋筋六丁目", "天神橋筋六丁目"),
        ("谷町九丁目", "谷町九丁目"),
        ("堺東", "堺東"),
        ("北新地", "北新地"),
        ("十三", "十三"),
        ("本町", "本町"),
        ("谷町", "谷町"),
    ]
    child = ""
    for key, label in child_map:
        if key in hay:
            child = label
            break

    if parent and child:
        return f"{parent}>{child}"
    if parent:
        return parent
    return ""

def _infer_tax_area_from_portal_title(portal_title: str) -> str:
    """
    Portal title examples:
      大阪・日本橋の人気メンズエステ「当たりSPA 日本橋店」
    Heuristic:
      - take "大阪・日本橋" part (before "の人気" if present)
      - map first token as parent (大阪/兵庫/奈良...), second token as child
    """
    s = _s(portal_title)
    if not s:
        return ""
    head = s.split("の人気", 1)[0]
    toks = [t for t in head.split("・") if t]
    if not toks:
        return ""
    parent = toks[0]
    child = toks[1] if len(toks) >= 2 else ""
    if parent and child:
        return f"{parent}>{child}"
    return parent


@dataclass
class PortalInfo:
    title: str
    join_key: str
    detail_url: str
    web_url: str
    image_urls: List[str]


def read_portal_rows(portal_csv_path: str) -> List[PortalInfo]:
    rows: List[PortalInfo] = []
    for row in _read_csv_dicts(portal_csv_path):
        raw_name = row.get("店舗名") or ""
        join_key = _normalize_shop_name_for_join(raw_name)
        if not join_key:
            continue

        detail_url = _s(row.get("詳細ページURL"))
        web_url = _s(row.get("Webサイトリンク"))
        img_field = row.get("画像リンク") or ""
        image_urls = _extract_urls(img_field)

        rows.append(
            PortalInfo(
            title=_s(raw_name),
            join_key=join_key,
            detail_url=detail_url,
            web_url=web_url,
            image_urls=image_urls,
            )
        )
    return rows


def build_portal_index(portal_rows: List[PortalInfo]) -> Dict[str, PortalInfo]:
    # Use last occurrence wins (OK for our join use-case)
    return {r.join_key: r for r in portal_rows}


def _pick_existing(paths: List[str]) -> str:
    for p in paths:
        if p and os.path.exists(p):
            return p
    return ""


def build_post_content(
    title: str,
    shop_catch: str,
    address: str,
    tel: str,
    hours: str,
    holiday: str,
    booking: str,
    access: str,
    portal: Optional[PortalInfo],
) -> str:
    parts: List[str] = []
    if shop_catch:
        parts.append(f"<p>{html.escape(shop_catch)}</p>")

    if portal and portal.image_urls:
        # Put images at top (WP content)
        imgs = "\n".join(
            f'<p><img src="{html.escape(u)}" alt="{html.escape(title)}"></p>'
            for u in portal.image_urls
        )
        parts.append(imgs)

    # Minimal readable body
    meta_lines: List[Tuple[str, str]] = [
        ("住所", address),
        ("電話", tel),
        ("営業時間", hours),
        ("定休日", holiday),
        ("予約", booking),
        ("アクセス", access),
    ]
    meta_html = "".join(
        f"<tr><th>{html.escape(k)}</th><td>{html.escape(v)}</td></tr>"
        for k, v in meta_lines
        if _s(v)
    )
    if meta_html:
        parts.append(f"<table>{meta_html}</table>")

    if portal and portal.detail_url:
        parts.append(
            f'<p><a href="{html.escape(portal.detail_url)}" target="_blank" rel="noopener">参照元ページ</a></p>'
        )

    return "\n".join(parts).strip()


def main() -> None:
    # CLI args (optional)
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mode",
        default="auto",
        choices=["auto", "portal-only", "details+portal"],
        help="auto: use details if available; portal-only: ignore details; details+portal: require details",
    )
    parser.add_argument("--details", default=os.environ.get("SHOP_DETAILS_CSV", ""), help="details CSV path")
    parser.add_argument("--portal", default=os.environ.get("SHOP_PORTAL_CSV", ""), help="portal CSV path")
    parser.add_argument("--out", default=os.environ.get("SHOP_OUT_CSV", "shop_import_acf.csv"), help="output CSV path")
    args = parser.parse_args()

    if args.mode == "portal-only":
        details_path = args.details  # keep as-is (typically empty)
    else:
        details_path = args.details or _pick_existing(DETAILS_CANDIDATES)
    portal_path = args.portal or _pick_existing(PORTAL_CANDIDATES)
    out_path = args.out

    portal_rows: List[PortalInfo] = []
    portal_idx: Dict[str, PortalInfo] = {}
    if portal_path and os.path.exists(portal_path):
        portal_rows = read_portal_rows(portal_path)
        portal_idx = build_portal_index(portal_rows)

    out_rows: List[dict] = []

    # Portal-only mode
    if args.mode == "portal-only" or (args.mode == "auto" and (not details_path or not os.path.exists(details_path))):
        for p in portal_rows:
            store_title = p.join_key
            tax_area = _infer_tax_area_from_portal_title(p.title)
            post_content = build_post_content(
                title=store_title,
                shop_catch="",
                address="",
                tel="",
                hours="",
                holiday="",
                booking="",
                access="",
                portal=p,
            )

            out: Dict[str, str] = {k: "" for k in OUTPUT_COLUMNS}
            out.update(
                {
                    "post_title": store_title,
                    "post_content": post_content,
                    "tax_area": tax_area,
                    "official_url": p.web_url,
                }
            )
            out_rows.append(out)

        with open(out_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=OUTPUT_COLUMNS,
                extrasaction="ignore",
                quoting=csv.QUOTE_MINIMAL,
            )
            writer.writeheader()
            writer.writerows(out_rows)

        print(f"Wrote: {os.path.abspath(out_path)}")
        print(f"Rows: {len(out_rows)}")
        return

    for row in _read_csv_dicts(details_path):
        title = _s(row.get("店舗名"))
        join_key = _normalize_shop_name_for_join(title)
        portal = portal_idx.get(join_key)

        address = _s(row.get("住所"))
        tel = _s(row.get("電話番号"))
        hours = _s(row.get("営業時間"))
        holiday = _s(row.get("定休日"))
        booking = _s(row.get("予約"))
        access = _s(row.get("アクセス方法"))

        # Prices (numeric-only)
        p50 = _extract_int(row.get("50分"))
        p60 = _extract_int(row.get("60分"))
        p70 = _extract_int(row.get("70分"))
        p80 = _extract_int(row.get("80分"))
        p90 = _extract_int(row.get("90分"))
        p100 = _extract_int(row.get("100分"))
        p120 = _extract_int(row.get("120分"))
        p150 = _extract_int(row.get("150分"))
        p180 = _extract_int(row.get("180分"))
        p240 = _extract_int(row.get("240分"))  # not an ACF key, stored in textarea
        p_ext = _extract_int(row.get("延長30分"))
        p_nom = _extract_int(row.get("指名料"))

        # basic_price: prefer 90min, else minimum among existing course prices
        basic_candidates = [p90, p60, p50, p70, p80, p100, p120, p150, p180]
        basic_price = ""
        if p90:
            basic_price = p90
        else:
            nums = [int(x) for x in basic_candidates if x.isdigit() and int(x) > 0]
            if nums:
                basic_price = str(min(nums))

        # price_textarea: store 240min if present (numeric-only)
        price_textarea = ""
        if p240:
            price_textarea = f"240分: {p240}"

        # Ages
        a18 = _extract_int(row.get("18-19歳"))
        a20 = _extract_int(row.get("20-24歳"))
        a25 = _extract_int(row.get("25-29歳"))
        a30 = _extract_int(row.get("30-34歳"))
        a35 = _extract_int(row.get("35-39歳"))
        a40 = _extract_int(row.get("40-44歳"))

        # LINE
        shop_line = _line_id_to_url(row.get("LINEID"))

        # tax_area (heuristic)
        tax_area = _infer_tax_area(address, access)
        if not tax_area and portal:
            # If details side doesn't have address/access, infer from portal title
            tax_area = _infer_tax_area_from_portal_title(portal.title)
        if not tax_area:
            # As a fallback, try inferring from the shop title itself (some sources embed area in title)
            tax_area = _infer_tax_area_from_portal_title(title)

        # official_url from portal (if available)
        official_url = portal.web_url if portal and portal.web_url else ""

        # shop_catch not provided by source
        shop_catch = ""

        post_content = build_post_content(
            title=title,
            shop_catch=shop_catch,
            address=address,
            tel=tel,
            hours=hours,
            holiday=holiday,
            booking=booking,
            access=access,
            portal=portal,
        )

        out: Dict[str, str] = {k: "" for k in OUTPUT_COLUMNS}
        out.update(
            {
                "post_title": title,
                "post_content": post_content,
                "tax_area": tax_area,
                "shop_catch": shop_catch,
                "shop_tel": tel,
                "shop_hours": hours,
                "shop_address": address,
                "shop_line": shop_line,
                "official_url": official_url,
                "review_star": "",
                "recommend_text": "",
                "shop_holiday": holiday,
                "shop_booking": booking,
                "shop_parking": "",
                "basic_price": basic_price,
                "price_textarea": price_textarea,
                "price_90": p90,
                "price_120": p120,
                "price_150": p150,
                "price_50": p50,
                "price_60": p60,
                "price_70": p70,
                "price_80": p80,
                "price_100": p100,
                "price_180": p180,
                "price_200": "",
                "price_210": "",
                "price_extension": p_ext,
                "price_nomination": p_nom,
                "age_18": a18,
                "age_20": a20,
                "age_25": a25,
                "age_30": a30,
                "age_35": a35,
                "age_40": a40,
                # therapist_* empty (not provided)
                # area_* empty (not provided)
            }
        )

        out_rows.append(out)

    with open(out_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=OUTPUT_COLUMNS,
            extrasaction="ignore",
            quoting=csv.QUOTE_MINIMAL,
        )
        writer.writeheader()
        writer.writerows(out_rows)

    print(f"Wrote: {os.path.abspath(out_path)}")
    print(f"Rows: {len(out_rows)}")


if __name__ == "__main__":
    main()

