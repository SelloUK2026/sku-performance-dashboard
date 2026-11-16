import base64
from http.server import ThreadingHTTPServer
from threading import Thread
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import app


class DashboardAuthTests(unittest.TestCase):
    def setUp(self):
        self.settings = (
            patch.object(app, "DASHBOARD_REQUIRE_AUTH", True),
            patch.object(app, "DASHBOARD_AUTH_USERNAME", "team"),
            patch.object(app, "DASHBOARD_AUTH_PASSWORD", "example-password"),
        )
        for setting in self.settings:
            setting.start()
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), app.Handler)
        self.thread = Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        for setting in reversed(self.settings):
            setting.stop()

    def request_status(self, path, credentials=None, method="GET"):
        headers = {}
        if credentials is not None:
            encoded = base64.b64encode(credentials.encode()).decode()
            headers["Authorization"] = "Basic " + encoded
        request = Request(self.base + path, headers=headers, method=method)
        try:
            with urlopen(request) as response:
                return response.status
        except HTTPError as error:
            return error.code

    def test_static_and_data_api_require_login(self):
        self.assertEqual(self.request_status("/"), 401)
        self.assertEqual(self.request_status("/api/skus"), 401)
        self.assertEqual(self.request_status("/", "team:wrong"), 401)
        self.assertEqual(self.request_status("/", "team:example-password"), 200)

    def test_health_and_refresh_token_remain_separate(self):
        self.assertEqual(self.request_status("/api/data-refresh", method="POST"), 401)
        self.assertEqual(self.request_status("/api/data-refresh", "team:example-password", method="POST"), 401)


if __name__ == "__main__":
    unittest.main()
