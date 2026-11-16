from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
import sys
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import app  # noqa: E402
from form_auth import PasswordLogin  # noqa: E402


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


class PromotionLoginTests(unittest.TestCase):
    def setUp(self):
        self.settings = (
            patch.object(app, "PROMOTION_REQUIRE_AUTH", True),
            patch.object(app, "LOGIN", PasswordLogin("team", "example-password", "Promotion", "test_session", False)),
        )
        for setting in self.settings:
            setting.start()
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), app.Handler)
        self.thread = Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_port}"
        self.opener = build_opener(NoRedirect)

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        for setting in reversed(self.settings):
            setting.stop()

    def test_form_login_protects_page_and_api(self):
        with self.assertRaises(HTTPError) as redirect:
            self.opener.open(self.base + "/")
        self.assertEqual(redirect.exception.code, 303)
        self.assertEqual(redirect.exception.headers["Location"], "/login")
        self.assertIsNone(redirect.exception.headers.get("WWW-Authenticate"))
        with urlopen(self.base + "/login") as response:
            self.assertIn('autocomplete="current-password"', response.read().decode())
        with self.assertRaises(HTTPError) as denied:
            urlopen(self.base + "/api/config")
        self.assertEqual(denied.exception.code, 401)
        form = urlencode({"username": "team", "password": "example-password"}).encode()
        with self.assertRaises(HTTPError) as logged_in:
            self.opener.open(Request(self.base + "/login", data=form))
        cookie = logged_in.exception.headers["Set-Cookie"].split(";", 1)[0]
        with urlopen(Request(self.base + "/", headers={"Cookie": cookie})) as response:
            self.assertEqual(response.status, 200)
        with self.assertRaises(HTTPError) as refresh:
            urlopen(Request(self.base + "/api/data-refresh", headers={"Cookie": cookie}, data=b""))
        self.assertEqual(refresh.exception.code, 401)

    def test_public_health_is_minimal(self):
        with urlopen(self.base + "/api/health") as response:
            self.assertEqual(json.load(response), {"ok": True})


if __name__ == "__main__":
    unittest.main()
