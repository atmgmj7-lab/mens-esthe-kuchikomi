"""Read-only public WordPress snapshot client and values."""

import json
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Mapping, Tuple
from urllib.parse import urlencode
from urllib.request import Request, urlopen


AREA_CONTRACT = {13: "shinosaka", 17: "sakai"}
PUBLIC_FIELDS = (
    "official_url",
    "shop_address",
    "basic_price",
    "shop_hours",
    "shop_tel",
    "shop_booking",
)


class SnapshotError(RuntimeError):
    pass


@dataclass(frozen=True)
class ShopSnapshot:
    id: int
    slug: str
    status: str
    title: str
    area_terms: Tuple[int, ...]
    fields: Mapping[str, Any]


@dataclass(frozen=True)
class WordPressSnapshot:
    base_url: str
    fetched_at: str
    areas: Mapping[int, str]
    shops: Tuple[ShopSnapshot, ...]

    @property
    def shops_by_id(self) -> Dict[int, ShopSnapshot]:
        return {shop.id: shop for shop in self.shops}


def _get_json(url: str, timeout: float, retries: int):
    last_error = None
    for attempt in range(retries):
        try:
            request = Request(
                url,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "EskomiCoverageBatchDryRun/1.0",
                },
                method="GET",
            )
            with urlopen(request, timeout=timeout) as response:
                if response.status != 200:
                    raise SnapshotError(f"unexpected HTTP status {response.status}")
                headers = {
                    name.casefold(): value for name, value in response.headers.items()
                }
                return json.loads(response.read().decode("utf-8")), headers
        except Exception as error:
            last_error = error
            if attempt + 1 < retries:
                time.sleep(0.25 * (attempt + 1))
    raise SnapshotError(f"public GET failed after {retries} attempts: {last_error}")


def _shop_from_rest(row: Mapping[str, Any]) -> ShopSnapshot:
    acf = row.get("acf") if isinstance(row.get("acf"), dict) else {}
    meta = row.get("meta") if isinstance(row.get("meta"), dict) else {}
    fields = {}
    for field in PUBLIC_FIELDS:
        if field in acf:
            fields[field] = acf[field]
        elif field in meta:
            fields[field] = meta[field]
    raw_title = row.get("title", "")
    title = raw_title.get("rendered", "") if isinstance(raw_title, dict) else raw_title
    return ShopSnapshot(
        id=int(row["id"]),
        slug=str(row.get("slug", "")),
        status=str(row.get("status", "publish")),
        title=str(title or ""),
        area_terms=tuple(sorted(int(value) for value in row.get("area", []))),
        fields=fields,
    )


def fetch_public_snapshot(
    base_url: str,
    timeout: float = 45.0,
    retries: int = 3,
) -> WordPressSnapshot:
    if retries < 1 or retries > 3:
        raise ValueError("retries must be between 1 and 3")
    base = base_url.rstrip("/")
    area_query = urlencode(
        {"include": "13,17", "per_page": "2", "_fields": "id,slug,name,count"}
    )
    area_rows, _ = _get_json(
        f"{base}/wp-json/wp/v2/area/?{area_query}", timeout, retries
    )
    areas = {int(row["id"]): str(row["slug"]) for row in area_rows}

    shops = []
    total_pages = None
    page = 0
    for page in range(1, 5):
        query = urlencode(
            {
                "per_page": "100",
                "page": str(page),
                "_fields": "id,slug,status,title,area,acf,meta",
            }
        )
        rows, headers = _get_json(
            f"{base}/wp-json/wp/v2/shop/?{query}", timeout, retries
        )
        header_pages = int(headers.get("x-wp-totalpages", "1"))
        if total_pages is None:
            total_pages = header_pages
            if total_pages > 4:
                raise SnapshotError(
                    f"shop pagination exceeds four-page bound: {total_pages}"
                )
        elif header_pages != total_pages:
            raise SnapshotError("shop pagination changed during snapshot")
        shops.extend(_shop_from_rest(row) for row in rows)
        if page >= total_pages:
            break
    if total_pages is None or page != total_pages:
        raise SnapshotError("incomplete shop snapshot")
    if len({shop.id for shop in shops}) != len(shops):
        raise SnapshotError("duplicate shop IDs in public snapshot")

    return WordPressSnapshot(
        base_url=base,
        fetched_at=datetime.now(timezone.utc).isoformat(),
        areas=areas,
        shops=tuple(sorted(shops, key=lambda shop: shop.id)),
    )
