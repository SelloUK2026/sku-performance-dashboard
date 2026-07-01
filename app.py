from __future__ import annotations

import json
import math
import os
import re
import time
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse

import pandas as pd


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
DEFAULT_WORKBOOK = ROOT.parent / "Lastest Data Analyse - Codex.xlsx"
WORKBOOK_PATH = Path(os.environ.get("SKU_APP_WORKBOOK", DEFAULT_WORKBOOK))
GOOGLE_SHEET_ID = os.environ.get("GOOGLE_SHEET_ID", "17fj9gaoE4U5_Ks_EkI68CPBBPIjjbDYMkifG1SqbBAg")
SOURCE_MODE = os.environ.get("SKU_APP_SOURCE", "excel").strip().lower()
CACHE_SECONDS = int(os.environ.get("SKU_APP_CACHE_SECONDS", "900"))

DEFAULT_GOOGLE_GIDS = {
    "Sheet1": "1716425068",
    "PowerBI": "52402949",
    "SKU": "89826798",
    "Inventory Report": "477705650",
    "Container report": "589906690",
    "Price Change": "1378873325",
    "Month": "359291539",
    "Freight": "1871717919",
    "Bank": "188099649",
    "Image": "1122166894",
}


class DataSourceError(RuntimeError):
    pass


def clean_number(value, default=0.0):
    if value is None:
        return default
    try:
        if pd.isna(value):
            return default
    except TypeError:
        pass
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(result):
        return default
    return result


def clean_value(value):
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    if isinstance(value, pd.Timestamp):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def simplify_columns(df):
    df = df.copy()
    df.columns = [str(c).split("/")[0].strip() for c in df.columns]
    return df


def normalize_sku(value):
    if value is None:
        return ""
    return str(value).strip().upper()


def first_image_url(value):
    if not isinstance(value, str):
        return ""
    match = re.search(r"https?://[^,\s]+", value)
    return match.group(0) if match else ""


def table_records(df):
    return [
        {key: clean_value(value) for key, value in row.items()}
        for row in df.replace({pd.NA: None}).to_dict(orient="records")
    ]


