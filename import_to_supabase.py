from __future__ import annotations

import csv
import json
import math
import os
import re
import sys
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import pandas as pd


ROOT = Path(__file__).resolve().parent
DEFAULT_WORKBOOK = ROOT.parent / "Lastest Data Analyse - Codex.xlsx"
WORKBOOK_PATH = Path(os.environ.get("SKU_APP_WORKBOOK", DEFAULT_WORKBOOK))
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
if SUPABASE_URL.endswith("/rest/v1"):
    SUPABASE_URL = SUPABASE_URL[:-8].rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BATCH_SIZE = int(os.environ.get("SUPABASE_IMPORT_BATCH_SIZE", "1000"))
ARRIVAL_SHEET_ID = os.environ.get("ARRIVAL_SHEET_ID", "1yJZc8YnlqftOOP4mF1cfQ_FovfsrNBWzTMzaJYuySpk")
ARRIVAL_SHEET_GID = os.environ.get("ARRIVAL_SHEET_GID", "1184624748")
ARRIVAL_STATUS = os.environ.get("ARRIVAL_STATUS", "Arrived").strip().lower()


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


def normalize_sku(value):
    text = clean_text(value)
    return text.upper() if text else None


def simplify_columns(df):
    df = df.copy()
    df.columns = [str(col).split("/")[0].strip() for col in df.columns]
    return df


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


def merge_price_history_points(points):
    merged = {}
    order = []
    for point in points:
        label = clean_text(point.get("label"))
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


def supabase_request(method, table, rows=None, query=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}{query}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
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
    df = pd.read_excel(WORKBOOK_PATH, sheet_name="PowerBI")
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
            "selling_fee": clean_number(row.get("selling_fee"), 0),
            "ads_fee": clean_number(row.get("ads_fee"), 0),
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
    rows = {}
    for _, row in df.iterrows():
        sku = normalize_sku(row.get("Product SKU"))
        if not sku:
            continue
        rows[sku] = {
            "sku": sku,
            "main_category": clean_text(row.get("Main Category")),
            "subcategory": clean_text(row.get("Subcategory")),
            "brand": clean_text(row.get("Brand")),
            "grade_level": clean_number(row.get("Grade Level")),
            "estimated_months_to_sell": clean_number(row.get("Estimated Months to Sell")),
            "daily_average_sales": clean_number(row.get("Daily Average Sales")),
            "stock_on_hand": clean_number(row.get("Total Inventory Qty")),
            "cogs": clean_number(row.get("COGS")),
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


def build_price_history():
    raw = pd.read_excel(WORKBOOK_PATH, sheet_name="Price Change", header=None)
    rows = []
    if raw.shape[0] < 3:
        return rows
    date_row = raw.iloc[0]
    label_row = raw.iloc[1]
    for row_idx in range(2, len(raw)):
        sku = normalize_sku(raw.iat[row_idx, 0])
        if not sku:
            continue
        points = []
        col = 5
        while col < raw.shape[1]:
            label = clean_text(date_row.iat[col])
            stock_label = str(label_row.iat[col]).strip().lower()
            price_label = str(label_row.iat[col + 1]).strip().lower() if col + 1 < raw.shape[1] else ""
            if label and stock_label == "stock":
                points.append({
                    "label": label,
                    "stock": clean_number(raw.iat[row_idx, col]),
                    "price": clean_number(raw.iat[row_idx, col + 1]) if price_label == "price" else None,
                })
                col += 2
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
        sku = normalize_sku(row.get("Unnamed: 25"))
        if not sku:
            continue
        urls = image_urls(row.get("White bg image")) + image_urls(row.get("Picture URLs"))
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


def main():
    require_env()
    print(f"Workbook: {WORKBOOK_PATH}")
    tables = [
        ("sales", build_sales(), "?id=not.is.null"),
        ("sku_master", build_sku_master(), "?sku=not.is.null"),
        ("inventory", build_inventory(), "?sku=not.is.null"),
        ("container_report", build_container_report(), "?id=not.is.null"),
        ("price_history", build_price_history(), "?id=not.is.null"),
        ("product_images", build_product_images(), "?sku=not.is.null"),
    ]
    for table, rows, delete_query in tables:
        print(f"\nClearing {table}...")
        clear_table(table, delete_query)
        print(f"Uploading {len(rows):,} rows to {table}...")
        insert_rows(table, rows)
    print("\nDone.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise
