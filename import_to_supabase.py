from __future__ import annotations

import csv
import hashlib
import json
import math
import os
import re
import sys
import uuid
from datetime import date, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import pandas as pd
from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parent
DEFAULT_WORKBOOK = ROOT.parents[1] / "Lastest Data Analyse - Codex.xlsx"
WORKBOOK_PATH = Path(os.environ.get("SKU_APP_WORKBOOK", DEFAULT_WORKBOOK))
UPCOMING_STOCK_FILE = Path(
    os.environ.get(
        "SKU_UPCOMING_STOCK_FILE",
        WORKBOOK_PATH.parent / "upcomingStockExport_Normal_UK_current.xlsx",
    )
)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
if SUPABASE_URL.endswith("/rest/v1"):
    SUPABASE_URL = SUPABASE_URL[:-8].rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BATCH_SIZE = int(os.environ.get("SUPABASE_IMPORT_BATCH_SIZE", "1000"))
SALES_IMPORT_MODE = os.environ.get("SUPABASE_SALES_MODE", "full").strip().lower()
SALES_ARCHIVE_DIR = Path(
    os.environ.get("SKU_SALES_ARCHIVE_DIR", WORKBOOK_PATH.parent / "Sales Data")
)
REFRESH_AS_OF = os.environ.get("SKU_REFRESH_AS_OF", "").strip()
IMPORT_TABLES = {
    name.strip()
    for name in os.environ.get("SUPABASE_IMPORT_TABLES", "").split(",")
    if name.strip()
}
ARRIVAL_SHEET_ID = os.environ.get("ARRIVAL_SHEET_ID", "1yJZc8YnlqftOOP4mF1cfQ_FovfsrNBWzTMzaJYuySpk")
ARRIVAL_SHEET_GID = os.environ.get("ARRIVAL_SHEET_GID", "1184624748")
ARRIVAL_STATUS = os.environ.get("ARRIVAL_STATUS", "Arrived").strip().lower()
PROTECTION_SHEET_ID = os.environ.get("PROTECTION_SHEET_ID", ARRIVAL_SHEET_ID)
PROTECTION_SHEET_GID = os.environ.get("PROTECTION_SHEET_GID", "644948696")

SALES_COLUMNS = (
    "sale_date",
    "platform",
    "sku",
    "sku_qty",
    "sales_amt",
    "cogs",
    "extra_freight",
    "promo_rebate",
    "selling_fee",
    "ads_fee",
    "resend_amt",
    "refund_amt",
    "profit_incl_rn",
    "postage",
)


def require_env():
    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_SERVICE_ROLE_KEY:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if missing:
        raise SystemExit(f"Missing environment variable(s): {', '.join(missing)}")
    if not WORKBOOK_PATH.exists():
        raise SystemExit(f"Workbook not found: {WORKBOOK_PATH}")
    if not UPCOMING_STOCK_FILE.exists():
        raise SystemExit(f"Upcoming stock export not found: {UPCOMING_STOCK_FILE}")
    if SALES_IMPORT_MODE not in {"full", "incremental-months"}:
        raise SystemExit(
            "SUPABASE_SALES_MODE must be 'full' or 'incremental-months'."
        )


@lru_cache(maxsize=1)
def read_powerbi():
    return pd.read_excel(WORKBOOK_PATH, sheet_name="PowerBI")


def clean_number(value, default=None):
    if value is None or pd.isna(value):
        return default
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(result):
        return default
    return result


def clean_text(value):
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    return text or None


def clean_date(value):
    if value is None or pd.isna(value):
        return None
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d", "%Y/%m/%d %H:%M:%S", "%d/%m/%Y", "%d/%m/%y"):
            try:
                return pd.to_datetime(text, format=fmt).strftime("%Y-%m-%d")
            except ValueError:
                pass
    date = pd.to_datetime(value, errors="coerce")
    if pd.isna(date):
        return None
    return date.strftime("%Y-%m-%d")


