"""A disk-backed, explicitly refreshed copy of the immutable daily source tables.

Normal requests never revalidate these tables against Supabase. An authenticated
upload from the verified importer atomically replaces the copy. A cold instance
without a local file can recover once from Supabase, without keeping sales in RAM.
"""
from __future__ import annotations

from contextlib import closing
from datetime import datetime, timezone
import gzip
import hashlib
import hmac
import json
import lzma
import os
from pathlib import Path
import re
import sqlite3
import tempfile
from threading import RLock
from urllib.parse import parse_qs
from urllib.request import Request, urlopen

DASHBOARD_TABLES = (
    "sales", "sku_master", "inventory", "freight", "container_report",
    "upcoming_stock", "price_history", "product_images", "channeladvisor_products",
)
PROMOTION_TABLES = (
    "promotion_sku_data", "channeladvisor_products", "promotion_protection_list", "inventory",
)
IDENTIFIER = re.compile(r"^[a-z_][a-z0-9_]*$")
MAX_UPLOAD = 64 * 1024 * 1024
MAX_DATABASE = 512 * 1024 * 1024


def compressed_reader(source):
    """Detect the transport format so older gzip restart copies remain usable."""
    source.seek(0)
    magic = source.read(6)
    source.seek(0)
    if magic == b"\xfd7zXZ\x00":
        return lzma.LZMAFile(source, "rb"), "xz"
    if magic[:2] == b"\x1f\x8b":
        return gzip.GzipFile(fileobj=source), "gzip"
    raise ValueError("Unsupported daily data compression")


def unpack_database(source, target_path):
    reader, compression = compressed_reader(source)
    total = 0
    with reader, Path(target_path).open("wb") as target:
        while chunk := reader.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_DATABASE:
                raise ValueError("Daily data file is too large")
            target.write(chunk)
    return compression


def pack_database(source_path, target_path, compression="xz"):
    if compression not in {"gzip", "xz"}:
        raise ValueError("Unsupported daily data compression")
    original_hash = hashlib.sha256()
    opener = lzma.open if compression == "xz" else gzip.open
    options = {"preset": 6} if compression == "xz" else {"compresslevel": 5}
    with Path(source_path).open("rb") as source, opener(target_path, "wb", **options) as target:
        while chunk := source.read(1024 * 1024):
            original_hash.update(chunk)
            target.write(chunk)
    with Path(target_path).open("rb") as source:
        reader, _ = compressed_reader(source)
        with reader:
            restored_hash = hashlib.file_digest(reader, "sha256").hexdigest()
    if original_hash.hexdigest() != restored_hash:
        raise ValueError("Compressed daily data integrity check failed")
    return restored_hash


def identifier(value):
    if not IDENTIFIER.fullmatch(value):
        raise ValueError("Invalid cached field or table")
    return value


def field(value):
    return "json_extract(payload, '$." + identifier(value) + "')"


def build_database(path, tables, metadata):
    """Consume one table at a time; rows can be a streaming generator."""
    counts = {}
    with closing(sqlite3.connect(path)) as db:
        db.execute("PRAGMA journal_mode=OFF")
        db.execute("CREATE TABLE cache_metadata (payload TEXT NOT NULL)")
        for table, rows in tables.items():
            identifier(table)
            db.execute(f'CREATE TABLE "{table}" (payload TEXT NOT NULL)')
            db.executemany(
                f'INSERT INTO "{table}" VALUES (?)',
                ((json.dumps(row, separators=(",", ":"), allow_nan=False),) for row in rows),
            )
            counts[table] = db.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0]
            for column in ("sku", "sale_date", "platform_sku"):
                db.execute(f'CREATE INDEX "{table}_{column}" ON "{table}" ({field(column)})')
        metadata = dict(metadata, schemaVersion=1, counts=counts)
        db.execute("INSERT INTO cache_metadata VALUES (?)", (json.dumps(metadata),))
        db.commit()
    return metadata


