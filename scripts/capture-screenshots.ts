/// <reference lib="dom" />
// Regenerates the 5 README screenshots (docs/screens/*.jpg) against a real
// running production build. Fixed-viewport captures, never fullPage - a
// full-page capture of a content-heavy route (workbench, proof) produces an
// extremely tall portrait image that doesn't belong in a uniform showcase
// grid next to a landscape banner. Run with the app already built and
// served (see package.json "screenshots" script).
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3300";
const VIEWPORT = { width: 1400, height: 875 }; // landscape desktop, matches the two shots that were already right
const OUT_DIR = "docs/screens";

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });

  // Landing banner: top of "/", exactly what a visitor sees first.
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT_DIR}/landing-banner.jpg`, type: "jpeg", quality: 90 });

  // Workbench: scrolled just enough that the actual contour line (not just
  // the empty top of the chart panel) is in frame alongside the result cards.
  await page.goto(`${BASE_URL}/workbench`, { waitUntil: "networkidle" });
  await page.evaluate(() => window.scrollTo(0, 560));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT_DIR}/workbench.jpg`, type: "jpeg", quality: 90 });

  // Contour: just the chart panel itself, not the whole page - an element
  // screenshot is naturally the right aspect ratio, never a tall capture.
  // Scroll so the panel sits clear of the sticky navbar first - an element
  // screenshot still composites whatever's on screen at that position, so a
  // panel scrolled to sit directly under the fixed header gets the header's
  // text visibly overlapping the capture.
  const contourPanel = page.locator("text=Counterfactual surface").locator("xpath=ancestor::div[contains(@class,'panel')][1]");
  const panelBoxBeforeScroll = await contourPanel.boundingBox();
  const currentScrollY = await page.evaluate(() => window.scrollY);
  if (panelBoxBeforeScroll) {
    const panelPageTop = panelBoxBeforeScroll.y + currentScrollY;
    await page.evaluate((top) => window.scrollTo(0, Math.max(0, top)), panelPageTop - 90);
  }
  await page.waitForTimeout(200);
  await contourPanel.screenshot({ path: `${OUT_DIR}/contour.jpg`, type: "jpeg", quality: 90 });

  // Scenarios: top of the page (preset cards).
  await page.goto(`${BASE_URL}/scenarios`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT_DIR}/scenarios.jpg`, type: "jpeg", quality: 90 });

  // Proof: top of the page (claims ledger cards).
  await page.goto(`${BASE_URL}/proof`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT_DIR}/proof.jpg`, type: "jpeg", quality: 90 });

  await browser.close();
  console.log(`[capture-screenshots] wrote 5 uniform ${VIEWPORT.width}x${VIEWPORT.height} landscape screenshots to ${OUT_DIR}/`);
}

main().catch((e) => {
  console.error("[capture-screenshots] fatal:", e);
  process.exitCode = 1;
});
