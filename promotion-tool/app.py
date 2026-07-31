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
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.error import HTTPError
from urllib.parse import urlencode, urlparse
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


def supabase_promotion_inventory():
    if not supabase_enabled():
        return {}
    now = time.monotonic()
    if (
        _SUPABASE_PROMOTION_CACHE["rows"] is not None
        and now < _SUPABASE_PROMOTION_CACHE["expires_at"]
    ):
        return _SUPABASE_PROMOTION_CACHE["rows"]

    rows = supabase_select_all(
        "promotion_sku_data",
        {
            "select": (
                "sku,main_category,subcategory,brand,inventory_status,"
                "grade_level,estimated_months_to_sell,stock_on_hand,cogs,"
                "first_arrival_date,suggested_freight,sold_qty,sales_amt,"
                "return_rate,lifetime_profit_margin"
            ),
            "order": "sku.asc",
        },
    )
    inventory = {}
    for row in rows:
        sku = str(row.get("sku") or "").strip().upper()
        if not sku:
            continue
        inventory[sku] = {
            "sku": sku,
            "main_category": row.get("main_category"),
            "subcategory": row.get("subcategory"),
            "brand": row.get("brand"),
            "inventory_status": row.get("inventory_status"),
            "grade": nullable_number(row.get("grade_level")),
            "estimated_months": nullable_number(
                row.get("estimated_months_to_sell")
            ),
            "stock": nullable_number(row.get("stock_on_hand")),
            "cogs": nullable_number(row.get("cogs")),
            "first_arrival_date": row.get("first_arrival_date"),
            "avg_freight": nullable_number(row.get("suggested_freight")),
            "sold_qty": normalise_number(row.get("sold_qty")),
            "sales_amt": normalise_number(row.get("sales_amt")),
            "return_rate": nullable_number(row.get("return_rate")),
            "normal_margin": nullable_number(
                row.get("lifetime_profit_margin")
            ),
            "lifetime_profit_margin": nullable_number(
                row.get("lifetime_profit_margin")
            ),
        }
    _SUPABASE_PROMOTION_CACHE.update(
        {
            "expires_at": now + max(PROMOTION_CACHE_SECONDS, 0),
            "rows": inventory,
        }
    )
    return inventory


def supabase_channeladvisor_prices():
    if not supabase_enabled():
        return {}, {}
    now = time.monotonic()
    if (
        _SUPABASE_CA_PRICE_CACHE["exact"] is not None
        and now < _SUPABASE_CA_PRICE_CACHE["expires_at"]
    ):
        return (
            _SUPABASE_CA_PRICE_CACHE["exact"],
            _SUPABASE_CA_PRICE_CACHE["canonical"],
        )

    rows = supabase_select_all(
        "channeladvisor_products",
        {
            "select": (
                "platform_sku,wooper_sku,ca_price,mapping_status"
            ),
            "ca_price": "not.is.null",
            "order": "platform_sku.asc",
        },
    )
    exact = {}
    canonical_candidates = {}
    for row in rows:
        platform_sku = str(row.get("platform_sku") or "").strip().upper()
        ca_price = nullable_number(row.get("ca_price"))
        if not platform_sku or ca_price is None:
            continue
        exact[platform_sku] = ca_price
        wooper_sku = str(row.get("wooper_sku") or "").strip().upper()
        if row.get("mapping_status") == "mapped" and wooper_sku:
            canonical_candidates.setdefault(wooper_sku, set()).add(ca_price)
    canonical = {
        sku: next(iter(prices))
        for sku, prices in canonical_candidates.items()
        if len(prices) == 1
    }
    _SUPABASE_CA_PRICE_CACHE.update(
        {
            "expires_at": now + max(PROMOTION_CACHE_SECONDS, 0),
            "exact": exact,
            "canonical": canonical,
        }
    )
    return exact, canonical


def sample_inventory():
    rows = json.loads(SAMPLE_PATH.read_text(encoding="utf-8"))["rows"]
    return {str(row["sku"]).upper(): row for row in rows}


