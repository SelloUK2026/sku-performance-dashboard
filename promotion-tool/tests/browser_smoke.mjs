import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.PROMOTION_TOOL_URL || "http://127.0.0.1:8878";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

await page.goto(baseUrl, { waitUntil: "networkidle" });
const initial = {
  title: await page.title(),
  guideVisible: await page.locator("#guideModal").isVisible(),
  guideCounter: await page.locator("#guideCounter").textContent(),
  platformCount: await page.locator("#platform option").count(),
  defaultCommission: await page.locator("#defaultCommission").inputValue(),
  marginInputs: await page.locator(".grade-margin").count(),
  vatOptions: await page.locator(".vat-option").count(),
  vatRate: await page.locator(".vat-controls > strong").textContent(),
  priceSourceOptions: await page.locator(".price-source-option").count(),
  defaultPriceSource: await page.locator(".price-source-option.active").textContent(),
  discountIntervalEnabled: await page.locator("#discountIntervalEnabled").isChecked(),
  discountIntervalValue: await page.locator("#discountInterval").inputValue(),
  discountIntervalDisabled: await page.locator("#discountInterval").isDisabled(),
  guideText: await page.locator("#guideModal").textContent(),
  defaultCommissionLabel: await page.locator("#defaultCommission").evaluate(
    (input) => input.closest("label").childNodes[0].textContent.trim(),
  ),
};
await page.screenshot({
  path: "analysis/user-guide-desktop.png",
  fullPage: true,
});
await page.locator("#guideLanguageButton").click();
const chinese = {
  htmlLanguage: await page.locator("html").getAttribute("lang"),
  title: await page.title(),
  switchLabel: await page.locator("#guideLanguageButton").textContent(),
  guideTitle: await page.locator("#guideTitle").textContent(),
  guideCounter: await page.locator("#guideCounter").textContent(),
  caPriceLabel: await page.locator('.price-source-option[data-price-source="ca"]').textContent(),
  caHeader: await page.locator("#caPriceHeader").textContent(),
  vatRate: await page.locator(".vat-controls > strong").textContent(),
  defaultCommissionLabel: await page.locator("#defaultCommission").evaluate(
    (input) => input.closest("label").childNodes[0].textContent.trim(),
  ),
  defaultCommissionValue: await page.locator("#defaultCommission").inputValue(),
  campaignName: await page.locator("#campaignName").inputValue(),
  noPageOverflow: await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  ),
};
await page.screenshot({
  path: "analysis/chinese-desktop.png",
  fullPage: true,
});
await page.locator("#guideLanguageButton").click();
await page.waitForFunction(() => document.documentElement.lang === "en");
await page.locator("#guideNext").click();
initial.secondGuideTitle = await page.locator("#guideTitle").textContent();
await page.locator("#guideCloseButton").click();
initial.startupCaMappingVisible = await page.locator("#mappingModal").isVisible();
initial.startupCaMappingTitle = await page.locator("#mappingTitle").textContent();
initial.startupCaMappingCount = await page.locator("#mappingList .mapping-row").count();
initial.startupCaMappingSearchVisible = await page.locator("#mappingSearch").isVisible();
initial.startupCaParentCount = await page
  .locator("#mappingList .mapping-row .mapping-product strong")
  .evaluateAll((nodes) => nodes.filter((node) => node.textContent.trim().toUpperCase().endsWith("-ALL")).length);
if (initial.startupCaMappingVisible) {
  await page.locator("#closeMappings").click();
}
initial.firstImportVisibleAfterGuide = await page.locator("#firstImportModal").isVisible();

let releaseCancelledImport;
let markCancelledImportStarted;
const cancelledImportStarted = new Promise((resolve) => {
  markCancelledImportStarted = resolve;
});
const cancelledImportRoute = async (route) => {
  if (route.request().headers()["x-filename"] !== "cancel-test.csv") {
    await route.continue();
    return;
  }
  markCancelledImportStarted();
  await new Promise((resolve) => {
    releaseCancelledImport = resolve;
  });
  try {
    await route.continue();
  } catch {
    // The expected browser abort can close the intercepted request first.
  }
};
await page.route("**/api/import", cancelledImportRoute);
await page.locator("#fileInput").setInputFiles({
  name: "cancel-test.csv",
  mimeType: "text/csv",
  buffer: Buffer.from("Platform SKU,Current Offer Price\nAI1005-BK,24.99\n"),
});
await cancelledImportStarted;
await page.waitForSelector("#importProgressModal.visible");
const cancelledImport = {
  visible: await page.locator("#importProgressModal").isVisible(),
  title: await page.locator("#importProgressTitle").textContent(),
  message: await page.locator("#importProgressMessage").textContent(),
  cancelLabel: await page.locator("#cancelImport").textContent(),
  rowCountBeforeCancel: await page.locator("#candidateRows tr").count(),
};
await page.screenshot({
  path: "analysis/import-progress.png",
});
await page.locator("#cancelImport").click();
releaseCancelledImport();
await page.waitForFunction(
  () => !document.querySelector("#importProgressModal")?.classList.contains("visible"),
);
await page.unroute("**/api/import", cancelledImportRoute);
await page.waitForTimeout(200);
cancelledImport.hidden = await page.locator("#importProgressModal").isHidden();
cancelledImport.rowCountAfterCancel = await page.locator("#candidateRows tr").count();
cancelledImport.status = await page.locator("#calculationStatus").textContent();
cancelledImport.firstImportRestored = await page.locator("#firstImportModal").isVisible();

await page.locator("#fileInput").setInputFiles({
  name: "current-offers.csv",
  mimeType: "text/csv",
  buffer: Buffer.from("Platform SKU,Current Offer Price\nAI1005-BK,24.99\n"),
});
await page.waitForSelector("#candidateRows tr");
const offerImport = {
  rowCount: await page.locator("#candidateRows tr").count(),
  commissionTableRequired: await page.locator("#commissionRequirement").isVisible(),
  caPrice: await page.locator("#candidateRows tr td").nth(5).textContent(),
  offerPrice: await page.locator("#candidateRows tr td").nth(6).textContent(),
  defaultPriceUsed: await page.locator("#candidateRows tr td").nth(7).textContent(),
};
let releaseCommissionImport;
let markCommissionImportStarted;
const commissionImportStarted = new Promise((resolve) => {
  markCommissionImportStarted = resolve;
});
const commissionImportRoute = async (route) => {
  markCommissionImportStarted();
  await new Promise((resolve) => {
    releaseCommissionImport = resolve;
  });
  try {
    await route.continue();
  } catch {
    // Removing the route can resume the intercepted request first.
  }
};
await page.route("**/api/import-commissions", commissionImportRoute);
await page.locator("#commissionFileInput").setInputFiles(
  "C:\\Users\\SELLOCP92-1\\Downloads\\UK Product Commission Rate List.xlsx",
);
await commissionImportStarted;
await page.waitForSelector("#importProgressModal.visible");
const commissionProgress = {
  title: await page.locator("#importProgressTitle").textContent(),
  message: await page.locator("#importProgressMessage").textContent(),
};
releaseCommissionImport();
await page.unroute("**/api/import-commissions", commissionImportRoute);
await page.waitForFunction(
  () => (
    document.querySelector("#commissionRequirement")?.hidden === true
    && !document.querySelector("#importProgressModal")?.classList.contains("visible")
  ),
);
commissionProgress.hiddenAfterImport = await page.locator("#importProgressModal").isHidden();
const matchedCommission = {
  requirementHidden: await page.locator("#commissionRequirement").isHidden(),
  missingPromptVisible: await page.locator("#commissionMissingModal").isVisible(),
};
await page.locator("#platform").selectOption("The Range");
await page.waitForFunction(
  () => (
    document.querySelector("#defaultCommission")?.value === "14.0"
    && document.querySelector("#commissionRequirement")?.hidden === true
  ),
);
matchedCommission.reusedForRange = await page.locator("#commissionRequirement").isHidden();
await page.locator("#platform").selectOption("Debenhams");
await page.waitForFunction(
  () => (
    document.querySelector("#defaultCommission")?.value === "24.0"
    && document.querySelector("#commissionRequirement")?.hidden === true
  ),
);
await page.locator('.price-source-option[data-price-source="offer"]').click();
await page.waitForFunction(
  () => (
    document.querySelector(".price-source-option.active")?.textContent === "Offer price"
    && document.querySelectorAll("#candidateRows tr td")[7]?.textContent.trim() === "£24.99"
  ),
);
offerImport.offerPriceUsed = await page.locator("#candidateRows tr td").nth(7).textContent();

await page.locator("#fileInput").setInputFiles({
  name: "missing-commission.csv",
  mimeType: "text/csv",
  buffer: Buffer.from("Platform SKU,Current Offer Price\nAIRPURE-HOAIR334,19.99\n"),
});
await page.waitForSelector("#commissionMissingModal.visible");
const missingCommission = {
  promptVisible: await page.locator("#commissionMissingModal").isVisible(),
  summary: await page.locator("#commissionMissingSummary").textContent(),
  sku: await page.locator(".commission-missing-row strong").textContent(),
  suggestedRate: await page.locator(".missing-commission-rate").inputValue(),
  suggestionSource: await page.locator(".commission-suggestion-source").textContent(),
  requirementVisible: await page.locator("#commissionRequirement").isVisible(),
  decision: await page.locator("#candidateRows tr td").nth(16).textContent(),
};
await page.screenshot({
  path: "analysis/commission-missing.png",
  fullPage: true,
});
await page.locator("#applySuggestedCommissions").click();
await page.waitForFunction(
  () => !document.querySelector("#commissionMissingModal")?.classList.contains("visible"),
);
missingCommission.applied = !(await page.locator("#commissionMissingModal").isVisible());
missingCommission.requirementCleared = await page.locator("#commissionRequirement").isHidden();

await page.locator("#fileInput").setInputFiles({
  name: "missing-offer.csv",
  mimeType: "text/csv",
  buffer: Buffer.from("Platform SKU,Current Offer Price\nAI1005-BK,\n"),
});
await page.waitForFunction(
  () => {
    const row = document.querySelector("#candidateRows tr");
    return row?.textContent.includes("AI1005-BK-UK")
      && row.querySelectorAll("td")[6]?.textContent.trim() === "-";
  },
);
const missingOffer = {
  offerPrice: await page.locator("#candidateRows tr td").nth(6).textContent(),
  priceUsed: await page.locator("#candidateRows tr td").nth(7).textContent(),
  reason: await page.locator("#candidateRows tr td").last().textContent(),
};

