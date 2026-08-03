from __future__ import annotations

import csv
import base64
import hmac
import io
import json
import math
import os
import re
import time
import uuid
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen

from openpyxl import load_workbook


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
SAMPLE_PATH = BASE_DIR / "sample_data.json"
MAPPINGS_PATH = BASE_DIR / "data" / "sku_mappings.json"
LIFETIME_METRICS_PATH = BASE_DIR / "data" / "lifetime_metrics.json"
NON_EXISTING_SKU = "__NON_EXISTING__"
WORKBOOK_PATH = Path(
    os.environ.get(
        "SKU_DATA_WORKBOOK",
        BASE_DIR.parent / "Lastest Data Analyse - Codex.xlsx",
    )
)
WOOPER_INVENTORY_PATH = os.environ.get("WOOPER_INVENTORY_PATH")
CHANNELADVISOR_PATH = os.environ.get("CHANNELADVISOR_PATH")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
if SUPABASE_URL.endswith("/rest/v1"):
    SUPABASE_URL = SUPABASE_URL[:-8].rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
PROMOTION_DATA_SOURCE = os.environ.get(
    "PROMOTION_DATA_SOURCE",
    "supabase" if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY else "workbook",
).strip().lower()
PROMOTION_CACHE_SECONDS = int(os.environ.get("PROMOTION_CACHE_SECONDS", "300"))
PROMOTION_AUTH_USERNAME = os.environ.get("PROMOTION_AUTH_USERNAME", "").strip()
PROMOTION_AUTH_PASSWORD = os.environ.get("PROMOTION_AUTH_PASSWORD", "")
PROMOTION_REQUIRE_AUTH = (
    os.environ.get("PROMOTION_REQUIRE_AUTH", "false").strip().lower()
    in {"1", "true", "yes", "on"}
)
_INVENTORY_CACHE = {"path": None, "mtime_ns": None, "rows": None}
_FIRST_ARRIVAL_CACHE = {"path": None, "mtime_ns": None, "rows": None}
_FREIGHT_CACHE = {"path": None, "mtime_ns": None, "rows": None}
_PERFORMANCE_CACHE = {"path": None, "mtime_ns": None, "rows": None}
_PERFORMANCE_BUILD_LOCK = Lock()
_CA_PRICE_CACHE = {
    "path": None,
    "mtime_ns": None,
    "exact": None,
    "canonical": None,
}
_SUPABASE_PROMOTION_CACHE = {"expires_at": 0.0, "rows": None}
_SUPABASE_CA_PRICE_CACHE = {
    "expires_at": 0.0,
    "exact": None,
    "canonical": None,
}
WORKTABLE_SCHEMA_VERSION = 1
MAX_WORKTABLE_SNAPSHOT_BYTES = 12 * 1024 * 1024

DEFAULT_COMMISSIONS = {
    "eBay": 0.11,
    "Amazon(UK)": 0.18,
    "Temu(UK)": 0.00,
    "Wayfair": 0.05,
    "Debenhams": 0.24,
    "Tesco": 0.18,
    "BrandAlley": 0.24,
    "Decathlon UK Limited": 0.19,
    "The Range": 0.14,
    "TikTok(Skylos)": 0.09,
    "Tiktok(Levede)": 0.09,
    "Skylous shopify": 0.00,
    "Go Groopie": 0.00,
    "Groupon(UK)": 0.00,
    "Wowcher": 0.20,
    "Onbuy": 0.15,
    "ManoMano": 0.16,
    "Fruugo": 0.20,
    "Rackham": 0.18,
}
VARIABLE_COMMISSION_PLATFORMS = {"Debenhams", "The Range"}