def channeladvisor_source_path():
    if CHANNELADVISOR_PATH:
        explicit_path = Path(CHANNELADVISOR_PATH)
        if explicit_path.exists():
            return explicit_path

    downloads = Path.home() / "Downloads"
    exports = sorted(
        downloads.glob("InventoryExport_Marketplace_New_Listing_Template*.xlsx"),
        key=lambda path: path.stat().st_mtime_ns,
        reverse=True,
    )
    if exports:
        return exports[0]
    return WORKBOOK_PATH


def channeladvisor_prices():
    """Return CA prices indexed by raw SKU and the legacy naming rule."""
    if PROMOTION_DATA_SOURCE == "supabase" and supabase_enabled():
        return supabase_channeladvisor_prices()

    source_path = channeladvisor_source_path()
    if not source_path.exists():
        return {}, {}

    resolved_path = str(source_path.resolve())
    mtime_ns = source_path.stat().st_mtime_ns
    if (
        _CA_PRICE_CACHE["path"] == resolved_path
        and _CA_PRICE_CACHE["mtime_ns"] == mtime_ns
        and _CA_PRICE_CACHE["exact"] is not None
    ):
        return _CA_PRICE_CACHE["exact"], _CA_PRICE_CACHE["canonical"]

    workbook = load_workbook(source_path, data_only=True, read_only=True)
    try:
        sheet = workbook["Image"] if "Image" in workbook.sheetnames else workbook.active
        sheet.reset_dimensions()
        row_iterator = sheet.iter_rows(values_only=True)
        headers = [clean_header(value) for value in next(row_iterator, ())]
        sku_index = headers.index("inventory number")
        price_index = headers.index("buy it now price")
        exact = {}
        canonical_candidates = {}
        for values in row_iterator:
            platform_sku = str(values[sku_index] or "").strip().upper()
            price = nullable_number(values[price_index])
            if not platform_sku or price is None or price <= 0:
                continue
            exact[platform_sku] = price
            canonical = ca_price_sku(platform_sku)
            canonical_candidates.setdefault(canonical, set()).add(price)
        canonical = {
            sku: next(iter(prices))
            for sku, prices in canonical_candidates.items()
            if len(prices) == 1
        }
    finally:
        workbook.close()

    _CA_PRICE_CACHE.update(
        {
            "path": resolved_path,
            "mtime_ns": mtime_ns,
            "exact": exact,
            "canonical": canonical,
        }
    )
    return exact, canonical


def align_channeladvisor_prices(inventory_skus, mappings=None, exact_prices=None):
    """Align raw ChannelAdvisor SKUs to verified Wooper SKUs."""
    inventory_skus = {str(sku).strip().upper() for sku in inventory_skus}
    mappings = {
        str(platform_sku).strip().upper(): str(wooper_sku).strip().upper()
        for platform_sku, wooper_sku in (mappings or {}).items()
    }
    if exact_prices is None:
        exact_prices, _ = channeladvisor_prices()

    records = {}
    canonical_candidates = {}
    for platform_sku, price in exact_prices.items():
        platform_key = str(platform_sku or "").strip().upper()
        if platform_key.endswith("-ALL"):
            records[platform_key] = {
                "platform_sku": platform_key,
                "wooper_sku": None,
                "ca_price": price,
                "mapping_status": "non_existing",
                "mapping_source": "parent_sku_rule",
            }
            continue

        saved_mapping = mappings.get(platform_key)
        if saved_mapping == NON_EXISTING_SKU:
            records[platform_key] = {
                "platform_sku": platform_key,
                "wooper_sku": None,
                "ca_price": price,
                "mapping_status": "non_existing",
                "mapping_source": "saved",
            }
            continue

        wooper_sku = resolve_wooper_sku(
            platform_key,
            inventory_skus,
            mappings=mappings,
        )
        if wooper_sku is None:
            mapping_status = "unresolved"
            mapping_source = "unresolved"
        elif saved_mapping == wooper_sku:
            mapping_status = "mapped"
            mapping_source = "saved"
        elif platform_key == wooper_sku:
            mapping_status = "mapped"
            mapping_source = "exact"
        else:
            mapping_status = "mapped"
            mapping_source = "rule"

        records[platform_key] = {
            "platform_sku": platform_key,
            "wooper_sku": wooper_sku,
            "ca_price": price,
            "mapping_status": mapping_status,
            "mapping_source": mapping_source,
        }
        if wooper_sku:
            canonical_candidates.setdefault(wooper_sku, set()).add(price)

    canonical_prices = {
        sku: next(iter(prices))
        for sku, prices in canonical_candidates.items()
        if len(prices) == 1
    }
    return records, canonical_prices


