import { chromium } from "playwright";

const baseUrl = process.env.PROMOTION_TOOL_URL || "http://127.0.0.1:8877";
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});

try {
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const filename = await page.evaluate(() =>
    `${localDateStamp(new Date(2026, 9, 26))} - Tesco-Summer-Sale-nomination.csv`,
  );
  if (filename !== "20261026 - Tesco-Summer-Sale-nomination.csv") {
    throw new Error(`Unexpected nomination filename: ${filename}`);
  }
  console.log(filename);
} finally {
  await browser.close();
}