class DailyDataCache:
    def __init__(self, tables, loader, path=None, enabled=None):
        self.tables = tuple(tables)
        self.loader = loader
        self.enabled = (os.environ.get("DAILY_DATA_CACHE", "false").lower() == "true"
                        if enabled is None else enabled)
        self.path = Path(path or os.environ.get(
            "DAILY_DATA_CACHE_PATH", str(Path(tempfile.gettempdir()) / "daily-source.sqlite3")))
        self.lock = RLock()
        self._metadata = None
        self.source_reads = 0
        self.snapshot_downloads = 0
        self.snapshot_bytes = 0
        self.snapshot_compression = None

    def _read_metadata(self, path, check=False):
        with closing(sqlite3.connect(f"{Path(path).resolve().as_uri()}?mode=ro", uri=True)) as db:
            if check and db.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise ValueError("Invalid daily data file")
            metadata = json.loads(db.execute("SELECT payload FROM cache_metadata").fetchone()[0])
            if metadata.get("schemaVersion") != 1 or not metadata.get("generation"):
                raise ValueError("Unsupported daily data file")
            for table in self.tables:
                if table not in metadata.get("counts", {}):
                    raise ValueError("Missing daily table: " + table)
                if check:
                    actual = db.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0]
                    if actual != metadata["counts"][table]:
                        raise ValueError("Daily table count mismatch: " + table)
            return metadata

    def ensure(self):
        with self.lock:
            if self._metadata is not None:
                return
            if self.path.is_file():
                self._metadata = self._read_metadata(self.path, check=True)
                return
            self.path.parent.mkdir(parents=True, exist_ok=True)
            fd, temp_name = tempfile.mkstemp(dir=self.path.parent, suffix=".sqlite3")
            os.close(fd)
            temporary = Path(temp_name)
            try:
                snapshot_url = os.environ.get("DAILY_DATA_SNAPSHOT_URL", "")
                if snapshot_url:
                    key = os.environ.get("DAILY_DATA_STORAGE_KEY", "") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
                    request = Request(snapshot_url, headers={"apikey": key, "Authorization": "Bearer " + key,
                                                            "Cache-Control": "no-cache"})
                    try:
                        with urlopen(request, timeout=180) as source, tempfile.TemporaryFile(dir=self.path.parent) as packed:
                            total = 0
                            while chunk := source.read(1024 * 1024):
                                total += len(chunk)
                                if total > MAX_UPLOAD:
                                    raise ValueError("Saved daily data is too large")
                                packed.write(chunk)
                            packed.seek(0)
                            compression = unpack_database(packed, temporary)
                        metadata = self._read_metadata(temporary, check=True)
                    except Exception:
                        raise RuntimeError("Unable to restore saved daily data; retry or publish-cache") from None
                    os.replace(temporary, self.path)
                    self._metadata = metadata
                    self.snapshot_downloads += 1
                    self.snapshot_bytes += total
                    self.snapshot_compression = compression
                    return
                timestamp = datetime.now(timezone.utc).isoformat()
                metadata = build_database(temporary, {t: self.loader(t) for t in self.tables}, {
                    "generation": timestamp, "refreshedAt": timestamp, "origin": "cold-start-recovery",
                })
                os.replace(temporary, self.path)
                self._metadata = metadata
            finally:
                temporary.unlink(missing_ok=True)

    def generation(self):
        self.ensure()
        return self._metadata["generation"]

    def status(self):
        with self.lock:
            if self.enabled and self._metadata is None and self.path.is_file():
                self._metadata = self._read_metadata(self.path)
            return dict(self._metadata or {}, enabled=self.enabled,
                        ready=self._metadata is not None, refreshPolicy="after-successful-import",
                        sourceReadsSinceStart=self.source_reads,
                        snapshotDownloadsSinceStart=self.snapshot_downloads,
                        snapshotBytesSinceStart=self.snapshot_bytes,
                        snapshotCompression=self.snapshot_compression)

    def count(self, table):
        with self.lock:
            self.ensure()
            return self._metadata["counts"][table]

    def select(self, table, params=None):
        if table not in self.tables:
            raise ValueError("Table is not a daily source")
        params = params or {}
        if isinstance(params, str):
            params = {k: values[-1] for k, values in parse_qs(params).items()}
        columns = str(params.get("select", "*"))
        if columns != "*":
            for column in columns.split(","):
                identifier(column)
        conditions, values, ordering = [], [], []
        for column, expression in params.items():
            if column in {"select", "order", "limit", "offset"}:
                continue
            target = field(column)
            operator, _, value = str(expression).partition(".")
            if expression == "not.is.null":
                conditions.append(target + " IS NOT NULL")
            elif expression == "is.null":
                conditions.append(target + " IS NULL")
            elif operator in {"eq", "gte", "lte", "gt", "lt"}:
                conditions.append(target + " " + {"eq": "=", "gte": ">=", "lte": "<=", "gt": ">", "lt": "<"}[operator] + " ?")
                values.append(value)
            else:
                raise ValueError("Unsupported daily data filter")
        for item in str(params.get("order", "")).split(","):
            if not item:
                continue
            column, *options = item.split(".")
            target = field(column)
            if "nullslast" in options:
                ordering.append(target + " IS NULL ASC")
            ordering.append(target + (" DESC" if "desc" in options else " ASC"))
        sql = f'SELECT payload FROM "{table}"'
        if conditions:
            sql += " WHERE " + " AND ".join(conditions)
        if ordering:
            sql += " ORDER BY " + ", ".join(ordering)
        limit = int(params.get("limit", -1))
        offset = int(params.get("offset", 0))
        if limit < -1 or offset < 0:
            raise ValueError("Invalid daily data page")
        sql += " LIMIT ? OFFSET ?"
        values.extend((limit, offset))
        with self.lock:
            self.ensure()
            with closing(sqlite3.connect(f"{self.path.resolve().as_uri()}?mode=ro", uri=True)) as db:
                rows = [json.loads(row[0]) for row in db.execute(sql, values)]
        if columns != "*":
            rows = [{column: row.get(column) for column in columns.split(",")} for row in rows]
        return rows

    def accept_upload(self, handler):
        """Dedicated credential, independent of the tools' interactive login."""
        token = os.environ.get("DATA_REFRESH_TOKEN", "")
        provided = handler.headers.get("Authorization", "")
        if not token or not hmac.compare_digest(provided, "Bearer " + token):
            handler.send_json({"error": "Refresh authorization required"}, status=401)
            return False
        temporary = compressed = None
        try:
            length = int(handler.headers.get("Content-Length", "0"))
            if not 0 < length <= MAX_UPLOAD:
                raise ValueError("Invalid daily data upload size")
            self.path.parent.mkdir(parents=True, exist_ok=True)
            fd, name = tempfile.mkstemp(dir=self.path.parent, suffix=".sqlite3")
            os.close(fd)
            temporary = Path(name)
            with tempfile.TemporaryFile(dir=self.path.parent) as compressed:
                remaining = length
                while remaining:
                    chunk = handler.rfile.read(min(1024 * 1024, remaining))
                    if not chunk:
                        raise ValueError("Incomplete daily data upload")
                    compressed.write(chunk)
                    remaining -= len(chunk)
                compressed.seek(0)
                compression = unpack_database(compressed, temporary)
            metadata = self._read_metadata(temporary, check=True)
            with self.lock:
                current = self.status()
                if (current.get("origin") == "verified-import"
                        and current.get("generation", "") > metadata["generation"]):
                    raise ValueError("An older daily refresh cannot replace newer data")
                os.replace(temporary, self.path)
                self._metadata = metadata
                self.snapshot_compression = compression
            return True
        except (ValueError, OSError, sqlite3.Error, EOFError, KeyError, TypeError, lzma.LZMAError):
            handler.send_json({"error": "Daily data upload rejected; existing data retained"}, status=400)
            return False
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