def inventory_source_path():
    if WOOPER_INVENTORY_PATH:
        explicit_path = Path(WOOPER_INVENTORY_PATH)
        if explicit_path.exists():
            return explicit_path

    downloads = Path.home() / "Downloads"
    exports = sorted(
        downloads.glob("InventoryReportExport_Normal_UK_*.xlsx"),
        key=lambda path: path.stat().st_mtime_ns,
        reverse=True,
    )
    if exports:
        return exports[0]
    return WORKBOOK_PATH


def workbook_inventory():
    """Load the Wooper Inventory Report and reuse it until the workbook changes."""
    source_path = inventory_source_path()
    if not source_path.exists():
        return {}

    workbook_path = str(source_path.resolve())
    mtime_ns = source_path.stat().st_mtime_ns
    if (
        _INVENTORY_CACHE["path"] == workbook_path
        and _INVENTORY_CACHE["mtime_ns"] == mtime_ns
        and _INVENTORY_CACHE["rows"] is not None
    ):
        return _INVENTORY_CACHE["rows"]

    workbook = load_workbook(source_path, data_only=True, read_only=True)
    try:
        sheet = (
            workbook["Inventory Report"]
            if "Inventory Report" in workbook.sheetnames
            else workbook.active
        )
        sheet.reset_dimensions()
        row_iterator = sheet.iter_rows(values_only=True)
        raw_headers = next(row_iterator, ())
        headers = [
            clean_header(str(value or "").split("/", 1)[0])
            for value in raw_headers
        ]
        field_headers = {
            "sku": "product sku",
            "main_category": "main category",
            "subcategory": "subcategory",
            "brand": "brand",
            "inventory_status": "inventory status",
            "grade": "grade level",
            "estimated_months": "estimated months to sell",
            "stock": "total inventory qty",
            "cogs": "cogs",
        }
        indexes = {
            field: headers.index(header)
            for field, header in field_headers.items()
            if header in headers
        }
        if "sku" not in indexes:
            raise ValueError("Inventory Report does not contain a Product SKU column")

        inventory = {}
        for values in row_iterator:
            sku = str(values[indexes["sku"]] or "").strip().upper()
            if not sku:
                continue
            inventory[sku] = {
                field: values[index]
                for field, index in indexes.items()
                if field != "sku"
            }
            inventory[sku]["sku"] = sku
    finally:
        workbook.close()

    _INVENTORY_CACHE.update(
        {"path": workbook_path, "mtime_ns": mtime_ns, "rows": inventory}
    )
    return inventory


