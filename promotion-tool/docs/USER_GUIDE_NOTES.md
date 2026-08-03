# Promotion Nomination User Guide Notes

Status: Living notes for the production tool. Update this file and the in-app
walkthrough whenever a user-facing workflow, rule, input, or output changes.
These notes will be used to create the final user guide.

## Standard workflow

1. At startup, resolve any new ChannelAdvisor SKUs that the latest refresh
   could not map automatically.
2. Select the platform and enter a campaign name.
3. Review the default platform commission and amend it when required.
4. For Debenhams or The Range, download and upload the latest
   `UK Product Commission Rate List` from DingTalk.
5. Upload the current platform offer file containing Platform SKU and Current
   Offer Price.
   A progress window remains visible while the offer or commission file is
   processed. Use Cancel import to stop the request and retain the previous
   results.
6. State whether the imported prices include or exclude VAT.
7. Choose CA price or offer price as the calculation basis.
8. Resolve only the platform SKUs that the app cannot match automatically.
9. Set nomination filters and review the grade-to-profit-margin matrix.
10. Choose whether exported promotion prices include or exclude VAT.
11. Review eligible, excluded, and warning results.
    Collapse the Criteria panel when more room is needed for the results table;
    use the compact plus button to reopen it.
12. Select approved SKUs and export the promotion nomination file.

## Input rules

- The first upload must contain the platform SKU and current offer price.
- Supported offer-file types are CSV, XLSX, and XLSM.
- Offer and commission imports display a blocking progress window while the
  selected file is being read, matched, and calculated.
- Cancel import stops the active browser requests, ignores late responses, and
  restores the rows, selections, mapping state, and commission state from
  before the import started.
- Debenhams and The Range always require the latest
  `UK Product Commission Rate List` downloaded from DingTalk.
- The workbook contains all variable-commission platforms, with each platform
  stored on a separate tab. The current sample contains `The Range` and
  `Debenhams` tabs.
- Each commission tab must contain Platform, Category, SKU, and Commission Rate.
- The app reads every tab in one upload and applies rates for the selected
  platform using the mapped Wooper SKU.
- When an imported SKU has no matching rate, the app prompts the user to either
  re-upload the latest file or review and apply a suggested commission rate.
- Suggested missing-SKU rates use a single matching category rate when
  available; otherwise they use the editable platform default.
- Export remains blocked until every SKU has a confirmed commission rate.
- The platform default commission is shown automatically but remains editable.
- Imported prices can be marked VAT Included or VAT Excluded.
- VAT is fixed at 20% for the current UK demo.
- CA price means ChannelAdvisor Buy It Now Price and is treated as the normal
  pre-promotion price.
- Wooper provides the canonical SKU, grade, main category, subcategory, brand,
  inventory status, estimated selling months, stock, and COGS.

## SKU mapping rules

The app checks SKU mappings in this order:

1. A CA SKU ending in `-ALL` is classified as a non-existing parent SKU.
2. A saved Supabase manual mapping.
3. A Wooper SKU supplied in the imported file.
4. An exact platform-SKU-to-Wooper-SKU match.
5. The normalization rule used by column C of the manual workbook's CA Price
   sheet.

Only a SKU that fails all five checks is shown in the mapping dialog.

- Wooper SKU is always the canonical core SKU.
- Multiple ChannelAdvisor SKUs may map to the same Wooper SKU.
- CA SKUs ending in `-ALL` are parent SKUs. They are automatically marked
  non-existing, excluded from promotion calculations, and omitted from mapping
  prompts.
- Every refresh reuses saved mappings before applying automatic rules.
- Newly introduced CA SKUs that remain unresolved are shown at tool startup.
- Mapping work can be saved in batches; unresolved rows remain available from
  the Resolve mappings button.
- Use the Wooper SKU field for a genuine naming exception.
- Use Non-existing SKU for an old product that should no longer participate.
- Manual mappings and non-existing statuses are stored in Supabase and omitted
  from future prompts after they are resolved.
- Current non-existing SKUs: `EC1011-1PK` and `PT1118-BK-UK`.

## Nomination and pricing rules

- Available filters include grade, main category, subcategory, brand, stock,
  estimated selling months, first-arrival cutoff, minimum discount, and return
  review threshold.
