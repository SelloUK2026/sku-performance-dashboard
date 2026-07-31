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
            "subcategory": row.get("subcategory"),×mtÚÚ$z{-®éÜj×–âÄ”4U2æ—FV×2‚’f÷"Æ–2–âÆ–6W0¢Ð¢ÖVBÒµÐ¢–bÖçVÅöÖ–æw2—2æöæS ¢ÖçVÅöÖ–æw2Ò6öÖ&–æVE÷ÆFf÷&ÕöÖ–æw2‡ÆFf÷&Ò¢–b–çfVçF÷'’—2æöæS ¢–çfVçF÷'’Òvö÷W%ö–çfVçF÷'’‚¢–bW†7Eö6÷&–6W2—2æöæS ¢W†7Eö6÷&–6W2ÂòÒ6†ææVÆGf—6÷%÷&–6W2‚¢òÂÆ–væVEö6÷&–6W2ÒÆ–våö6†ææVÆGf—6÷%÷&–6W2€¢–çfVçF÷'’À¢Ö–æw3ÖÖçVÅöÖ–æw2À¢W†7E÷&–6W3ÖW†7Eö6÷&–6W2À¢¢f÷"6÷W&6U÷&÷r–â&÷w3 ¢F&vWBÒ·Ð¢f÷"†VFW"ÂfÇVR–â6÷W&6U÷&÷ræ—FV×2‚“ ¢f–VÆBÒÆ–5öÆöö·WævWB†6ÆVåö†VFW"††VFW"’¢–bf–VÆBæBf–VÆBæ÷B–âF&vWC ¢F&vWE¶f–VÆEÒÒfÇVP¢ÆFf÷&Õ÷6·RÒ7G"€¢F&vWBævWB‚'ÆFf÷&Õ÷6·R"¢÷"F&vWBævWB‚'6·R"¢÷"F&vWBævWB‚'vö÷W%÷6·R"¢÷"" ¢’ç7G&—‚¢–bæ÷BÆFf÷&Õ÷6·S ¢6öçF–çVP¢F&vWE²'ÆFf÷&Õ÷6·R%ÒÒÆFf÷&Õ÷6·P¢ÆFf÷&Õö¶W’ÒÆFf÷&Õ÷6·RçWW"‚¢–bÖçVÅöÖ–æw2ævWB‡ÆFf÷&Õö¶W’’ÓÒäôåôU„•5D”äuõ4µS ¢6öçF–çVP¢WFöÖF–5÷6·RÒ6÷&–6U÷6·R‡ÆFf÷&Õ÷6·R¢6æöæ–6ÂÒ&W6öÇfU÷vö÷W%÷6·R€¢ÆFf÷&Õ÷6·RÀ¢–çfVçF÷'’À¢Ö–æw3ÖÖçVÅöÖ–æw2À¢W‡Æ–6—E÷vö÷W%÷6·S×F&vWBævWB‚'vö÷W%÷6·R"’À¢¢ÖF6†VBÒ6æöæ–6Â—2æ÷BæöæP¢–×÷'FVEö6÷&–6RÒçVÆÆ&ÆUöçVÖ&W"‡F&vWBævWB‚&6÷&–6R"’¢F&vWE²&6÷&–6R%ÒÒ€¢–×÷'FVEö6÷&–6P¢–b–×÷'FVEö6÷&–6R—2æ÷BæöæP¢VÇ6RW†7Eö6÷&–6W2ævWB‡ÆFf÷&Õö¶W’¢÷"Æ–væVEö6÷&–6W2ævWB†6æöæ–6Â÷"WFöÖF–5÷6·R¢¢F&vWE²'7VvvW7FVE÷6·R%ÒÒ6æöæ–6Â÷"" ¢F&vWE²'6·R%ÒÒ6æöæ–6Â÷"" ¢F&vWE²&Ö–æu÷7FGW2%ÒÒ&ÖVB"–bÖF6†VBVÇ6R'Vç&W6öÇfVB ¢–bÖF6†VC ¢ÆFf÷&Õ÷fÇVW2ÒF–7B‡F&vWB¢F&vWBÒF–7B†–çfVçF÷'•¶6æöæ–6ÅÒ¢F&vWBç÷‚'&–6R"ÂæöæR¢F&vWBç÷‚&öffW%÷&–6R"ÂæöæR¢F&vWBç÷‚&6÷&–6R"ÂæöæR¢F&vWBçWFFR‡ÆFf÷&Õ÷fÇVW2¢F&vWE²'6·R%ÒÒ6æöæ–6À¢ÖVBæVæB‡F&vWB¢&WGW&âÖV@  ¦FVbfÆ–Eö&6–5öWF†÷&—¦F–öâ††VFW%÷fÇVR“ ¢–bæ÷B†VFW%÷fÇVR÷"æ÷B†VFW%÷fÇVRç7F'G7v—F‚‚$&6–2"“ ¢&WGW&âfÇ6P¢G'“ ¢FV6öFVBÒ&6ScBæ#cFFV6öFR€¢†VFW%÷fÇVRç7Æ—B‚""Â•³ÒÀ¢fÆ–FFSÕG'VRÀ¢’æFV6öFR‚'WFbÓ‚"¢W†6WB…fÇVTW'&÷"ÂVæ–6öFTFV6öFTW'&÷"“ ¢&WGW&âfÇ6P¢W6W&æÖRÂ6W&F÷"Â77v÷&BÒFV6öFVBç'F—F–öâ‚#¢"¢–bæ÷B6W&F÷# ¢&WGW&âfÇ6P¢&WGW&â€¢†Ö2æ6ö×&UöF–vW7B‡W6W&æÖRÂ$ôÔõD”ôåôUD…õU4U$äÔR¢æB†Ö2æ6ö×&UöF–vW7B‡77v÷&BÂ$ôÔõD”ôåôUD…õ55tõ$B¢  ¦6Æ72†æFÆW"…6–×ÆT…EE&WVW7D†æFÆW"“ ¢FVbõö–æ—Eõò‡6VÆbÂ¦&w2Â¢¦·v&w2“ ¢7WW"‚’åõö–æ—Eõò‚¦&w2ÂF—&V7F÷'“×7G"…5DD”5ôD•"’Â¢¦·v&w2 ¢FVb6VæEö§6öâ‡6VÆbÂ–ÆöBÂ7FGW3Ó#“ ¢&öG’Ò§6öâæGV×2‡–ÆöBÂVç7W&Uö66–“ÔfÇ6RÂÆÆ÷uöæãÔfÇ6R’æVæ6öFR‚'WFbÓ‚"¢6VÆbç6VæE÷&W7öç6R‡7FGW2¢6VÆbç6VæEö†VFW"‚$6öçFVçBÕG—R"Â&Æ–6F–öâö§6öã²6†'6WC×WFbÓ‚"¢6VÆbç6VæEö†VFW"‚$6öçFVçBÔÆVæwF‚"Â7G"†ÆVâ†&öG’’’¢6VÆbæVæEö†VFW'2‚¢6VÆbçvf–ÆRçw&—FR†&öG’ ¢FVb&VEö§6öâ‡6VÆb“ ¢ÆVæwF‚Ò–çB‡6VÆbæ†VFW'2ævWB‚$6öçFVçBÔÆVæwF‚"Â#"’¢&WGW&â§6öâæÆöG2‡6VÆbç&f–ÆRç&VB†ÆVæwF‚’÷""'·Ò" ¢FVb&WV—&UöWF†÷&—¦F–öâ‡6VÆbÂF‚“ ¢–bF‚ÓÒ"ö’ö†VÇF‚"÷"æ÷B$ôÔõD”ôåõ$UT•$UôUDƒ ¢&WGW&âG'VP¢–bfÆ–Eö&6–5öWF†÷&—¦F–öâ‡6VÆbæ†VFW'2ævWB‚$WF†÷&—¦F–öâ"’“ ¢&WGW&âG'VP¢6VÆbç6VæE÷&W7öç6RƒC¢6VÆbç6VæEö†VFW"‚%uurÔWF†VçF–6FR"Ât&6–2&VÆÓÒ%&öÖ÷F–öâFööÂ"r¢6VÆbç6VæEö†VFW"‚$66†RÔ6öçG&öÂ"Â&æò×7F÷&R"¢6VÆbç6VæEö†VFW"‚$6öçFVçBÔÆVæwF‚"Â#"¢6VÆbæVæEö†VFW'2‚¢&WGW&âfÇ6P ¢FVbFõôtUB‡6VÆb“ ¢'6VBÒW&Ç'6R‡6VÆbçF‚¢–bæ÷B6VÆbç&WV—&UöWF†÷&—¦F–öâ‡'6VBçF‚“ ¢&WGW&à¢–b'6VBçF‚ÓÒ"ö’ö†VÇF‚# ¢6VÆbç6VæEö§6öâ€¢°¢&ö²#¢G'VRÀ¢&ÖöFR#¢'&öÖ÷F–öâ×FööÂ"À¢&FF6÷W&6R#¢$ôÔõD”ôåôDDõ4õU$4RÀ¢'7W&6R#¢7W&6UöVæ&ÆVB‚’À¢&WF…&WV—&VB#¢$ôÔõD”ôåõ$UT•$UôUD‚À¢Ð¢¢&WGW&à¢–b'6VBçF‚ÓÒ"ö’÷6×ÆR# ¢–ÆöBÒ§6öâæÆöG2…4ÕÄUõD‚ç&VE÷FW‡B†Væ6öF–æsÒ'WFbÓ‚"’¢–çfVçF÷'’Òvö÷W%ö–çfVçF÷'’‚¢W†7Eö6÷&–6W2ÂòÒ6†ææVÆGf—6÷%÷&–6W2‚¢òÂÆ–væVEö6÷&–6W2ÒÆ–våö6†ææVÆGf—6÷%÷&–6W2€¢–çfVçF÷'’À¢Ö–æw3×W'6—7FVEöÖ–æuöF–7F–öæ'’‚&6†ææVÆGf—6÷""’À¢W†7E÷&–6W3ÖW†7Eö6÷&–6W2À¢¢f÷"&÷r–â–ÆöBævWB‚'&÷w2"ÂµÒ“ ¢6·RÒ7G"‡&÷rævWB‚'6·R"’÷"""’ç7G&—‚’çWW"‚¢W&f÷&Öæ6RÒ–çfVçF÷'’ævWB‡6·RÂ·Ò¢f÷"f–VÆB–â€¢'6öÆE÷G’"À¢'6ÆW5ö×B"À¢'&WGW&å÷&FR"À¢&æ÷&ÖÅöÖ&v–â"À¢&Æ–fWF–ÖU÷&öf—EöÖ&v–â"À¢“ ¢–bW&f÷&Öæ6RævWB†f–VÆB’—2æ÷BæöæS ¢&÷u¶f–VÆEÒÒW&f÷&Öæ6U¶f–VÆEÐ¢&÷u²&öffW%÷&–6R%ÒÒ&÷rævWB‚'&–6R"¢&÷u²&6÷&–6R%ÒÒ€¢W†7Eö6÷&–6W2ævWB‡7G"‡&÷rævWB‚'ÆFf÷&Õ÷6·R"’÷"""’çWW"‚’¢÷"Æ–væVEö6÷&–6W2ævWB‡7G"‡&÷rævWB‚'6·R"’÷"""’çWW"‚’¢÷"&÷rævWB‚'&–6R"¢¢6VÆbç6VæEö§6öâ‡–ÆöB¢&WGW&à¢–b'6VBçF‚ÓÒ"ö’ö6öæf–r# ¢–çfVçF÷'’Òvö÷W%ö–çfVçF÷'’‚¢W†7Eö6÷&–6W2ÂòÒ6†ææVÆGf—6÷%÷&–6W2‚¢6öÖ–æw2ÒW'6—7FVEöÖ–æuöF–7F–öæ'’‚&6†ææVÆGf—6÷""¢6öÆ–væÖVçBÂòÒÆ–våö6†ææVÆGf—6÷%÷&–6W2€¢–çfVçF÷'’À¢Ö–æw3Ö6öÖ–æw2À¢W†7E÷&–6W3ÖW†7Eö6÷&–6W2À¢¢6öÆ–væÖVçE÷7VÖÖ'’Ò°¢7FGW3¢7VÒ€¢&÷u²&Ö–æu÷7FGW2%ÒÓÒ7FGW0¢f÷"&÷r–â6öÆ–væÖVçBçfÇVW2‚¢¢f÷"7FGW2–â‚&ÖVB"Â'Vç&W6öÇfVB"Â&æöåöW†—7F–ær"¢Ð¢6VÆbç6VæEö§6öâ€¢°¢&FVfVÇD6öÖÖ—76–öç2#¢DTdTÅEô4ôÔÔ•54”ôå2À¢'f&–&ÆT6öÖÖ—76–öåÆFf÷&×2#¢6÷'FVB€¢d$”$ÄUô4ôÔÔ•54”ôåõÄDdõ$Õ0¢’À¢'vö÷W%6·W2#¢7W&6Uö–çfVçF÷'•÷6·W2‚’÷"6÷'FVB†–çfVçF÷'’’À¢&6&–6T6÷VçB#¢ÆVâ†W†7Eö6÷&–6W2’À¢&6Æ–væÖVçE7VÖÖ'’#¢6öÆ–væÖVçE÷7VÖÖ'’À¢&6Vç&W6öÇfVB#¢Vç&W6öÇfVEö6†ææVÆGf—6÷%÷&÷w2‚’À¢&Ö–æu7F÷&vR#¢€¢'7W&6R"–b7W&6UöVæ&ÆVB‚’VÇ6R&Æö6Â ¢’À¢Ð¢¢&WGW&à¢7WW"‚’æFõôtUB‚ ¢FVbFõõõ5B‡6VÆb“ ¢'6VBÒW&Ç'6R‡6VÆbçF‚¢–bæ÷B6VÆbç&WV—&UöWF†÷&—¦F–öâ‡'6VBçF‚“ ¢&WGW&à¢G'“ ¢–b'6VBçF‚ÓÒ"ö’ö6Æ7VÆFR# ¢–ÆöBÒ6VÆbç&VEö§6öâ‚¢7&—FW&–Ò–ÆöBævWB‚&7&—FW&–"Â·Ò¢6æF–FFW2Ò°¢6Æ7VÆFUö6æF–FFR‡&÷rÂ7&—FW&–¢f÷"&÷r–â–ÆöBævWB‚'&÷w2"ÂµÒ¢Ð¢6VÆbç6VæEö§6öâ‡²&6æF–FFW2#¢6æF–FFW7Ò¢&WGW&à¢–b'6VBçF‚ÓÒ"ö’ö–×÷'B# ¢ÆVæwF‚Ò–çB‡6VÆbæ†VFW'2ævWB‚$6öçFVçBÔÆVæwF‚"Â#"’¢FFÒ6VÆbç&f–ÆRç&VB†ÆVæwF‚¢f–ÆVæÖRÒ6VÆbæ†VFW'2ævWB‚%‚Ôf–ÆVæÖR"Â""’æÆ÷vW"‚¢–bf–ÆVæÖRæVæG7v—F‚‚"æ77b"“ ¢&÷w2Ò&÷w5ög&öÕö77b†FF¢VÆ–bf–ÆVæÖRæVæG7v—F‚‚‚"ç†Ç7‚"Â"ç†Ç6Ò"’“ ¢&÷w2Ò&÷w5ög&öÕ÷v÷&¶&öö²†FF¢VÇ6S ¢6VÆbç6VæEö§6öâ€¢²&W'&÷"#¢%W6R55bÂ„Å5‚Â÷"„Å4Òf–ÆRâ'ÒÂ7FGW3ÓC ¢¢&WGW&à¢ÆFf÷&ÒÒ6VÆbæ†VFW'2ævWB‚%‚ÕÆFf÷&Ò"Â""¢ÖVBÒÖö–×÷'FVE÷&÷w2‡&÷w2ÂÆFf÷&Ó×ÆFf÷&Ò¢Vç&W6öÇfVBÒ°¢&÷rf÷"&÷r–âÖVB–b&÷rævWB‚&Ö–æu÷7FGW2"’ÓÒ'Vç&W6öÇfVB ¢Ð¢6VÆbç6VæEö§6öâ€¢°¢'&÷w2#¢ÖVBÀ¢'6÷W&6U&÷w2#¢ÆVâ‡&÷w2’À¢'Vç&W6öÇfVB#¢Vç&W6öÇfVBÀ¢Ð¢¢&WGW&à¢–b'6VBçF‚ÓÒ"ö’ö–×÷'BÖ6öÖÖ—76–öç2# ¢ÆVæwF‚Ò–çB‡6VÆbæ†VFW'2ævWB‚$6öçFVçBÔÆVæwF‚"Â#"’¢FFÒ6VÆbç&f–ÆRç&VB†ÆVæwF‚¢f–ÆVæÖRÒ6VÆbæ†VFW'2ævWB‚%‚Ôf–ÆVæÖR"Â""’æÆ÷vW"‚¢–bf–ÆVæÖRæVæG7v—F‚‚"æ77b"“ ¢&÷w2Â6öæfÆ–7G2Òæ÷&ÖÆ—6Uö6öÖÖ—76–öå÷&÷w2€¢&÷w5ög&öÕö77b†FF¢¢VÆ–bf–ÆVæÖRæVæG7v—F‚‚‚"ç†Ç7‚"Â"ç†Ç6Ò"’“ ¢&÷w2Â6öæfÆ–7G2Ò6öÖÖ—76–öå÷&÷w5ög&öÕ÷v÷&¶&öö²†FF¢VÇ6S ¢6VÆbç6VæEö§6öâ€¢²&W'&÷"#¢%W6R55bÂ„Å5‚Â÷"„Å4Òf–ÆRâ'ÒÀ¢7FGW3ÓCÀ¢¢&WGW&à¢–bæ÷B&÷w3 ¢6VÆbç6VæEö§6öâ€¢°¢&W'&÷"#¢€¢$æò6öÖÖ—76–öâ&÷w2vW&Rf÷VæBâW‡V7FVBÆFf÷&ÒÂ ¢$6FVv÷'’Â4µRÂæB6öÖÖ—76–öâ&FR6öÇVÖç2â ¢¢ÒÀ¢7FGW3ÓCÀ¢¢&WGW&à¢–b6öæfÆ–7G3 ¢6VÆbç6VæEö§6öâ€¢°¢&W'&÷"#¢€¢$6öæfÆ–7F–ær6öÖÖ—76–öâ&FW2vW&Rf÷VæBf÷"F†R ¢'6ÖRÆFf÷&ÒæB4µRâ ¢’À¢&6öæfÆ–7G2#¢6öæfÆ–7G2À¢ÒÀ¢7FGW3ÓCÀ¢¢&WGW&à¢ÆFf÷&Õö6÷VçG2Ò·Ð¢f÷"&÷r–â&÷w3 ¢ÆFf÷&ÒÒ&÷u²'ÆFf÷&Ò%Ð¢ÆFf÷&Õö6÷VçG5·ÆFf÷&ÕÒÒ€¢ÆFf÷&Õö6÷VçG2ævWB‡ÆFf÷&ÒÂ’²¢¢6VÆbç6VæEö§6öâ€¢°¢'&÷w2#¢&÷w2À¢'ÆFf÷&Ô6÷VçG2#¢ÆFf÷&Õö6÷VçG2À¢Ð¢¢&WGW&à¢–b'6VBçF‚ÓÒ"ö’öÖ–æw2# ¢–ÆöBÒ6VÆbç&VEö§6öâ‚¢Ö–æu÷66÷RÒ7G"€¢–ÆöBævWB‚&Ö–æu÷66÷R"’÷"'ÆFf÷&Ò ¢’ç7G&—‚’æÆ÷vW"‚¢–bÖ–æu÷66÷Ræ÷B–â²&6†ææVÆGf—6÷""Â'ÆFf÷&Ò'Ó ¢6VÆbç6VæEö§6öâ‡²&W'&÷"#¢$–çfÆ–BÖ–ær66÷Râ'ÒÂ7FGW3ÓC¢&WGW&à¢ÆFf÷&ÒÒ7G"‡–ÆöBævWB‚'ÆFf÷&Ò"’÷"""’ç7G&—‚¢–çfVçF÷'•÷6·W2Ò°¢7G"‡6·R’ç7G&—‚’çWW"‚¢f÷"6·R–â€¢7W&6Uö–çfVçF÷'•÷6·W2‚’÷"vö÷W%ö–çfVçF÷'’‚¢¢–b7G"‡6·R’ç7G&—‚¢Ð¢–çfÆ–EöÖ–æw2ÒµÐ¢fÆ–EöÖ–æw2ÒµÐ¢f÷"—FVÒ–â–ÆöBævWB‚&Ö–æw2"ÂµÒ“ ¢ÆFf÷&Õ÷6·RÒ7G"†—FVÒævWB‚'ÆFf÷&Õ÷6·R"’÷"""’ç7G&—‚’çWW"‚¢vö÷W%÷6·RÒ7G"†—FVÒævWB‚'vö÷W%÷6·R"’÷"""’ç7G&—‚’çWW"‚¢–bÆFf÷&Õ÷6·RæB—FVÒævWB‚&æöåöW†—7F–ær"“ ¢fÆ–EöÖ–æw2æVæB€¢°¢&W‡FW&æÅ÷6·R#¢ÆFf÷&Õ÷6·RÀ¢'vö÷W%÷6·R#¢æöæRÀ¢'7FGW2#¢&æöåöW†—7F–ær"À¢Ð¢¢6öçF–çVP¢–bæ÷BÆFf÷&Õ÷6·R÷"æ÷Bvö÷W%÷6·S ¢6öçF–çVP¢–bvö÷W%÷6·Ræ÷B–â–çfVçF÷'•÷6·W3 ¢–çfÆ–EöÖ–æw2æVæB€¢°¢'ÆFf÷&Õ÷6·R#¢ÆFf÷&Õ÷6·RÀ¢'vö÷W%÷6·R#¢vö÷W%÷6·RÀ¢Ð¢¢VÇ6S ¢fÆ–EöÖ–æw2æVæB€¢°¢&W‡FW&æÅ÷6·R#¢ÆFf÷&Õ÷6·RÀ¢'vö÷W%÷6·R#¢vö÷W%÷6·RÀ¢'7FGW2#¢&ÖVB"À¢Ð¢¢6fU÷W'6—7FVEöÖ–æw2€¢fÆ–EöÖ–æw2À¢Ö–æu÷66÷RÀ¢ÆFf÷&ÒÀ¢¢&VÖVBÒÖö–×÷'FVE÷&÷w2€¢–ÆöBævWB‚'&÷w2"ÂµÒ’À¢ÆFf÷&Ó×ÆFf÷&ÒÀ¢¢6VÆbç6VæEö§6öâ€¢°¢'&÷w2#¢&VÖVBÀ¢&–çfÆ–DÖ–æw2#¢–çfÆ–EöÖ–æw2À¢'6fVD6÷VçB#¢ÆVâ‡fÆ–EöÖ–æw2’À¢'Vç&W6öÇfVB#¢°¢&÷p¢f÷"&÷r–â&VÖV@¢–b&÷rævWB‚&Ö–æu÷7FGW2"’ÓÒ'Vç&W6öÇfVB ¢ÒÀ¢&6Vç&W6öÇfVB#¢Vç&W6öÇfVEö6†ææVÆGf—6÷%÷&÷w2‚’À¢Ð¢¢&WGW&à¢6VÆbç6VæEö§6öâ‡²&W'&÷"#¢$æ÷Bf÷VæB'ÒÂ7FGW3ÓCB¢W†6WBW†6WF–öâ2W†3 ¢6VÆbç6VæEö§6öâ‡²&W'&÷"#¢7G"†W†2—ÒÂ7FGW3ÓC  ¦FVbÖ–â‚“ ¢–b$ôÔõD”ôåôDDõ4õU$4RÓÒ'7W&6R"æBæ÷B7W&6UöVæ&ÆVB‚“ ¢&—6R'VçF–ÖTW'&÷"€¢%7W&6RFF6÷W&6R&WV—&W25U$4UõU$ÂæB ¢%5U$4Uõ4U%d”4Uõ$ôÄUô´U’â ¢¢–b$ôÔõD”ôåõ$UT•$UôUD‚æBæ÷B€¢$ôÔõD”ôåôUD…õU4U$äÔRæB$ôÔõD”ôåôUD…õ55tõ$@¢“ ¢&—6R'VçF–ÖTW'&÷"€¢%$ôÔõD”ôåõ$UT•$UôUD‚—2Væ&ÆVB'WBF†RWF†VçF–6F–öâ ¢'W6W&æÖR÷"77v÷&B—2Ö—76–ærâ ¢¢÷'BÒ–çB†÷2æVçf—&öâævWB‚%õ%B"Â#ƒƒsr"’¢†÷7BÒ÷2æVçf—&öâævWB‚$„õ5B"Â##rããã"¢6W'fW"ÒF‡&VF–æt…EE6W'fW"‚††÷7BÂ÷'B’Â†æFÆW"¢&–çB†b%&öÖ÷F–öâFööÂ'Vææ–ærB‡GG¢ò÷¶†÷7GÓ§·÷'GÒ"¢6W'fW"ç6W'fUöf÷&WfW"‚  ¦–bõöæÖUõòÓÒ%õöÖ–åõò# ¢Ö–â‚