def workbook_first_arrivals():
    """Match the dashboard's SKU-master then earliest-inbound date fallback."""
    source_path = WORKBOOK_PATH
    if not source_path.exists():
        return {}

    workbook_path = str(source_path.resolve())
    mtime_ns = source_path.stat().st_mtime_ns
    if (
        _FIRST_ARRIVAL_CACHE["path"] == workbook_path
        and _FIRST_ARRIVAL_CACHE["mtime_ns"] == mtime_ns
        and _FIRST_ARRIVAL_CACHE["rows"] is not None
    ):
        return _FIRST_ARRIVAL_CACHE["rows"]

    workbook = load_workbook(source_path, data_only=True, read_only=True)
    try:
        master_arrivals = {}
        if "SKU" in workbook.sheetnames:
            sheet = workbook["SKU"]
            sheet.reset_dimensions()
            row_iterator = sheet.iter_rows(values_only=True)
            headers = [clean_header(value) for value in next(row_iterator, ())]
            if "sku master" in headers and "first arrival date" in headers:
                sku_index = headers.index("sku master")
                arrival_index = headers.index("first arrival date")
                for values in row_iterator:
                    sku = str(values[sku_index] or "").strip().upper()
                    arrival = normalise_date(values[arrival_index])
                    if sku and arrival:
                        master_arrivals[sku] = arrival

        inbound_arrivals = {}
        if "Container report" in workbook.sheetnames:
            sheet = workbook["Container report"]
            sheet.reset_dimensions()
            row_iterator = sheet.iter_rows(values_only=True)
            headers = [clean_header(value) for value in next(row_iterator, ())]
            if "sku" in headers and "inbound time" in headers:
                sku_index = headers.index("sku")
                inbound_index = headers.index("inbound time")
                for values in row_iterator:
                    sku = str(values[sku_index] or "").strip().upper()
                    arrival = normalise_date(values[inbound_index])
                    if not sku or not arrival:
                        continue
                    existing = inbound_arrivals.get(sku)
                    if existing is None or arrival < existing:
                        inbound_arrivals[sku] = arrival

        arrivals = dict(inbound_arrivals)
        arrivals.update(master_arrivals)
    finally:
        workbook.close()

    _FIRST_ARRIVAL_CACHE.update(
        {"path": workbook_path, "mtime_ns": mtime_ns, "rows": arrivals}
    )
    return arrivals


def select_suggested_freight(
    suggested_freight,
    valid_qty,
    avg_actual_freight,
    sello_tools_calculation,
):
    suggested = nullable_number(suggested_freight)
    if suggested is not None:
        return suggested
    average = nullable_number(avg_actual_freight)
    if normalise_number(valid_qty) > 5 and average is not None:
        return average
    return nullable_number(sello_tools_calculation)


def workbook_suggested_freight():
    """Load the same per-unit suggested freight used by the SKU dashboard."""
    source_path = WORKBOOK_PATH
    if not source_path.exists():
        return {}

    workbook_path = str(source_path.resolve())
    mtime_ns = source_path.stat().st_mtime_ns
    if (
        _FREIGHT_CACHE["path"] == workbook_path
        and _FREIGHT_CACHE["mtime_ns"] == mtime_ns
        and _FREIGHT_CACHE["rows"] is not None
    ):
        return _FREIGHT_CACHE["rows"]

    workbook = load_workbook(source_path, data_only=True, read_only=True)
    try:
        if "Freight" not in workbook.sheetnames:
            return {}
        sheet = workbook["Freight"]
        sheet.reset_dimensions()
        row_iterator = sheet.iter_rows(values_only=True)
        headers = [clean_header(value) for value in next(row_iterator, ())]
        field_headers = {
            "sku": "sku",
            "suggested_freight": "suggested freight",
            "valid_qty": "valid qty",
            "avg_actual_freight": "avg actual freight",
            "sello_tools_calculation": "sello tools calculation",
        }
        indexes = {
            field: headers.index(header)
            for field, header in field_headers.items()
            if header in headers
        }
        if "sku" not in indexes:
            return {}

        freight = {}
        for values in row_iterator:
            sku = str(values[indexes["sku"]] or "").strip().upper()
            if not sku:
                continue
            value = select_suggested_freight(
                values[indexes["suggested_freight"]]
                if "suggested_freight" in indexes
                else None,
                values[indexes["valid_qty"]] if "valid_qty" in indexes else None,
                values[indexes["avg_actual_freight"]]
                if "avg_actual_freight" in indexes
                else None,
                values[indexes["sello_tools_calculation"]]
                if "sello_tools_calculation" in indexes
                else None,
            )
            if value is not None:
                freight[sku] = value
    finally:
        workbook.close()

    _FREIGHT_CACHE.update(
        {"path": workbook_path, "mtime_ns": mtime_ns, "rows": freight}
    )
    return freight


