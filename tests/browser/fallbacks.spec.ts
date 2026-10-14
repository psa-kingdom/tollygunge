import { test, expect } from "@playwright/test";
test("unmatched route has branded 404, accessible navigation and no overflow", async ({ page }) => {
  const response = await page.goto("/missing/route/fallback-check");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "A little off the beaten path." })).toBeVisible();
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "TPA homepage", exact: true })).toBeFocused();
  const outline = await page.locator(":focus").evaluate(el => getComputedStyle(el).outlineWidth);
  expect(parseFloat(outline)).toBeGreaterThan(0);
  await page.screenshot({ path: `.local/fallback-release/404-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole("link", { name: "Return to homepage" }).click();
  await expect(page).toHaveURL(/\/$/);
});
test("missing reset link provides recovery without issuing email", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.getByRole("heading", { name: "This link is no longer available." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Request a new reset link" })).toHaveAttribute("href", "/forgot-password");
});
test("database outage renders safe error and retry only re-fetches the page", async ({ page }) => {
  test.skip(!process.env.TPA_FALLBACK_OUTAGE_URL, "Requires isolated unreachable-database process");
  await page.goto(process.env.TPA_FALLBACK_OUTAGE_URL + "/");
  await expect(page.getByRole("heading", { name: "Let’s try that again." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  const writes: string[] = [];
  page.on("request", req => { if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method())) writes.push(req.url()); });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Let’s try that again." })).toBeVisible();
  expect(writes).toEqual([]);
  expect(await page.locator("body").innerText()).not.toMatch(/postgres|ECONNREFUSED|private-secret/);
  await page.screenshot({ path: `.local/fallback-release/error-${test.info().project.name}.png`, fullPage: true });
});