def excel_weeknum(date_value):
    jan1 = datetime(date_value.year, 1, 1)
    week1_start = jan1 - timedelta(days=(jan1.weekday() + 1) % 7)
    return ((date_value - week1_start).days // 7) + 1


def format_price_history_label(value):
    text = clean_text(value)
    if not text:
        return None
    formula_date = re.search(r"Date\(\s*(\d{4})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*\)", text, re.IGNORECASE)
    if formula_date:
        date_value = datetime(int(formula_date.group(1)), int(formula_date.group(2)), int(formula_date.group(3)))
        return f"{date_value.day}/{date_value.month}/{date_value.year} ({excel_weeknum(date_value)})"
    parsed = pd.to_datetime(text, errors="coerce")
    if not pd.isna(parsed):
        date_value = parsed.to_pydatetime()
        return f"{date_value.day}/{date_value.month}/{date_value.year} ({excel_weeknum(date_value)})"
    return text


def normalize_sku(value):
    text = clean_text(value)
    return text.upper() if text else None


def simplify_columns(df):
    df = df.copy()
    df.columns = [str(col).split("/")[0].strip() for col in df.columns]
    return df


def read_wooper_export(path):
    workbook = load_workbook(path, read_only=True, data_only=True)
    worksheet = workbook[workbook.sheetnames[0]]
    if hasattr(worksheet, "reset_dimensions"):
        worksheet.reset_dimensions()
    rows = list(worksheet.iter_rows(values_only=True))
    workbook.close()
    if not rows:
        return pd.DataFrame()
    return pd.DataFrame(rows[1:], columns=rows[0])


FREIGHT_EXCLUDED_PLATFORMS = {
    "Amazon(UK) FBA",
    "Wayfair",
    "Amazon(UK) SFP",
    "Homebase IE",
    "Debenhams IE",
    "Wowcher IE",
}
MIN_FREIGHT_UNITS = 5
MIN_COURIER_FREIGHT = 1.69


def select_suggested_freight(valid_qty, avg_actual_freight, merchant_shipping_cost):
    valid_qty = clean_number(valid_qty, 0)
    average = clean_number(avg_actual_freight, None)
    merchant = clean_number(merchant_shipping_cost, None)
    if valid_qty > MIN_FREIGHT_UNITS and average is not None and average >= MIN_COURIER_FREIGHT:
        return average
    return merchant


def build_powerbi_freight_metrics():
    df = simplify_columns(read_powerbi())
    required = {"sku_code", "platform name", "sku_qty", "postage"}
    if not required.issubset(df.columns):
        return {}
    df = df.copy()
    df["sku_norm"] = df["sku_code"].map(normalize_sku)
    df["platform_norm"] = df["platform name"].map(lambda value: clean_text(value) or "")
    df["qty_num"] = df["sku_qty"].map(lambda value: clean_number(value, 0))
    df["postage_num"] = df["postage"].map(lambda value: clean_number(value, 0))
    df = df[
        (df["sku_norm"].notna())
        & (df["postage_num"] != 0)
        & (~df["platform_norm"].isin(FREIGHT_EXCLUDED_PLATFORMS))
    ]
    metrics = {}
    for sku, group in df.groupby("sku_norm", dropna=True):
        valid_qty = float(group["qty_num"].sum())
        postage_total = float(group["postage_num"].sum())
        avg_actual = postage_total / valid_qty if valid_qty else None
        metrics[sku] = {
            "valid_qty": valid_qty,
            "avg_actual_freight": avg_actual,
        }
    return metrics


def image_urls(value):
    if not isinstance(value, str):
        return []
    seen = set()
    urls = []
    for url in re.findall(r"https?://[^,\s]+", value):
        if url not in seen:
            urls.append(url)
            seen.add(url)
    return urls


def preferred_image_url(row):
    white_bg = clean_text(row.get("White bg image"))
    if white_bg:
        urls = image_urls(white_bg)
        if urls:
            return urls[0]
    picture_urls = row.get("Picture URLs")
    if isinstance(picture_urls, str):
        for key in ("ITEMIMAGEURL12", "ITEMIMAGEURL41"):
            match = re.search(rf"{key}=(https?://[^,\s]+)", picture_urls)
            if match:
                return match.group(1).strip()
        urls = image_urls(picture_urls)
        if urls:
            return urls[0]
    return None


def image_sku_from_row(row):
    sku = normalize_sku(row.get("Unnamed: 25"))
    if sku:
        return sku
    return price_change_formula_sku(row.get("Inventory Number"))


def resolve_ca_wooper_sku(platform_sku, inventory_skus, explicit_wooper_sku=None):
    inventory_skus = {
        normalize_sku(sku) for sku in inventory_skus if normalize_sku(sku)
    }
    candidates = (
        ("exact", normalize_sku(platform_sku)),
        ("workbook", normalize_sku(explicit_wooper_sku)),
        ("rule", price_change_formula_sku(platform_sku)),
    )
    for source, candidate in candidates:
        if candidate in inventory_skus:
            return candidate, source
    return None, "unresolved"


def merge_price_history_points(points):
    merged = {}
    order = []
    for point in points:
        label = format_price_history_label(point.get("label"))
        if not label:
            continue
        existing = merged.get(label)
        if existing is None:
            merged[label] = {
                "label": label,
                "stock": point.get("stock"),
                "price": point.get("price"),
            }
            order.append(label)
            continue
        if existing.get("stock") is None and point.get("stock") is not None:
            existing["stock"] = point.get("stock")
        if existing.get("price") is None and point.get("price") is not None:
            existing["price"] = point.get("price")
    return [merged[label] for label in order]


def price_history_sku_column(label_row):
    for idx, value in enumerate(label_row):
        text = str(value or "").strip().lower()
        if text in {"inventory number", "sku", "sku code", "inventory sku"}:
            return idx
    return 0


def price_change_formula_sku(value):
    text = clean_text(value)
    if not text:
        return None
    text = text.replace(".", "D")
    if "-UK" in text:
        text = text[: text.find("-UK") + 3]
    elif "_" in text:
        text = f"{text.split('_', 1)[0]}-UK"
    else:
        text = f"{text}-UK"
    return normalize_sku(text)


def price_history_sku_from_row(raw, row_idx):
    sku = normalize_sku(raw.iat[row_idx, 0])
    if sku:
        return sku
    if raw.shape[1] > 1:
        return price_change_formula_sku(raw.iat[row_idx, 1])
    return None


def supabase_request(method, table, rows=None, query="", prefer="return=minimal"):
    url = f"{SUPABASE_URL}/rest/v1/{table}{query}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }
    body = None if rows is None else json.dumps(rows).encode("utf-8")
    request = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=120) as response:
            return response.read()
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {method} {table} failed: {exc.code} {detail}") from exc