def aggregate_lifetime_metrics(rows):
    totals = {}
    for row in rows:
        sku = str(row.get("sku_code") or "").strip().upper()
        if not sku:
            continue
        item = totals.setdefault(
            sku,
            {
                "sold_qty": 0.0,
                "sales_amt": 0.0,
                "net_sales": 0.0,
                "return_amount": 0.0,
                "profit_incl_rn": 0.0,
            },
        )
        item["sold_qty"] += normalise_number(row.get("sku_qty"))
        item["sales_amt"] += normalise_number(row.get("sales_amt"))
        item["net_sales"] += (
            normalise_number(row.get("sales_amt"))
            + normalise_number(row.get("extra_freight"))
            - normalise_number(row.get("promo_rebate"))
        )
        item["return_amount"] += (
            normalise_number(row.get("refund_amt"))
            + normalise_number(row.get("resend_amt"))
        )
        item["profit_incl_rn"] += normalise_number(row.get("profit_incl_rn"))

    metrics = {}
    for sku, item in totals.items():
        net_sales = item["net_sales"]
        metrics[sku] = {
            **item,
            "return_rate": item["return_amount"] / net_sales if net_sales else None,
            "lifetime_profit_margin": (
                item["profit_incl_rn"] / net_sales if net_sales else None
            ),
            "normal_margin": (
                item["profit_incl_rn"] / net_sales if net_sales else None
            ),
        }
    return metrics


def workbook_lifetime_metrics():
    """Aggregate all-platform lifetime metrics using the dashboard definitions."""
    source_path = WORKBOOK_PATH
    if not source_path.exists():
        return {}

    workbook_path = str(source_path.resolve())
    mtime_ns = source_path.stat().st_mtime_ns
    if (
        _PERFORMANCE_CACHE["path"] == workbook_path
        and _PERFORMANCE_CACHE["mtime_ns"] == mtime_ns
        and _PERFORMANCE_CACHE["rows"] is not None
    ):
        return _PERFORMANCE_CACHE["rows"]

    with _PERFORMANCE_BUILD_LOCK:
        if (
            _PERFORMANCE_CACHE["path"] == workbook_path
            and _PERFORMANCE_CACHE["mtime_ns"] == mtime_ns
            and _PERFORMANCE_CACHE["rows"] is not None
        ):
            return _PERFORMANCE_CACHE["rows"]

        if LIFETIME_METRICS_PATH.exists():
            try:
                cached = json.loads(
                    LIFETIME_METRICS_PATH.read_text(encoding="utf-8")
                )
                if (
                    cached.get("source_path") == workbook_path
                    and cached.get("source_mtime_ns") == mtime_ns
                ):
                    metrics = cached.get("metrics", {})
                    _PERFORMANCE_CACHE.update(
                        {
                            "path": workbook_path,
                            "mtime_ns": mtime_ns,
                            "rows": metrics,
                        }
                    )
                    return metrics
            except (OSError, ValueError, TypeError):
                pass

        workbook = load_workbook(source_path, data_only=True, read_only=True)
        try:
            if "PowerBI" not in workbook.sheetnames:
                return {}
            sheet = workbook["PowerBI"]
            sheet.reset_dimensions()
            row_iterator = sheet.iter_rows(values_only=True)
            headers = [clean_header(value) for value in next(row_iterator, ())]
            field_headers = {
                "sku_code": "sku code",
                "sku_qty": "sku qty",
                "sales_amt": "sales amt",
                "extra_freight": "extra freight",
                "promo_rebate": "promo rebate",
                "resend_amt": "resend amt",
                "refund_amt": "refund amt",
                "profit_incl_rn": "profit incl rn",
            }
            indexes = {
                field: headers.index(header)
                for field, header in field_headers.items()
                if header in headers
            }
            if "sku_code" not in indexes:
                return {}
            metrics = aggregate_lifetime_metrics(
                {
                    field: values[index]
                    for field, index in indexes.items()
                }
                for values in row_iterator
            )
        finally:
            workbook.close()

        LIFETIME_METRICS_PATH.parent.mkdir(parents=True, exist_ok=True)
        cache_payload = {
            "source_path": workbook_path,
            "source_mtime_ns": mtime_ns,
            "metrics": metrics,
        }
        temporary_path = LIFETIME_METRICS_PATH.with_suffix(".tmp")
        temporary_path.write_text(
            json.dumps(cache_payload, ensure_ascii=True),
            encoding="utf-8",
        )
        temporary_path.replace(LIFETIME_METRICS_PATH)
        _PERFORMANCE_CACHE.update(
            {"path": workbook_path, "mtime_ns": mtime_ns, "rows": metrics}
        )
        return metrics


