import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  timeout: 240000,
  expect: { timeout: 30000 },
  fullyParallel: false,
  use: {
    channel: process.env.TPA_BROWSER_CHANNEL || undefined,
    baseURL: process.env.TPA_TEST_URL || "http://127.0.0.1:3112",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "phone",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  reporter: [["list"], ["html", { open: "never" }]],
});