def clear_table(table, query=""):
    supabase_request("DELETE", table, query=query)


def insert_rows(table, rows):
    total = len(rows)
    for start in range(0, total, BATCH_SIZE):
        batch = rows[start:start + BATCH_SIZE]
        supabase_request("POST", table, rows=batch)
        print(f"{table}: inserted {min(start + BATCH_SIZE, total):,}/{total:,}")


def read_rows(table, query=""):
    payload = supabase_request("GET", table, query=query)
    return json.loads(payload.decode("utf-8"))


def call_rpc(function_name, params):
    payload = supabase_request(
        "POST",
        f"rpc/{function_name}",
        rows=params,
        prefer="return=representation",
    )
    return json.loads(payload.decode("utf-8"))


def first_day_next_month(value):
    if value.month == 12:
        return date(value.year + 1, 1, 1)
    return date(value.year, value.month + 1, 1)


def sales_refresh_window(as_of=None):
    if as_of is None:
        as_of = clean_date(REFRESH_AS_OF) if REFRESH_AS_OF else date.today().isoformat()
    as_of_date = pd.Timestamp(as_of).date()
    current_start = date(as_of_date.year, as_of_date.month, 1)
    previous_day = current_start - timedelta(days=1)
    start_date = date(previous_day.year, previous_day.month, 1)
    end_date = first_day_next_month(current_start)
    months = (start_date.strftime("%Y-%m"), current_start.strftime("%Y-%m"))
    return start_date, end_date, months


def filter_sales_window(rows, start_date, end_date):
    start_text = start_date.isoformat()
    end_text = end_date.isoformat()
    return [row for row in rows if start_text <= row["sale_date"] < end_text]


