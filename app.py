from __future__ import annotations

import json
import math
import os
import re
import time
import csv
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import parse_qs, quote, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
DEFAULT_WORKBOOK = ROOT.parent / "Lastest Data Analyse - Codex.xlsx"
WORKBOOK_PATH = Path(os.environ.get("SKU_APP_WORKBOOK", DEFAULT_WORKBOOK))
GOOGLE_SHEET_ID = os.environ.get("GOOGLE_SHEET_ID", "17fj9gaoE4U5_Ks_EkI68CPBBPIjjbDYMkifG1SqbBAg")
SOURCE_MODE = os.environ.get("SKU_APP_SOURCE", "excel").strip().lower()
CACHE_SECONDS = int(os.environ.get("SKU_APP_CACHE_SECONDS", "900"))
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
if SUPABASE_URL.endswith("/rest/v1"):
    SUPABASE_URL = SUPABASE_URL[:-8].rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

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


pd = None


def get_pandas():
    global pd
    if pd is None:
        import pandas as pandas_module
        pd = pandas_module
    return pd


def clean_number(value, default=0.0):
    if value is None:
        return default
    try:
        pandas_module = pd
        if pandas_module is not None and pandas_module.isna(value):
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
        pandas_module = pd
        if pandas_module is not None and pandas_module.isna(value):
            return None
    except TypeError:
        pass
    pandas_module = pd
    if pandas_module is not None and isinstance(value, pandas_module.Timestamp):
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


def simplify_key(key):
    return str(key).split("/")[0].strip()


def parse_date(value):
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y", "%m/%d/%Y", "%m/%d/%y", "%Y/%m/%d"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(text.split(" ")[0])
    except ValueError:
        return None


def normalize_sku(value):
    if value is None:
        return ""
    return str(value).strip().upper()


def first_image_url(value):
    if not isinstance(value, str):
        return ""
    match = re.search(r"https?://[^,\s]+", value)
    return match.group(0).strip() if match else ""


def preferred_image_url_from_row(row):
    white_bg = row.get("White bg image") if hasattr(row, "get") else None
    white_bg_url = first_image_url(white_bg)
    if white_bg_url:
        return white_bg_url
    picture_urls = row.get("Picture URLs") if hasattr(row, "get") else None
    if isinstance(picture_urls, str):
        for key in ("ITEMIMAGEURL12", "ITEMIMAGEURL41"):
            match = re.search(rf"{key}=(https?://[^,\s]+)", picture_urls)
            if match:
                return match.group(1).strip()
    return first_image_url(picture_urls)


def image_urls_from_row(row):
    preferred = preferred_image_url_from_row(row)
    urls = [preferred] if preferred else []
    for column in ("White bg image", "Picture URLs"):
        value = row.get(column)
        if isinstance(value, str):
            urls.extend(re.findall(r"https?://[^,\s]+", value))
    cleaned = []
    seen = set()
    for url in urls:
        url = url.strip()
        if url and url not in seen:
            cleaned.append(url)
            seen.add(url)
    return cleaned


def excel_weeknum(date_value):
    jan1 = datetime(date_value.year, 1, 1)
    week1_start = jan1 - timedelta(days=(jan1.weekday() + 1) % 7)
    return ((date_value - week1_start).days // 7) + 1


def format_price_history_label(value):
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    formula_date = re.search(r"Date\(\s*(\d{4})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*\)", text, re.IGNORECASE)
    if formula_date:
        date_value = datetime(int(formula_date.group(1)), int(formula_date.group(2)), int(formula_date.group(3)))
        return f"{date_value.day}/{date_value.month}/{date_value.year} ({excel_weeknum(date_value)})"
    date_value = parse_date(clean_value(value))
    if date_value:
        return f"{date_value.day}/{date_value.month}/{date_value.year} ({excel_weeknum(date_value)})"
    return text


def merge_price_history_points(points):
    merged = {}
    order = []
    for point in points or []:
        label = format_price_history_label(point.get("label"))
        if not label:
            continue
        stock = clean_number(point.get("stock"), None)
        price = clean_number(point.get("price"), None)
        existing = merged.get(label)
        if existing is None:
            merged[label] = {"label": label, "stock": stock, "price": price}
            order.append(label)
            continue
        if existing.get("stock") is None and stock is not None:
            existing["stock"] = stock
        if existing.get("price") is None and price is not None:
            existing["price"] = price
    return [merged[label] for label in order]


def price_history_sku_column(label_row):
    for idx, value in enumerate(label_row):
        text = str(value or "").strip().lower()
        if text in {"inventory number", "sku", "sku code", "inventory sku"}:
            return idx
    return 0


def price_change_formula_sku(value):
    text = clean_value(value)
    if not text:
        return None
    text = str(text).replace(".", "D")
    if "-UK" in text:
        text = text[: text.find("-UK") + 3]
    elif "_" in text:
        text = f"{text.split('_', 1)[0]}-UK"
    else:
        text = f"{text}-UK"
    return normalize_sku(text)


def price_history_sku_from_excel_row(raw, row_idx):
    sku = normalize_sku(raw.iat[row_idx, 0])
    if sku:
        return sku
    if raw.shape[1] > 1:
        return price_change_formula_sku(raw.iat[row_idx, 1])
    return None


def price_history_sku_from_google_row(row):
    sku = normalize_sku(row[0] if row else "")
    if sku:
        return sku
    return price_change_formula_sku(row[1] if len(row) > 1 else "")


def image_sku_from_row(row):
    sku = normalize_sku(row.get("Unnamed: 25") if hasattr(row, "get") else None)
    if sku:
        return sku
    return price_change_formula_sku(row.get("Inventory Number") if hasattr(row, "get") else None)


def supabase_enabled():
    return bool(SUPABASE_URL and SUPABASE_ANON_KEY)


def supabase_headers(extra=None):
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Accept": "application/json",
    }
    if extra:
        headers.update(extra)
    return headers


def supabase_request(path, headers=None):
    if not supabase_enabled():
        raise DataSourceError("Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY in Render.")
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    request = Request(url, headers=supabase_headers(headers))
    try:
        with urlopen(request, timeout=60) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else []
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise DataSourceError(f"Supabase request failed: {exc.code} {detail}") from exc


def supabase_select_all(table, select="*", query=""):
    rows = []
    offset = 0
    page_size = 1000
    while True:
        page = supabase_request(
            f"{table}?select={quote(select, safe='*,()')}{query}&limit={page_size}&offset={offset}"
        )
        rows.extend(page)
        if len(page) < page_size:
            return rows
        offset += page_size


def supabase_count(table):
    if not supabase_enabled():
        return 0
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=id&limit=1"
    request = Request(url, headers=supabase_headers({"Prefer": "count=exact", "Range": "0-0"}))
    try:
        with urlopen(request, timeout=30) as response:
            content_range = response.headers.get("Content-Range", "")
    except Exception:
        return 0
    if "/" in content_range:
        try:
            return int(content_range.rsplit("/", 1)[1])
        except ValueError:
            return 0
    return 0


def supabase_date(value):
    parsed = parse_date(value)
    return parsed.strftime("%Y-%m-%d") if parsed else None


def table_records(df):
    pandas_module = get_pandas()
    return [
        {key: clean_value(value) for key, value in row.items()}
        for row in df.replace({pandas_module.NA: None}).to_dict(orient="records")
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
        if self.source_mode in ("google", "supabase"):
            return int(time.time() / max(CACHE_SECONDS, 60))
        return self.workbook_path.stat().st_mtime

    def read_sheet(self, sheet_name, **kwargs):
        if self.source_mode == "google":
            gid = DEFAULT_GOOGLE_GIDS[sheet_name]
            url = f"https://docs.google.com/spreadsheets/d/{self.google_sheet_id}/export?format=csv&gid={gid}"
            try:
                pandas_module = get_pandas()
                return pandas_module.read_csv(url, **kwargs)
            except HTTPError as exc:
                if exc.code in (401, 403):
                    raise DataSourceError(
                        "Google Sheet is not publicly readable. Set sharing to 'Anyone with the link can view', then redeploy or wait for the cache to refresh."
                    ) from exc
                raise
        pandas_module = get_pandas()
        return pandas_module.read_excel(self.workbook_path, sheet_name=sheet_name, **kwargs)

    def google_csv_url(self, sheet_name):
        gid = DEFAULT_GOOGLE_GIDS[sheet_name]
        return f"https://docs.google.com/spreadsheets/d/{self.google_sheet_id}/export?format=csv&gid={gid}"

    def iter_google_lines(self, sheet_name):
        try:
            with urlopen(self.google_csv_url(sheet_name), timeout=60) as response:
                for raw_line in response:
                    yield raw_line.decode("utf-8-sig", errors="replace")
        except HTTPError as exc:
            if exc.code in (401, 403):
                raise DataSourceError(
                    "Google Sheet is not publicly readable. Set sharing to 'Anyone with the link can view', then redeploy or wait for the cache to refresh."
                ) from exc
            raise

    def iter_google_dicts(self, sheet_name):
        yield from csv.DictReader(self.iter_google_lines(sheet_name))

    def read_google_dicts(self, sheet_name):
        return list(self.iter_google_dicts(sheet_name))

    def read_google_rows(self, sheet_name):
        try:
            with urlopen(self.google_csv_url(sheet_name), timeout=60) as response:
                text = response.read().decode("utf-8-sig", errors="replace").splitlines()
        except HTTPError as exc:
            if exc.code in (401, 403):
                raise DataSourceError(
                    "Google Sheet is not publicly readable. Set sharing to 'Anyone with the link can view', then redeploy or wait for the cache to refresh."
                ) from exc
            raise
        return list(csv.reader(text))

    def load(self):
        if self.source_mode == "supabase":
            return self.load_supabase()
        if self.source_mode == "google":
            return self.load_google()
        return self.load_excel()

    def load_supabase(self):
        inventory_rows = supabase_select_all("inventory")
        sku_rows = supabase_select_all("sku_master")
        image_rows = supabase_select_all("product_images")

        inventory = {normalize_sku(row.get("sku")): row for row in inventory_rows if normalize_sku(row.get("sku"))}
        sku = {normalize_sku(row.get("sku")): row for row in sku_rows if normalize_sku(row.get("sku"))}
        image = {normalize_sku(row.get("sku")): row for row in image_rows if normalize_sku(row.get("sku"))}
        sku_options = self.build_supabase_sku_options(sku, inventory, image)

        oldest = supabase_request("sales?select=sale_date&order=sale_date.asc&limit=1")
        newest = supabase_request("sales?select=sale_date&order=sale_date.desc&limit=1")
        min_date = parse_date(oldest[0].get("sale_date")) if oldest else None
        max_date = parse_date(newest[0].get("sale_date")) if newest else None

        return {
            "powerbi": None,
            "maxDate": max_date,
            "sku": sku,
            "inventory": inventory,
            "container": {},
            "image": image,
            "price_history": {},
            "meta": {
                "source": "Supabase",
                "workbook": SUPABASE_URL,
                "lastUpdate": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
                "dataStart": clean_value(min_date),
                "dataEnd": clean_value(max_date),
                "skuCount": len(sku_options),
                "salesRows": supabase_count("sales"),
                "cacheSeconds": CACHE_SECONDS,
            },
            "skuOptions": sku_options,
        }

    def build_supabase_sku_options(self, sku, inventory, image):
        sku_values = sorted(set(sku) | set(inventory) | set(image))
        result = []
        for sku_code in sku_values:
            img = image.get(sku_code, {})
            inv = inventory.get(sku_code, {})
            title = clean_value(img.get("title")) or ""
            category = clean_value(inv.get("main_category")) or ""
            label = f"{sku_code} - {title}" if title else sku_code
            result.append({"sku": sku_code, "label": label, "title": title, "category": category})
        return result

    def load_excel(self):
        pandas_module = get_pandas()
        powerbi = self.read_sheet("PowerBI")
        powerbi["Date"] = pandas_module.to_datetime(powerbi["Date"], errors="coerce")
        powerbi["sku_norm"] = powerbi["sku_code"].map(normalize_sku)
        powerbi = powerbi[powerbi["sku_norm"] != ""].copy()

        sku = simplify_columns(self.read_sheet("SKU"))
        sku["sku_norm"] = sku["sku_Master"].map(normalize_sku)

        inventory = simplify_columns(self.read_sheet("Inventory Report"))
        inventory["sku_norm"] = inventory["Product SKU"].map(normalize_sku)

        container = self.read_sheet("Container report")
        container["sku_norm"] = container["SKU"].map(normalize_sku)
        container["Inbound Time"] = pandas_module.to_datetime(container["Inbound Time"], errors="coerce")
        container["Latest Batch Arrival Date"] = pandas_module.to_datetime(container["Latest Batch Arrival Date"], errors="coerce")

        image = self.read_sheet("Image")
        image["sku_norm"] = image.apply(image_sku_from_row, axis=1)
        image["image_url"] = image.apply(preferred_image_url_from_row, axis=1)

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

    def group_sales_by_sku(self, powerbi):
        grouped = {}
        for row in powerbi:
            grouped.setdefault(row["sku"], []).append(row)
        return grouped

    def load_google(self):
        min_date = None
        max_date = None
        sales_rows = 0
        sales_skus = set()
        for row in self.iter_google_dicts("PowerBI"):
            sku_norm = normalize_sku(row.get("sku_code"))
            date_value = parse_date(row.get("Date"))
            if not sku_norm or date_value is None:
                continue
            sales_rows += 1
            sales_skus.add(sku_norm)
            min_date = date_value if min_date is None or date_value < min_date else min_date
            max_date = date_value if max_date is None or date_value > max_date else max_date

        sku = {}
        for row in self.read_google_dicts("SKU"):
            simplified = {simplify_key(key): value for key, value in row.items()}
            sku_norm = normalize_sku(simplified.get("sku_Master"))
            if sku_norm:
                sku[sku_norm] = simplified

        inventory = {}
        for row in self.read_google_dicts("Inventory Report"):
            simplified = {simplify_key(key): value for key, value in row.items()}
            sku_norm = normalize_sku(simplified.get("Product SKU"))
            if sku_norm:
                inventory[sku_norm] = simplified

        container = {}
        for row in self.read_google_dicts("Container report"):
            sku_norm = normalize_sku(row.get("SKU"))
            inbound_time = parse_date(row.get("Inbound Time"))
            if sku_norm and inbound_time is not None:
                current = container.get(sku_norm)
                if current is None or inbound_time > current["inbound_time"]:
                    container[sku_norm] = {"inbound_time": inbound_time, "row": row}

        image = {}
        for row in self.read_google_dicts("Image"):
            sku_norm = image_sku_from_row(row)
            if sku_norm:
                image_url = preferred_image_url_from_row(row)
                row["image_url"] = image_url
                row["sku_norm"] = sku_norm
                image[sku_norm] = row

        price_history = self.load_google_price_history()
        last_update = self.read_google_last_update()
        sku_options = self.build_google_sku_options(sales_skus, sku, inventory, image)

        return {
            "powerbi": None,
            "maxDate": max_date,
            "sku": sku,
            "inventory": inventory,
            "container": container,
            "image": image,
            "price_history": price_history,
            "meta": {
                "source": "Google Sheets",
                "workbook": f"https://docs.google.com/spreadsheets/d/{self.google_sheet_id}",
                "lastUpdate": last_update,
                "dataStart": clean_value(min_date),
                "dataEnd": clean_value(max_date),
                "skuCount": len(sku_options),
                "salesRows": int(sales_rows),
                "cacheSeconds": CACHE_SECONDS,
            },
            "skuOptions": sku_options,
        }

    def read_google_last_update(self):
        try:
            with urlopen(self.google_csv_url("PowerBI"), timeout=30) as response:
                header_date = response.headers.get("Date")
                if header_date:
                    return parsedate_to_datetime(header_date).strftime("%Y-%m-%d %H:%M UTC")
        except Exception:
            pass
        return datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    def build_google_sku_options(self, sales_skus, sku, inventory, image):
        sku_values = sorted(set(sales_skus) | set(sku) | set(inventory))
        result = []
        for sku_code in sku_values:
            img = image.get(sku_code, {})
            inv = inventory.get(sku_code, {})
            title = clean_value(img.get("Auction Title")) or ""
            category = clean_value(inv.get("Main Category")) or ""
            label = f"{sku_code} - {title}" if title else sku_code
            result.append({"sku": sku_code, "label": label, "title": title, "category": category})
        return result

    def load_google_price_history(self):
        raw = self.read_google_rows("Price Change")
        records = {}
        if len(raw) < 3:
            return records
        date_row = raw[0]
        label_row = raw[1]
        for row in raw[2:]:
            sku_code = price_history_sku_from_google_row(row)
            if not sku_code:
                continue
            points = []
            col = 5
            while col < len(date_row):
                date_label = date_row[col] if col < len(date_row) else ""
                stock_label = (label_row[col] if col < len(label_row) else "").strip().lower()
                price_label = (label_row[col + 1] if col + 1 < len(label_row) else "").strip().lower()
                if date_label and stock_label == "stock":
                    stock_value = row[col] if col < len(row) else None
                    price_value = row[col + 1] if col + 1 < len(row) else None
                    points.append({
                        "label": str(date_label),
                        "stock": clean_number(stock_value, None),
                        "price": clean_number(price_value, None) if price_label == "price" else None,
                    })
                    col += 2
                elif date_label:
                    price_value = row[col] if col < len(row) else None
                    points.append({
                        "label": str(date_label),
                        "stock": None,
                        "price": clean_number(price_value, None),
                    })
                    col += 1
                else:
                    col += 1
            records[sku_code] = merge_price_history_points(points)
        return records

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
        pandas_module = get_pandas()
        raw = self.read_sheet("Price Change", header=None)
        records = {}
        if raw.shape[0] < 3:
            return records
        date_row = raw.iloc[0]
        label_row = raw.iloc[1]
        for row_idx in range(2, len(raw)):
            sku_code = price_history_sku_from_excel_row(raw, row_idx)
            if not sku_code:
                continue
            points = []
            col = 5
            while col < raw.shape[1]:
                date_label = date_row.iat[col]
                stock_label = str(label_row.iat[col]).strip().lower()
                price_label = str(label_row.iat[col + 1]).strip().lower() if col + 1 < raw.shape[1] else ""
                if pandas_module.notna(date_label) and stock_label == "stock":
                    points.append({
                        "label": format_price_history_label(date_label),
                        "stock": clean_number(raw.iat[row_idx, col], None),
                        "price": clean_number(raw.iat[row_idx, col + 1], None) if price_label == "price" else None,
                    })
                    col += 2
                elif pandas_module.notna(date_label):
                    points.append({
                        "label": format_price_history_label(date_label),
                        "stock": None,
                        "price": clean_number(raw.iat[row_idx, col], None),
                    })
                    col += 1
                else:
                    col += 1
            records[sku_code] = merge_price_history_points(points)
        return records


store = DataStore(WORKBOOK_PATH)


def aggregate_sales(df):
    pandas_module = get_pandas()
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
    return table_records(pandas_module.concat([grouped, pandas_module.DataFrame([total])], ignore_index=True))


def aggregate_sales_rows(rows):
    grouped = {}
    for row in rows:
        platform = row["platform"] or "-"
        item = grouped.setdefault(platform, {
            "platform name": platform,
            "sku_qty": 0.0,
            "sales_amt": 0.0,
            "selling_fee": 0.0,
            "ads_fee": 0.0,
            "refund_amt": 0.0,
            "profit_incl_rn": 0.0,
        })
        item["sku_qty"] += clean_number(row.get("sku_qty"))
        item["sales_amt"] += clean_number(row.get("sales_amt"))
        item["selling_fee"] += clean_number(row.get("selling_fee"))
        item["ads_fee"] += clean_number(row.get("ads_fee"))
        item["refund_amt"] += clean_number(row.get("refund_amt"))
        item["profit_incl_rn"] += clean_number(row.get("profit_incl_rn"))

    records = sorted(grouped.values(), key=lambda item: item["sales_amt"], reverse=True)
    total = {
        "platform name": "Grand Total",
        "sku_qty": sum(item["sku_qty"] for item in records),
        "sales_amt": sum(item["sales_amt"] for item in records),
        "selling_fee": sum(item["selling_fee"] for item in records),
        "ads_fee": sum(item["ads_fee"] for item in records),
        "refund_amt": sum(item["refund_amt"] for item in records),
        "profit_incl_rn": sum(item["profit_incl_rn"] for item in records),
    }
    for item in records + [total]:
        sales = clean_number(item["sales_amt"])
        qty = clean_number(item["sku_qty"])
        item["selling_fee_pct"] = clean_number(item["selling_fee"]) / sales if sales else None
        item["ads_fee_pct"] = clean_number(item["ads_fee"]) / sales if sales else None
        item["return_pct"] = clean_number(item["refund_amt"]) / sales if sales else None
        item["profit_margin"] = clean_number(item["profit_incl_rn"]) / sales if sales else None
        item["unit_price"] = sales / qty * 1.2 if qty else None
    return records + [total]


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


def numeric_summary_rows(rows):
    sales = sum(clean_number(row.get("sales_amt")) for row in rows)
    qty = sum(clean_number(row.get("sku_qty")) for row in rows)
    profit = sum(clean_number(row.get("profit_incl_rn")) for row in rows)
    ads = sum(clean_number(row.get("ads_fee")) for row in rows)
    return {
        "qty": qty,
        "sales": sales,
        "profit": profit,
        "profitMargin": profit / sales if sales else None,
        "adsFee": ads,
        "adsFeeRate": ads / sales if sales else None,
        "unitPrice": sales / qty * 1.2 if qty else None,
    }


def detail_payload_supabase(sku_code):
    data = store.get()
    sku_norm = normalize_sku(sku_code)
    sku_filter = quote(sku_norm, safe="")
    sales_rows = supabase_select_all(
        "sales",
        "sale_date,platform,sku_qty,sales_amt,selling_fee,ads_fee,refund_amt,profit_incl_rn,postage",
        f"&sku=eq.{sku_filter}&order=sale_date.asc",
    )
    sales = []
    for row in sales_rows:
        date_value = parse_date(row.get("sale_date"))
        if date_value is None:
            continue
        sales.append({
            "date": date_value,
            "platform": row.get("platform") or "",
            "sku": sku_norm,
            "sku_qty": clean_number(row.get("sku_qty")),
            "sales_amt": clean_number(row.get("sales_amt")),
            "selling_fee": clean_number(row.get("selling_fee")),
            "ads_fee": clean_number(row.get("ads_fee")),
            "refund_amt": clean_number(row.get("refund_amt")),
            "profit_incl_rn": clean_number(row.get("profit_incl_rn")),
            "postage": clean_number(row.get("postage")),
        })

    max_date = max((row["date"] for row in sales), default=data.get("maxDate") or datetime.now())
    recent_start = max_date - timedelta(days=30)
    recent = [row for row in sales if recent_start <= row["date"] <= max_date]
    current_year = [row for row in sales if row["date"].year == max_date.year]

    inv = data["inventory"].get(sku_norm, {})
    sku_row = data["sku"].get(sku_norm, {})
    img = data["image"].get(sku_norm, {})
    container_rows = supabase_request(
        f"container_report?select=inbound_time,latest_batch_arrival_date&sku=eq.{sku_filter}&order=inbound_time.desc&limit=1"
    )
    inbound = container_rows[0] if container_rows else {}
    first_container_rows = supabase_request(
        f"container_report?select=inbound_time&sku=eq.{sku_filter}&order=inbound_time.asc&limit=1"
    )
    first_inbound = first_container_rows[0] if first_container_rows else {}
    price_history = supabase_request(
        f"price_history?select=label,stock,price&sku=eq.{sku_filter}&order=sequence.asc"
    )

    cogs = clean_number(inv.get("cogs"), None)
    if cogs is None:
        cogs = clean_number(sku_row.get("cogs"), None)
    image_urls = img.get("image_urls") if isinstance(img.get("image_urls"), list) else []
    first_arrival = supabase_date(sku_row.get("first_arrival_date")) or supabase_date(first_inbound.get("inbound_time"))

    snapshot = {
        "sku": sku_norm,
        "title": clean_value(img.get("title")) or "",
        "imageUrl": clean_value(img.get("image_url")) or "",
        "imageUrls": image_urls,
        "grade": clean_value(inv.get("grade_level") or sku_row.get("grade")),
        "estimatedMonthsToSell": clean_number(inv.get("estimated_months_to_sell"), None),
        "dailyAverageSales": clean_number(inv.get("daily_average_sales"), None),
        "stockOnHand": clean_number(inv.get("stock_on_hand"), None),
        "cogs": cogs,
        "firstArrival": clean_value(first_arrival),
        "lastArrival": clean_value(supabase_date(inbound.get("inbound_time"))),
        "category": clean_value(inv.get("main_category")),
        "subcategory": clean_value(inv.get("subcategory")),
        "brand": clean_value(inv.get("brand") or img.get("brand")),
    }

    monthly_map = {}
    for row in sales:
        month = row["date"].strftime("%Y-%m")
        item = monthly_map.setdefault(month, {"month": month, "qty": 0.0, "sales": 0.0, "profit": 0.0})
        item["qty"] += clean_number(row.get("sku_qty"))
        item["sales"] += clean_number(row.get("sales_amt"))
        item["profit"] += clean_number(row.get("profit_incl_rn"))
    monthly = []
    for month in sorted(monthly_map):
        item = monthly_map[month]
        item["profitMargin"] = item["profit"] / item["sales"] if item["sales"] else None
        monthly.append(item)

    freight_rows = [row for row in sales if row.get("postage") != 0 and row.get("platform") != "Amazon(UK) FBM"]
    avg_freight = sum(clean_number(row.get("postage")) for row in freight_rows) / len(freight_rows) if freight_rows else 0
    current_price = None
    for point in reversed(price_history):
        if point.get("price") is not None:
            current_price = clean_number(point.get("price"), None)
            break
    if current_price is None:
        current_price = clean_number(snapshot["cogs"], 0) * 1.2

    return {
        "meta": data["meta"],
        "snapshot": snapshot,
        "salesRows": [
            {
                "date": row["date"].strftime("%Y-%m-%d"),
                "platform": row["platform"],
                "sku_qty": row["sku_qty"],
                "sales_amt": row["sales_amt"],
                "selling_fee": row["selling_fee"],
                "ads_fee": row["ads_fee"],
                "refund_amt": row["refund_amt"],
                "profit_incl_rn": row["profit_incl_rn"],
            }
            for row in sales
        ],
        "periods": {
            "recent": {
                "label": f"{recent_start:%Y-%m-%d} to {max_date:%Y-%m-%d}",
                "summary": numeric_summary_rows(recent),
                "platforms": aggregate_sales_rows(recent),
            },
            "year": {
                "label": str(max_date.year),
                "summary": numeric_summary_rows(current_year),
                "platforms": aggregate_sales_rows(current_year),
            },
            "lifetime": {
                "label": "Lifetime",
                "summary": numeric_summary_rows(sales),
                "platforms": aggregate_sales_rows(sales),
            },
        },
        "monthlyTrend": monthly[-18:],
        "priceHistory": merge_price_history_points(price_history)[-18:],
        "priceTest": calculate_price_test(current_price, cogs or 0, avg_freight),
    }


def detail_payload_google(sku_code):
    data = store.get()
    sku_norm = normalize_sku(sku_code)
    sales = []
    max_date = data.get("maxDate") or datetime.now()
    for row in store.iter_google_dicts("PowerBI"):
        row_sku = normalize_sku(row.get("sku_code"))
        date_value = parse_date(row.get("Date"))
        if date_value is None:
            continue
        if row_sku == sku_norm:
            sales.append({
                "date": date_value,
                "platform": row.get("platform name") or "",
                "sku": row_sku,
                "sku_qty": clean_number(row.get("sku_qty")),
                "sales_amt": clean_number(row.get("sales_amt")),
                "selling_fee": clean_number(row.get("selling_fee")),
                "ads_fee": clean_number(row.get("ads_fee")),
                "refund_amt": clean_number(row.get("refund_amt")),
                "profit_incl_rn": clean_number(row.get("profit_incl_rn")),
                "postage": clean_number(row.get("postage")),
            })
    recent_start = max_date - timedelta(days=30)
    recent = [row for row in sales if recent_start <= row["date"] <= max_date]
    current_year = [row for row in sales if row["date"].year == max_date.year]

    inv = data["inventory"].get(sku_norm, {})
    sku_row = data["sku"].get(sku_norm, {})
    img = data["image"].get(sku_norm, {})
    inbound = data["container"].get(sku_norm, {})

    cogs = clean_number(inv.get("COGS"), None)
    if cogs is None:
        cogs = clean_number(sku_row.get("COGS"), None)

    snapshot = {
        "sku": sku_norm,
        "title": clean_value(img.get("Auction Title")) or "",
        "imageUrl": clean_value(img.get("image_url")) or "",
        "imageUrls": image_urls_from_row(img) if img else [],
        "grade": clean_value(inv.get("Grade Level")),
        "estimatedMonthsToSell": clean_number(inv.get("Estimated Months to Sell"), None),
        "dailyAverageSales": clean_number(inv.get("Daily Average Sales"), None),
        "stockOnHand": clean_number(inv.get("Total Inventory Qty"), None),
        "cogs": cogs,
        "firstArrival": clean_value(sku_row.get("First Arrival Date")),
        "lastArrival": clean_value(inbound.get("inbound_time")) if inbound else None,
        "category": clean_value(inv.get("Main Category")),
        "subcategory": clean_value(inv.get("Subcategory")),
        "brand": clean_value(inv.get("Brand")),
    }

    monthly_map = {}
    for row in sales:
        month = row["date"].strftime("%Y-%m")
        item = monthly_map.setdefault(month, {"month": month, "qty": 0.0, "sales": 0.0, "profit": 0.0})
        item["qty"] += clean_number(row.get("sku_qty"))
        item["sales"] += clean_number(row.get("sales_amt"))
        item["profit"] += clean_number(row.get("profit_incl_rn"))
    monthly = []
    for month in sorted(monthly_map):
        item = monthly_map[month]
        item["profitMargin"] = item["profit"] / item["sales"] if item["sales"] else None
        monthly.append(item)

    freight_rows = [row for row in sales if row.get("postage") != 0 and row.get("platform") != "Amazon(UK) FBM"]
    avg_freight = sum(clean_number(row.get("postage")) for row in freight_rows) / len(freight_rows) if freight_rows else 0
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
        "salesRows": [
            {
                "date": row["date"].strftime("%Y-%m-%d"),
                "platform": row["platform"],
                "sku_qty": row["sku_qty"],
                "sales_amt": row["sales_amt"],
                "selling_fee": row["selling_fee"],
                "ads_fee": row["ads_fee"],
                "refund_amt": row["refund_amt"],
                "profit_incl_rn": row["profit_incl_rn"],
            }
            for row in sales
        ],
        "periods": {
            "recent": {
                "label": f"{recent_start:%Y-%m-%d} to {max_date:%Y-%m-%d}",
                "summary": numeric_summary_rows(recent),
                "platforms": aggregate_sales_rows(recent),
            },
            "year": {
                "label": str(max_date.year),
                "summary": numeric_summary_rows(current_year),
                "platforms": aggregate_sales_rows(current_year),
            },
            "lifetime": {
                "label": "Lifetime",
                "summary": numeric_summary_rows(sales),
                "platforms": aggregate_sales_rows(sales),
            },
        },
        "monthlyTrend": monthly[-18:],
        "priceHistory": data["price_history"].get(sku_norm, [])[-18:],
        "priceTest": price_test,
    }