def wooper_inventory():
    if PROMOTION_DATA_SOURCE == "supabase" and supabase_enabled():
        return supabase_promotion_inventory()

    inventory = dict(workbook_inventory())
    for sku, first_arrival in workbook_first_arrivals().items():
        if sku in inventory:
            inventory[sku] = {
                **inventory[sku],
                "first_arrival_date": first_arrival,
            }
    for sku, suggested_freight in workbook_suggested_freight().items():
        if sku in inventory:
            inventory[sku] = {
                **inventory[sku],
                "avg_freight": suggested_freight,
            }
    for sku, metrics in workbook_lifetime_metrics().items():
        if sku in inventory:
            inventory[sku] = {**inventory[sku], **metrics}
    for sku, sample_row in sample_inventory().items():
        inventory[sku] = {**inventory.get(sku, {}), **sample_row, "sku": sku}
    return inventory


def resolve_wooper_sku(
    platform_sku,
    inventory_skus,
    mappings=None,
    explicit_wooper_sku=None,
):
    platform_key = str(platform_sku or "").strip().upper()
    inventory_skus = {str(sku).strip().upper() for sku in inventory_skus}
    mappings = mappings or {}
    candidates = [
        mappings.get(platform_key),
        explicit_wooper_sku,
        platform_key,
        ca_price_sku(platform_key),
    ]
    for candidate in candidates:
        candidate_key = str(candidate or "").strip().upper()
        if candidate_key and candidate_key in inventory_skus:
            return candidate_key
    return None


