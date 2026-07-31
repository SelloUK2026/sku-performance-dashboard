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
    && document.querySelectorAll("#candidateRows tr td")[7]?.textContent.trim() === "Â£24.99"
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
)ßÍ½¶‰žËkºwµçU…Ñ”  ¤€ôøì(€½¹ÍÐÝ½É­ÍÁ…”€ô‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È ˆ¹Ý½É­ÍÁ…”ˆ¤ì(€½¹ÍÐÉ•ÍÕ±ÑÌ€ô‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È ˆ¹É•ÍÕ±ÑÌµÁ…¹•°ˆ¤ì(€½¹ÍÐÑ½½±‰…È€ô‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È ˆ¹Ñ…‰±”µÑ½½±‰…Èˆ¤ì(€É•ÑÕÉ¸ì(€€€Ý½É­ÍÁ…•½±Õµ¹Ìè•Ñ½µÁÕÑ•‘MÑå±”¡Ý½É­ÍÁ…”¤¹É¥‘Q•µÁ±…Ñ•½±Õµ¹Ì°(€€€Ý½É­ÍÁ…•]¥‘Ñ èÝ½É­ÍÁ…”¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤¹Ý¥‘Ñ °(€€€É•ÍÕ±ÑÍ`èÉ•ÍÕ±ÑÌ¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤¹à°(€€€É•ÍÕ±ÑÍ]¥‘Ñ èÉ•ÍÕ±ÑÌ¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤¹Ý¥‘Ñ °(€€€Ñ½½±‰…É`èÑ½½±‰…È¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤¹à°(€€€Ñ½½±‰…É]¥‘Ñ èÑ½½±‰…È¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤¹Ý¥‘Ñ °(€€€ÍÉ½±±`èÝ¥¹‘½Ü¹ÍÉ½±±`°(€ôì)ô¤ì)µ½‰¥±”¹Ù…Ñ½¹ÑÉ½±ÍY¥Í¥‰±”€ô…Ý…¥Ðµ½‰¥±•A…”¹±½…Ñ½È ˆ¹Ù…Ðµ½¹ÑÉ½±Ìˆ¤¹¥ÍY¥Í¥‰±” ¤ì)µ½‰¥±”¹Ù…Ñ½¹ÑÉ½±Í¥Ð€ôµ½‰¥±•Y…Ñ½¹ÑÉ½±Ì(€€˜˜µ½‰¥±•Y…Ñ½¹ÑÉ½±Ì¹à€øô€À(€€˜˜µ½‰¥±•Y…Ñ½¹ÑÉ½±Ì¹à€¬µ½‰¥±•Y…Ñ½¹ÑÉ½±Ì¹Ý¥‘Ñ €ðô€ÌäÀì)±•ÐÉ•±•…Í•5½‰¥±•½µµ¥ÍÍ¥½¹%µÁ½ÉÐì)±•Ðµ…É­5½‰¥±•½µµ¥ÍÍ¥½¹%µÁ½ÉÑMÑ…ÉÑ•ì)½¹ÍÐµ½‰¥±•½µµ¥ÍÍ¥½¹%µÁ½ÉÑMÑ…ÉÑ•€ô¹•ÜAÉ½µ¥Í” ¡É•Í½±Ù”¤€ôøì(€µ…É­5½‰¥±•½µµ¥ÍÍ¥½¹%µÁ½ÉÑMÑ…ÉÑ•€ôÉ•Í½±Ù”ì)ô¤ì)½¹ÍÐµ½‰¥±•½µµ¥ÍÍ¥½¹%µÁ½ÉÑI½ÕÑ”€ô…Íå¹Œ€¡É½ÕÑ”¤€ôøì(€µ…É­5½‰¥±•½µµ¥ÍÍ¥½¹%µÁ½ÉÑMÑ…ÉÑ• ¤ì(€…Ý…¥Ð¹•ÜAÉ½µ¥Í” ¡É•Í½±Ù”¤€ôøì(€€€É•±•…Í•5½‰¥±•½µµ¥ÍÍ¥½¹%µÁ½ÉÐ€ôÉ•Í½±Ù”ì(€ô¤ì(€ÑÉäì(€€€…Ý…¥ÐÉ½ÕÑ”¹½¹Ñ¥¹Õ” ¤ì(€ô…Ñ ì(€€€€¼¼I•µ½Ù¥¹œÑ¡”É½ÕÑ”…¸É•ÍÕµ”Ñ¡”¥¹Ñ•É•ÁÑ•É•ÅÕ•ÍÐ™¥ÉÍÐ¸(€ô)ôì)…Ý…¥Ðµ½‰¥±•A…”¹É½ÕÑ” ˆ¨¨½…Á¤½¥µÁ½ÉÐµ½µµ¥ÍÍ¥½¹Ìˆ°µ½‰¥±•½µµ¥ÍÍ¥½¹%µÁ½ÉÑI½ÕÑ”¤ì)…Ý…¥Ðµ½‰¥±•A…”¹±½…Ñ½È ˆ½µµ¥ÍÍ¥½¹¥±•%¹ÁÕÐˆ¤¹Í•Ñ%¹ÁÕÑ¥±•Ì (€€‰éqqUÍ•ÉÍqqM11=@äÈ´Åqq½Ý¹±½…‘ÍqqU,AÉ½‘ÕÐ½µµ¥ÍÍ¥½¸I…Ñ”1¥ÍÐ¹á±Íàˆ°(¤ì)…Ý…¥Ðµ½‰¥±•½µµ¥ÍÍ¥½¹%µÁ½ÉÑMÑ…ÉÑ•ì)…Ý…¥Ðµ½‰¥±•A…”¹Ý…¥Ñ½ÉM•±•Ñ½È ˆ¥µÁ½ÉÑAÉ½É•ÍÍ5½‘…°¹Ù¥Í¥‰±”ˆ¤ì)½¹ÍÐµ½‰¥±•%µÁ½ÉÑAÉ½É•ÍÌ€ô…Ý…¥Ðµ½‰¥±•A…”¹±½…Ñ½È (€€ˆ¥µÁ½ÉÑAÉ½É•ÍÍ5½‘…°€¹¥µÁ½ÉÐµÁÉ½É•ÍÌµµ½‘…°ˆ°(¤¹‰½Õ¹‘¥¹	½à ¤ì)µ½‰¥±”¹¥µÁ½ÉÑAÉ½É•ÍÍ¥ÑÌ€ôµ½‰¥±•%µÁ½ÉÑAÉ½É•ÍÌ(€€˜˜µ½‰¥±•%µÁ½ÉÑAÉ½É•ÍÌ¹à€øô€À(€€˜˜µ½‰¥±•%µÁ½ÉÑAÉ½É•ÍÌ¹à€¬µ½‰¥±•%µÁ½ÉÑAÉ½É•ÍÌ¹Ý¥‘Ñ €ðô€ÌäÀ(€€˜˜µ½‰¥±•%µÁ½ÉÑAÉ½É•ÍÌ¹ä€øô€À(€€˜˜µ½‰¥±•%µÁ½ÉÑAÉ½É•ÍÌ¹ä€¬µ½‰¥±•%µÁ½ÉÑAÉ½É•ÍÌ¹¡•¥¡Ð€ðô€àÐÐì)µ½‰¥±”¹¥µÁ½ÉÑAÉ½É•ÍÍQ¥Ñ±”€ô…Ý…¥Ðµ½‰¥±•A…”¹±½…Ñ½È ˆ¥µÁ½ÉÑAÉ½É•ÍÍQ¥Ñ±”ˆ¤¹Ñ•áÑ½¹Ñ•¹Ð ¤ì)µ½‰¥±”¹¥µÁ½ÉÑ…¹•±Y¥Í¥‰±”€ô…Ý…¥Ðµ½‰¥±•A…”¹±½…Ñ½È ˆ…¹•±%µÁ½ÉÐˆ¤¹¥ÍY¥Í¥‰±” ¤ì)…Ý…¥Ðµ½‰¥±•A…”¹ÍÉ••¹Í¡½Ð¡ì(€Á…Ñ è€‰…¹…±åÍ¥Ì½¥µÁ½ÉÐµÁÉ½É•ÍÌµµ½‰¥±”¹Á¹œˆ°)ô¤ì)É•±•…Í•5½‰¥±•½µµ¥ÍÍ¥½¹%µÁ½ÉÐ ¤ì)…Ý…¥Ðµ½‰¥±•A…”¹Õ¹É½ÕÑ” ˆ¨¨½…Á¤½¥µÁ½ÉÐµ½µµ¥ÍÍ¥½¹Ìˆ°µ½‰¥±•½µµ¥ÍÍ¥½¹%µÁ½ÉÑI½ÕÑ”¤ì)…Ý…¥Ðµ½‰¥±•A…”¹Ý…¥Ñ½ÉÕ¹Ñ¥½¸ (€€ ¤€ôø€…‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È ˆ¥µÁ½ÉÑAÉ½É•ÍÍ5½‘…°ˆ¤ü¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰Ù¥Í¥‰±”ˆ¤°(¤ì)…Ý…¥Ðµ½‰¥±•A…”¹±½…Ñ½È ˆ™¥±•%¹ÁÕÐˆ¤¹Í•Ñ%¹ÁÕÑ¥±•Ì¡ì(€¹…µ”è€‰µ¥ÍÍ¥¹œµ½µµ¥ÍÍ¥½¸¹ÍØˆ°(€µ¥µ•QåÁ”è€‰Ñ•áÐ½ÍØˆ°(€‰Õ™™•Èè	Õ™™•È¹™É½´ ‰A±…Ñ™½É´M-T±ÕÉÉ•¹Ð=™™•ÈAÉ¥•q¹%IAUIµ!=%HÌÌÐ°Ää¸äåq¸ˆ¤°)ô¤ì)…Ý…¥Ðµ½‰¥±•A…”¹Ý…¥Ñ½ÉM•±•Ñ½È ˆ½µµ¥ÍÍ¥½¹5¥ÍÍ¥¹5½‘…°¹Ù¥Í¥‰±”ˆ¤ì)½¹ÍÐµ½‰¥±•½µµ¥ÍÍ¥½¹5½‘…°€ô…Ý…¥Ðµ½‰¥±•A…”¹±½…Ñ½È ˆ½µµ¥ÍÍ¥½¹5¥ÍÍ¥¹5½‘…°€¹µ½‘…°ˆ¤¹‰½Õ¹‘¥¹	½à ¤ì)µ½‰¥±”¹½µµ¥ÍÍ¥½¹5½‘…±¥ÑÌ€ôµ½‰¥±•½µµ¥ÍÍ¥½¹5½‘…°(€€˜˜µ½‰¥±•½µµ¥ÍÍ¥½¹5½‘…°¹à€øô€À(€€˜˜µ½‰¥±•½µµ¥ÍÍ¥½¹5½‘…°¹à€¬µ½‰¥±•½µµ¥ÍÍ¥½¹5½‘…°¹Ý¥‘Ñ €ðô€ÌäÀ(€€˜˜µ½‰¥±•½µµ¥ÍÍ¥½¹5½‘…°¹ä€øô€À(€€˜˜µ½‰¥±•½µµ¥ÍÍ¥½¹5½‘…°¹ä€¬µ½‰¥±•½µµ¥ÍÍ¥½¹5½‘…°¹¡•¥¡Ð€ðô€àÐÐì)µ½‰¥±”¹½µµ¥ÍÍ¥½¹Ñ¥½¹ÍY¥Í¥‰±”€ô…Ý…¥Ðµ½‰¥±•A…”¹±½…Ñ½È ˆÉ•ÕÁ±½…‘½µµ¥ÍÍ¥½¸ˆ¤¹¥ÍY¥Í¥‰±” ¤(€€˜˜…Ý…¥Ðµ½‰¥±•A…”¹±½…Ñ½È ˆ…ÁÁ±åMÕ•ÍÑ•‘½µµ¥ÍÍ¥½¹Ìˆ¤¹¥ÍY¥Í¥‰±” ¤ì)µ½‰¥±”¹¡¥¹•Í•½µµ¥ÍÍ¥½¹Q¥Ñ±”€ô…Ý…¥Ðµ½‰¥±•A…”¹±½…Ñ½È ˆ½µµ¥ÍÍ¥½¹5¥ÍÍ¥¹Q¥Ñ±”ˆ¤¹Ñ•áÑ½¹Ñ•¹Ð ¤ì)µ½‰¥±”¹¡¥¹•Í•½µµ¥ÍÍ¥½¹MÕµµ…Éä€ô…Ý…¥Ðµ½‰¥±•A…”¹±½…Ñ½È ˆ½µµ¥ÍÍ¥½¹5¥ÍÍ¥¹MÕµµ…Éäˆ¤¹Ñ•áÑ½¹Ñ•¹Ð ¤ì)…Ý…¥Ðµ½‰¥±•A…”¹ÍÉ••¹Í¡½Ð¡ì(€Á…Ñ è€‰…¹…±åÍ¥Ì½½µµ¥ÍÍ¥½¸µµ¥ÍÍ¥¹œµµ½‰¥±”¹Á¹œˆ°(€™Õ±±A…”èÑÉÕ”°)ô¤ì)…Ý…¥Ðµ½‰¥±•A…”¹ÍÉ••¹Í¡½Ð¡ì(€Á…Ñ è€‰…¹…±åÍ¥Ì½Ù…Ðµ½¹ÑÉ½±Ìµµ½‰¥±”¹Á¹œˆ°(€™Õ±±A…”èÑÉÕ”°)ô¤ì)…Ý…¥Ðµ½‰¥±•½¹Ñ•áÐ¹±½Í” ¤ì)…Ý…¥Ð‰É½ÝÍ•È¹±½Í” ¤ì()½¹ÍÐµ…Ñ•É¥…±ÉÉ½ÉÌ€ô•ÉÉ½ÉÌ¹™¥±Ñ•È ¡µ•ÍÍ…”¤€ôø€…µ•ÍÍ…”¹¥¹±Õ‘•Ì ‰…¥±•Ñ¼±½…É•Í½ÕÉ”ˆ¤¤ì)¥˜€¡µ…Ñ•É¥…±ÉÉ½ÉÌ¹±•¹Ñ ¤Ñ¡É½Ü¹•ÜÉÉ½È¡	É½ÝÍ•È½¹Í½±”•ÉÉ½ÉÌè€‘íµ…Ñ•É¥…±ÉÉ½ÉÌ¹©½¥¸ ˆð€ˆ¥õ€¤ì)¥˜€ (€€…¥¹¥Ñ¥…°¹Õ¥‘•Y¥Í¥‰±”(€ñð¥¹¥Ñ¥…°¹Õ¥‘•½Õ¹Ñ•È€„ôô€‰MÑ•À€Ä½˜€Øˆ(€ñð¥¹¥Ñ¥…°¹Í•½¹‘Õ¥‘•Q¥Ñ±”€„ôô€‰%µÁ½ÉÐÕÉÉ•¹Ð½™™•ÉÌˆ(€ñð€ (€€€¥¹¥Ñ¥…°¹ÍÑ…ÉÑÕÁ…5…ÁÁ¥¹Y¥Í¥‰±”(€€€€˜˜¥¹¥Ñ¥…°¹ÍÑ…ÉÑÕÁ…5…ÁÁ¥¹Q¥Ñ±”€„ôô€‰5…Ñ M-UÌÑ¼]½½Á•Èˆ(€€¤(€ñð€¡¥¹¥Ñ¥…°¹ÍÑ…ÉÑÕÁ…5…ÁÁ¥¹Y¥Í¥‰±”€˜˜¥¹¥Ñ¥…°¹ÍÑ…ÉÑÕÁ…5…ÁÁ¥¹½Õ¹Ð€ð€Ä¤(€ñð€ …¥¹¥Ñ¥…°¹ÍÑ…ÉÑÕÁ…5…ÁÁ¥¹Y¥Í¥‰±”€˜˜¥¹¥Ñ¥…°¹ÍÑ…ÉÑÕÁ…5…ÁÁ¥¹½Õ¹Ð€„ôô€À¤(€ñð€ (€€€¥¹¥Ñ¥…°¹ÍÑ…ÉÑÕÁ…5…ÁÁ¥¹Y¥Í¥‰±”(€€€€˜˜€…¥¹¥Ñ¥…°¹ÍÑ…ÉÑÕÁ…5…ÁÁ¥¹M•…É¡Y¥Í¥‰±”(€€¤(€ñð¥¹¥Ñ¥…°¹ÍÑ…ÉÑÕÁ…A…É•¹Ñ½Õ¹Ð€„ôô€À(€ñð€…¥¹¥Ñ¥…°¹™¥ÉÍÑ%µÁ½ÉÑY¥Í¥‰±•™Ñ•ÉÕ¥‘”(¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È (€€€¥ÉÍÐµÙ¥Í¥ÐÕÍ•ÈÕ¥‘”‘¥¹½Ð½µÁ±•Ñ”Ñ¡”•áÁ•Ñ•™±½Üè€‘í)M=8¹ÍÑÉ¥¹¥™ä¡¥¹¥Ñ¥…°¥õ€°(€€¤ì)ô)¥˜€¡¥¹¥Ñ¥…°¹Á±…Ñ™½Éµ½Õ¹Ð€ð€ÄÀ¤Ñ¡É½Ü¹•ÜÉÉ½È ‰A±…Ñ™½É´‘•™…Õ±ÑÌ‘¥¹½Ð±½…¸ˆ¤ì)¥˜€¡¥¹¥Ñ¥…°¹µ…É¥¹%¹ÁÕÑÌ€„ôô€à¤Ñ¡É½Ü¹•ÜÉÉ½È ‰É…‘”µ…É¥¸µ…ÑÉ¥à¥Ì¥¹½µÁ±•Ñ”¸ˆ¤ì)¥˜€¡¥¹¥Ñ¥…°¹Ù…Ñ=ÁÑ¥½¹Ì€„ôô€Ðñð¥¹¥Ñ¥…°¹Ù…ÑI…Ñ”€„ôô€‰YP€ÈÀ”ˆ¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È ‰YP½¹ÑÉ½±Ì…É”¥¹½µÁ±•Ñ”¸ˆ¤ì)ô)¥˜€¡¥¹¥Ñ¥…°¹ÁÉ¥•M½ÕÉ•=ÁÑ¥½¹Ì€„ôô€Èñð¥¹¥Ñ¥…°¹‘•™…Õ±ÑAÉ¥•M½ÕÉ”€„ôô€‰ÁÉ¥”ˆ¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È ‰ÁÉ¥”¥Ì¹½ÐÑ¡”‘•™…Õ±Ð…±Õ±…Ñ¥½¸Í½ÕÉ”¸ˆ¤ì)ô)¥˜€ (€€……¹•±±•‘%µÁ½ÉÐ¹Ù¥Í¥‰±”(€ñð…¹•±±•‘%µÁ½ÉÐ¹Ñ¥Ñ±”€„ôô€‰1½…‘¥¹œÁ±…Ñ™½É´‘…Ñ„ˆ(€ñð€……¹•±±•‘%µÁ½ÉÐ¹µ•ÍÍ…”ü¹¥¹±Õ‘•Ì ‰…¹•°µÑ•ÍÐ¹ÍØˆ¤(€ñð…¹•±±•‘%µÁ½ÉÐ¹…¹•±1…‰•°€„ôô€‰…¹•°¥µÁ½ÉÐˆ(€ñð…¹•±±•‘%µÁ½ÉÐ¹É½Ý½Õ¹Ñ	•™½É•…¹•°€„ôô€À(€ñð€……¹•±±•‘%µÁ½ÉÐ¹¡¥‘‘•¸(€ñð…¹•±±•‘%µÁ½ÉÐ¹É½Ý½Õ¹Ñ™Ñ•É…¹•°€„ôô€À(€ñð…¹•±±•‘%µÁ½ÉÐ¹ÍÑ…ÑÕÌ€„ôô€‰%µÁ½ÉÐ…¹•±±•ˆ(€ñð€……¹•±±•‘%µÁ½ÉÐ¹™¥ÉÍÑ%µÁ½ÉÑI•ÍÑ½É•(¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È¡%µÁ½ÉÐ…¹•±±…Ñ¥½¸™…¥±•è€‘í)M=8¹ÍÑÉ¥¹¥™ä¡…¹•±±•‘%µÁ½ÉÐ¥õ€¤ì)ô)¥˜€ (€½µµ¥ÍÍ¥½¹AÉ½É•ÍÌ¹Ñ¥Ñ±”€„ôô€‰1½…‘¥¹œ½µµ¥ÍÍ¥½¸Ñ…‰±”ˆ(€ñð€…½µµ¥ÍÍ¥½¹AÉ½É•ÍÌ¹µ•ÍÍ…”ü¹¥¹±Õ‘•Ì ‰U,AÉ½‘ÕÐ½µµ¥ÍÍ¥½¸I…Ñ”1¥ÍÐ¹á±Íàˆ¤(€ñð€…½µµ¥ÍÍ¥½¹AÉ½É•ÍÌ¹¡¥‘‘•¹™Ñ•É%µÁ½ÉÐ(¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È¡½µµ¥ÍÍ¥½¸¥µÁ½ÉÐÁÉ½É•ÍÌ™…¥±•è€‘í)M=8¹ÍÑÉ¥¹¥™ä¡½µµ¥ÍÍ¥½¹AÉ½É•ÍÌ¥õ€¤ì)ô)¥˜€ (€¥¹¥Ñ¥…°¹‘•™…Õ±Ñ½µµ¥ÍÍ¥½¹1…‰•°€„ôô€‰•™…Õ±Ð½µµ¥ÍÍ¥½¸ˆ(€ñð¥¹¥Ñ¥…°¹‘•™…Õ±Ñ½µµ¥ÍÍ¥½¹1…‰•°¹¥¹±Õ‘•Ì ‰YPˆ¤(¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È¡•™…Õ±Ð½µµ¥ÍÍ¥½¸±…‰•°¥Ì¥¹½ÉÉ•Ðè€‘í¥¹¥Ñ¥…°¹‘•™…Õ±Ñ½µµ¥ÍÍ¥½¹1…‰•±õ€¤ì)ô)¥˜€ (€¡¥¹•Í”¹¡Ñµ±1…¹Õ…”€„ôô€‰é µ8ˆ(€ñð¡¥¹•Í”¹Ñ¥Ñ±”€„ôô€‹’þ¦Rš>C–B7–Þ—–Üˆ(€ñð¡¥¹•Í”¹ÍÝ¥Ñ¡1…‰•°ü¹ÑÉ¥´ ¤€„ôô€‰¹±¥Í ˆ(€ñð¡¥¹•Í”¹Õ¥‘•Q¥Ñ±”€„ôô€‹¦'š.§–æÏ–>Àˆ(€ñð¡¥¹•Í”¹Õ¥‘•½Õ¹Ñ•È€„ôô€‹ž²°Çš¶—¾ò3–ÄÛš¶”ˆ(€ñð¡¥¹•Í”¹…AÉ¥•1…‰•°ü¹ÑÉ¥´ ¤€„ôô€‰–äˆ(€ñð¡¥¹•Í”¹…!•…‘•È¹É•Á±…” ½qÌ¬½œ°€ˆ€ˆ¤¹ÑÉ¥´ ¤€„ôô€‰–äƒ–B­YPˆ(€ñð¡¥¹•Í”¹Ù…ÑI…Ñ”€„ôô€‰YP€ÈÀ”ˆ(€ñð¡¥¹•Í”¹‘•™…Õ±Ñ½µµ¥ÍÍ¥½¹1…‰•°€„ôô€‹¦îc¢º“’ö¦Gž:ˆ(€ñð¡¥¹•Í”¹‘•™…Õ±Ñ½µµ¥ÍÍ¥½¹Y…±Õ”€„ôô¥¹¥Ñ¥…°¹‘•™…Õ±Ñ½µµ¥ÍÍ¥½¸(€ñð¡¥¹•Í”¹…µÁ…¥¹9…µ”€„ôô€‰aQI€ÈÔ”ˆ(€ñð€…¡¥¹•Í”¹¹½A…•=Ù•É™±½Ü(¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È¡M¥µÁ±¥™¥•¡¥¹•Í”¥¹Ñ•É™…”¥Ì¥¹½µÁ±•Ñ”è€‘í)M=8¹ÍÑÉ¥¹¥™ä¡¡¥¹•Í”¥õ€¤ì)ô)¥˜€ …¥¹¥Ñ¥…°¹Õ¥‘•Q•áÐü¹¥¹±Õ‘•Ì ‰U,AÉ½‘ÕÐ½µµ¥ÍÍ¥½¸I…Ñ”1¥ÍÐ™É½´¥¹Q…±¬ˆ¤¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È ‰Q¡”ÕÍ•ÈÕ¥‘”‘½•Ì¹½Ð•áÁ±…¥¸Ý¡•É”Ñ¼½‰Ñ…¥¸Ñ¡”½µµ¥ÍÍ¥½¸Ý½É­‰½½¬¸ˆ¤ì)ô)¥˜€ (€¥¹¥Ñ¥…°¹‘¥Í½Õ¹Ñ%¹Ñ•ÉÙ…±¹…‰±•(€ñð¥¹¥Ñ¥…°¹‘¥Í½Õ¹Ñ%¹Ñ•ÉÙ…±Y…±Õ”€„ôô€ˆÔˆ(€ñð€…¥¹¥Ñ¥…°¹‘¥Í½Õ¹Ñ%¹Ñ•ÉÙ…±¥Í…‰±•(¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È ‰¥Í½Õ¹Ð¥¹Ñ•ÉÙ…°‘•™…Õ±ÑÌ…É”¥¹½ÉÉ•Ð¸ˆ¤ì)ô)¥˜€ …½™™•É%µÁ½ÉÐ¹½µµ¥ÍÍ¥½¹Q…‰±•I•ÅÕ¥É•¤Ñ¡É½Ü¹•ÜÉÉ½È ‰Y…É¥…‰±”½µµ¥ÍÍ¥½¸ÕÁ±½…Ý…Ì¹½ÐÉ•ÅÕ•ÍÑ•¸ˆ¤ì)¥˜€ (€€…µ…Ñ¡•‘½µµ¥ÍÍ¥½¸¹É•ÅÕ¥É•µ•¹Ñ!¥‘‘•¸(€ñðµ…Ñ¡•‘½µµ¥ÍÍ¥½¸¹µ¥ÍÍ¥¹AÉ½µÁÑY¥Í¥‰±”(€ñð€…µ…Ñ¡•‘½µµ¥ÍÍ¥½¸¹É•ÕÍ•‘½ÉI…¹”(¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È¡5…Ñ¡•½µµ¥ÍÍ¥½¸É…Ñ”Ý…Ì¹½Ð…ÁÁ±¥•è€‘í)M=8¹ÍÑÉ¥¹¥™ä¡µ…Ñ¡•‘½µµ¥ÍÍ¥½¸¥õ€¤ì)ô)¥˜€ (€€…µ¥ÍÍ¥¹½µµ¥ÍÍ¥½¸¹ÁÉ½µÁÑY¥Í¥‰±”(€ñð€…µ¥ÍÍ¥¹½µµ¥ÍÍ¥½¸¹ÍÕµµ…Éäü¹¥¹±Õ‘•Ì ‰I”µÕÁ±½…Ñ¡”±…Ñ•ÍÐU,AÉ½‘ÕÐ½µµ¥ÍÍ¥½¸I…Ñ”1¥ÍÐ™É½´¥¹Q…±¬ˆ¤(€ñðµ¥ÍÍ¥¹½µµ¥ÍÍ¥½¸¹Í­Ôü¹ÑÉ¥´ ¤€„ôô€‰%IAUIµ!=%HÌÌÐˆ(€ñð€…µ¥ÍÍ¥¹½µµ¥ÍÍ¥½¸¹ÍÕ•ÍÑ•‘I…Ñ”(€ñð€…µ¥ÍÍ¥¹½µµ¥ÍÍ¥½¸¹ÍÕ•ÍÑ¥½¹M½ÕÉ”ü¹¥¹±Õ‘•Ì ‰Á±…Ñ™½É´‘•™…Õ±Ðˆ¤(€ñð€…µ¥ÍÍ¥¹½µµ¥ÍÍ¥½¸¹É•ÅÕ¥É•µ•¹ÑY¥Í¥‰±”(€ñðµ¥ÍÍ¥¹½µµ¥ÍÍ¥½¸¹‘•¥Í¥½¸ü¹ÑÉ¥´ ¤€„ôô€‰I•Ù¥•Üˆ(€ñð€…µ¥ÍÍ¥¹½µµ¥ÍÍ¥½¸¹…ÁÁ±¥•(€ñð€…µ¥ÍÍ¥¹½µµ¥ÍÍ¥½¸¹É•ÅÕ¥É•µ•¹Ñ±•…É•(¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È¡5¥ÍÍ¥¹œ½µµ¥ÍÍ¥½¸É•½Ù•Éä™…¥±•è€‘í)M=8¹ÍÑÉ¥¹¥™ä¡µ¥ÍÍ¥¹½µµ¥ÍÍ¥½¸¥õ€¤ì)ô)½¹ÍÐ•áÁ•Ñ•‘•™…Õ±ÑAÉ¥”€ô½™™•É%µÁ½ÉÐ¹…AÉ¥”ü¹ÑÉ¥´ ¤€ôôô€ˆ´ˆ(€€ü½™™•É%µÁ½ÉÐ¹½™™•ÉAÉ¥”ü¹ÑÉ¥´ ¤(€€è½™™•É%µÁ½ÉÐ¹…AÉ¥”ü¹ÑÉ¥´ ¤ì)¥˜€ (€½™™•É%µÁ½ÉÐ¹½™™•ÉAÉ¥”ü¹ÑÉ¥´ ¤€„ôô€‹
ŒÈÐ¸ääˆ(€ñð½™™•É%µÁ½ÉÐ¹‘•™…Õ±ÑAÉ¥•UÍ•ü¹ÑÉ¥´ ¤€„ôô•áÁ•Ñ•‘•™…Õ±ÑAÉ¥”(€ñð½™™•É%µÁ½ÉÐ¹½™™•ÉAÉ¥•UÍ•ü¹ÑÉ¥´ ¤€„ôô€‹
ŒÈÐ¸ääˆ(¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È (€€€ÁÉ¥”…¹½™™•ÈÁÉ¥”Í½ÕÉ”ÍÝ¥Ñ¡¥¹œ‘¥¹½ÐÉ•…±Õ±…Ñ”è€‘í)M=8¹ÍÑÉ¥¹¥™ä¡½™™•É%µÁ½ÉÐ¥õ€°(€€¤ì)ô)½¹ÍÐÙ…±¥‘……±±‰…¬€ôµ¥ÍÍ¥¹=™™•È¹ÁÉ¥•UÍ•ü¹ÑÉ¥´ ¤€„ôô€‹
ŒÀ¸ÀÀˆ(€€˜˜µ¥ÍÍ¥¹=™™•È¹É•…Í½¸ü¹¥¹±Õ‘•Ì ‰=™™•ÈÁÉ¥”Õ¹…Ù…¥±…‰±”ìÁÉ¥”ÕÍ•ˆ¤ì)½¹ÍÐ¹½AÉ¥•Ù…¥±…‰±”€ôµ¥ÍÍ¥¹=™™•È¹ÁÉ¥•UÍ•ü¹ÑÉ¥´ ¤€ôôô€‹
ŒÀ¸ÀÀˆ(€€˜˜µ¥ÍÍ¥¹=™™•È¹É•…Í½¸ü¹¥¹±Õ‘•Ì ‰AÉ¥”½Èµ…É¥¸Í•ÑÑ¥¹Ìµ…­”É•Ù•ÉÍ”ÁÉ¥¥¹œ¥µÁ½ÍÍ¥‰±”ˆ¤(€€˜˜€…µ¥ÍÍ¥¹=™™•È¹É•…Í½¸ü¹¥¹±Õ‘•Ì ‰=™™•ÈÁÉ¥”Õ¹…Ù…¥±…‰±”ìÁÉ¥”ÕÍ•ˆ¤ì)¥˜€ (€µ¥ÍÍ¥¹=™™•È¹½™™•ÉAÉ¥”ü¹ÑÉ¥´ ¤€„ôô€ˆ´ˆ(€ñð€ …Ù…±¥‘……±±‰…¬€˜˜€…¹½AÉ¥•Ù…¥±…‰±”¤(¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È¡5¥ÍÍ¥¹œ½™™•ÈÁÉ¥”‘¥¹½Ð™…±°‰…¬Ñ¼ÁÉ¥”è€‘í)M=8¹ÍÑÉ¥¹¥™ä¡µ¥ÍÍ¥¹=™™•È¥õ€¤ì)ô)¥˜€ (€€…µ…ÁÁ¥¹œ¹ÁÉ½µÁÑY¥Í¥‰±”(€ñðµ…ÁÁ¥¹œ¹ÍÕ•ÍÑ•‘M­Ô€„ôô€ˆˆ(€ñð€…µ…ÁÁ¥¹œ¹¹½¹á¥ÍÑ¥¹=ÁÑ¥½¸(€ñð€…µ…ÁÁ¥¹œ¹¥¹Ù…±¥‘I•©•Ñ•(€ñð€…µ…ÁÁ¥¹œ¹É•µ…¥¹•‘=Á•¸(€ñð€…µ…ÁÁ¥¹œ¹Ù…±¥‘]½½Á•É•ÁÑ•(€ñð€…µ…ÁÁ¥¹œ¹±½Í•(€ñð€…µ…ÁÁ¥¹œ¹É•½Á•¹Ù…¥±…‰±”(€ñð€…µ…ÁÁ¥¹œ¹É•½Á•¹•(¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È ‰5…¹Õ…°M-Tµ…ÁÁ¥¹œ‘¥¹½Ð•¹™½É”Ñ¡”ÕÉÉ•¹Ð]½½Á•ÈM-T±¥ÍÐ¸ˆ¤ì)ô)¥˜€¡±½…‘•¹É½Ý½Õ¹Ð€„ôô€ÄÀ¤Ñ¡É½Ü¹•ÜÉÉ½È ‰]½É­‰½½¬Í…µÁ±”É½ÝÌ‘¥¹½Ð±½…¸ˆ¤ì)½¹ÍÐ•áÁ•Ñ•‘M­Õ=É‘•È€ôl¸¸¹±½…‘•¹‘¥ÍÁ±…å•‘M­ÕÍt¹Í½ÉÐ ¡±•™Ð°É¥¡Ð¤€ôø€ (€±•™Ð¹±½…±•½µÁ…É”¡É¥¡Ð°€‰•¸µˆ°ì¹Õµ•É¥ŒèÑÉÕ”°Í•¹Í¥Ñ¥Ù¥Ñäè€‰‰…Í”ˆô¤(¤¤ì)¥˜€¡±½…‘•¹‘¥ÍÁ±…å•‘M­ÕÌ¹©½¥¸ ‰ðˆ¤€„ôô•áÁ•Ñ•‘M­Õ=É‘•È¹©½¥¸ ‰ðˆ¤¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È¡¥ÍÁ±…å•M-UÌ…É”¹½ÐÍ½ÉÑ•µhè€‘í)M=8¹ÍÑÉ¥¹¥™ä¡±½…‘•¹‘¥ÍÁ±…å•‘M­ÕÌ¥õ€¤ì)ô)¥˜€ (€±½…‘•¹É¥Ñ•É¥…]¥‘Ñ¡áÁ…¹‘•€ð€ÈäÀ(€ñð±½…‘•¹É¥Ñ•É¥…]¥‘Ñ¡½±±…ÁÍ•€ø€ÐÔ(€ñð±½…‘•¹É•ÍÕ±ÑÍ]¥‘Ñ¡½±±…ÁÍ•€ðô±½…‘•¹É•ÍÕ±ÑÍ]¥‘Ñ¡áÁ…¹‘•(€ñð€…±½…‘•¹É¥Ñ•É¥…½Éµ!¥‘‘•¸(€ñð±½…‘•¹É¥Ñ•É¥…Q½±•áÁ…¹‘•€„ôô€‰™…±Í”ˆ(€ñð±½…‘•¹É¥Ñ•É¥…AÉ•™•É•¹”€„ôô€‰ÑÉÕ”ˆ(€ñð±½…‘•¹¡¥¹•Í•M¡½ÝÉ¥Ñ•É¥…Q¥Ñ±”€„ôô€‹šbûž’ëž¶o¦'šv‡’îØˆ(€ñð€…±½…‘•¹É¥Ñ•É¥…I•ÍÑ½É•(¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È¡É¥Ñ•É¥„½±±…ÁÍ”™…¥±•è€‘í)M=8¹ÍÑÉ¥¹¥™ä¡±½…‘•¥õ€¤ì)ô)¥˜€ (€±½…‘•¹µ…¥¹…Ñ•½Éå=ÁÑ¥½¹Ì€ð€È(€ñð±½…‘•¹ÍÕ‰…Ñ•½Éå=ÁÑ¥½¹Ì€ð€È(€ñð±½…‘•¹‰É…¹‘=ÁÑ¥½¹Ì€ð€È(€ñð±½…‘•¹µÕ±Ñ¥…Ñ•½ÉåMÕµµ…Éä€„ôô€ˆÈÍ•±•Ñ•ˆ(€ñð±½…‘•¹µÕ±Ñ¥…Ñ•½ÉåY…±Õ•Ì¹±•¹Ñ €„ôô€È(€ñð€…±½…‘•¹µÕ±Ñ¥…Ñ•½ÉåY…±Õ•Ì¹¥¹±Õ‘•Ì ‰!½µ”ÁÁ±¥…¹•Ìˆ¤(€ñð€…±½…‘•¹µÕ±Ñ¥…Ñ•½ÉåY…±Õ•Ì¹¥¹±Õ‘•Ì ‰-¥Ñ¡•¸ÁÁ±¥…¹•Ìˆ¤(€ñð±½…‘•¹¡¥¹•Í•5Õ±Ñ¥…Ñ•½ÉåMÕµµ…Éä€„ôô€‰qÔÕ‘˜ÉqÔäÀÀä€ÈqÔäàÜäˆ(€ñð€…±½…‘•¹Õ¹Í•±•Ñ•‘…Ñ•½ÉåI•…Í½¸ü¹¥¹±Õ‘•Ì ‰=ÕÑÍ¥‘”Í•±•Ñ•µ…¥¸…Ñ•½Éäˆ¤(€ñð€…±½…‘•¹µÕ±Ñ¥…Ñ•½Éå±•…É•(¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È¡5Õ±Ñ¤µÍ•±•Ð™¥±Ñ•ÉÌ…É”¥¹½µÁ±•Ñ”è€‘í)M=8¹ÍÑÉ¥¹¥™ä¡±½…‘•¥õ€¤ì)ô)¥˜€¡±½…‘•¹¹½Éµ…±5…É¥¹I½ÝI•…Í½¸ü¹Ñ½1½Ý•É…Í” ¤¹¥¹±Õ‘•Ì ‰¹½Éµ…°µ…É¥¸ˆ¤¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È (€€€!¥ÍÑ½É¥…°¹½Éµ…°µ…É¥¸ÍÑ¥±°¡…¹•ÌÑ¡”‘•¥Í¥½¸è€‘í)M=8¹ÍÑÉ¥¹¥™ä¡±½…‘•¥õ€°(€€¤ì)ô)¥˜€¡±½…‘•¹É•ÑÕÉ¹I…Ñ•I•Ù¥•Ý½Õ¹Ð€ð€Ä¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È¡I•Ù¥•Üµ•ÑÉ¥Ì…É”¹½Ð¡¥¡±¥¡Ñ•è€‘í)M=8¹ÍÑÉ¥¹¥™ä¡±½…‘•¥õ€¤ì)ô)¥˜€ (€±½…‘•¹¡•…‘•É9½Ñ•½Õ¹Ð€„ôô€Ì(€ñð€…±½…‘•¹ÁÉ½µ½!¥¡±¥¡Ñ9½Ñ”ü¹¥¹±Õ‘•Ì ˆÔÁ•É•¹Ñ…”Á½¥¹ÑÌˆ¤(€ñð€…±½…‘•¹É•ÑÕÉ¹!¥¡±¥¡Ñ9½Ñ”ü¹¥¹±Õ‘•Ì ‰I•ÑÕÉ¸É•Ù¥•ÜÑ¡É•Í¡½±ˆ¤(€ñð€…±½…‘•¹É•ÑÕÉ¹Q½½±Ñ¥ÁY¥Í¥‰±”(€ñð±½…‘•¹ÍÑ¥­å!•…‘•Èü¹Á½Í¥Ñ¥½¸€„ôô€‰ÍÑ¥­äˆ(€ñð€…±½…‘•¹ÍÑ¥­å!•…‘•Èü¹ÍÉ½±±•(€ñð±½…‘•¹ÍÑ¥­å!•…‘•Èü¹Ñ½Á•±Ñ„€ø€È(¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È¡!•…‘•ÈÕ¥‘…¹”½ÈÍÑ¥­äÍÉ½±±¥¹œ™…¥±•è€‘í)M=8¹ÍÑÉ¥¹¥™ä¡±½…‘•¥õ€¤ì)ô)¥˜€ (€±½…‘•¹¡¥¹•Í••¥Í¥½¸ü¹ÑÉ¥´ ¤€„ôô€‹š:K¦fˆ(€ñð€…±½…‘•¹¡¥¹•Í•I•…Í½¸ü¹¥¹±Õ‘•Ì ‹–êO–¶c’ö;’ê;ž¶o¦'šv‡’îØˆ¤(€ñð€…±½…‘•¹¡¥¹•Í•I•…Í½¸ü¹¥¹±Õ‘•Ì ‹¦¢ÒŸž:¢úû–"Ãš"[¢Ú¢þØ—–º‡š‚ã¦b#–ðˆ¤(€ñð±½…‘•¹¡¥¹•Í•…!•…‘•È¹É•Á±…” ½qÌ¬½œ°€ˆ€ˆ¤¹ÑÉ¥´ ¤€„ôô€‰–äƒ–B­YPˆ(€ñð€…±½…‘•¹¡¥¹•Í•I•ÑÕÉ¹!¥¡±¥¡Ñ9½Ñ”ü¹¥¹±Õ‘•Ì ‹¦îc¢ºØ”ˆ¤(€ñð±½…‘•¹¡¥¹•Í•I½Ý½Õ¹Ð€„ôô±½…‘•¹É½Ý½Õ¹Ð(¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È¡å¹…µ¥Œ¡¥¹•Í”É•ÍÕ±ÑÌ…É”¥¹½µÁ±•Ñ”è€‘í)M=8¹ÍÑÉ¥¹¥™ä¡±½…‘•¥õ€¤ì)ô)½¹ÍÐÁÉ½µ½5…É¥¹%¹‘•à€ô±½…‘•¹¡•…‘•É=É‘•È¹¥¹‘•á=˜ ‰AÉ½µ¼µ…É¥¸ÁÉ½Á½Í•ˆ¤ì)¥˜€ (€ÁÉ½µ½5…É¥¹%¹‘•à€ð€À(€ñð±½…‘•¹¡•…‘•É=É‘•ÉmÁÉ½µ½5…É¥¹%¹‘•à€¬€Åt€„ôô€‰M= ˆ(€ñð±½…‘•¹¡•…‘•É=É‘•ÉmÁÉ½µ½5…É¥¹%¹‘•à€¬€Ét€„ôô€‰M½±ˆ(€ñð±½…‘•¹¡•…‘•É=É‘•ÉmÁÉ½µ½5…É¥¹%¹‘•à€¬€Ít€„ôô€‰1¥™•Ñ¥µ”µ…É¥¸…™Ñ•ÈÉ•ÑÕÉ¹Ìˆ(¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È¡I•ÍÕ±Ð½±Õµ¹Ì…É”¥¸Ñ¡”ÝÉ½¹œÁ½Í¥Ñ¥½¸è€‘í)M=8¹ÍÑÉ¥¹¥™ä¡±½…‘•¹¡•…‘•É=É‘•È¥õ€¤ì)ô)¥˜€¡±½…‘•¹½Ù•É±…ÁÁ¥¹!•…‘•ÉÌ¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È¡I•ÍÕ±Ð½±Õµ¹Ì½Ù•É±…Àè€‘í)M=8¹ÍÑÉ¥¹¥™ä¡±½…‘•¥õ€¤ì)ô)½¹ÍÐÁ½Í¥Ñ¥Ù•%¹Ñ•ÉÙ…±¥Í½Õ¹ÑÌ€ô±½…‘•¹ÍÕ•ÍÑ•‘¥Í½Õ¹ÑÍ™Ñ•É%¹Ñ•ÉÙ…°(€€¹µ…À ¡Ù…±Õ”¤€ôø9Õµ‰•È¡Ù…±Õ”ü¹É•Á±…” ˆ”ˆ°€ˆˆ¤¤¤(€€¹™¥±Ñ•È ¡Ù…±Õ”¤€ôø9Õµ‰•È¹¥Í¥¹¥Ñ”¡Ù…±Õ”¤€˜˜Ù…±Õ”€ø€À¤ì)¥˜€ (€€…±½…‘•¹‘¥Í½Õ¹Ñ%¹Ñ•ÉÙ…±%¹ÁÕÑ¹…‰±•(€ñð€…Á½Í¥Ñ¥Ù•%¹Ñ•ÉÙ…±¥Í½Õ¹ÑÌ¹•Ù•Éä ¡Ù…±Õ”¤€ôø5…Ñ ¹…‰Ì¡Ù…±Õ”€”€Ô¤€ð€À¸ÀÀÄ¤(€ñð±½…‘•¹ÍÕ•ÍÑ•‘¥Í½Õ¹ÑÍ	•™½É•%¹Ñ•ÉÙ…°¹©½¥¸ ‰ðˆ¤(€€€€ôôô±½…‘•¹ÍÕ•ÍÑ•‘¥Í½Õ¹ÑÍ™Ñ•É%¹Ñ•ÉÙ…°¹©½¥¸ ‰ðˆ¤(¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È¡¥Í½Õ¹Ð¥¹Ñ•ÉÙ…°‘¥¹½Ð™±½½ÈÍÕ•ÍÑ¥½¹Ìè€‘í)M=8¹ÍÑÉ¥¹¥™ä¡±½…‘•¥õ€¤ì)ô)¥˜€ (€±½…‘•¹¹½Éµ…±AÉ¥•!•…‘•È¹É•Á±…” ½qÌ¬½œ°€ˆ€ˆ¤¹ÑÉ¥´ ¤€„ôô€‰AÉ¥”ÕÍ•YP¥¹±Õ‘•ˆ(€ñð±½…‘•¹½™™•ÉAÉ¥•!•…‘•È¹É•Á±…” ½qÌ¬½œ°€ˆ€ˆ¤¹ÑÉ¥´ ¤€„ôô€‰=™™•ÈÁÉ¥”YP•á±Õ‘•ˆ(€ñð±½…‘•¹ÁÉ½µ½AÉ¥•!•…‘•È¹É•Á±…” ½qÌ¬½œ°€ˆ€ˆ¤¹ÑÉ¥´ ¤€„ôô€‰AÉ½µ¼ÁÉ¥”YP•á±Õ‘•ˆ(€ñð±½…‘•¹ÁÉ¥•!•…‘•É]¥‘Ñ¡Ì¹Í½µ” ¡Ý¥‘Ñ ¤€ôøÝ¥‘Ñ €ø€äÐ¤(€ñð±½…‘•¹ÁÉ¥•!•…‘•É1¥¹•½Õ¹ÑÌ¹Í½µ” ¡½Õ¹Ð¤€ôø½Õ¹Ð€„ôô€È¤(€ñð±½…‘•¹É•ÑÕÉ¹I…Ñ•Ì¹•Ù•Éä ¡Ù…±Õ”¤€ôøÙ…±Õ”€ôôô€ˆ´ˆ¤(€ñð€…±½…‘•¹•áÁ½ÉÑ!…Í…AÉ¥•!•…‘•È(€ñð€…±½…‘•¹•áÁ½ÉÑ!…Í%¹ÁÕÑY…Ñ!•…‘•È(€ñð€…±½…‘•¹•áÁ½ÉÑ!…ÍAÉ½µ½Y…Ñ!•…‘•È(€ñð€…±½…‘•¹•áÁ½ÉÑ!…ÍAÉ¥•M½ÕÉ•!•…‘•È(¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È (€€€YP‰…Í¥ÌÝ…Ì¹½ÐÉ•½É‘•¥¸Ñ¡”Ñ…‰±”…¹•áÁ½ÉÐ¡•…‘•ÉÌè€‘í)M=8¹ÍÑÉ¥¹¥™ä¡±½…‘•¥õ€°(€€¤ì)ô)¥˜€ (€€…µ½‰¥±”¹Õ¥‘•Y¥Í¥‰±”(€ñð€…µ½‰¥±”¹Ý¥‘Ñ¡¥ÑÌ(€ñð€…µ½‰¥±”¹¡•¥¡Ñ¥ÑÌ(€ñð€…µ½‰¥±”¹¹½A…•=Ù•É™±½Ü(€ñð€…µ½‰¥±”¹Ù…Ñ½¹ÑÉ½±ÍY¥Í¥‰±”(€ñð€…µ½‰¥±”¹Ù…Ñ½¹ÑÉ½±Í¥Ð(€ñð€…µ½‰¥±”¹½µµ¥ÍÍ¥½¹5½‘…±¥ÑÌ(€ñð€…µ½‰¥±”¹½µµ¥ÍÍ¥½¹Ñ¥½¹ÍY¥Í¥‰±”(€ñð€…µ½‰¥±”¹ÍÑ…ÉÑÕÁ…5…ÁÁ¥¹¥ÑÌ(€ñð€…µ½‰¥±”¹¥µÁ½ÉÑAÉ½É•ÍÍ¥ÑÌ(€ñðµ½‰¥±”¹¥µÁ½ÉÑAÉ½É•ÍÍQ¥Ñ±”€„ôô€‹š¶–r£–*ƒ¢ö÷’ö¦Gž:¢† ˆ(€ñð€…µ½‰¥±”¹¥µÁ½ÉÑ…¹•±Y¥Í¥‰±”(€ñð€…µ½‰¥±”¹É¥Ñ•É¥…½±±…ÁÍ•(€ñðµ½‰¥±”¹É¥Ñ•É¥…½±±…ÁÍ•‘!•¥¡Ð€ø€ÔÀ(€ñðµ½‰¥±”¹É¥Ñ•É¥…M¡½ÝQ¥Ñ±”€„ôô€‹šbûž’ëž¶o¦'šv‡’îØˆ(€ñðµ½‰¥±”¹½±±…ÁÍ•‘I•ÍÕ±ÑÍ]¥‘Ñ €„ôô€ÌäÀ(€ñð€…µ½‰¥±”¹É¥Ñ•É¥…I•ÍÑ½É•(€ñð€…µ½‰¥±”¹É•ÍÕ±ÑÍA…¹•±½¹ÍÑÉ…¥¹•(€ñðµ½‰¥±”¹ÍÑ¥­å!•…‘•ÉA½Í¥Ñ¥½¸€„ôô€‰ÍÑ¥­äˆ(€ñðµ½‰¥±”¹¡¥¹•Í•Q¥Ñ±”€„ôô€‹¦'š.§–æÏ–>Àˆ(€ñðµ½‰¥±”¹¡¥¹•Í•½Õ¹Ñ•È€„ôô€‹ž²°Çš¶—¾ò3–ÄÛš¶”ˆ(€ñðµ½‰¥±”¹¡¥¹•Í•½µµ¥ÍÍ¥½¹Q¥Ñ±”€„ôô€‹žòë–ÂG’ö¦Gž:ˆ(€ñð€…µ½‰¥±”¹¡¥¹•Í•½µµ¥ÍÍ¥½¹MÕµµ…Éäü¹¥¹±Õ‘•Ì ‰¥¹Q…±¬ˆ¤(¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È¡UÍ•ÈÕ¥‘”½Èµ½‰¥±”É•ÍÕ±ÑÌ±…å½ÕÐ™…¥±•è€‘í)M=8¹ÍÑÉ¥¹¥™ä¡µ½‰¥±”¥õ€¤ì)ô()½¹Í½±”¹±½œ¡)M=8¹ÍÑÉ¥¹¥™ä¡ì(€¥¹¥Ñ¥…°°(€¡¥¹•Í”°(€½™™•É%µÁ½ÉÐ°(€µ¥ÍÍ¥¹=™™•È°(€µ…ÁÁ¥¹œ°(€…¹•±±•‘%µÁ½ÉÐ°(€½µµ¥ÍÍ¥½¹AÉ½É•ÍÌ°(€±½…‘•°(€µ½‰¥±”°)ô¤¤ì