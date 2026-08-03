import { chromium } from "playwright";

const baseUrl = process.env.PROMOTION_TOOL_URL || "http://127.0.0.1:8878";
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
let savedRecord = null;
let calculateRequests = 0;

page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("request", (request) => {
  if (request.url().endsWith("/api/calculate")) calculateRequests += 1;
});

await page.route("**/api/worktables**", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (request.method() === "POST") {
    const payload = request.postDataJSON();
    savedRecord = {
      id: "11111111-1111-1111-1111-111111111111",
      platform: payload.platform,
      event_name: payload.event_name,
      source_file: payload.snapshot.source.file,
      source_row_count: payload.snapshot.source.row_count,
      candidate_count: payload.snapshot.candidates.length,
      eligible_count: payload.snapshot.candidates.filter((row) => row.eligible).length,
      selected_count: payload.snapshot.selected_skus.length,
      snapshot: payload.snapshot,
      created_at: "2026-08-03T04:00:00Z",
      created_on: "2026-08-03",
    };
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ worktable: savedRecord }),
    });
    return;
  }
  if (url.pathname.split("/").filter(Boolean).length === 3) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ worktable: savedRecord }),
    });
    return;
  }
  const summary = savedRecord ? [{ ...savedRecord, snapshot: undefined }] : [];
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ worktables: summary }),
  });
});

await page.goto(baseUrl, { waitUntil: "networkidle" });
if (await page.locator("#guideModal").isVisible()) {
  await page.locator("#guideCloseButton").click();
}
if (await page.locator("#mappingModal").isVisible()) {
  await page.locator("#closeMappings").click();
}
await page.locator("#firstSampleButton").click();
await page.waitForSelector("#candidateRows tr");
await page.waitForFunction(() => !document.querySelector("#saveWorktableButton")?.disabled);

await page.locator("#saveWorktableButton").click();
const saveModal = {
  visible: await page.locator("#saveWorktableModal").isVisible(),
  platform: await page.locator("#savePlatform").inputValue(),
  eventName: await page.locator("#saveEventName").inputValue(),
};
await page.screenshot({ path: "analysis/save-worktable-modal.png", fullPage: true });
await page.locator("#saveEventName").fill("Audit Event 2026");
await page.locator("#confirmSaveWorktable").click();
await page.waitForFunction(() => !document.querySelector("#saveWorktableModal")?.classList.contains("visible"));

const afterSave = {
  saveDisabled: await page.locator("#saveWorktableButton").isDisabled(),
  capturedEvent: savedRecord?.event_name,
  snapshotRows: savedRecord?.snapshot.rows.length,
  snapshotCandidates: savedRecord?.snapshot.candidates.length,
};

await page.locator("#savedWorktablesButton").click();
await page.waitForSelector("#savedWorktableRows tr");
const archive = {
  visible: await page.locator("#savedWorktablesModal").isVisible(),
  rowCount: await page.locator("#savedWorktableRows tr").count(),
  rowText: await page.locator("#savedWorktableRows tr").textContent(),
};
await page.screenshot({ path: "analysis/saved-worktables-archive.png", fullPage: true });
const calculationsBeforeOpen = calculateRequests;
await page.locator("[data-worktable-id]").click();
await page.waitForFunction(() => !document.querySelector("#savedRecordBanner")?.hidden);
const frozen = {
  bannerVisible: await page.locator("#savedRecordBanner").isVisible(),
  bannerText: await page.locator("#savedRecordBanner").textContent(),
  overrideDisabled: await page.locator(".override-input").first().isDisabled(),
  criteriaDisabled: await page.locator("#campaignName").isDisabled(),
  rowCount: await page.locator("#candidateRows tr").count(),
  recalculated: calculateRequests !== calculationsBeforeOpen,
};
await page.screenshot({ path: "analysis/saved-worktable-readonly.png", fullPage: true });

await page.locator("#returnToDraft").click();
const returned = {
  bannerHidden: await page.locator("#savedRecordBanner").isHidden(),
  overrideEnabled: await page.locator(".override-input").first().isEnabled(),
  rowCount: await page.locator("#candidateRows tr").count(),
};
const editableSelection = page.locator(".row-select:not(:disabled)").first();
await editableSelection.click();
const unsavedWarning = await page.evaluate(() => {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
});

await page.setViewportSize({ width: 390, height: 844 });
await page.locator("#savedWorktablesButton").click();
await page.waitForSelector("#savedWorktableRows tr");
const mobile = await page.locator("#savedWorktablesModal .modal").evaluate((modal) => {
  const rect = modal.getBoundingClientRect();
  return {
    fitsWidth: rect.left >= 0 && rect.right <= window.innerWidth,
    fitsHeight: rect.top >= 0 && rect.bottom <= window.innerHeight,
    pageFits: document.documentElement.scrollWidth <= window.innerWidth,
  };
});
await page.screenshot({ path: "analysis/saved-worktables-mobile.png", fullPage: true });
await page.locator("#closeSavedWorktables").click();

const result = { saveModal, afterSave, archive, frozen, returned, unsavedWarning, mobile, errors };
console.log(JSON.stringify(result, null, 2));

if (!saveModal.visible || saveModal.platform !== "Debenhams") throw new Error("Save confirmation modal failed");
if (afterSave.capturedEvent !== "Audit Event 2026" || !afterSave.saveDisabled) throw new Error("Save record failed");
if (!archive.visible || archive.rowCount !== 1 || !archive.rowText.includes("Audit Event 2026")) throw new Error("Archive failed");
if (!frozen.bannerVisible || !frozen.overrideDisabled || !frozen.criteriaDisabled || frozen.recalculated) throw new Error("Frozen view failed");
if (!returned.bannerHidden || !returned.overrideEnabled || returned.rowCount !== frozen.rowCount) throw new Error("Return to draft failed");
if (!unsavedWarning) throw new Error("Unsaved worktable close warning failed");
if (!mobile.fitsWidth || !mobile.fitsHeight || !mobile.pageFits) throw new Error("Mobile archive layout failed");
if (errors.length) throw new Error(`Browser console errors: ${errors.join(" | ")}`);

await browser.close();
