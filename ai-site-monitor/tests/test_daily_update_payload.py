import importlib.util
import os
import sys
import types
import unittest
import uuid
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
SECRET_HEADER = "x-escomi-daily-update-secret"


def _install_import_stubs():
    dotenv = types.ModuleType("dotenv")
    dotenv.load_dotenv = lambda *args, **kwargs: None
    sys.modules.setdefault("dotenv", dotenv)

    bs4 = types.ModuleType("bs4")
    bs4.BeautifulSoup = object
    sys.modules.setdefault("bs4", bs4)

    requests = types.ModuleType("requests")
    requests.get = mock.Mock()
    requests.post = mock.Mock()
    requests.RequestException = Exception
    sys.modules.setdefault("requests", requests)

    playwright = types.ModuleType("playwright")
    playwright_async = types.ModuleType("playwright.async_api")
    playwright_async.async_playwright = object
    playwright_async.Browser = object
    playwright_async.TimeoutError = TimeoutError
    sys.modules.setdefault("playwright", playwright)
    sys.modules.setdefault("playwright.async_api", playwright_async)

    google = types.ModuleType("google")
    google.genai = types.SimpleNamespace()
    sys.modules.setdefault("google", google)


def _load_module(name, filename):
    _install_import_stubs()
    spec = importlib.util.spec_from_file_location(name, ROOT / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeResponse:
    def __init__(self, status_code=200, payload=None, text=""):
        self.status_code = status_code
        self._payload = [] if payload is None else payload
        self.text = text

    def json(self):
        return self._payload


class DailyUpdatePayloadTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.auto = _load_module("ai_auto_updater_under_test", "ai_auto_updater.py")
        cls.hourly = _load_module("hourly_schedule_updater_under_test", "hourly_schedule_updater.py")

    def assert_safe_post(self, post_mock, expected_meta):
        self.assertEqual(post_mock.call_count, 1)
        args, kwargs = post_mock.call_args
        self.assertEqual(args[0], "https://example.test/wp-json/escomi/v1/update/")
        self.assertNotIn("auth", kwargs)
        self.assertEqual(kwargs["headers"], {SECRET_HEADER: "test-proxy-secret"})
        self.assertEqual(
            set(kwargs["json"]), {"shop_post_id", "meta", "request_id"}
        )
        self.assertEqual(kwargs["json"]["meta"], expected_meta)
        request_id = uuid.UUID(kwargs["json"]["request_id"])
        self.assertEqual(request_id.version, 4)
        self.assertFalse(any(key.startswith("age_") for key in kwargs["json"]["meta"]))

    def test_daily_caller_uses_uuid_and_proxy_secret_without_basic_or_age(self):
        post = mock.Mock(return_value=FakeResponse(200))
        self.auto.requests.post = post

        ok = self.auto.update_shop_ai_summary(
            "https://example.test/",
            "test-proxy-secret",
            123,
            "確認済みの本日情報",
            "本日空きあり",
            [{"name": "A", "time": "12:00-18:00", "tags": []}],
        )

        self.assertTrue(ok)
        self.assert_safe_post(
            post,
            {
                "shop_today_analysis": "確認済みの本日情報",
                "shop_availability": "本日空きあり",
                "shop_today_therapists": [
                    {"name": "A", "time": "12:00-18:00", "tags": []}
                ],
            },
        )

    def test_hourly_caller_uses_uuid_and_proxy_secret_without_basic(self):
        post = mock.Mock(return_value=FakeResponse(200))
        self.hourly.requests.post = post

        ok = self.hourly.update_schedule_only(
            "https://example.test/",
            "test-proxy-secret",
            456,
            [{"name": "B", "time": "14:00-20:00", "tags": []}],
            "受付中",
        )

        self.assertTrue(ok)
        self.assert_safe_post(
            post,
            {
                "shop_today_therapists": [
                    {"name": "B", "time": "14:00-20:00", "tags": []}
                ],
                "shop_availability": "受付中",
            },
        )

    def test_each_write_gets_a_new_request_id(self):
        post = mock.Mock(return_value=FakeResponse(200))
        self.hourly.requests.post = post
        for _ in range(2):
            self.hourly.update_schedule_only(
                "https://example.test", "test-proxy-secret", 456, [], ""
            )
        request_ids = [call.kwargs["json"]["request_id"] for call in post.call_args_list]
        self.assertEqual(len(set(request_ids)), 2)

    def test_public_shop_get_does_not_use_basic_authorization(self):
        response = FakeResponse(200, [])
        for module in (self.auto, self.hourly):
            get = mock.Mock(return_value=response)
            module.requests.get = get
            module.fetch_shops("https://example.test")
            _, kwargs = get.call_args
            headers = kwargs.get("headers", {})
            self.assertNotIn("Authorization", headers)
            self.assertNotIn("auth", kwargs)

    def test_daily_config_requires_proxy_secret_not_wordpress_credentials(self):
        with mock.patch.dict(
            os.environ,
            {
                "WP_SITE_URL": "https://example.test",
                "DAILY_UPDATE_PROXY_SECRET": "test-proxy-secret",
                "GEMINI_API_KEY": "test-gemini-key",
            },
            clear=True,
        ):
            config = self.auto.get_config()
        self.assertEqual(config["daily_update_proxy_secret"], "test-proxy-secret")
        self.assertNotIn("user", config)
        self.assertNotIn("app_password", config)


if __name__ == "__main__":
    unittest.main()