- Main category, subcategory, and brand are multi-select dropdowns. Select any
  number of values in each dropdown; a SKU may match any selected value within
  that filter, while different filters are applied together.
- An empty multi-select dropdown means all values. Use the clear icon in the
  open dropdown to return to all values.
- Return rate at or above the default 6% threshold is highlighted red and marks
  an otherwise eligible SKU for review.
- When lifetime margin minus promo margin is more than 5 percentage points,
  both margin cells are highlighted red and the SKU is marked for review.
- Hover or keyboard-focus the information icon in the Promo margin, Lifetime
  margin, or Return rate header to see the corresponding red-highlight rule.
- The table header remains visible while the user scrolls through a long SKU
  result list.
- Displayed result rows are always sorted from A to Z by the core Wooper SKU,
  including filtered and searched views.
- The Criteria panel can be collapsed after settings are reviewed. The results
  table expands into the available space, and the compact plus button restores
  the panel. The choice is remembered on the same browser.
- These two checks are review warnings, not exclusion reasons.
- The discount always references the editable grade-to-profit-margin matrix.
- Suggested freight follows the SKU dashboard precedence: Suggested Freight,
  then Avg Actual Freight when Valid Qty is over 5, then Sello Tools
  Calculation.
- WMS is 8% of the promotion selling price excluding VAT. Reverse pricing
  includes the same 8% WMS rate in the target-margin denominator.
- Lifetime margin and return rate aggregate all available PowerBI history across
  every platform for the mapped Wooper SKU.
- Lifetime margin uses profit including refunds and resends divided by net
  sales. Return rate uses refund amount plus resend amount divided by net sales.
- Net sales equals sales amount plus extra freight minus promotion rebate.
- CA price is the default calculation source.
- CA price is always treated as VAT included, including when the imported offer
  price is set to VAT excluded.
- Users may switch the calculation source between CA price and offer price.
- When offer price is selected but unavailable, CA price is used automatically.
- When CA price is selected but unavailable, offer price is used and the row is
  flagged for review.
- The workbook matrix is the default for each new run.
- Maximum discount caps the proposed discount.
- Discount interval is optional and defaults to 5% when enabled.
- The interval rounds only the automatically suggested discount down to the
  nearest step. For example, 22.1% becomes 20% at a 5% interval.
- A manually entered final-discount override is not changed by the interval.
- A final-discount override recalculates promotion price, profit, and margin.
- VAT-excluded imported prices are multiplied by 1.20 before discount and
  margin calculations.
- VAT-inclusive promotion prices are the internal pricing and rounding basis.
- A VAT-excluded export price is the VAT-inclusive result divided by 1.20.
- The Normal Price and Promotion Price CSV headers state their VAT basis.
- The CSV export includes COGS and Avg Freight for calculation review; these
  fields do not appear in the on-screen result table.
- Only selected candidates are included in the export.

## Demo data behavior

- The local demo prefers the newest Wooper
  `InventoryReportExport_Normal_UK_*.xlsx` file in Downloads.
- It falls back to `Lastest Data Analyse - Codex.xlsx` when the raw Wooper
  export is not available.
- Manual mappings and non-existing statuses are stored in the persistent
  Supabase `sku_mappings` table.
- First arrival date follows the SKU dashboard: use the SKU master date when
  available, otherwise use the SKU's earliest Container report inbound date.
  Dates are normalized before applying the exclusion cutoff.
- CA prices are read from the newest ChannelAdvisor
  `InventoryExport_Marketplace_New_Listing_Template*.xlsx` file in Downloads,
  with the workbook Image sheet as fallback.
- Each ChannelAdvisor SKU is aligned to the Wooper inventory through saved
  mapping, exact match, then the CA naming rule. The aligned Wooper SKU is used
  as the CA-price fallback when the uploaded platform SKU is named differently.
- Unresolved ChannelAdvisor SKUs do not trigger a bulk prompt. A user is asked
  to map an SKU only when it affects the current promotion input and all
  automatic methods fail.
- The demo reads unresolved CA mappings from Supabase and writes completed
  mappings through its server-side connection. Supabase credentials are never
  exposed to the browser.

## Shared production data model

The SKU-dashboard schema and importer define
`channeladvisor_products`, keyed by the original ChannelAdvisor platform SKU,
with verified Wooper SKU, CA price, mapping status, mapping source, title,
brand, and import timestamp.