def calculate_candidate(row: dict, criteria: dict) -> dict:
    result = dict(row)
    legacy_price = nullable_number(row.get("price"))
    offer_price = nullable_number(row.get("offer_price"))
    if offer_price is None:
        offer_price = legacy_price
    ca_price = nullable_number(row.get("ca_price"))
    requested_price_source = str(criteria.get("price_source") or "ca").lower()
    valid_ca_price = ca_price is not None and ca_price > 0
    valid_offer_price = offer_price is not None and offer_price > 0
    if requested_price_source == "ca":
        price = ca_price if valid_ca_price else offer_price
        calculation_price_source = (
            "ca" if valid_ca_price else "offer" if valid_offer_price else None
        )
    else:
        price = offer_price if valid_offer_price else ca_price
        calculation_price_source = (
            "offer" if valid_offer_price else "ca" if valid_ca_price else None
        )
    price = price or 0
    cogs = normalise_number(row.get("cogs"))
    sold_qty = normalise_number(row.get("sold_qty"))
    postage = normalise_number(row.get("postage"))
    avg_freight = nullable_number(row.get("avg_freight"))
    if avg_freight is None:
        avg_freight = postage / sold_qty if sold_qty else 0

    commission = nullable_number(row.get("commission"))
    if commission is None:
        commission = normalise_number(criteria.get("default_commission"), 0.264)

    margins = criteria.get("grade_margins", {})
    target_margin = normalise_number(margins.get(grade_key(row.get("grade"))), 0.12)
    max_discount = normalise_number(criteria.get("max_discount"), 0.25)
    wms_rate = normalise_number(criteria.get("wms_rate"), 0.08)
    vat_rate = normalise_number(criteria.get("vat_rate"), 0.20)
    input_price_includes_vat = criteria.get("input_price_includes_vat", True)
    export_price_includes_vat = criteria.get("export_price_includes_vat", True)
    vat_multiplier = 1 + vat_rate
    calculation_price_includes_vat = (
        True if calculation_price_source == "ca" else input_price_includes_vat
    )
    price_including_vat = (
        price if calculation_price_includes_vat else price * vat_multiplier
    )

    denominator = 1 - commission - wms_rate - target_margin
    if price_including_vat <= 0 or denominator <= 0:
        suggested_discount = 0
        calculation_error = "Price or margin settings make reverse pricing impossible"
    else:
        suggested_discount = (
            1
            - (
                ((cogs + avg_freight) / denominator)
                * vat_multiplier
                / price_including_vat
            )
        )
        suggested_discount = min(suggested_discount, max_discount)
        discount_interval = normalise_number(
            criteria.get("discount_interval"),
            0.05,
        )
        if (
            criteria.get("use_discount_interval", False)
            and discount_interval > 0
            and suggested_discount > 0
        ):
            suggested_discount = (
                math.floor((suggested_discount + 1e-12) / discount_interval)
                * discount_interval
            )
        calculation_error = ""

    override_discount = nullable_number(row.get("override_discount"))
    final_discount = (
        override_discount if override_discount is not None else suggested_discount
    )
    raw_promo_price = price_including_vat * (1 - final_discount)
    if criteria.get("rounding", True):
        promo_price_including_vat = excel_mround(raw_promo_price, 0.1)
        if final_discount < max_discount:
            promo_price_including_vat -= 0.05
    else:
        promo_price_including_vat = raw_promo_price
    promo_price_including_vat = max(promo_price_including_vat, 0)

    ex_vat_price = (
        promo_price_including_vat / vat_multiplier
        if vat_multiplier
        else promo_price_including_vat
    )
    promo_price = (
        promo_price_including_vat
        if export_price_includes_vat
        else ex_vat_price
    )
    wms_fee = ex_vat_price * wms_rate
    profit = (
        ex_vat_price * (1 - commission)
        - cogs
        - avg_freight
        - wms_fee
    )
    promo_margin = profit / ex_vat_price if ex_vat_price else None

    reasons = []
    warnings = []
    if requested_price_source == "offer" and calculation_price_source == "ca":
        warnings.append("Offer price unavailable; CA price used")
    if requested_price_source == "ca" and calculation_price_source == "offer":
        warnings.append("CA price unavailable; offer price used")
    if row.get("commission_requires_review"):
        warnings.append("Commission rate needs confirmation")
    grade = normalise_number(row.get("grade"))
    stock = normalise_number(row.get("stock"))
    estimated_months = normalise_number(row.get("estimated_months"))
    return_rate = normalise_number(row.get("return_rate"))
    minimum_discount = normalise_number(criteria.get("min_discount"), 0)

    if grade < normalise_number(criteria.get("min_grade"), 0):
        reasons.append("Grade below threshold")
    if stock < normalise_number(criteria.get("min_stock"), 0):
        reasons.append("Stock below threshold")
    if estimated_months < normalise_number(criteria.get("min_months"), 0):
        reasons.append("Saleable months below threshold")
    if suggested_discount < minimum_discount:
        reasons.append("Available discount below minimum")
    if final_discount < 0:
        reasons.append("Target margin requires a price increase")

    categories = [
        clean_header(value)
        for value in criteria.get("categories", [])
        if clean_header(value)
    ]
    if categories:
        candidate_category = clean_header(row.get("subcategory"))
        if not any(category in candidate_category for category in categories):
            reasons.append("Outside selected categories")

    def selected_values(plural_key: str, singular_key: str) -> list[str]:
        raw_values = criteria.get(plural_key)
        if raw_values is None:
            raw_values = criteria.get(singular_key)
        if not isinstance(raw_values, (list, tuple, set)):
            raw_values = [raw_values]
        return [clean_header(value) for value in raw_values if clean_header(value)]

    main_categories = selected_values("main_categories", "main_category")
    if (
        main_categories
        and clean_header(row.get("main_category")) not in main_categories
    ):
        reasons.append("Outside selected main category")
    subcategories = selected_values("subcategories", "subcategory")
    if subcategories and clean_header(row.get("subcategory")) not in subcategories:
        reasons.append("Outside selected subcategory")
    brands = selected_values("brands", "brand")
    if brands and clean_header(row.get("brand")) not in brands:
        reasons.append("Outside selected brand")

    cutoff = normalise_date(criteria.get("exclude_first_arrival_on_or_after"))
    first_arrival = normalise_date(row.get("first_arrival_date"))
    if cutoff and first_arrival and first_arrival >= cutoff:
        reasons.append("First arrival is inside the excluded new-product period")

    return_review_threshold = normalise_number(
        criteria.get("max_return_rate"),
        0.06,
    )
    return_rate_review = return_rate >= return_review_threshold
    if return_rate_review:
        warnings.append(
            "Return rate is at or above "
            f"{return_review_threshold * 100:g}% review threshold"
        )

    lifetime_margin = nullable_number(row.get("lifetime_profit_margin"))
    lifetime_margin_gap = (
        lifetime_margin - promo_margin
        if lifetime_margin is not None and promo_margin is not None
        else None
    )
    margin_gap_review = (
        lifetime_margin_gap is not None
        and lifetime_margin_gap > 0.05 + 1e-12
    )
    if margin_gap_review:
        warnings.append(
            "Lifetime margin exceeds promo margin by more than 5 points"
        )

    if promo_margin is not None and promo_margin + 0.0001 < target_margin:
        if override_discount is not None:
            warnings.append("Override discount leaves margin below target")
        elif criteria.get("rounding", True):
            warnings.append("Rounding leaves margin slightly below target")
        else:
            warnings.append("Final discount leaves margin below target")
    if calculation_error:
        reasons.append(calculation_error)

    result.update(
        {
            "avg_freight": avg_freight,
            "commission": commission,
            "offer_price": offer_price,
            "ca_price": ca_price,
            "price": price,
            "price_including_vat": price_including_vat,
            "calculation_price_source": calculation_price_source,
            "requested_price_source": requested_price_source,
            "target_margin": target_margin,
            "suggested_discount": suggested_discount,
            "final_discount": final_discount,
            "use_discount_interval": criteria.get(
                "use_discount_interval",
                False,
            ),
            "discount_interval": normalise_number(
                criteria.get("discount_interval"),
                0.05,
            ),
            "promo_price": promo_price,
            "promo_price_including_vat": promo_price_including_vat,
            "promo_price_excluding_vat": ex_vat_price,
            "input_price_includes_vat": input_price_includes_vat,
            "export_price_includes_vat": export_price_includes_vat,
            "promo_profit": profit,
            "promo_margin": promo_margin,
            "return_rate_review": return_rate_review,
            "lifetime_margin_gap": lifetime_margin_gap,
            "margin_gap_review": margin_gap_review,
            "wms_fee": wms_fee,
            "eligible": not reasons,
            "reasons": reasons,
            "warnings": warnings,
        }
    )
    return result