ALIASES = {
    "platform_sku": {
        "platform sku",
        "platform_sku",
        "merchant sku",
        "seller sku",
        "sku",
        "inventory number",
    },
    "product_id": {"product-id", "product id", "product_id", "offer id"},
    "sku": {"sku code", "sku_code"},
    "wooper_sku": {"wooper id", "wooper sku", "core sku"},
    "brand": {"brand"},
    "subcategory": {"subcategory", "sub category", "category"},
    "inventory_status": {"inventory status", "inventory_status", "status"},
    "grade": {"grade", "grade level", "grade_level"},
    "estimated_months": {
        "estimated sales month",
        "estimated months to sell",
        "estimated_months",
        "saleable months",
    },
    "sold_qty": {"soldqty", "sold qty", "sold_qty", "quantity sold"},
    "sales_amt": {"salesamt", "sales amt", "sales_amt", "sales"},
    "postage": {"postage", "shipping cost"},
    "return_rate": {"res&ref%", "return rate", "return_rate", "resend refund rate"},
    "normal_margin": {"profit% before res+ref", "normal margin", "normal_margin"},
    "offer_price": {
        "price",
        "selling price",
        "offer price",
        "current offer price",
    },
    "ca_price": {
        "buy it now price",
        "buy now price",
        "bin price",
        "ca price",
        "normal price",
    },
    "cogs": {"cogs", "cost", "cost price"},
    "stock": {"soh", "stock", "stock on hand", "total inventory qty"},
    "commission": {"commission", "platform commission", "commission rate"},
    "avg_freight": {"avg freight", "average freight", "avg_freight", "suggested freight"},
    "override_discount": {"override discount", "override_discount"},
}


def clean_header(value) -> str:
    text = re.sub(r"[\r\n_]+", " ", str(value or "")).strip().lower()
    return re.sub(r"\s+", " ", text)


def normalise_number(value, default=0.0):
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return default if not math.isfinite(float(value)) else float(value)
    text = str(value).strip().replace(",", "")
    if text.endswith("%"):
        text = text[:-1]
        try:
            return float(text) / 100
        except ValueError:
            return default
    try:
        parsed = float(text)
        return parsed if math.isfinite(parsed) else default
    except ValueError:
        return default


def nullable_number(value):
    if value is None or value == "":
        return None
    return normalise_number(value, None)


def normalise_date(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()

    text = str(value).strip()
    for date_format in ("%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(text[:10], date_format).date().isoformat()
        except ValueError:
            continue
    return None


def excel_mround(value: float, multiple: float) -> float:
    if multiple == 0:
        return value
    quotient = Decimal(str(value)) / Decimal(str(multiple))
    rounded = quotient.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return float(rounded * Decimal(str(multiple)))


def grade_key(value) -> str:
    grade = int(normalise_number(value, 0))
    return str(grade if 0 <= grade <= 7 else 0)


def ca_price_sku(platform_sku) -> str:
    """Match the workbook formula in CA Price column C."""
    text = str(platform_sku or "").strip()
    upper = text.upper()
    uk_index = upper.find("-UK")
    if uk_index >= 0:
        mapped = text[: uk_index + 3]
    elif "_" in text:
        mapped = text.split("_", 1)[0] + "-UK"
    else:
        mapped = text + "-UK"
    return mapped.replace(".", "D").upper()


def load_mappings():
    if not MAPPINGS_PATH.exists():
        return {}
    return json.loads(MAPPINGS_PATH.read_text(encoding="utf-8"))


def save_mappings(mappings):
    MAPPINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    MAPPINGS_PATH.write_text(
        json.dumps(mappings, indent=2, ensure_ascii=True), encoding="utf-8"
    )


def supabase_enabled():
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


def supabase_request(method, table, rows=None, params=None, prefer=None):
    query = urlencode(params or {}, doseq=True)
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if query:
        url = f"{url}?{query}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    body = None if rows is None else json.dumps(rows).encode("utf-8")
    request = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=120) as response:
            payload = response.read()
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Supabase {method} {table} failed: {exc.code} {detail}"
        ) from exc
    return json.loads(payload.decode("utf-8")) if payload else []


