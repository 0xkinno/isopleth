import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    screenshot: "only-on-failure",
    // Optional override for sandboxes that ship a headed Chromium binary
    // but not the exact chromium_headless_shell revision this Playwright
    // version expects to download. Unset in normal/CI use.
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } : {}),
  },
  webServer: {
    // `next start -p` instead of shell env-var syntax (the previous
    // `set PORT=... && pnpm start` is Windows-cmd-only and silently hangs
    // CI on Linux/macOS, where `set` just sets a shell variable no child
    // process inherits).
    command: `pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  // Chromium only, per instruction - device presets below borrow their
  // viewport/device metrics (incl. touch) but never their default browser,
  // since several (iPhone SE, iPad Pro 11) default to WebKit.
  projects: [
    { name: "iPhone SE", use: { ...devices["iPhone SE"], browserName: "chromium" } },
    { name: "Pixel 7", use: { ...devices["Pixel 7"], browserName: "chromium" } },
    { name: "iPad Pro 11", use: { ...devices["iPad Pro 11"], browserName: "chromium" } },
    { name: "desktop-1440", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
    { name: "desktop-1920", use: { browserName: "chromium", viewport: { width: 1920, height: 1080 } } },
  ],
});