def rows_from_csv(data: bytes):
    text = data.decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))


def rows_from_workbook(data: bytes):
    workbook = load_workbook(io.BytesIO(data), data_only=True, read_only=True)
    sheet = workbook.active
    sheet.reset_dimensions()
    iterator = sheet.iter_rows(values_only=True)
    headers = next(iterator, None)
    if not headers:
        return []
    return [
        {str(headers[index] or ""): value for index, value in enumerate(values)}
        for values in iterator
        if any(value not in (None, "") for value in values)
    ]


def normalise_commission_rows(rows, default_platform=""):
    platform_headers = {"platform", "platform name", "marketplace"}
    category_headers = {"category", "product category", "commission category"}
    sku_headers = {
        "sku",
        "sku code",
        "wooper sku",
        "core sku",
        "inventory number",
    }
    commission_headers = ALIASES["commission"] | {"rate"}
    normalised = {}
    conflicts = []

    for source_row in rows:
        cleaned = {
            clean_header(header): value
            for header, value in source_row.items()
        }

        def first_value(headers):
            return next(
                (
                    cleaned[header]
                    for header in headers
                    if header in cleaned and cleaned[header] not in (None, "")
                ),
                None,
            )

        platform = str(first_value(platform_headers) or default_platform).strip()
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
                }
            )
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if not self.require_authorization(parsed.path):
            return
        try:
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