def supabase_select_all(table, params=None, page_size=1000):
    rows = []
    offset = 0
    while True:
        page_params = dict(params or {})
        page_params["limit"] = page_size
        page_params["offset"] = offset
        page = supabase_request("GET", table, params=page_params)
        rows.extend(page)
        if len(page) < page_size:
            return rows
        offset += page_size


def validate_worktable_id(value):
    try:
        return str(uuid.UUID(str(value or "")))
    except (ValueError, TypeError, AttributeError) as exc:
        raise ValueError("Invalid saved worktable ID.") from exc


def list_saved_worktables(platform="", event_name="", created_on="", limit=100):
    if not supabase_enabled():
        raise RuntimeError("Saved worktables require Supabase.")
    params = {
        "select": (
            "id,platform,event_name,source_file,source_row_count,"
            "candidate_count,eligible_count,selected_count,created_at,created_on"
        ),
        "order": "created_at.desc",
        "limit": max(1, min(int(limit or 100), 250)),
    }
    platform = str(platform or "").strip()
    event_name = str(event_name or "").strip()
    created_on = str(created_on or "").strip()
    if platform:
        params["platform"] = f"eq.{platform}"
    if event_name:
        params["event_name"] = f"ilike.*{event_name[:160]}*"
    if created_on:
        try:
            date.fromisoformat(created_on)
        except ValueError as exc:
            raise ValueError("Creation date must use YYYY-MM-DD.") from exc
        params["created_on"] = f"eq.{created_on}"
    return supabase_request("GET", "promotion_worktables", params=params)


def get_saved_worktable(worktable_id):
    if not supabase_enabled():
        raise RuntimeError("Saved worktables require Supabase.")
    rows = supabase_request(
        "GET",
        "promotion_worktables",
        params={
            "select": "*",
            "id": f"eq.{validate_worktable_id(worktable_id)}",
            "limit": 1,
        },
    )
    return rows[0] if rows else None


def create_saved_worktable(payload):
    if not supabase_enabled():
        raise RuntimeError("Saved worktables require Supabase.")
    platform = str(payload.get("platform") or "").strip()
    event_name = str(payload.get("event_name") or "").strip()
    snapshot = payload.get("snapshot")
    if not platform:
        raise ValueError("Promotion platform is required.")
    if len(platform) > 120:
        raise ValueError("Promotion platform is too long.")
    if not event_name:
        raise ValueError("Event name is required.")
    if len(event_name) > 160:
        raise ValueError("Event name is too long.")
    if not isinstance(snapshot, dict):
        raise ValueError("Worktable snapshot is required.")
    candidates = snapshot.get("candidates")
    rows = snapshot.get("rows")
    selected_skus = snapshot.get("selected_skus")
    if not isinstance(candidates, list) or not candidates:
        raise ValueError("Calculate at least one SKU before saving.")
    if not isinstance(rows, list) or not isinstance(selected_skus, list):
        raise ValueError("Worktable snapshot is incomplete.")
    snapshot = dict(snapshot)
    snapshot["schema_version"] = WORKTABLE_SCHEMA_VERSION
    encoded_snapshot = json.dumps(
        snapshot,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
    ).encode("utf-8")
    if len(encoded_snapshot) > MAX_WORKTABLE_SNAPSHOT_BYTES:
        raise ValueError("This worktable is too large to save.")
    source = snapshot.get("source") if isinstance(snapshot.get("source"), dict) else {}
    record = {
        "platform": platform,
        "event_name": event_name,
        "source_file": str(source.get("file") or "").strip() or None,
        "source_row_count": max(0, int(source.get("row_count") or len(rows))),
        "candidate_count": len(candidates),
        "eligible_count": sum(bool(row.get("eligible")) for row in candidates),
        "selected_count": len({str(sku) for sku in selected_skus if str(sku)}),
        "snapshot": snapshot,
    }
    saved = supabase_request(
        "POST",
        "promotion_worktables",
        rows=[record],
        prefer="return=representation",
    )
    if not saved:
        raise RuntimeError("Supabase did not return the saved worktable.")
    return saved[0]