def file_sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json_atomic(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    temporary.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    os.replace(temporary, path)


def archive_sales_months(powerbi_df, refresh_months, archive_dir=SALES_ARCHIVE_DIR):
    """Backfill missing monthly archives and replace only the refreshed months."""
    if "Date" not in powerbi_df.columns:
        raise RuntimeError("PowerBI sheet is missing the Date column.")

    frame = powerbi_df.copy()
    frame["__sale_date"] = pd.to_datetime(frame["Date"], errors="coerce")
    frame = frame[frame["__sale_date"].notna()].copy()
    if frame.empty:
        raise RuntimeError("PowerBI sheet has no valid dated sales rows to archive.")
    frame["__month"] = frame["__sale_date"].dt.strftime("%Y-%m")

    available_months = sorted(frame["__month"].unique())
    missing_refresh = sorted(set(refresh_months) - set(available_months))
    if missing_refresh:
        raise RuntimeError(
            "PowerBI is missing required refresh month(s): " + ", ".join(missing_refresh)
        )

    archive_dir = Path(archive_dir)
    manifest_path = archive_dir / "manifest.json"
    manifest = {"months": {}}
    if manifest_path.exists():
        try:
            loaded = json.loads(manifest_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict) and isinstance(loaded.get("months"), dict):
                manifest = loaded
        except (OSError, json.JSONDecodeError):
            raise RuntimeError(f"Monthly sales manifest is invalid: {manifest_path}")

    targets = []
    for month in available_months:
        year = month[:4]
        target = archive_dir / year / f"PowerBI Sales {month}.xlsx"
        if (
            month in refresh_months
            or not target.exists()
            or month not in manifest["months"]
        ):
            targets.append((month, target))

    results = []
    for month, target in targets:
        month_frame = frame.loc[frame["__month"] == month].drop(
            columns=["__sale_date", "__month"]
        )
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_name(f".{target.stem}.{uuid.uuid4().hex}.tmp.xlsx")
        try:
            month_frame.to_excel(temporary, sheet_name="PowerBI", index=False)
            check = pd.read_excel(temporary, sheet_name="PowerBI", usecols=["Date"])
            check_dates = pd.to_datetime(check["Date"], errors="coerce")
            if len(check) != len(month_frame) or check_dates.isna().any():
                raise RuntimeError(f"Archive validation failed for {month}.")
            if set(check_dates.dt.strftime("%Y-%m")) != {month}:
                raise RuntimeError(f"Archive {month} contains rows from another month.")
            os.replace(temporary, target)
        finally:
            if temporary.exists():
                temporary.unlink()

        entry = {
            "file": str(target.relative_to(archive_dir)).replace("\\", "/"),
            "rows": len(month_frame),
            "dashboard_rows": int(
                month_frame.get("sku_code", pd.Series(dtype=object))
                .map(normalize_sku)
                .notna()
                .sum()
            ),
            "min_date": check_dates.min().strftime("%Y-%m-%d"),
            "max_date": check_dates.max().strftime("%Y-%m-%d"),
            "sha256": file_sha256(target),
        }
        manifest["months"][month] = entry
        results.append({"month": month, **entry})

    rewritten_months = {month for month, _ in targets}
    for month in available_months:
        if month in rewritten_months:
            continue
        entry = manifest["months"].get(month)
        target = archive_dir / entry["file"] if entry else None
        if not entry or not target.exists():
            raise RuntimeError(f"Monthly sales archive is missing for {month}.")
        actual_hash = file_sha256(target)
        if actual_hash != entry.get("sha256"):
            raise RuntimeError(
                f"Closed-month sales archive changed unexpectedly: {target}"
            )
        if "dashboard_rows" not in entry:
            month_frame = frame.loc[frame["__month"] == month]
            entry["dashboard_rows"] = int(
                month_frame.get("sku_code", pd.Series(dtype=object))
                .map(normalize_sku)
                .notna()
                .sum()
            )

    manifest["source_workbook"] = str(WORKBOOK_PATH)
    manifest["generated_at"] = datetime.now().astimezone().isoformat()
    write_json_atomic(manifest_path, manifest)
    return results, manifest


def replace_sales_window(rows, start_date, end_date):
    expected_rows = len(rows)
    if expected_rows == 0:
        raise RuntimeError("Incremental sales window is empty; live sales were not changed.")

    run_id = str(uuid.uuid4())
    staging_rows = [
        {"run_id": run_id, "row_number": index, **{key: row[key] for key in SALES_COLUMNS}}
        for index, row in enumerate(rows, start=1)
    ]
    try:
        print(f"Staging {expected_rows:,} sales rows for atomic replacement...")
        insert_rows("sales_import_staging", staging_rows)
        result = call_rpc(
            "replace_sales_window_v2",
            {
                "p_run_id": run_id,
                "p_start_date": start_date.isoformat(),
                "p_end_date": end_date.isoformat(),
                "p_expected_rows": expected_rows,
            },
        )
    except Exception:
        try:
            clear_table("sales_import_staging", f"?run_id=eq.{run_id}")
        except Exception as cleanup_error:
            print(f"Warning: could not clean staging run {run_id}: {cleanup_error}")
        raise

    if not isinstance(result, dict) or result.get("inserted_rows") != expected_rows:
        raise RuntimeError(f"Unexpected incremental sales RPC result: {result!r}")
    return result


def load_channeladvisor_mappings():
    rows = read_rows(
        "sku_mappings",
        (
            "?select=external_sku,wooper_sku,status"
            "&mapping_scope=eq.channeladvisor"
            "&platform=eq."
        ),
    )
    mappings = {}
    for row in rows:
        external_sku = normalize_sku(row.get("external_sku"))
        if not external_sku:
            continue
        mappings[external_sku] = {
            "wooper_sku": normalize_sku(row.get("wooper_sku")),
            "status": clean_text(row.get("status")),
        }
    return mappings


def read_google_csv(sheet_id, gid):
    query = urlencode({"format": "csv", "gid": gid})
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?{query}"
    try:
        with urlopen(url, timeout=90) as response:
            text = response.read().decode("utf-8-sig", errors="replace").splitlines()
    except HTTPError as exc:
        if exc.code in (401, 403):
            raise RuntimeError(
                "Arrival Google Sheet is not publicly readable. Share it as 'Anyone with the link can view' or leave ARRIVAL_SHEET_ID blank."
            ) from exc
        raise
    return list(csv.DictReader(text))


def build_sales():
    df = read_powerbi()
    rows = []
    for _, row in df.iterrows():
        sku = normalize_sku(row.get("sku_code"))
        sale_date = clean_date(row.get("Date"))
        if not sku or not sale_date:
            continue
        rows.append({
            "sale_date": sale_date,
            "platform": clean_text(row.get("platform name")),
            "sku": sku,
            "sku_qty": clean_number(row.get("sku_qty"), 0),
            "sales_amt": clean_number(row.get("sales_amt"), 0),
            "cogs": clean_number(row.get("cogs"), 0),
            "extra_freight": clean_number(row.get("extra_freight"), 0),
            "promo_rebate": clean_number(row.get("promo_rebate"), 0),
            "selling_fee": clean_number(row.get("selling_fee"), 0),
            "ads_fee": clean_number(row.get("ads_fee"), 0),
            "resend_amt": clean_number(row.get("resend_amt"), 0),
            "refund_amt": clean_number(row.get("refund_amt"), 0),
            "profit_incl_rn": clean_number(row.get("profit_incl_rn"), 0),
            "postage": clean_number(row.get("postage"), 0),
        })
    return rows


def build_sku_master():
    df = simplify_columns(pd.read_excel(WORKBOOK_PATH, sheet_name="SKU"))
    rows = {}
    for _, row in df.iterrows():
        sku = normalize_sku(row.get("sku_Master"))
        if not sku:
            continue
        rows[sku] = {
            "sku": sku,
            "first_arrival_date": clean_date(row.get("First Arrival Date")),
            "cogs": clean_number(row.get("COGS")),
            "grade": clean_number(row.get("Grade")),
        }
    return list(rows.values())


def build_inventory():
    df = simplify_columns(pd.read_excel(WORKBOOK_PATH, sheet_name="Inventory Report"))
    powerbi_freight = build_powerbi_freight_metrics()
    rows = {}
    for _, row in df.iterrows():
        sku = normalize_sku(row.get("Product SKU"))
        if not sku:
            continue
        metrics = powerbi_freight.get(sku, {})
        merchant_shipping_cost = clean_number(row.get("Merchant Shipping Cost"))
        rows[sku] = {
            "sku": sku,
            "main_category": clean_text(row.get("Main Category")),
            "subcategory": clean_text(row.get("Subcategory")),
            "brand": clean_text(row.get("Brand")),
            "inventory_status": clean_text(row.get("Inventory Status")),
            "grade_level": clean_number(row.get("Grade Level")),
            "estimated_months_to_sell": clean_number(row.get("Estimated Months to Sell")),
            "daily_average_sales": clean_number(row.get("Daily Average Sales")),
            "stock_on_hand": clean_number(row.get("Total Inventory Qty")),
            "cogs": clean_number(row.get("COGS")),
            "estimated_cost_price": clean_number(row.get("Estimated Cost Price")),
            "suggested_freight": select_suggested_freight(
                metrics.get("valid_qty"),
                metrics.get("avg_actual_freight"),
                merchant_shipping_cost,
            ),
            "merchant_shipping_cost": merchant_shipping_cost,
        }
    return list(rows.values())


def build_upcoming_stock():
    if not UPCOMING_STOCK_FILE.exists():
        raise FileNotFoundError(f"Upcoming stock export not found: {UPCOMING_STOCK_FILE}")
    df = simplify_columns(read_wooper_export(UPCOMING_STOCK_FILE))
    required = {
        "Product SKU",
        "Container No.1 Stock Qty",
        "Container 1 ETA (WH)",
        "Container No.2 Stock Qty",
        "Container 2 ETA (WH)",
        "Reorder Placed Date",
        "Production Scheduled Quantity",
    }
    missing = sorted(required - set(df.columns))
    if missing:
        raise RuntimeError(
            "Upcoming stock export header changed; missing: " + ", ".join(missing)
        )
    rows = {}
    for _, row in df.iterrows():
        sku = normalize_sku(row.get("Product SKU"))
        if not sku:
            continue
        rows[sku] = {
            "sku": sku,
            "container_1_stock_qty": clean_number(row.get("Container No.1 Stock Qty")),
            "container_1_eta": clean_date(row.get("Container 1 ETA (WH)")),
            "container_2_stock_qty": clean_number(row.get("Container No.2 Stock Qty")),
            "container_2_eta": clean_date(row.get("Container 2 ETA (WH)")),
            "reorder_placed_date": clean_date(row.get("Reorder Placed Date")),
            "production_scheduled_qty": clean_number(
                row.get("Production Scheduled Quantity")
            ),
        }
    return list(rows.values())


def build_freight():
    df = simplify_columns(pd.read_excel(WORKBOOK_PATH, sheet_name="Inventory Report"))
    powerbi_freight = build_powerbi_freight_metrics()
    rows = {}
    for _, row in df.iterrows():
        sku = normalize_sku(row.get("Product SKU"))
        if not sku:
            continue
        metrics = powerbi_freight.get(sku, {})
        valid_qty = clean_number(metrics.get("valid_qty"), 0)
        avg_actual = clean_number(metrics.get("avg_actual_freight"), None)
        merchant_shipping_cost = clean_number(row.get("Merchant Shipping Cost"))
        rows[sku] = {
            "sku": sku,
            "sello_tools_calculation": merchant_shipping_cost,
            "valid_qty": valid_qty,
            "avg_actual_freight": avg_actual,
            "suggested_freight": select_suggested_freight(
                valid_qty,
                avg_actual,
                merchant_shipping_cost,
            ),
        }
    return list(rows.values())


def build_container_report():
    df = pd.read_excel(WORKBOOK_PATH, sheet_name="Container report")
    rows = {}
    for _, row in df.iterrows():
        sku = normalize_sku(row.get("SKU"))
        if not sku:
            continue
        item = {
            "invoice_number": clean_text(row.get("Invoice number")),
            "sku": sku,
            "inbound_time": clean_date(row.get("Inbound Time")),
            "latest_batch_arrival_date": clean_date(row.get("Latest Batch Arrival Date")),
            "qty": clean_number(row.get("QTY")),
            "product_type": clean_text(row.get("Product Type")),
            "status": clean_text(row.get("Status")),
            "source": "workbook",
        }
        key = (item["invoice_number"] or "workbook", item["sku"], item["inbound_time"] or "", item["qty"])
        rows[key] = item

    if ARRIVAL_SHEET_ID:
        for row in read_google_csv(ARRIVAL_SHEET_ID, ARRIVAL_SHEET_GID):
            status = clean_text(row.get("Status"))
            if (status or "").strip().lower() != ARRIVAL_STATUS:
                continue
            sku = normalize_sku(row.get("SKU"))
            inbound_time = clean_date(row.get("Inbound Time"))
            invoice_number = clean_text(row.get("Invoice number"))
            if not sku or not inbound_time:
                continue
            item = {
                "invoice_number": invoice_number,
                "sku": sku,
                "inbound_time": inbound_time,
                "latest_batch_arrival_date": clean_date(row.get("Latest Batch Arrival Date")),
                "qty": clean_number(row.get("QTY")),
                "product_type": clean_text(row.get("Product Type")),
                "status": status,
                "source": "库存到货",
            }
            key = (item["invoice_number"] or "arrival_sheet", item["sku"], item["inbound_time"], item["qty"])
            rows[key] = item
    return list(rows.values())


def build_promotion_protection_list():
    rows = {}
    if not PROTECTION_SHEET_ID:
        return []
    for source_row, row in enumerate(
        read_google_csv(PROTECTION_SHEET_ID, PROTECTION_SHEET_GID),
        start=2,
    ):
        sku = normalize_sku(row.get("SKU"))
        protection_start = clean_date(row.get("保护期開始"))
        protection_end = clean_date(row.get("保护期結束"))
        if not sku or not protection_start or not protection_end:
            continue
        if protection_end < protection_start:
            raise RuntimeError(
                f"Protection list row {source_row} ends before it starts: {sku}"
            )
        key = (sku, protection_start, protection_end)
        rows[key] = {
            "sku": sku,
            "protection_owner": clean_text(row.get("保护归属")),
            "protected_ca_price": clean_number(row.get("保护CA Price")),
            "protection_start": protection_start,
            "protection_end": protection_end,
            "source_row": source_row,
            "source_spreadsheet_id": PROTECTION_SHEET_ID,
            "source_sheet": "保護清單",
        }
    return list(rows.values())


def build_price_history():
    raw = pd.read_excel(WORKBOOK_PATH, sheet_name="Price Change", header=None)
    rows = []
    if raw.shape[0] < 3:
        return rows
    date_row = raw.iloc[0]
    label_row = raw.iloc[1]
    for row_idx in range(2, len(raw)):
        sku = price_history_sku_from_row(raw, row_idx)
        if not sku:
            continue
        points = []
        col = 5
        while col < raw.shape[1]:
            label = format_price_history_label(date_row.iat[col])
            stock_label = str(label_row.iat[col]).strip().lower()
            price_label = str(label_row.iat[col + 1]).strip().lower() if col + 1 < raw.shape[1] else ""
            if label and stock_label == "stock":
                points.append({
                    "label": label,
                    "stock": clean_number(raw.iat[row_idx, col]),
                    "price": clean_number(raw.iat[row_idx, col + 1]) if price_label == "price" else None,
                })
                col += 2
            elif label:
                points.append({
                    "label": label,
                    "stock": None,
                    "price": clean_number(raw.iat[row_idx, col]),
                })
                col += 1
            else:
                col += 1
        for sequence, point in enumerate(merge_price_history_points(points)):
            rows.append({
                "sku": sku,
                "label": point["label"],
                "sequence": sequence,
                "stock": point["stock"],
                "price": point["price"],
            })
    return rows


def build_product_images():
    df = pd.read_excel(WORKBOOK_PATH, sheet_name="Image")
    rows = {}
    for _, row in df.iterrows():
        sku = image_sku_from_row(row)
        if not sku:
            continue
        preferred = preferred_image_url(row)
        urls = ([preferred] if preferred else []) + image_urls(row.get("White bg image")) + image_urls(row.get("Picture URLs"))
        deduped = []
        seen = set()
        for url in urls:
            if url not in seen:
                deduped.append(url)
                seen.add(url)
        rows[sku] = {
            "sku": sku,
            "title": clean_text(row.get("Auction Title")),
            "brand": clean_text(row.get("Brand")),
            "image_url": deduped[0] if deduped else None,
            "image_urls": deduped,
        }
    return list(rows.values())


def build_channeladvisor_products(inventory_rows=None, manual_mappings=None):
    df = pd.read_excel(WORKBOOK_PATH, sheet_name="Image")
    if inventory_rows is None:
        inventory_rows = build_inventory()
    inventory_skus = {row["sku"] for row in inventory_rows}
    manual_mappings = manual_mappings or {}
    rows = {}
    for _, row in df.iterrows():
        platform_sku = clean_text(row.get("Inventory Number"))
        if not platform_sku:
            continue
        platform_sku = platform_sku.upper()
        saved_mapping = manual_mappings.get(platform_sku)
        saved_wooper_sku = normalize_sku(
            saved_mapping.get("wooper_sku") if saved_mapping else None
        )
        if platform_sku.endswith("-ALL"):
            wooper_sku = None
            mapping_status = "non_existing"
            mapping_source = "parent_sku_rule"
        elif saved_mapping and saved_mapping.get("status") == "non_existing":
            wooper_sku = None
            mapping_status = "non_existing"
            mapping_source = "manual"
        elif saved_wooper_sku in inventory_skus:
            wooper_sku = saved_wooper_sku
            mapping_status = "mapped"
            mapping_source = "manual"
        else:
            wooper_sku, mapping_source = resolve_ca_wooper_sku(
                platform_sku,
                inventory_skus,
                explicit_wooper_sku=row.get("Unnamed: 25"),
            )
            mapping_status = "mapped" if wooper_sku else "unresolved"
        rows[platform_sku] = {
            "platform_sku": platform_sku,
            "wooper_sku": wooper_sku,
            "ca_price": clean_number(row.get("Buy It Now Price")),
            "title": clean_text(row.get("Auction Title")),
            "brand": clean_text(row.get("Brand")),
            "mapping_status": mapping_status,
            "mapping_source": mapping_source,
        }
    return list(rows.values())


def build_promotion_sku_data(
    inventory_rows=None,
    sku_master_rows=None,
    container_rows=None,
    sales_rows=None,
):
    inventory_rows = inventory_rows if inventory_rows is not None else build_inventory()
    sku_master_rows = (
        sku_master_rows if sku_master_rows is not None else build_sku_master()
    )
    container_rows = (
        container_rows if container_rows is not None else build_container_report()
    )
    sales_rows = sales_rows if sales_rows is not None else build_sales()

    master_arrivals = {
        row["sku"]: row.get("first_arrival_date")
        for row in sku_master_rows
        if row.get("sku") and row.get("first_arrival_date")
    }
    inbound_arrivals = {}
    for row in container_rows:
        sku = normalize_sku(row.get("sku"))
        inbound_time = clean_date(row.get("inbound_time"))
        if not sku or not inbound_time:
            continue
        current = inbound_arrivals.get(sku)
        if current is None or inbound_time < current:
            inbound_arrivals[sku] = inbound_time

    totals = {}
    for row in sales_rows:
        sku = normalize_sku(row.get("sku"))
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
                "fallback_freight_total": 0.0,
                "fallback_freight_units": 0.0,
            },
        )
        item["sold_qty"] += clean_number(row.get("sku_qty"), 0)
        item["sales_amt"] += clean_number(row.get("sales_amt"), 0)
        item["net_sales"] += (
            clean_number(row.get("sales_amt"), 0)
            + clean_number(row.get("extra_freight"), 0)
            - clean_number(row.get("promo_rebate"), 0)
        )
        item["return_amount"] += (
            clean_number(row.get("refund_amt"), 0)
            + clean_number(row.get("resend_amt"), 0)
        )
        item["profit_incl_rn"] += clean_number(row.get("profit_incl_rn"), 0)
        postage = clean_number(row.get("postage"), 0)
        platform = clean_text(row.get("platform")) or ""
        if postage != 0 and platform not in FREIGHT_EXCLUDED_PLATFORMS:
            item["fallback_freight_total"] += postage
            item["fallback_freight_units"] += clean_number(row.get("sku_qty"), 0)

    rows = []
    for inventory_row in inventory_rows:
        sku = normalize_sku(inventory_row.get("sku"))
        if not sku:
            continue
        metrics = totals.get(sku, {})
        net_sales = clean_number(metrics.get("net_sales"), 0)
        merchant_shipping_cost = clean_number(
            inventory_row.get("merchant_shipping_cost"), None
        )
        freight_units = clean_number(metrics.get("fallback_freight_units"), 0)
        avg_actual_freight = (
            clean_number(metrics.get("fallback_freight_total"), 0) / freight_units
            if freight_units
            else None
        )
        suggested_freight = select_suggested_freight(
            freight_units,
            avg_actual_freight,
            merchant_shipping_cost,
        )
        rows.append(
            {
                "sku": sku,
                "main_category": inventory_row.get("main_category"),
                "subcategory": inventory_row.get("subcategory"),
                "brand": inventory_row.get("brand"),
                "inventory_status": inventory_row.get("inventory_status"),
                "grade_level": clean_number(inventory_row.get("grade_level")),
                "estimated_months_to_sell": clean_number(
                    inventory_row.get("estimated_months_to_sell")
                ),
                "stock_on_hand": clean_number(inventory_row.get("stock_on_hand")),
                "cogs": clean_number(inventory_row.get("cogs")),
                "first_arrival_date": (
                    master_arrivals.get(sku) or inbound_arrivals.get(sku)
                ),
                "suggested_freight": suggested_freight,
                "merchant_shipping_cost": merchant_shipping_cost,
                "sold_qty": clean_number(metrics.get("sold_qty"), 0),
                "sales_amt": clean_number(metrics.get("sales_amt"), 0),
                "net_sales": net_sales,
                "return_amount": clean_number(metrics.get("return_amount"), 0),
                "profit_incl_rn": clean_number(metrics.get("profit_incl_rn"), 0),
                "return_rate": (
                    clean_number(metrics.get("return_amount"), 0) / net_sales
                    if net_sales
                    else None
                ),
                "lifetime_profit_margin": (
                    clean_number(metrics.get("profit_incl_rn"), 0) / net_sales
                    if net_sales
                    else None
                ),
            }
        )
    return rows


