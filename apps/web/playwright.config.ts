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
  },
  webServer: {
    command: `set PORT=${PORT} && pnpm start`,
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