def persisted_mapping_rows(
    mapping_scope,
    platform="",
    include_all_platforms=False,
):
    if not supabase_enabled():
        return []
    rows = supabase_select_all(
        "sku_mappings",
        {
            "select": "mapping_scope,platform,external_sku,wooper_sku,status",
            "mapping_scope": f"eq.{mapping_scope}",
        },
    )
    if mapping_scope == "channeladvisor":
        return [row for row in rows if not row.get("platform")]
    if include_all_platforms:
        return rows
    platform_key = str(platform or "").strip()
    return [
        row
        for row in rows
        if not row.get("platform") or row.get("platform") == platform_key
    ]


def persisted_mapping_dictionary(mapping_scope, platform=""):
    if not supabase_enabled():
        return load_mappings()
    mappings = {}
    rows = persisted_mapping_rows(mapping_scope, platform)
    rows.sort(key=lambda row: bool(row.get("platform")))
    for row in rows:
        external_sku = str(row.get("external_sku") or "").strip().upper()
        if not external_sku:
            continue
        mapped_value = (
            NON_EXISTING_SKU
            if row.get("status") == "non_existing"
            else str(row.get("wooper_sku") or "").strip().upper()
        )
        if mapped_value:
            mappings[external_sku] = mapped_value
    return mappings


def combined_platform_mappings(platform=""):
    if not supabase_enabled():
        return load_mappings()
    mappings = persisted_mapping_dictionary("channeladvisor")
    rows = persisted_mapping_rows(
        "platform",
        include_all_platforms=True,
    )
    grouped = {}
    for row in rows:
        external_sku = str(row.get("external_sku") or "").strip().upper()
        if not external_sku:
            continue
        mapped_value = (
            NON_EXISTING_SKU
            if row.get("status") == "non_existing"
            else str(row.get("wooper_sku") or "").strip().upper()
        )
        if mapped_value:
            grouped.setdefault(external_sku, set()).add(mapped_value)

    # Reuse an external SKU across marketplaces only when every saved row agrees.
    for external_sku, mapped_values in grouped.items():
        if len(mapped_values) == 1:
            mappings[external_sku] = next(iter(mapped_values))

    platform_key = str(platform or "").strip()
    current_rows = [
        row
        for row in rows
        if not row.get("platform") or row.get("platform") == platform_key
    ]
    current_rows.sort(key=lambda row: bool(row.get("platform")))
    for row in current_rows:
        external_sku = str(row.get("external_sku") or "").strip().upper()
        if not external_sku:
            continue
        mapped_value = (
            NON_EXISTING_SKU
            if row.get("status") == "non_existing"
            else str(row.get("wooper_sku") or "").strip().upper()
        )
        if mapped_value:
            mappings[external_sku] = mapped_value
    return mappings


def unresolved_channeladvisor_rows():
    if not supabase_enabled():
        return []
    return supabase_select_all(
        "channeladvisor_products",
        {
            "select": "platform_sku,title,brand,ca_price,mapping_status",
            "mapping_status": "eq.unresolved",
            "order": "platform_sku.asc",
        },
    )


def save_persisted_mappings(items, mapping_scope, platform=""):
    if not supabase_enabled():
        saved = load_mappings()
        for item in items:
            external_sku = item["external_sku"]
            saved[external_sku] = (
                NON_EXISTING_SKU
                if item["status"] == "non_existing"
                else item["wooper_sku"]
            )
        save_mappings(saved)
        return

    timestamp = datetime.now().astimezone().isoformat()
    rows = [
        {
            "mapping_scope": mapping_scope,
            "platform": "" if mapping_scope == "channeladvisor" else platform,
            "external_sku": item["external_sku"],
            "wooper_sku": item["wooper_sku"],
            "status": item["status"],
            "mapping_source": "manual",
            "updated_at": timestamp,
        }
        for item in items
    ]
    if not rows:
        return
    supabase_request(
        "POST",
        "sku_mappings",
        rows=rows,
        params={"on_conflict": "mapping_scope,platform,external_sku"},
        prefer="resolution=merge-duplicates,return=minimal",
    )
    if mapping_scope == "channeladvisor":
        product_rows = [
            {
                "platform_sku": item["external_sku"],
                "wooper_sku": item["wooper_sku"],
                "mapping_status": item["status"],
                "mapping_source": "manual",
            }
            for item in items
        ]
        supabase_request(
            "POST",
            "channeladvisor_products",
            rows=product_rows,
            params={"on_conflict": "platform_sku"},
            prefer="resolution=merge-duplicates,return=minimal",
        )


def supabase_inventory_skus():
    if not supabase_enabled():
        return []
    if PROMOTION_DATA_SOURCE == "supabase":
        return sorted(supabase_promotion_inventory())
    return sorted(
        str(row.get("sku") or "").strip().upper()
        for row in supabase_select_all("inventory", {"select": "sku"})
        if row.get("sku")
    )


def promotion_data_refreshed_at():
    if not supabase_enabled():
        return None
    rows = supabase_request(
        "GET",
        "promotion_sku_data",
        params={
            "select": "refreshed_at",
            "order": "refreshed_at.desc",
            "limit": 1,
        },
    )
    return rows[0].get("refreshed_at") if rows else None


def supabase_promotion_inventory():
    if not supabase_enabled():
        return {}
    now = time.monotonic()
    if (
        _SUPABASE_PROMOTION_CACHE["rows"] is not None
        and now …9137 tokens truncated…rm = str(first_value(platform_headers) or default_platform).strip()
        sku = str(first_value(sku_headers) or "").strip().upper()
        category = str(first_value(category_headers) or "").strip()
        commission = nullable_number(first_value(commission_headers))
        if commission is not None and commission > 1:
            commission /= 100
        if not platform or not sku or commission is None:
            continue
        if commission < 0 or commission > 1:
            continue

        canonical_platform = next(
            (
                name
                for name in DEFAULT_COMMISSIONS
                if clean_header(name) == clean_header(platform)
            ),
            platform,
        )
        key = (clean_header(canonical_platform), sku)
        existing = normalised.get(key)
        if existing and not math.isclose(
            existing["commission"],
            commission,
            abs_tol=1e-12,
        ):
            conflicts.append(
                {
                    "platform": canonical_platform,
                    "sku": sku,
                    "rates": [existing["commission"], commission],
                }
            )
            continue
        normalised[key] = {
            "platform": canonical_platform,
            "category": category,
            "sku": sku,
            "commission": commission,
        }

    return list(normalised.values()), conflicts


def commission_rows_from_workbook(data: bytes):
    workbook = load_workbook(io.BytesIO(data), data_only=True, read_only=True)
    rows = []
    conflicts = []
    for sheet in workbook.worksheets:
        sheet.reset_dimensions()
        iterator = sheet.iter_rows(values_only=True)
        headers = next(iterator, None)
        if not headers:
            continue
        source_rows = [
            {
                str(headers[index] or ""): value
                for index, value in enumerate(values)
            }
            for values in iterator
            if any(value not in (None, "") for value in values)
        ]
        sheet_rows, sheet_conflicts = normalise_commission_rows(
            source_rows,
            default_platform=sheet.title,
        )
        rows.extend(sheet_rows)
        conflicts.extend(sheet_conflicts)
    return rows, conflicts


def map_imported_rows(
    rows,
    manual_mappings=None,
    inventory=None,
    exact_ca_prices=None,
    platform="",
):
    alias_lookup = {
        alias: field for field, aliases in ALIASES.items() for alias in aliases
    }
    mapped = []
    if manual_mappings is None:
        manual_mappings = combined_platform_mappings(platform)
    if inventory is None:
        inventory = wooper_inventory()
    if exact_ca_prices is None:
        exact_ca_prices, _ = channeladvisor_prices()
    _, aligned_ca_prices = align_channeladvisor_prices(
        inventory,
        mappings=manual_mappings,
        exact_prices=exact_ca_prices,
    )
    for source_row in rows:
        target = {}
        for header, value in source_row.items():
            field = alias_lookup.get(clean_header(header))
            if field and field not in target:
                target[field] = value
        platform_sku = str(
            target.get("platform_sku")
            or target.get("sku")
            or target.get("wooper_sku")
            or ""
        ).strip()
        if not platform_sku:
            continue
        target["platform_sku"] = platform_sku
        platform_key = platform_sku.upper()
        if manual_mappings.get(platform_key) == NON_EXISTING_SKU:
            continue
        automatic_sku = ca_price_sku(platform_sku)
        canonical = resolve_wooper_sku(
            platform_sku,
            inventory,
            mappings=manual_mappings,
            explicit_wooper_sku=target.get("wooper_sku"),
        )
        matched = canonical is not None
        imported_ca_price = nullable_number(target.get("ca_price"))
        target["ca_price"] = (
            imported_ca_price
            if imported_ca_price is not None
            else exact_ca_prices.get(platform_key)
            or aligned_ca_prices.get(canonical or automatic_sku)
        )
        target["suggested_sku"] = canonical or ""
        target["sku"] = canonical or ""
        target["mapping_status"] = "mapped" if matched else "unresolved"
        if matched:
            platform_values = dict(target)
            target = dict(inventory[canonical])
            target.pop("price", None)
            target.pop("offer_price", None)
            target.pop("ca_price", None)
            target.update(platform_values)
            target["sku"] = canonical
        mapped.append(target)
    return mapped


def valid_basic_authorization(header_value):
    if not header_value or not header_value.startswith("Basic "):
        return False
    try:
        decoded = base64.b64decode(
            header_value.split(" ", 1)[1],
            validate=True,
        ).decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        return False
    username, separator, password = decoded.partition(":")
    if not separator:
        return False
    return (
        hmac.compare_digest(username, PROMOTION_AUTH_USERNAME)
        and hmac.compare_digest(password, PROMOTION_AUTH_PASSWORD)
    )


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(length) or b"{}")

    def require_authorization(self, path):
        if path == "/api/health" or not PROMOTION_REQUIRE_AUTH:
            return True
        if valid_basic_authorization(self.headers.get("Authorization")):
            return True
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="Promotion Tool"')
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", "0")
        self.end_headers()
        return False

    def do_GET(self):
        parsed = urlparse(self.path)
        if not self.require_authorization(parsed.path):
            return
        if parsed.path == "/api/health":
            self.send_json(
                {
                    "ok": True,
                    "mode": "promotion-tool",
                    "dataSource": PROMOTION_DATA_SOURCE,
                    "supabase": supabase_enabled(),
                    "authRequired": PROMOTION_REQUIRE_AUTH,
                }
            )
            return
        if parsed.path == "/api/sample":
            payload = json.loads(SAMPLE_PATH.read_text(encoding="utf-8"))
            inventory = wooper_inventory()
            exact_ca_prices, _ = channeladvisor_prices()
            _, aligned_ca_prices = align_channeladvisor_prices(
                inventory,
                mappings=persisted_mapping_dictionary("channeladvisor"),
                exact_prices=exact_ca_prices,
            )
            for row in payload.get("rows", []):
                sku = str(row.get("sku") or "").strip().upper()
                performance = inventory.get(sku, {})
                for field in (
                    "sold_qty",
                    "sales_amt",
                    "return_rate",
                    "normal_margin",
                    "lifetime_profit_margin",
                ):
                    if performance.get(field) is not None:
                        row[field] = performance[field]
                row["offer_price"] = row.get("price")
                row["ca_price"] = (
                    exact_ca_prices.get(str(row.get("platform_sku") or "").upper())
                    or aligned_ca_prices.get(str(row.get("sku") or "").upper())
                    or row.get("price")
                )
            self.send_json(payload)
            return
        if parsed.path == "/api/config":
            inventory = wooper_inventory()
            exact_ca_prices, _ = channeladvisor_prices()
            ca_mappings = persisted_mapping_dictionary("channeladvisor")
            ca_alignment, _ = align_channeladvisor_prices(
                inventory,
                mappings=ca_mappings,
                exact_prices=exact_ca_prices,
            )
            ca_alignment_summary = {
                status: sum(
                    row["mapping_status"] == status
                    for row in ca_alignment.values()
                )
                for status in ("mapped", "unresolved", "non_existing")
            }
            self.send_json(
                {
                    "defaultCommissions": DEFAULT_COMMISSIONS,
                    "variableCommissionPlatforms": sorted(
                        VARIABLE_COMMISSION_PLATFORMS
                    ),
                    "wooperSkus": supabase_inventory_skus() or sorted(inventory),
                    "caPriceCount": len(exact_ca_prices),
                    "caAlignmentSummary": ca_alignment_summary,
                    "caUnresolved": unresolved_channeladvisor_rows(),
                    "mappingStorage": (
                        "supabase" if supabase_enabled() else "local"
                    ),
                    "promotionDataRefreshedAt": promotion_data_refreshed_at(),
                }
            )
            return
        if parsed.path == "/api/worktables":
            try:
                query = parse_qs(parsed.query)
                rows = list_saved_worktables(
                    platform=(query.get("platform") or [""])[0],
                    event_name=(query.get("event_name") or [""])[0],
                    created_on=(query.get("created_on") or [""])[0],
                    limit=(query.get("limit") or [100])[0],
                )
                self.send_json({"worktables": rows})
            except ValueError as exc:
                self.send_json({"error": str(exc)}, status=400)
            except RuntimeError as exc:
                self.send_json({"error": str(exc)}, status=503)
            return
        if parsed.path.startswith("/api/worktables/"):
            try:
                record = get_saved_worktable(parsed.path.rsplit("/", 1)[-1])
                if record is None:
                    self.send_json({"error": "Saved worktable not found."}, status=404)
                else:
                    self.send_json({"worktable": record})
            except ValueError as exc:
                self.send_json({"error": str(exc)}, status=400)
            except RuntimeError as exc:
                self.send_json({"error": str(exc)}, status=503)
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if not self.require_authorization(parsed.path):
            return
        try:
            if parsed.path == "/api/worktables":
                record = create_saved_worktable(self.read_json())
                self.send_json({"worktable": record}, status=201)
                return
            if parsed.path == "/api/calculate":
                payload = self.read_json()
                criteria = payload.get("criteria", {})
                candidates = [
                    calculate_candidate(row, criteria)
                    for row in payload.get("rows", [])
                ]
                self.send_json({"candidates": candidates})
                return
            if parsed.path == "/api/import":
                length = int(self.headers.get("Content-Length", "0"))
                data = self.rfile.read(length)
                filename = self.headers.get("X-Filename", "").lower()
                if filename.endswith(".csv"):
                    rows = rows_from_csv(data)
                elif filename.endswith((".xlsx", ".xlsm")):
                    rows = rows_from_workbook(data)
                else:
                    self.send_json(
                        {"error": "Use a CSV, XLSX, or XLSM file."}, status=400
                    )
                    return
                platform = self.headers.get("X-Platform", "")
                mapped = map_imported_rows(rows, platform=platform)
                unresolved = [
                    row for row in mapped if row.get("mapping_status") == "unresolved"
                ]
                self.send_json(
                    {
                        "rows": mapped,
                        "sourceRows": len(rows),
                        "unresolved": unresolved,
                    }
                )
                return
            if parsed.path == "/api/import-commissions":
                length = int(self.headers.get("Content-Length", "0"))
                data = self.rfile.read(length)
                filename = self.headers.get("X-Filename", "").lower()
                if filename.endswith(".csv"):
                    rows, conflicts = normalise_commission_rows(
                        rows_from_csv(data)
                    )
                elif filename.endswith((".xlsx", ".xlsm")):
                    rows, conflicts = commission_rows_from_workbook(data)
                else:
                    self.send_json(
                        {"error": "Use a CSV, XLSX, or XLSM file."},
                        status=400,
                    )
                    return
                if not rows:
                    self.send_json(
                        {
                            "error": (
                                "No commission rows were found. Expected Platform, "
                                "Category, SKU, and Commission Rate columns."
                            )
                        },
                        status=400,
                    )
                    return
                if conflicts:
                    self.send_json(
                        {
                            "error": (
                                "Conflicting commission rates were found for the "
                                "same platform and SKU."
                            ),
                            "conflicts": conflicts,
                        },
                        status=400,
                    )
                    return
                platform_counts = {}
                for row in rows:
                    platform = row["platform"]
                    platform_counts[platform] = (
                        platform_counts.get(platform, 0) + 1
                    )
                self.send_json(
                    {
                        "rows": rows,
                        "platformCounts": platform_counts,
                    }
                )
                return
            if parsed.path == "/api/mappings":
                payload = self.read_json()
                mapping_scope = str(
                    payload.get("mapping_scope") or "platform"
                ).strip().lower()
                if mapping_scope not in {"channeladvisor", "platform"}:
                    self.send_json({"error": "Invalid mapping scope."}, status=400)
                    return
                platform = str(payload.get("platform") or "").strip()
                inventory_skus = {
                    str(sku).strip().upper()
                    for sku in (
                        supabase_inventory_skus() or wooper_inventory()
                    )
                    if str(sku).strip()
                }
                invalid_mappings = []
                valid_mappings = []
                for item in payload.get("mappings", []):
                    platform_sku = str(item.get("platform_sku") or "").strip().upper()
                    wooper_sku = str(item.get("wooper_sku") or "").strip().upper()
                    if platform_sku and item.get("non_existing"):
                        valid_mappings.append(
                            {
                                "external_sku": platform_sku,
                                "wooper_sku": None,
                                "status": "non_existing",
                            }
                        )
                        continue
                    if not platform_sku or not wooper_sku:
                        continue
                    if wooper_sku not in inventory_skus:
                        invalid_mappings.append(
                            {
                                "platform_sku": platform_sku,
                                "wooper_sku": wooper_sku,
                            }
                        )
                    else:
                        valid_mappings.append(
                            {
                                "external_sku": platform_sku,
                                "wooper_sku": wooper_sku,
                                "status": "mapped",
                            }
                        )
                save_persisted_mappings(
                    valid_mappings,
                    mapping_scope,
                    platform,
                )
                remapped = map_imported_rows(
                    payload.get("rows", []),
                    platform=platform,
                )
                self.send_json(
                    {
                        "rows": remapped,
                        "invalidMappings": invalid_mappings,
                        "savedCount": len(valid_mappings),
                        "unresolved": [
                            row
                            for row in remapped
                            if row.get("mapping_status") == "unresolved"
                        ],
                        "caUnresolved": unresolved_channeladvisor_rows(),
                    }
                )
                return
            self.send_json({"error": "Not found"}, status=404)
        except Exception as exc:
            self.send_json({"error": str(exc)}, status=400)


def main():
    if PROMOTION_DATA_SOURCE == "supabase" and not supabase_enabled():
        raise RuntimeError(
            "Supabase data source requires SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY."
        )
    if PROMOTION_REQUIRE_AUTH and not (
        PROMOTION_AUTH_USERNAME and PROMOTION_AUTH_PASSWORD
    ):
        raise RuntimeError(
            "PROMOTION_REQUIRE_AUTH is enabled but the authentication "
            "username or password is missing."
        )
    port = int(os.environ.get("PORT", "8877"))
    host = os.environ.get("HOST", "127.0.0.1")
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"Promotion tool running at http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