class DataStore:
    def __init__(self, workbook_path: Path, source_mode: str = SOURCE_MODE, google_sheet_id: str = GOOGLE_SHEET_ID):
        self.workbook_path = workbook_path
        self.source_mode = source_mode
        self.google_sheet_id = google_sheet_id
        self.mtime = None
        self.loaded_at = 0.0
        self.data = None

    def get(self):
        current_mtime = self.current_version()
        if self.data is None or self.mtime != current_mtime:
            self.data = self.load()
            self.mtime = current_mtime
            self.loaded_at = time.time()
        return self.data

    def current_version(self):
        if self.source_mode == "google":
            return int(time.time() / max(CACHE_SECONDS, 60))
        return self.workbook_path.stat().st_mtime

    def read_sheet(self, sheet_name, **kwargs):
        if self.source_mode == "google":
            gid = DEFAULT_GOOGLE_GIDS[sheet_name]
            url = f"https://docs.google.com/spreadsheets/d/{self.google_sheet_id}/export?format=csv&gid={gid}"
            try:
                return pd.read_csv(url, **kwargs)
            except HTTPError as exc:
                if exc.code in (401, 403):
                    raise DataSourceError(
                        "Google Sheet is not publicly readable. Set sharing to 'Anyone with the link can view', then redeploy or wait for the cache to refresh."
                    ) from exc
                raise
        return pd.read_excel(self.workbook_path, sheet_name=sheet_name, **kwargs)

    def load(self):
        powerbi = self.read_sheet("PowerBI")
        powerbi["Date"] = pd.to_datetime(powerbi["Date"], errors="coerce")
        powerbi["sku_norm"] = powerbi["sku_code"].map(normalize_sku)
        powerbi = powerbi[powerbi["sku_norm"] != ""].copy()

        sku = simplify_columns(self.read_sheet("SKU"))
        sku["sku_norm"] = sku["sku_Master"].map(normalize_sku)

        inventory = simplify_columns(self.read_sheet("Inventory Report"))
        inventory["sku_norm"] = inventory["Product SKU"].map(normalize_sku)

        container = self.read_sheet("Container report")
        container["sku_norm"] = container["SKU"].map(normalize_sku)
        container["Inbound Time"] = pd.to_datetime(container["Inbound Time"], errors="coerce")
        container["Latest Batch Arrival Date"] = pd.to_datetime(container["Latest Batch Arrival Date"], errors="coerce")

        image = self.read_sheet("Image")
        image["sku_norm"] = image["Unnamed: 25"].map(normalize_sku)
        image["image_url"] = image["White bg image"].fillna("").astype(str)
        missing = image["image_url"].str.strip().eq("")
        image.loc[missing, "image_url"] = image.loc[missing, "Picture URLs"].map(first_image_url)

        price_history = self.load_price_history()

        max_date = powerbi["Date"].max()
        min_date = powerbi["Date"].min()
        last_update = self.read_last_update()

        sku_options = self.build_sku_options(powerbi, sku, inventory, image)

        return {
            "powerbi": powerbi,
            "sku": sku,
            "inventory": inventory,
            "container": container,
            "image": image,
            "price_history": price_history,
            "meta": {
                "source": "Google Sheets" if self.source_mode == "google" else "Excel workbook",
                "workbook": str(self.workbook_path) if self.source_mode != "google" else f"https://docs.google.com/spreadsheets/d/{self.google_sheet_id}",
                "lastUpdate": last_update,
                "dataStart": clean_value(min_date),
                "dataEnd": clean_value(max_date),
                "skuCount": len(sku_options),
                "salesRows": int(len(powerbi)),
                "cacheSeconds": CACHE_SECONDS if self.source_mode == "google" else 0,
            },
            "skuOptions": sku_options,
        }

    def read_last_update(self):
        try:
            sheet1 = self.read_sheet("Sheet1", header=None, nrows=2, usecols=[0, 1])
            return clean_value(sheet1.iloc[0, 1])
        except Exception:
            if self.source_mode == "google":
                return clean_value(datetime.now())
            return clean_value(datetime.fromtimestamp(self.workbook_path.stat().st_mtime))

    def build_sku_options(self, powerbi, sku, inventory, image):
        sku_values = sorted(set(powerbi["sku_norm"]) | set(sku["sku_norm"]) | set(inventory["sku_norm"]))
        titles = image.drop_duplicates("sku_norm").set_index("sku_norm")["Auction Title"].to_dict()
        categories = inventory.drop_duplicates("sku_norm").set_index("sku_norm")["Main Category"].to_dict()
        result = []
        for sku_code in sku_values:
            if not sku_code:
                continue
            title = clean_value(titles.get(sku_code)) or ""
            category = clean_value(categories.get(sku_code)) or ""
            label = f"{sku_code} - {title}" if title else sku_code
            result.append({"sku": sku_code, "label": label, "title": title, "category": category})
        return result

    def load_price_history(self):
        raw = self.read_sheet("Price Change", header=None)
        records = {}
        if raw.shape[0] < 3:
            return records
        date_row = raw.iloc[0]
        label_row = raw.iloc[1]
        for row_idx in range(2, len(raw)):
            sku_code = normalize_sku(raw.iat[row_idx, 0])
            if not sku_code:
                continue
            points = []
            col = 5
            while col < raw.shape[1]:
                date_label = date_row.iat[col]
                stock_label = str(label_row.iat[col]).strip().lower()
                price_label = str(label_row.iat[col + 1]).strip().lower() if col + 1 < raw.shape[1] else ""
                if pd.notna(date_label) and stock_label == "stock":
                    points.append({
                        "label": str(date_label),
                        "stock": clean_number(raw.iat[row_idx, col], None),
                        "price": clean_number(raw.iat[row_idx, col + 1], None) if price_label == "price" else None,
                    })
                    col += 2
                else:
                    col += 1
            records[sku_code] = points
        return records


store = DataStore(WORKBOOK_PATH)