def main():
    require_env()
    print(f"Workbook: {WORKBOOK_PATH}")
    inventory_rows = build_inventory()
    channeladvisor_mappings = load_channeladvisor_mappings()
    channeladvisor_rows = build_channeladvisor_products(
        inventory_rows,
        manual_mappings=channeladvisor_mappings,
    )
    row_cache = {"inventory": inventory_rows}

    def cached_rows(table, builder):
        def load():
            if table not in row_cache:
                row_cache[table] = builder()
            return row_cache[table]

        return load

    sales_rows = cached_rows("sales", build_sales)
    sku_master_rows = cached_rows("sku_master", build_sku_master)
    freight_rows = cached_rows("freight", build_freight)
    container_rows = cached_rows("container_report", build_container_report)
    upcoming_stock_rows = cached_rows("upcoming_stock", build_upcoming_stock)
    table_builders = [
        ("sales", sales_rows, "?id=not.is.null"),
        ("sku_master", sku_master_rows, "?sku=not.is.null"),
        ("inventory", lambda: inventory_rows, "?sku=not.is.null"),
        ("freight", freight_rows, "?sku=not.is.null"),
        ("container_report", container_rows, "?id=not.is.null"),
        ("upcoming_stock", upcoming_stock_rows, "?sku=not.is.null"),
        ("price_history", build_price_history, "?id=not.is.null"),
        ("product_images", build_product_images, "?sku=not.is.null"),
        (
            "channeladvisor_products",
            lambda: channeladvisor_rows,
            "?platform_sku=not.is.null",
        ),
        (
            "promotion_sku_data",
            lambda: build_promotion_sku_data(
                inventory_rows,
                sku_master_rows(),
                container_rows(),
                sales_rows(),
            ),
            "?sku=not.is.null",
        ),
        (
            "promotion_protection_list",
            build_promotion_protection_list,
            "?sku=not.is.null",
        ),
    ]
    if IMPORT_TABLES:
        known_tables = {table for table, _, _ in table_builders}
        unknown_tables = sorted(IMPORT_TABLES - known_tables)
        if unknown_tables:
            raise SystemExit(
                f"Unknown SUPABASE_IMPORT_TABLES value(s): {', '.join(unknown_tables)}"
            )
        table_builders = [
            item for item in table_builders if item[0] in IMPORT_TABLES
        ]
        print(
            "Selected Supabase tables: "
            + ", ".join(table for table, _, _ in table_builders)
        )
    for table, builder, delete_query in table_builders:
        rows = builder()
        if table == "sales" and SALES_IMPORT_MODE == "incremental-months":
            start_date, end_date, refresh_months = sales_refresh_window()
            print(
                f"\nArchiving monthly PowerBI sales; refreshed months: "
                f"{', '.join(refresh_months)}..."
            )
            archive_results, archive_manifest = archive_sales_months(
                read_powerbi(), refresh_months
            )
            for item in archive_results:
                print(
                    f"Sales archive {item['month']}: {item['rows']:,} rows -> "
                    f"{item['file']}"
                )
            window_rows = filter_sales_window(rows, start_date, end_date)
            archived_dashboard_rows = sum(
                archive_manifest["months"][month]["dashboard_rows"]
                for month in refresh_months
            )
            if len(window_rows) != archived_dashboard_rows:
                raise RuntimeError(
                    "Monthly archive/dashboard row mismatch: "
                    f"archives contain {archived_dashboard_rows:,} valid rows, "
                    f"import has {len(window_rows):,}."
                )
            window_months = sorted({row["sale_date"][:7] for row in window_rows})
            if window_months != list(refresh_months):
                raise RuntimeError(
                    "Incremental sales rows do not contain exactly the required months: "
                    f"expected {list(refresh_months)}, got {window_months}."
                )
            print(
                f"Replacing sales window {start_date} to {end_date} (exclusive) "
                f"with {len(window_rows):,} rows..."
            )
            result = replace_sales_window(window_rows, start_date, end_date)
            print(
                "Sales window replaced atomically: "
                f"deleted {result['deleted_rows']:,}, "
                f"inserted {result['inserted_rows']:,}, "
                f"verified {result['window_rows']:,}."
            )
            continue
        print(f"\nClearing {table}...")
        clear_table(table, delete_query)
        print(f"Uploading {len(rows):,} rows to {table}...")
        insert_rows(table, rows)
    imported_tables = {table for table, _, _ in table_builders}
    if "channeladvisor_products" in imported_tables:
        unresolved_ca = sum(
            row["mapping_status"] == "unresolved" for row in channeladvisor_rows
        )
        print(
            f"\nChannelAdvisor mappings: {unresolved_ca:,} unresolved. "
            "The promotion tool will prompt for these mappings at startup."
        )
    print("\nDone.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise

