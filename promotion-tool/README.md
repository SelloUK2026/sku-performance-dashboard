# Promotion Nomination Tool

Promotion calculation and nomination export tool based on
`Deb-20260623-25OFF.xlsm`.

## Production data

The hosted service reads from the shared Supabase project:

- `promotion_sku_data`: calculation-ready Wooper product snapshot
- `channeladvisor_products`: CA SKUs, CA prices, and mapping state
- `sku_mappings`: durable manual mappings and non-existing statuses

The normal SKU dashboard refresh runs `import_to_supabase.py`, which refreshes
these tables in the same import as sales, inventory, freight, arrivals, prices,
and images. Platform offer prices and variable commission workbooks remain
user-supplied inputs for each promotion run.

## Render service

Create a separate Python web service from this repository:

- Build command: `pip install -r promotion-tool/requirements.txt`
- Start command: `python -u promotion-tool/app.py`
- Health endpoint: `/api/health`

Required environment variables:

- `HOST=0.0.0.0`
- `PROMOTION_DATA_SOURCE=supabase`
- `PROMOTION_CACHE_SECONDS=300`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PROMOTION_REQUIRE_AUTH=false`

`PROMOTION_AUTH_USERNAME` and `PROMOTION_AUTH_PASSWORD` are optional and only
required when application-level authentication is enabled.

The service-role key is used only by the Python backend and must never be sent
to the browser or committed to GitHub.

## Features

- First-step import of platform SKU and current offer price.
- Platform defaults for the 19 commission rates supplied in the reference image.
- All-tab `UK Product Commission Rate List` import for Debenhams and The Range,
  with missing-SKU suggestions and export blocking until all rates are confirmed.
- CA price ingestion from ChannelAdvisor Buy It Now Price, with CA price or
  offer price selectable as the calculation basis.
- Automatic CA-price fallback when an imported offer price is unavailable.
- Exact `CA Price!C` automatic SKU normalization plus persistent manual mappings.
- Supabase-backed many-to-one CA-to-Wooper mappings, with newly unresolved CA
  SKUs prompted at startup after each daily refresh.
- CA SKUs ending in `-ALL` automatically classified as non-existing parent SKUs.
- Workbook-matched reverse pricing, discount cap, optional discount intervals,
  price rounding, profit, and margin.
- Editable grade-to-profit-margin matrix from `Template - General`.
- Wooper minimum-grade and first-arrival filters, with multi-select dropdowns
  for main category, subcategory, and brand.
- All-platform lifetime profit margin after returns and return rate from the
  SKU-dashboard PowerBI history.
- SKU-dashboard suggested freight precedence and WMS at 8% of promotion
  selling price excluding VAT.
- CSV, XLSX, and XLSM import with common column-name mapping.
- Manual candidate selection and discount override.
- Selected nomination CSV export.
- First-visit six-step walkthrough with a permanent Help button.
- Ten reference rows copied from the manual workbook for regression testing.

User-facing workflow notes are maintained in `docs/USER_GUIDE_NOTES.md` while
the app is being enhanced. They are the source for the final user guide.