def aggregate_sales(df):
    if df.empty:
        return []
    grouped = df.groupby("platform name", dropna=False).agg(
        sku_qty=("sku_qty", "sum"),
        sales_amt=("sales_amt", "sum"),
        selling_fee=("selling_fee", "sum"),
        ads_fee=("ads_fee", "sum"),
        refund_amt=("refund_amt", "sum"),
        profit_incl_rn=("profit_incl_rn", "sum"),
    ).reset_index()
    grouped["selling_fee_pct"] = grouped.apply(lambda r: clean_number(r["selling_fee"]) / clean_number(r["sales_amt"]) if clean_number(r["sales_amt"]) else None, axis=1)
    grouped["ads_fee_pct"] = grouped.apply(lambda r: clean_number(r["ads_fee"]) / clean_number(r["sales_amt"]) if clean_number(r["sales_amt"]) else None, axis=1)
    grouped["return_pct"] = grouped.apply(lambda r: clean_number(r["refund_amt"]) / clean_number(r["sales_amt"]) if clean_number(r["sales_amt"]) else None, axis=1)
    grouped["profit_margin"] = grouped.apply(lambda r: clean_number(r["profit_incl_rn"]) / clean_number(r["sales_amt"]) if clean_number(r["sales_amt"]) else None, axis=1)
    grouped["unit_price"] = grouped.apply(lambda r: clean_number(r["sales_amt"]) / clean_number(r["sku_qty"]) * 1.2 if clean_number(r["sku_qty"]) else None, axis=1)

    total = {
        "platform name": "Grand Total",
        "sku_qty": grouped["sku_qty"].sum(),
        "sales_amt": grouped["sales_amt"].sum(),
        "selling_fee": grouped["selling_fee"].sum(),
        "ads_fee": grouped["ads_fee"].sum(),
        "refund_amt": grouped["refund_amt"].sum(),
        "profit_incl_rn": grouped["profit_incl_rn"].sum(),
    }
    sales = clean_number(total["sales_amt"])
    qty = clean_number(total["sku_qty"])
    total["selling_fee_pct"] = clean_number(total["selling_fee"]) / sales if sales else None
    total["ads_fee_pct"] = clean_number(total["ads_fee"]) / sales if sales else None
    total["return_pct"] = clean_number(total["refund_amt"]) / sales if sales else None
    total["profit_margin"] = clean_number(total["profit_incl_rn"]) / sales if sales else None
    total["unit_price"] = sales / qty * 1.2 if qty else None

    grouped = grouped.sort_values(["sales_amt"], ascending=False)
    return table_records(pd.concat([grouped, pd.DataFrame([total])], ignore_index=True))


def numeric_summary(df):
    sales = clean_number(df["sales_amt"].sum()) if not df.empty else 0
    qty = clean_number(df["sku_qty"].sum()) if not df.empty else 0
    profit = clean_number(df["profit_incl_rn"].sum()) if not df.empty else 0
    ads = clean_number(df["ads_fee"].sum()) if not df.empty else 0
    return {
        "qty": qty,
        "sales": sales,
        "profit": profit,
        "profitMargin": profit / sales if sales else None,
        "adsFee": ads,
        "adsFeeRate": ads / sales if sales else None,
        "unitPrice": sales / qty * 1.2 if qty else None,
    }


def detail_payload(sku_code):
    data = store.get()
    sku_norm = normalize_sku(sku_code)
    sales = data["powerbi"][data["powerbi"]["sku_norm"] == sku_norm].copy()

    max_date = data["powerbi"]["Date"].max()
    recent_start = max_date - pd.Timedelta(days=30)
    recent = sales[(sales["Date"] >= recent_start) & (sales["Date"] <= max_date)]
    current_year = sales[sales["Date"].dt.year == max_date.year]

    inv = data["inventory"][data["inventory"]["sku_norm"] == sku_norm].head(1)
    sku_row = data["sku"][data["sku"]["sku_norm"] == sku_norm].head(1)
    img = data["image"][data["image"]["sku_norm"] == sku_norm].head(1)
    inbound = data["container"][data["container"]["sku_norm"] == sku_norm].copy()
    inbound = inbound.sort_values("Inbound Time", ascending=False)

    cogs = clean_number(inv.iloc[0]["COGS"], None) if not inv.empty and "COGS" in inv else None
    if cogs is None and not sku_row.empty:
        cogs = clean_number(sku_row.iloc[0].get("COGS"), None)

    title = clean_value(img.iloc[0].get("Auction Title")) if not img.empty else ""
    image_url = clean_value(img.iloc[0].get("image_url")) if not img.empty else ""
    stock_on_hand = clean_number(inv.iloc[0]["Total Inventory Qty"], None) if not inv.empty else None
    daily_average = clean_number(inv.iloc[0]["Daily Average Sales"], None) if not inv.empty else None

    snapshot = {
        "sku": sku_norm,
        "title": title,
        "imageUrl": image_url,
        "grade": clean_value(inv.iloc[0]["Grade Level"]) if not inv.empty else None,
        "estimatedMonthsToSell": clean_number(inv.iloc[0]["Estimated Months to Sell"], None) if not inv.empty else None,
        "dailyAverageSales": daily_average,
        "stockOnHand": stock_on_hand,
        "cogs": cogs,
        "firstArrival": clean_value(sku_row.iloc[0]["First Arrival Date"]) if not sku_row.empty else None,
        "lastArrival": clean_value(inbound.iloc[0]["Inbound Time"]) if not inbound.empty else None,
        "category": clean_value(inv.iloc[0]["Main Category"]) if not inv.empty else None,
        "subcategory": clean_value(inv.iloc[0]["Subcategory"]) if not inv.empty else None,
        "brand": clean_value(inv.iloc[0]["Brand"]) if not inv.empty else None,
    }

    monthly = sales.dropna(subset=["Date"]).copy()
    if not monthly.empty:
        monthly["month"] = monthly["Date"].dt.to_period("M").astype(str)
        month_group = monthly.groupby("month").agg(
            qty=("sku_qty", "sum"),
            sales=("sales_amt", "sum"),
            profit=("profit_incl_rn", "sum"),
        ).reset_index()
        month_group["profitMargin"] = month_group.apply(lambda r: clean_number(r["profit"]) / clean_number(r["sales"]) if clean_number(r["sales"]) else None, axis=1)
    else:
        month_group = pd.DataFrame(columns=["month", "qty", "sales", "profit", "profitMargin"])

    freight_sales = sales[(sales["postage"] != 0) & (sales["platform name"] != "Amazon(UK) FBM")]
    avg_freight = clean_number(freight_sales["postage"].mean(), 0)
    current_price = None
    for point in reversed(data["price_history"].get(sku_norm, [])):
        if point.get("price") is not None:
            current_price = point["price"]
            break
    if current_price is None:
        current_price = clean_number(snapshot["cogs"], 0) * 1.2

    price_test = calculate_price_test(current_price, cogs or 0, avg_freight)

    return {
        "meta": data["meta"],
        "snapshot": snapshot,
        "periods": {
            "recent": {
                "label": f"{recent_start:%Y-%m-%d} to {max_date:%Y-%m-%d}",
                "summary": numeric_summary(recent),
                "platforms": aggregate_sales(recent),
            },
            "year": {
                "label": str(max_date.year),
                "summary": numeric_summary(current_year),
                "platforms": aggregate_sales(current_year),
            },
            "lifetime": {
                "label": "Lifetime",
                "summary": numeric_summary(sales),
                "platforms": aggregate_sales(sales),
            },
        },
        "monthlyTrend": table_records(month_group.tail(18)),
        "priceHistory": data["price_history"].get(sku_norm, [])[-18:],
        "priceTest": price_test,
    }