await page.locator("#fileInput").setInputFiles({
  name: "unmapped-offers.csv",
  mimeType: "text/csv",
  buffer: Buffer.from("Platform SKU,Current Offer Price\nMYSTERY_BLUE,49.99\n"),
});
await page.waitForSelector("#mappingModal.visible");
const mapping = {
  promptVisible: await page.locator("#mappingModal").isVisible(),
  suggestedSku: await page.locator(".manual-mapping").inputValue(),
  nonExistingOption: await page.locator(".non-existing-sku").isVisible(),
};
const mappingInput = page.locator(".manual-mapping");
await mappingInput.fill("NOT-A-WOOPER-SKU");
await page.locator("#saveMappings").click();
mapping.invalidRejected = await mappingInput.getAttribute("aria-invalid") === "true";
mapping.remainedOpen = await page.locator("#mappingModal").isVisible();
await page.screenshot({
  path: "analysis/mapping-validation.png",
});
await mappingInput.fill("AI1005-BK-UK");
mapping.validWooperAccepted = await mappingInput.getAttribute("aria-invalid") === "false";
await mappingInput.fill("");
await page.locator("#closeMappings").click();
mapping.closed = !(await page.locator("#mappingModal").isVisible());
mapping.reopenAvailable = await page.locator("#mappingButton").isVisible();
await page.locator("#mappingButton").click();
mapping.reopened = await page.locator("#mappingModal").isVisible();

await page.reload({ waitUntil: "networkidle" });
if (await page.locator("#mappingModal").isVisible()) {
  await page.locator("#closeMappings").click();
}
await page.locator("#firstSampleButton").click();
await page.waitForSelector("#candidateRows tr");
const loaded = {
  rowCount: await page.locator("#candidateRows tr").count(),
  displayedSkus: await page.locator("#candidateRows .sku-primary").allTextContents(),
  mainCategoryOptions: await page.locator("#mainCategory .multi-select-option").count(),
  subcategoryOptions: await page.locator("#subcategory .multi-select-option").count(),
  brandOptions: await page.locator("#brand .multi-select-option").count(),
  eligibleCount: await page.locator("#eligibleCount").textContent(),
};
loaded.criteriaWidthExpanded = await page.locator(".criteria-panel").evaluate(
  (panel) => Math.round(panel.getBoundingClientRect().width),
);
loaded.resultsWidthExpanded = await page.locator(".results-panel").evaluate(
  (panel) => Math.round(panel.getBoundingClientRect().width),
);
await page.locator("#criteriaToggle").click();
await page.waitForFunction(
  () => document.querySelector("#workspace")?.classList.contains("criteria-collapsed"),
);
loaded.criteriaWidthCollapsed = await page.locator(".criteria-panel").evaluate(
  (panel) => Math.round(panel.getBoundingClientRect().width),
);
loaded.resultsWidthCollapsed = await page.locator(".results-panel").evaluate(
  (panel) => Math.round(panel.getBoundingClientRect().width),
);
loaded.criteriaFormHidden = await page.locator("#criteriaForm").isHidden();
loaded.criteriaToggleExpanded = await page.locator("#criteriaToggle").getAttribute("aria-expanded");
loaded.criteriaPreference = await page.evaluate(
  () => localStorage.getItem("promotion-nomination-criteria-collapsed"),
);
await page.locator("#languageButton").click();
await page.waitForFunction(() => document.documentElement.lang === "zh-CN");
loaded.chineseShowCriteriaTitle = await page.locator("#criteriaToggle").getAttribute("title");
await page.screenshot({
  path: "analysis/collapsed-criteria.png",
});
await page.locator("#languageButton").click();
await page.waitForFunction(() => document.documentElement.lang === "en");
await page.locator("#criteriaToggle").click();
await page.waitForFunction(
  () => !document.querySelector("#workspace")?.classList.contains("criteria-collapsed"),
);
loaded.criteriaRestored = await page.locator("#criteriaForm").isVisible();
await page.locator("#mainCategory .multi-select-trigger").click();
await page.locator('#mainCategory input[value="Home Appliances"]').check();
const multiFilterCalculation = page.waitForResponse(
  (response) => response.url().endsWith("/api/calculate") && response.ok(),
);
await page.locator('#mainCategory input[value="Kitchen Appliances"]').check();
await multiFilterCalculation;
await page.waitForFunction(
  () => document.querySelector("#mainCategory .multi-select-value")?.textContent === "2 selected",
);
loaded.multiCategorySummary = await page.locator("#mainCategory .multi-select-value").textContent();
loaded.multiCategoryValues = await page.locator("#mainCategory input:checked").evaluateAll(
  (inputs) => inputs.map((input) => input.value),
);
await page.locator("#languageButton").click();
loaded.chineseMultiCategorySummary = await page.locator("#mainCategory .multi-select-value").textContent();
await page.locator("#languageButton").click();
await page.waitForFunction(() => document.documentElement.lang === "en");
loaded.unselectedCategoryReason = await page.locator("#candidateRows tr")
  .filter({ hasText: "BATH1010-WH-UK" })
  .locator("td")
  .last()
  .textContent();
await page.locator("#mainCategory .multi-select-trigger").click();
const clearedFilterCalculation = page.waitForResponse(
  (response) => response.url().endsWith("/api/calculate") && response.ok(),
);
await page.locator("#mainCategory .multi-select-clear").click();
await clearedFilterCalculation;
await page.waitForFunction(
  () => document.querySelector("#mainCategory .multi-select-value")?.textContent === "All main categories",
);
loaded.multiCategoryCleared = await page.locator("#mainCategory input:checked").count() === 0;
loaded.suggestedDiscountsBeforeInterval = await page.locator("#candidateRows tr").evaluateAll(
  (rows) => rows.map((row) => row.querySelectorAll("td")[8]?.textContent.trim()),
);
await page.waitForFunction(
  () => document.querySelector("#calculationStatus")?.textContent === "10 rows calculated",
);
await page.locator(".discount-interval-controls .switch").click();
await page.waitForFunction(
  (before) => {
    const after = [...document.querySelectorAll("#candidateRows tr")]
      .map((row) => row.querySelectorAll("td")[8]?.textContent.trim());
    return after.join("|") !== before.join("|");
  },
  loaded.suggestedDiscountsBeforeInterval,
);
loaded.discountIntervalInputEnabled = await page.locator("#discountInterval").isEnabled();
loaded.suggestedDiscountsAfterInterval = await page.locator("#candidateRows tr").evaluateAll(
  (rows) => rows.map((row) => row.querySelectorAll("td")[8]?.textContent.trim()),
);
await page.locator('.vat-option[data-vat-setting="input"][data-vat-value="excluded"]').click();
await page.locator('.vat-option[data-vat-setting="export"][data-vat-value="excluded"]').click();
await page.waitForFunction(
  () => document.querySelector("#calculationStatus")?.textContent === "10 rows calculated",
);
loaded.normalPriceHeader = await page.locator("#normalPriceHeader").textContent();
loaded.offerPriceHeader = await page.locator("#offerPriceHeader").textContent();
loaded.promoPriceHeader = await page.locator("#promoPriceHeader").textContent();
loaded.priceHeaderWidths = await page.locator("th.price-column").evaluateAll(
  (headers) => headers.map((header) => Math.round(header.getBoundingClientRect().width)),
);
loaded.priceHeaderLineCounts = await page.locator("th.price-column").evaluateAll(
  (headers) => headers.map((header) => header.querySelectorAll("span").length),
);
loaded.headerOrder = await page.locator("thead th").evaluateAll(
  (headers) => headers.map((header) => header.textContent.replace(/\s+/g, " ").trim()),
);
loaded.headerNoteCount = await page.locator(".header-note").count();
loaded.promoHighlightNote = await page.locator(
  "#promoMarginHeader .header-note",
).getAttribute("data-tooltip");
loaded.returnHighlightNote = await page.locator(
  "#returnRateHeader .header-note",
).getAttribute("data-tooltip");
const returnHeaderNote = page.locator("#returnRateHeader .header-note");
await returnHeaderNote.hover();
await page.waitForTimeout(180);
await page.screenshot({
  path: "analysis/header-highlight-note.png",
});
loaded.returnTooltipVisible = await returnHeaderNote.evaluate((node) => {
  const tooltip = getComputedStyle(node, "::after");
  return tooltip.visibility === "visible" && Number(tooltip.opacity) > 0;
});
loaded.stickyHeader = await page.locator(".table-shell").evaluate(async (shell) => {
  const previous = {
    flex: shell.style.flex,
    height: shell.style.height,
    maxHeight: shell.style.maxHeight,
    scrollTop: shell.scrollTop,
  };
  shell.style.flex = "0 0 220px";
  shell.style.height = "220px";
  shell.style.maxHeight = "220px";
  await new Promise(requestAnimationFrame);
  shell.scrollTop = 160;
  await new Promise(requestAnimationFrame);
  const header = shell.querySelector("thead th");
  const shellTop = shell.getBoundingClientRect().top;
  const headerTop = header.getBoundingClientRect().top;
  const result = {
    position: getComputedStyle(header).position,
    scrolled: shell.scrollTop > 0,
    topDelta: Math.abs(headerTop - shellTop),
  };
  shell.scrollTop = previous.scrollTop;
  shell.style.flex = previous.flex;
  shell.style.height = previous.height;
  shell.style.maxHeight = previous.maxHeight;
  return result;
});
loaded.overlappingHeaders = await page.locator("thead th").evaluateAll((headers) => {
  const rects = headers.map((header) => header.getBoundingClientRect());
  return rects.slice(1).some((rect, index) => rect.left < rects[index].right - 1);
});
loaded.lifetimeMargins = await page.locator("#candidateRows tr").evaluateAll(
  (rows) => rows.map((row) => row.querySelectorAll("td")[14]?.textContent.trim()),
);
loaded.returnRates = await page.locator("#candidateRows tr").evaluateAll(
  (rows) => rows.map((row) => row.querySelectorAll("td")[15]?.textContent.trim()),
);
const normalMarginRow = page.locator("#candidateRows tr").filter({ hasText: "AP0044-UK" });
loaded.normalMarginRowDecision = await normalMarginRow.locator("td").nth(16).textContent();
loaded.normalMarginRowReason = await normalMarginRow.locator("td").nth(17).textContent();
loaded.returnRateReviewCount = await page.locator("td.return-rate-review").count();
await page.locator("#languageButton").click();
const chineseResultRow = page.locator("#candidateRows tr").filter({ hasText: "AI1005-BK-UK" });
loaded.chineseDecision = await chineseResultRow.locator("td").nth(16).textContent();
loaded.chineseReason = await chineseResultRow.locator("td").nth(17).textContent();
loaded.chineseCaHeader = await page.locator("#caPriceHeader").textContent();
loaded.chineseReturnHighlightNote = await page.locator(
  "#returnRateHeader .header-note",
).getAttribute("data-tooltip");
loaded.chineseRowCount = await page.locator("#candidateRows tr").count();
await page.screenshot({
  path: "analysis/chinese-results.png",
  fullPage: true,
});
await page.locator("#languageButton").click();
await page.waitForFunction(() => document.documentElement.lang === "en");
const downloadPromise = page.waitForEvent("download");
await page.locator("#exportButton").click();
const download = await downloadPromise;
const exportCsv = await readFile(await download.path(), "utf8");
loaded.exportHasCaPriceHeader = exportCsv.includes("CA Price - Normal Price (VAT Included)");
loaded.exportHasInputVatHeader = exportCsv.includes("Offer Price (VAT Excluded)");
loaded.exportHasPromoVatHeader = exportCsv.includes("Promotion Price (VAT Excluded)");
loaded.exportHasPriceSourceHeader = exportCsv.includes("Calculation Price Source");

await page.screenshot({
  path: "analysis/browser-smoke.png",
  fullPage: true,
});

const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mobilePage = await mobileContext.newPage();
await mobilePage.goto(baseUrl, { waitUntil: "networkidle" });
await mobilePage.locator("#guideLanguageButton").click();
const mobileGuide = await mobilePage.locator("#guideModal .guide-modal").boundingBox();
const mobile = {
  guideVisible: await mobilePage.locator("#guideModal").isVisible(),
  chineseTitle: await mobilePage.locator("#guideTitle").textContent(),
  chineseCounter: await mobilePage.locator("#guideCounter").textContent(),
  widthFits: mobileGuide && mobileGuide.x >= 0 && mobileGuide.x + mobileGuide.width <= 390,
  heightFits: mobileGuide && mobileGuide.y >= 0 && mobileGuide.y + mobileGuide.height <= 844,
  noPageOverflow: await mobilePage.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  ),
  layout: await mobilePage.evaluate(() => {
    const workspace = document.querySelector(".workspace");
    const criteria = document.querySelector(".criteria-panel");
    const results = document.querySelector(".results-panel");
    return {
      innerWidth: window.innerWidth,
      scrollX: window.scrollX,
      workspaceColumns: getComputedStyle(workspace).gridTemplateColumns,
      workspaceWidth: workspace.getBoundingClientRect().width,
      criteriaX: criteria.getBoundingClientRect().x,
      criteriaWidth: criteria.getBoundingClientRect().width,
      resultsX: results.getBoundingClientRect().x,
      resultsWidth: results.getBoundingClientRect().width,
    };
  }),
};
await mobilePage.screenshot({
  path: "analysis/user-guide-mobile.png",
  fullPage: true,
});
await mobilePage.locator("#guideCloseButton").click();
mobile.startupCaMappingVisible = await mobilePage.locator("#mappingModal").isVisible();
const mobileMappingModal = await mobilePage.locator("#mappingModal .mapping-modal").boundingBox();
mobile.startupCaMappingFits = !mobile.startupCaMappingVisible || (
  mobileMappingModal
  && mobileMappingModal.x >= 0
  && mobileMappingModal.x + mobileMappingModal.width <= 390
  && mobileMappingModal.y >= 0
  && mobileMappingModal.y + mobileMappingModal.height <= 844
);
if (mobile.startupCaMappingVisible) {
  await mobilePage.locator("#closeMappings").click();
}
await mobilePage.locator("#firstSampleButton").click();
await mobilePage.waitForSelector("#candidateRows tr");
await mobilePage.locator("#criteriaToggle").click();
await mobilePage.waitForFunction(
  () => document.querySelector("#workspace")?.classList.contains("criteria-collapsed"),
);
const mobileCollapsedCriteria = await mobilePage.locator(".criteria-panel").boundingBox();
mobile.criteriaCollapsed = await mobilePage.locator("#criteriaForm").isHidden();
mobile.criteriaCollapsedHeight = mobileCollapsedCriteria?.height;
mobile.criteriaShowTitle = await mobilePage.locator("#criteriaToggle").getAttribute("title");
mobile.collapsedResultsWidth = await mobilePage.locator(".results-panel").evaluate(
  (panel) => Math.round(panel.getBoundingClientRect().width),
);
await mobilePage.screenshot({
  path: "analysis/collapsed-criteria-mobile.png",
  fullPage: true,
});
await mobilePage.locator("#criteriaToggle").click();
await mobilePage.waitForFunction(
  () => !document.querySelector("#workspace")?.classList.contains("criteria-collapsed"),
);
mobile.criteriaRestored = await mobilePage.locator("#criteriaForm").isVisible();
mobile.resultsPanelConstrained = await mobilePage.locator(".results-panel").evaluate((panel) => {
  const style = getComputedStyle(panel);
  return style.height !== "auto" && panel.clientHeight <= 760;
});
mobile.stickyHeaderPosition = await mobilePage.locator("thead th").first().evaluate(
  (header) => getComputedStyle(header).position,
);
const mobileVatControls = await mobilePage.locator(".vat-controls").boundingBox();
mobile.pageScrollWidth = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
mobile.vatControlsBox = mobileVatControls;
mobile.populatedLayout = await mobilePage.evaluate(() => {
  const workspace = document.querySelector(".workspace");
  const results = document.querySelector(".results-panel");
  const toolbar = document.querySelector(".table-toolbar");
  return {
    workspaceColumns: getComputedStyle(workspace).gridTemplateColumns,
    workspaceWidth: workspace.getBoundingClientRect().width,
    resultsX: results.getBoundingClientRect().x,
    resultsWidth: results.getBoundingClientRect().width,
    toolbarX: toolbar.getBoundingClientRect().x,
    toolbarWidth: toolbar.getBoundingClientRect().width,
    scrollX: window.scrollX,
  };
});
mobile.vatControlsVisible = await mobilePage.locator(".vat-controls").isVisible();
mobile.vatControlsFit = mobileVatControls
  && mobileVatControls.x >= 0
  && mobileVatControls.x + mobileVatControls.width <= 390;
let releaseMobileCommissionImport;
let markMobileCommissionImportStarted;
const mobileCommissionImportStarted = new Promise((resolve) => {
  markMobileCommissionImportStarted = resolve;
});
const mobileCommissionImportRoute = async (route) => {
  markMobileCommissionImportStarted();
  await new Promise((resolve) => {
    releaseMobileCommissionImport = resolve;
  });
  try {
    await route.continue();
  } catch {
    // Removing the route can resume the intercepted request first.
  }
};
await mobilePage.route("**/api/import-commissions", mobileCommissionImportRoute);
await mobilePage.locator("#commissionFileInput").setInputFiles(
  "C:\\Users\\SELLOCP92-1\\Downloads\\UK Product Commission Rate List.xlsx",
);
await mobileCommissionImportStarted;
await mobilePage.waitForSelector("#importProgressModal.visible");
const mobileImportProgress = await mobilePage.locator(
  "#importProgressModal .import-progress-modal",
).boundingBox();
mobile.importProgressFits = mobileImportProgress
  && mobileImportProgress.x >= 0
  && mobileImportProgress.x + mobileImportProgress.width <= 390
  && mobileImportProgress.y >= 0
  && mobileImportProgress.y + mobileImportProgress.height <= 844;
mobile.importProgressTitle = await mobilePage.locator("#importProgressTitle").textContent();
mobile.importCancelVisible = await mobilePage.locator("#cancelImport").isVisible();
await mobilePage.screenshot({
  path: "analysis/import-progress-mobile.png",
});
releaseMobileCommissionImport();
await mobilePage.unroute("**/api/import-commissions", mobileCommissionImportRoute);
await mobilePage.waitForFunction(
  () => !document.querySelector("#importProgressModal")?.classList.contains("visible"),
);
await mobilePage.locator("#fileInput").setInputFiles({
  name: "missing-commission.csv",
  mimeType: "text/csv",
  buffer: Buffer.from("Platform SKU,Current Offer Price\nAIRPURE-HOAIR334,19.99\n"),
});
await mobilePage.waitForSelector("#commissionMissingModal.visible");
const mobileCommissionModal = await mobilePage.locator("#commissionMissingModal .modal").boundingBox();
mobile.commissionModalFits = mobileCommissionModal
  && mobileCommissionModal.x >= 0
  && mobileCommissionModal.x + mobileCommissionModal.width <= 390
  && mobileCommissionModal.y >= 0
  && mobileCommissionModal.y + mobileCommissionModal.height <= 844;
mobile.commissionActionsVisible = await mobilePage.locator("#reuploadCommission").isVisible()
  && await mobilePage.locator("#applySuggestedCommissions").isVisible();
mobile.chineseCommissionTitle = await mobilePage.locator("#commissionMissingTitle").textContent();
mobile.chineseCommissionSummary = await mobilePage.locator("#commissionMissingSummary").textContent();
await mobilePage.screenshot({
  path: "analysis/commission-missing-mobile.png",
  fullPage: true,
});
await mobilePage.screenshot({
  path: "analysis/vat-controls-mobile.png",
  fullPage: true,
});
await mobileContext.close();
await browser.close();

const materialErrors = errors.filter((message) => !message.includes("Failed to load resource"));
if (materialErrors.length) throw new Error(`Browser console errors: ${materialErrors.join(" | ")}`);
if (
  !initial.guideVisible
  || initial.guideCounter !== "Step 1 of 6"
  || initial.secondGuideTitle !== "Import current offers"
  || (
    initial.startupCaMappingVisible
    && initial.startupCaMappingTitle !== "Match CA SKUs to Wooper"
  )
  || (initial.startupCaMappingVisible && initial.startupCaMappingCount < 1)
  || (!initial.startupCaMappingVisible && initial.startupCaMappingCount !== 0)
  || (
    initial.startupCaMappingVisible
    && !initial.startupCaMappingSearchVisible
  )
  || initial.startupCaParentCount !== 0
  || !initial.firstImportVisibleAfterGuide
) {
  throw new Error(
    `First-visit user guide did not complete the expected flow: ${JSON.stringify(initial)}`,
  );
}
if (initial.platformCount < 10) throw new Error("Platform defaults did not load.");
if (initial.marginInputs !== 8) throw new Error("Grade margin matrix is incomplete.");
if (initial.vatOptions !== 4 || initial.vatRate !== "VAT 20%") {
  throw new Error("VAT controls are incomplete.");
}
if (initial.priceSourceOptions !== 2 || initial.defaultPriceSource !== "CA price") {
  throw new Error("CA price is not the default calculation source.");
}
if (
  !cancelledImport.visible
  || cancelledImport.title !== "Loading platform data"
  || !cancelledImport.message?.includes("cancel-test.csv")
  || cancelledImport.cancelLabel !== "Cancel import"
  || cancelledImport.rowCountBeforeCancel !== 0
  || !cancelledImport.hidden
  || cancelledImport.rowCountAfterCancel !== 0
  || cancelledImport.status !== "Import cancelled"
  || !cancelledImport.firstImportRestored
) {
  throw new Error(`Import cancellation failed: ${JSON.stringify(cancelledImport)}`);
}
if (
  commissionProgress.title !== "Loading commission table"
  || !commissionProgress.message?.includes("UK Product Commission Rate List.xlsx")
  || !commissionProgress.hiddenAfterImport
) {
  throw new Error(`Commission import progress failed: ${JSON.stringify(commissionProgress)}`);
}
if (
  initial.defaultCommissionLabel !== "Default commission"
  || initial.defaultCommissionLabel.includes("VAT")
) {
  throw new Error(`Default commission label is incorrect: ${initial.defaultCommissionLabel}`);
}
if (
  chinese.htmlLanguage !== "zh-CN"
  || chinese.title !== "促销提名工具"
  || chinese.switchLabel?.trim() !== "English"
  || chinese.guideTitle !== "选择平台"
  || chinese.guideCounter !== "第1步，共6步"
  || chinese.caPriceLabel?.trim() !== "CA價"
  || chinese.caHeader.replace(/\s+/g, " ").trim() !== "CA價 含VAT"
  || chinese.vatRate !== "VAT 20%"
  || chinese.defaultCommissionLabel !== "默认佣金率"
  || chinese.defaultCommissionValue !== initial.defaultCommission
  || chinese.campaignName !== "EXTRA 25%"
  || !chinese.noPageOverflow
) {
  throw new Error(`Simplified Chinese interface is incomplete: ${JSON.stringify(chinese)}`);
}
if (!initial.guideText?.includes("UK Product Commission Rate List from DingTalk")) {
  throw new Error("The user guide does not explain where to obtain the commission workbook.");
}
if (
  initial.discountIntervalEnabled
  || initial.discountIntervalValue !== "5"
  || !initial.discountIntervalDisabled
) {
  throw new Error("Discount interval defaults are incorrect.");
}
if (!offerImport.commissionTableRequired) throw new Error("Variable commission upload was not requested.");
if (
  !matchedCommission.requirementHidden
  || matchedCommission.missingPromptVisible
  || !matchedCommission.reusedForRange
) {
  throw new Error(`Matched commission rate was not applied: ${JSON.stringify(matchedCommission)}`);
}
if (
  !missingCommission.promptVisible
  || !missingCommission.summary?.includes("Re-upload the latest UK Product Commission Rate List from DingTalk")
  || missingCommission.sku?.trim() !== "AIRPURE-HOAIR334"
  || !missingCommission.suggestedRate
  || !missingCommission.suggestionSource?.includes("platform default")
  || !missingCommission.requirementVisible
  || missingCommission.decision?.trim() !== "Review"
  || !missingCommission.applied
  || !missingCommission.requirementCleared
) {
  throw new Error(`Missing commission recovery failed: ${JSON.stringify(missingCommission)}`);
}
const expectedDefaultPrice = offerImport.caPrice?.trim() === "-"
  ? offerImport.offerPrice?.trim()
  : offerImport.caPrice?.trim();
if (
  offerImport.offerPrice?.trim() !== "£24.99"
  || offerImport.defaultPriceUsed?.trim() !== expectedDefaultPrice
  || offerImport.offerPriceUsed?.trim() !== "£24.99"
) {
  throw new Error(
    `CA price and offer price source switching did not recalculate: ${JSON.stringify(offerImport)}`,
  );
}
const validCaFallback = missingOffer.priceUsed?.trim() !== "£0.00"
  && missingOffer.reason?.includes("Offer price unavailable; CA price used");
const noPriceAvailable = missingOffer.priceUsed?.trim() === "£0.00"
  && missingOffer.reason?.includes("Price or margin settings make reverse pricing impossible")
  && !missingOffer.reason?.includes("Offer price unavailable; CA price used");
if (
  missingOffer.offerPrice?.trim() !== "-"
  || (!validCaFallback && !noPriceAvailable)
) {
  throw new Error(`Missing offer price did not fall back to CA price: ${JSON.stringify(missingOffer)}`);
}
if (
  !mapping.promptVisible
  || mapping.suggestedSku !== ""
  || !mapping.nonExistingOption
  || !mapping.invalidRejected
  || !mapping.remainedOpen
  || !mapping.validWooperAccepted
  || !mapping.closed
  || !mapping.reopenAvailable
  || !mapping.reopened
) {
  throw new Error("Manual SKU mapping did not enforce the current Wooper SKU list.");
}
if (loaded.rowCount !== 10) throw new Error("Workbook sample rows did not load.");
const expectedSkuOrder = [...loaded.displayedSkus].sort((left, right) => (
  left.localeCompare(right, "en-GB", { numeric: true, sensitivity: "base" })
));
if (loaded.displayedSkus.join("|") !== expectedSkuOrder.join("|")) {
  throw new Error(`Displayed SKUs are not sorted A-Z: ${JSON.stringify(loaded.displayedSkus)}`);
}
if (
  loaded.criteriaWidthExpanded < 290
  || loaded.criteriaWidthCollapsed > 45
  || loaded.resultsWidthCollapsed <= loaded.resultsWidthExpanded
  || !loaded.criteriaFormHidden
  || loaded.criteriaToggleExpanded !== "false"
  || loaded.criteriaPreference !== "true"
  || loaded.chineseShowCriteriaTitle !== "显示筛选条件"
  || !loaded.criteriaRestored
) {
  throw new Error(`Criteria collapse failed: ${JSON.stringify(loaded)}`);
}
if (
  loaded.mainCategoryOptions < 2
  || loaded.subcategoryOptions < 2
  || loaded.brandOptions < 2
  || loaded.multiCategorySummary !== "2 selected"
  || loaded.multiCategoryValues.length !== 2
  || !loaded.multiCategoryValues.includes("Home Appliances")
  || !loaded.multiCategoryValues.includes("Kitchen Appliances")
  || loaded.chineseMultiCategorySummary !== "\u5df2\u9009 2 \u9879"
  || !loaded.unselectedCategoryReason?.includes("Outside selected main category")
  || !loaded.multiCategoryCleared
) {
  throw new Error(`Multi-select filters are incomplete: ${JSON.stringify(loaded)}`);
}
if (loaded.normalMarginRowReason?.toLowerCase().includes("normal margin")) {
  throw new Error(
    `Historical normal margin still changes the decision: ${JSON.stringify(loaded)}`,
  );
}
if (loaded.returnRateReviewCount < 1) {
  throw new Error(`Review metrics are not highlighted: ${JSON.stringify(loaded)}`);
}
if (
  loaded.headerNoteCount !== 3
  || !loaded.promoHighlightNote?.includes("5 percentage points")
  || !loaded.returnHighlightNote?.includes("Return review threshold")
  || !loaded.returnTooltipVisible
  || loaded.stickyHeader?.position !== "sticky"
  || !loaded.stickyHeader?.scrolled
  || loaded.stickyHeader?.topDelta > 2
) {
  throw new Error(`Header guidance or sticky scrolling failed: ${JSON.stringify(loaded)}`);
}
if (
  loaded.chineseDecision?.trim() !== "排除"
  || !loaded.chineseReason?.includes("库存低于筛选条件")
  || !loaded.chineseReason?.includes("退货率达到或超过6%审核阈值")
  || loaded.chineseCaHeader.replace(/\s+/g, " ").trim() !== "CA價 含VAT"
  || !loaded.chineseReturnHighlightNote?.includes("默认6%")
  || loaded.chineseRowCount !== loaded.rowCount
) {
  throw new Error(`Dynamic Chinese results are incomplete: ${JSON.stringify(loaded)}`);
}
const promoMarginIndex = loaded.headerOrder.indexOf("Promo margin proposed");
if (
  promoMarginIndex < 0
  || loaded.headerOrder[promoMarginIndex + 1] !== "SOH"
  || loaded.headerOrder[promoMarginIndex + 2] !== "Sold"
  || loaded.headerOrder[promoMarginIndex + 3] !== "Lifetime margin after returns"
) {
  throw new Error(`Result columns are in the wrong position: ${JSON.stringify(loaded.headerOrder)}`);
}
if (loaded.overlappingHeaders) {
  throw new Error(`Result columns overlap: ${JSON.stringify(loaded)}`);
}
const positiveIntervalDiscounts = loaded.suggestedDiscountsAfterInterval
  .map((value) => Number(value?.replace("%", "")))
  .filter((value) => Number.isFinite(value) && value > 0);
if (
  !loaded.discountIntervalInputEnabled
  || !positiveIntervalDiscounts.every((value) => Math.abs(value % 5) < 0.001)
  || loaded.suggestedDiscountsBeforeInterval.join("|")
    === loaded.suggestedDiscountsAfterInterval.join("|")
) {
  throw new Error(`Discount interval did not floor suggestions: ${JSON.stringify(loaded)}`);
}
if (
  loaded.normalPriceHeader.replace(/\s+/g, " ").trim() !== "Price used VAT included"
  || loaded.offerPriceHeader.replace(/\s+/g, " ").trim() !== "Offer price VAT excluded"
  || loaded.promoPriceHeader.replace(/\s+/g, " ").trim() !== "Promo price VAT excluded"
  || loaded.priceHeaderWidths.some((width) => width > 94)
  || loaded.priceHeaderLineCounts.some((count) => count !== 2)
  || loaded.returnRates.every((value) => value === "-")
  || !loaded.exportHasCaPriceHeader
  || !loaded.exportHasInputVatHeader
  || !loaded.exportHasPromoVatHeader
  || !loaded.exportHasPriceSourceHeader
) {
  throw new Error(
    `VAT basis was not recorded in the table and export headers: ${JSON.stringify(loaded)}`,
  );
}
if (
  !mobile.guideVisible
  || !mobile.widthFits
  || !mobile.heightFits
  || !mobile.noPageOverflow
  || !mobile.vatControlsVisible
  || !mobile.vatControlsFit
  || !mobile.commissionModalFits
  || !mobile.commissionActionsVisible
  || !mobile.startupCaMappingFits
  || !mobile.importProgressFits
  || mobile.importProgressTitle !== "正在加载佣金率表"
  || !mobile.importCancelVisible
  || !mobile.criteriaCollapsed
  || mobile.criteriaCollapsedHeight > 50
  || mobile.criteriaShowTitle !== "显示筛选条件"
  || mobile.collapsedResultsWidth !== 390
  || !mobile.criteriaRestored
  || !mobile.resultsPanelConstrained
  || mobile.stickyHeaderPosition !== "sticky"
  || mobile.chineseTitle !== "选择平台"
  || mobile.chineseCounter !== "第1步，共6步"
  || mobile.chineseCommissionTitle !== "缺少佣金率"
  || !mobile.chineseCommissionSummary?.includes("DingTalk")
) {
  throw new Error(`User guide or mobile results layout failed: ${JSON.stringify(mobile)}`);
}

console.log(JSON.stringify({
  initial,
  chinese,
  offerImport,
  missingOffer,
  mapping,
  cancelledImport,
  commissionProgress,
  loaded,
  mobile,
}));
