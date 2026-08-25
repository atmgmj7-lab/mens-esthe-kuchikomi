import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

from tools.eskomi_coverage_batch.wordpress_snapshot import (
    SnapshotError,
    fetch_public_snapshot,
)


class SnapshotHandler(BaseHTTPRequestHandler):
    requests = []
    first_shop_failure = False

    def do_GET(self):
        parsed = urlsplit(self.path)
        query = parse_qs(parsed.query)
        type(self).requests.append((parsed.path, query, dict(self.headers)))
        if parsed.path == "/wp-json/wp/v2/area/":
            self.respond([
                {"id": 17, "slug": "sakai", "name": "堺東", "count": 18},
                {"id": 13, "slug": "shinosaka", "name": "新大阪", "count": 48},
            ])
            return
        if parsed.path == "/wp-json/wp/v2/shop/":
            if type(self).first_shop_failure:
                type(self).first_shop_failure = False
                self.send_response(503)
                self.end_headers()
                return
            page = int(query["page"][0])
            rows = [{
                "id": page,
                "slug": f"shop-{page}",
                "status": "publish",
                "title": {"rendered": f"Shop {page}"},
                "area": [13],
                "acf": {"official_url": f"https://shop-{page}.example/"},
                "meta": {},
            }]
            self.respond(rows, {"X-WP-TotalPages": "2"})
            return
        self.send_response(404)
        self.end_headers()

    def log_message(self, *_args):
        pass

    def respond(self, value, headers=None):
        body = json.dumps(value).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)


class WordPressSnapshotTest(unittest.TestCase):
    def setUp(self):
        SnapshotHandler.requests = []
        SnapshotHandler.first_shop_failure = False
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), SnapshotHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def test_fetches_complete_bounded_snapshot_using_get_without_authorization(self):
        snapshot = fetch_public_snapshot(self.base_url, timeout=2, retries=1)
        self.assertEqual({13: "shinosaka", 17: "sakai"}, snapshot.areas)
        self.assertEqual((1, 2), tuple(shop.id for shop in snapshot.shops))
        self.assertEqual("https://shop-1.example/", snapshot.shops[0].fields["official_url"])
        self.assertTrue(all("Authorization" not in headers for _, _, headers in SnapshotHandler.requests))
        self.assertEqual(3, len(SnapshotHandler.requests))

    def test_retries_a_transient_http_failure_within_the_fixed_limit(self):
        SnapshotHandler.first_shop_failure = True
        snapshot = fetch_public_snapshot(self.base_url, timeout=2, retries=2)
        self.assertEqual(2, len(snapshot.shops))
        shop_requests = [path for path, _, _ in SnapshotHandler.requests if path.endswith("/shop/")]
        self.assertEqual(3, len(shop_requests))

    def test_rejects_more_than_four_pages(self):
        original = SnapshotHandler.do_GET

        def five_pages(handler):
            parsed = urlsplit(handler.path)
            if parsed.path == "/wp-json/wp/v2/shop/":
                handler.respond([], {"X-WP-TotalPages": "5"})
                return
            original(handler)

        SnapshotHandler.do_GET = five_pages
        self.addCleanup(setattr, SnapshotHandler, "do_GET", original)
        with self.assertRaisesRegex(SnapshotError, "four-page bound"):
            fetch_public_snapshot(self.base_url, timeout=2, retries=1)


if __name__ == "__main__":
    unittest.main()
