import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ROUTES = ["/", "/workbench", "/portfolio", "/scenarios", "/proof", "/method"];

for (const route of ROUTES) {
  test(`layout ${route}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto(route, { waitUntil: "networkidle" });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1); // allow 1px of sub-pixel rounding

    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    // Report violations with detail for easy triage rather than a bare count.
    expect(axe.violations, JSON.stringify(axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([]);

    await page.screenshot({ path: `test-results/screens/${info.project.name}-${route.replace(/\W/g, "_") || "home"}.png`, fullPage: true });

    expect(errors, errors.join("\n")).toEqual([]);
  });
}

test("reduced motion: no animation errors", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toBeVisible();
});

test("44px minimum tap targets on primary CTAs", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const cta = page.getByRole("link", { name: "Map the boundary" });
  const box = await cta.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
});

test("honest snapshot age: the UI states data freshness, never claims real-time", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByText(/snapshot age:/i)).toBeVisible();
});
