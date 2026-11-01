import gzip
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from daily_data_cache import DailyDataCache, build_database


class Handler:
    def __init__(self, data, token="test-token"):
        self.headers = {"Content-Length": str(len(data)), "Authorization": "Bearer " + token}
        self.rfile = io.BytesIO(data)
        self.replies = []

    def send_json(self, payload, status=200):
        self.replies.append((status, payload))


class DailyCacheTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1])
        self.root = Path(self.temp.name)
        self.rows = [
            {"sku": "A+UK", "sale_date": "2026-10-29", "sequence": 2, "price": 12},
            {"sku": "B", "sale_date": None, "sequence": 3, "price": None},
            {"sku": "A+UK", "sale_date": "2026-10-01", "sequence": 1, "price": 10},
        ]
        self.cache = DailyDataCache(("sales",), lambda table: iter(self.rows),
                                    self.root / "active.sqlite3", enabled=True)

    def tearDown(self):
        self.temp.cleanup()

    def package(self, rows=None, generation="2026-11-02T01:00:00+00:00"):
        path = self.root / "upload.sqlite3"
        path.unlink(missing_ok=True)
        build_database(path, {"sales": self.rows if rows is None else rows},
                       {"generation": generation, "origin": "verified-import"})
        return gzip.compress(path.read_bytes())

    def test_queries_preserve_encoded_sku_order_projection_nulls_and_pagination(self):
        self.assertEqual(self.cache.select("sales", "sku=eq.A%2BUK&select=price&order=sequence.asc"),
                         [{"price": 10}, {"price": 12}])
        self.assertEqual(self.cache.select("sales", {"price": "not.is.null", "order": "sequence.desc", "limit": 1}),
                         [self.rows[0]])
        self.assertEqual(self.cache.select("sales", {"order": "sale_date.asc.nullslast", "offset": 2}),
                         [self.rows[1]])
        self.assertEqual(self.cache.select("sales", {"sale_date": "gte.2026-10-20"}), [self.rows[0]])

    def test_time_passing_and_process_recreation_do_not_read_source(self):
        self.assertEqual(self.cache.count("sales"), 3)
        def forbidden(table):
            raise AssertionError("Unexpected Supabase request")
        self.cache.loader = forbidden
        with patch("time.time", return_value=9999999999):
            self.assertEqual(self.cache.count("sales"), 3)
            self.assertEqual(len(self.cache.select("sales")), 3)
        restarted = DailyDataCache(("sales",), forbidden, self.cache.path, enabled=True)
        self.assertEqual(len(restarted.select("sales")), 3)

    def test_authenticated_replace_and_rejected_input_retain_previous_version(self):
        with patch.dict(os.environ, {"DATA_REFRESH_TOKEN": "test-token"}):
            good = Handler(self.package())
            self.assertTrue(self.cache.accept_upload(good))
            previous = self.cache.generation()
            self.assertFalse(self.cache.accept_upload(Handler(b"bad", "wrong-token")))
            self.assertFalse(self.cache.accept_upload(Handler(b"not gzip")))
            self.assertFalse(self.cache.accept_upload(Handler(self.package(generation="2026-10-01"))))
            self.assertEqual(self.cache.generation(), previous)
            self.assertTrue(self.cache.accept_upload(Handler(self.package(rows=[{"sku": "NEW"}], generation="2026-11-03"))))
            self.assertEqual(self.cache.select("sales"), [{"sku": "NEW"}])

    def test_cold_restore_downloads_compressed_snapshot_once_and_never_reads_tables(self):
        body = self.package()
        self.cache.loader = lambda table: self.fail("Raw table recovery should not be used")
        with patch.dict(os.environ, {"DAILY_DATA_SNAPSHOT_URL": "https://example.test/private"}), \
                patch("daily_data_cache.urlopen", return_value=io.BytesIO(body)) as opened:
            self.assertEqual(self.cache.count("sales"), 3)
            self.cache.select("sales")
            self.assertEqual(opened.call_count, 1)
            self.assertEqual(self.cache.status()["snapshotBytesSinceStart"], len(body))

    def test_failed_remote_restore_does_not_fall_back_to_bulk_database_download(self):
        self.cache.loader = lambda table: self.fail("Unexpected bulk download")
        with patch.dict(os.environ, {"DAILY_DATA_SNAPSHOT_URL": "https://example.test/private"}), \
                patch("daily_data_cache.urlopen", side_effect=OSError("offline")):
            with self.assertRaisesRegex(RuntimeError, "Unable to restore"):
                self.cache.select("sales")
        self.assertFalse(self.cache.path.exists())

    def test_invalid_query_does_not_access_arbitrary_tables_or_sql(self):
        with self.assertRaises(ValueError):
            self.cache.select("secrets")
        with self.assertRaises(ValueError):
            self.cache.select("sales", {"select": "sku); DROP TABLE sales"})


if __name__ == "__main__":
    unittest.main()