The live Supabase project contains `promotion_sku_data`,
`channeladvisor_products`, and `sku_mappings`. The normal validated SKU
dashboard refresh updates the promotion snapshot and CA data at the same time.
Manual mappings and non-existing statuses remain durable between refreshes.

## Change log

### 2026-07-31

- Published the Supabase-backed tool to Render with public access.
- Corrected the mapping prompt so it only suggests exact current Wooper SKUs;
  unresolved SKUs now start with a blank mapping field.
- Required every completed mapping to select an exact SKU from the current
  Wooper inventory list, while retaining the Non-existing SKU option.
- Reused an external SKU's saved mapping across platforms when every saved
  record agrees, preventing repeated prompts for previously resolved aliases.
- Kept conflicting platform mappings platform-specific so an uncertain
  cross-platform mapping is never applied automatically.
- Replaced the local-demo labels with production live-data labels.
- Corrected the result-table layout so Decision and Reason cannot cover Promo
  price, Promo margin, SOH, Lifetime margin, or Return rate.
- Moved SOH immediately after Months. Sold remains immediately before Lifetime
  margin, followed by Return rate.
- Kept grade filtering as an editable minimum grade-level threshold.
- Added bilingual hover and keyboard-focus notes to the margin and return-rate
  headers to explain their red-highlight rules.
- Kept the result header visible while scrolling through long SKU lists on
  desktop and mobile layouts.
- Corrected the populated results panel so the SKU table itself scrolls within
  the workspace and its header remains visible during natural mouse-wheel
  scrolling.
- Narrowed the Category column and expanded the Reason column, with wrapped
  reason text and a hover title for truncated category names.
- Widened the Final override-discount column and removed the number spinner so
  the full discount value and percent suffix remain visible.
- Added a bilingual import-progress window with a Cancel import action for
  platform offer files and commission workbooks.
- Added a persistent bilingual control to collapse or reopen the Criteria panel
  and expand the results workspace.
- Sorted displayed result rows from A to Z by the core Wooper SKU.
- Updated the English and Simplified Chinese filter labels and walkthrough.

### 2026-08-03

- Added Save worktable with mandatory confirmation of promotion platform and
  event name.
- Saved worktables are immutable historical records. They preserve the exact
  imported rows, criteria, VAT settings, commissions, mappings, overrides,
  selections, and calculated results that were visible when saved.
- Added a shared staff archive searchable by platform, event name, and Sydney
  creation date.
- Opening a saved record is read-only and does not recalculate against newer
  Supabase data or newer calculation logic.
- The current draft is retained in memory while a saved record is reviewed, so
  Return to current worktable restores the staff member's active work.
- A calculated worktable with unsaved changes triggers the browser's standard
  warning when the user closes or reloads the tab.

### 2026-07-30

- Added the six-step in-app walkthrough and permanent Help button.
- Added imported-price and exported-price VAT basis controls at a fixed 20%.
- Added explicit VAT Included or VAT Excluded labels to table and CSV headers.
- Added CA price ingestion from ChannelAdvisor Buy It Now Price.
- Aligned ChannelAdvisor SKUs to the verified Wooper inventory before using
  Wooper-level CA-price fallback.
- Added all-platform lifetime profit margin after returns and return rate to the
  review table and promotion export.
- Aligned suggested freight with the SKU dashboard and corrected reverse
  pricing so the 8% WMS charge is included consistently.
- Added CA price or offer price calculation-source selection with automatic
  CA-price fallback when offer price is unavailable.
- Split price-table headers across two lines and tightened their columns to
  preserve space for decisions and reasons.
- Corrected automatic mapping to use the full same-day Wooper inventory list.
- Corrected first-arrival filtering by merging the dashboard's earliest
  container inbound fallback into the current Wooper inventory.
- Added persistent Non-existing SKU handling before promotion calculations.
- Added a visible Close action to the SKU mapping dialog.
- Added the DingTalk `UK Product Commission Rate List` workflow, all-tab import,
  and missing-rate review prompts.

## Final guide checklist

Before publishing the final guide:

- Confirm the final Supabase data sources and refresh timing.
- Confirm each platform's required export columns and file format.
- Add screenshots from the production interface.
- Include troubleshooting for rejected files and unresolved SKUs.
- Record ownership for commission tables, margin defaults, and approvals.
