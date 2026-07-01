# SKU Performance App

This app recreates the workbook dashboard from `Lastest Data Analyse - Codex.xlsx` as a browser dashboard.

It can read from either:

- a local Excel workbook for testing
- the Google Sheet data source for Render hosting

## What It Reads

- `PowerBI`: sales, fees, returns, ads, profit, and platform performance
- `SKU`: first arrival date, COGS, grade support fields
- `Inventory Report`: stock on hand, grade level, months to sell, daily average sales
- `Container report`: latest inbound arrival
- `Price Change`: weekly stock and price history
- `Image`: product title and product image

## Run Locally From Excel

From this folder:

```powershell
$env:SKU_APP_WORKBOOK="C:\Users\SELLOCP92-1\Documents\Overall\Lastest Data Analyse - Codex.xlsx"
& "C:\Users\SELLOCP92-1\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" app.py
```

Open:

```text
http://127.0.0.1:8765
```

The app reloads the workbook automatically when the file modified time changes.

## Run Locally From Google Sheets

The Google Sheet must be shared as `Anyone with the link can view`.

In Google Sheets:

1. Click `Share`.
2. Under `General access`, choose `Anyone with the link`.
3. Set the role to `Viewer`.
4. Click `Done`.

```powershell
cd "C:\Users\SELLOCP92-1\Documents\Overall\sku-performance-app"
$env:SKU_APP_SOURCE="google"
$env:GOOGLE_SHEET_ID="17fj9gaoE4U5_Ks_EkI68CPBBPIjjbDYMkifG1SqbBAg"
& "C:\Users\SELLOCP92-1\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" app.py
```

Open:

```text
http://127.0.0.1:8765
```

Google Sheets mode caches data for 15 minutes by default. Change `SKU_APP_CACHE_SECONDS` if needed.

## Free Render Deployment

1. Make sure the Google Sheet is shared as `Anyone with the link can view`.
2. Put this `sku-performance-app` folder in a GitHub repository.
3. In Render, choose `New` then `Web Service`.
4. Connect the GitHub repository.
5. Use the free plan.
6. Render should detect `render.yaml`. If it asks manually:
   - Build command: `pip install -r requirements.txt`
   - Start command: `python app.py`
7. Add these environment variables if Render does not pick them up:
   - `SKU_APP_SOURCE=google`
   - `GOOGLE_SHEET_ID=17fj9gaoE4U5_Ks_EkI68CPBBPIjjbDYMkifG1SqbBAg`
   - `SKU_APP_CACHE_SECONDS=900`

## Sharing With The Team

For the hosted dashboard, your team uses the Render URL. The Google Sheet remains the data source behind the dashboard.

For internal network testing:

```powershell
$env:HOST="0.0.0.0"
$env:PORT="8765"
$env:SKU_APP_WORKBOOK="C:\path\to\Lastest Data Analyse - Codex.xlsx"
& "C:\Users\SELLOCP92-1\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" app.py
```