def calculate_price_test(price, cogs, freight, selling_cost=0.25, wms=0.08):
    ex_vat = clean_number(price) / 1.2
    profit = ex_vat - clean_number(cogs) - clean_number(freight) - ex_vat * (selling_cost + wms)
    margin = profit / ex_vat if ex_vat else None
    return {
        "price": clean_number(price),
        "cogs": clean_number(cogs),
        "freight": clean_number(freight),
        "sellingCostRate": selling_cost,
        "wmsRate": wms,
        "profit": profit,
        "margin": margin,
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/api/health":
                data = store.get()
                self.send_json({"ok": True, "meta": data["meta"]})
                return
            if parsed.path == "/api/skus":
                data = store.get()
                query = parse_qs(parsed.query).get("q", [""])[0].lower().strip()
                options = data["skuOptions"]
                if query:
                    options = [item for item in options if query in item["label"].lower()]
                self.send_json({"items": options[:250], "total": len(options)})
                return
            if parsed.path == "/api/sku":
                params = parse_qs(parsed.query)
                sku_code = params.get("sku", [""])[0]
                if not sku_code:
                    self.send_json({"error": "Missing sku"}, status=400)
                    return
                self.send_json(detail_payload(sku_code))
                return
            if parsed.path == "/api/price-test":
                params = parse_qs(parsed.query)
                payload = calculate_price_test(
                    params.get("price", [0])[0],
                    params.get("cogs", [0])[0],
                    params.get("freight", [0])[0],
                    clean_number(params.get("sellingCostRate", [0.25])[0], 0.25),
                    clean_number(params.get("wmsRate", [0.08])[0], 0.08),
                )
                self.send_json(payload)
                return
        except DataSourceError as exc:
            self.send_json({"error": str(exc)}, status=503)
            return
        super().do_GET()


def main():
    if SOURCE_MODE != "google" and not WORKBOOK_PATH.exists():
        raise SystemExit(f"Workbook not found: {WORKBOOK_PATH}")
    port = int(os.environ.get("PORT", "8765"))
    host = os.environ.get("HOST", "0.0.0.0" if os.environ.get("RENDER") else "127.0.0.1")
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"SKU Performance app running at http://{host}:{port}")
    if SOURCE_MODE == "google":
        print(f"Google Sheet: https://docs.google.com/spreadsheets/d/{GOOGLE_SHEET_ID}")
    else:
        print(f"Workbook: {WORKBOOK_PATH}")
    server.serve_forever()


if __name__ == "__main__":
    main()