def detail_payload(sku_code):
    if store.source_mode == "supabase":
        return detail_payload_supabase(sku_code)
    if store.source_mode == "google":
        return detail_payload_google(sku_code)
    pandas_module = get_pandas()
    data = store.get()
    sku_norm = normalize_sku(sku_code)
    sales = data["powerbi"][data["powerbi"]["sku_norm"] == sku_norm].copy()

    max_date = data["powerbi"]["Date"].max()
    recent_start = max_date - pandas_module.Timedelta(days=30)
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
    image_urls = image_urls_from_row(img.iloc[0]) if not img.empty else []
    stock_on_hand = clean_number(inv.iloc[0]["Total Inventory Qty"], None) if not inv.empty else None
    daily_average = clean_number(inv.iloc[0]["Daily Average Sales"], None) if not inv.empty else None

    snapshot = {
        "sku": sku_norm,
        "title": title,
        "imageUrl": image_url,
        "imageUrls": image_urls,
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
        month_group = pandas_module.DataFrame(columns=["month", "qty", "sales", "profit", "profitMargin"])

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
        "salesRows": [
            {
                "date": clean_value(row["Date"]),
                "platform": row["platform name"],
                "sku_qty": clean_number(row["sku_qty"]),
                "sales_amt": clean_number(row["sales_amt"]),
                "selling_fee": clean_number(row["selling_fee"]),
                "ads_fee": clean_number(row["ads_fee"]),
                "refund_amt": clean_number(row["refund_amt"]),
                "profit_incl_rn": clean_number(row["profit_incl_rn"]),
            }
            for _, row in sales.iterrows()
        ],
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
        except Exception as exc:
            self.send_json({"error": f"Dashboard API error: {exc}"}, status=500)
            return
        super().do_GET()


def main():
    if SOURCE_MODE == "supabase" and not supabase_enabled():
        raise SystemExit("Supabase mode needs SUPABASE_URL and SUPABASE_ANON_KEY.")
    if SOURCE_MODE not in ("google", "supabase") and not WORKBOOK_PATH.exists():
        raise SystemExit(f"Workbook not found: {WORKBOOK_PATH}")
    port = int(os.environ.get("PORT", "8765"))
    host = os.environ.get("HOST", "0.0.0.0" if os.environ.get("RENDER") else "127.0.0.1")
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"SKU Performance app running at http://{host}:{port}")
    if SOURCE_MODE == "google":
        print(f"Google Sheet: https://docs.google.com/spreadsheets/d/{GOOGLE_SHEET_ID}")
    elif SOURCE_MODE == "supabase":
        print(f"Supabase: {SUPABASE_URL}")
    else:
        print(f"Workbook: {WORKBOOK_PATH}")
    server.serve_forever()


if __name__ == "__main__":
    main()
