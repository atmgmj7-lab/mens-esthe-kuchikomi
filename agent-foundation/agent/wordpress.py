import json
import urllib.error
import urllib.parse
import urllib.request

WP_API = "https://mens-esthe-kuchikomi.com/wp-json/wp/v2"
HEADERS = {"User-Agent": "AgentFoundation/1.0"}


def _get(url: str, timeout: int = 12):
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = json.loads(r.read())
            total = int(r.headers.get("X-WP-Total", 0))
            total_pages = int(r.headers.get("X-WP-TotalPages", 1))
        return body, total, total_pages, None
    except urllib.error.HTTPError as e:
        return [], 0, 0, f"HTTP {e.code}: {e.reason}"
    except Exception as e:
        return [], 0, 0, str(e)


def fetch_posts(page: int = 1, per_page: int = 20) -> dict:
    url = (
        f"{WP_API}/posts"
        f"?page={page}&per_page={per_page}"
        f"&_fields=id,title,link,date,status,slug"
    )
    posts, total, total_pages, err = _get(url)
    if err:
        return {"error": err, "posts": [], "total": 0, "total_pages": 0}
    return {"posts": posts, "total": total, "total_pages": total_pages, "page": page}


def fetch_shops(page: int = 1, per_page: int = 20, search: str = "") -> dict:
    params = (
        f"page={page}&per_page={per_page}"
        f"&_fields=id,title,link,date,status,slug"
    )
    if search:
        params += f"&search={urllib.parse.quote(search)}"
    url = f"{WP_API}/shop?{params}"
    shops, total, total_pages, err = _get(url)
    if err:
        return {"error": err, "shops": [], "total": 0, "total_pages": 0}
    return {"shops": shops, "total": total, "total_pages": total_pages, "page": page}
