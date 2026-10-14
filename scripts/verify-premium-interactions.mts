/** Read-only acceptance for the integrated reference UI against a local build. */
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.env.TPA_PUBLIC_QA_URL ?? "http://127.0.0.1:3159";
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/, "Use an isolated local preview");
const dir = ".local/premium-redesign/interactions";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results: unknown[] = [];
let passed = false;
try {
  for (const width of [1440, 768, 390, 320]) {
    for (const colorScheme of ["light", "dark"] as const) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
      const page = await context.newPage();
      const errors: string[] = [], writes: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => { if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url()); });
      await page.goto(base, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 1440 && colorScheme === "light") await page.screenshot({ path: dir + "/hero-desktop.png" });
      if (width === 390 && colorScheme === "light") await page.screenshot({ path: dir + "/hero-phone.png" });
      const cover = page.getByRole("button", { name: /Tollygunge Professional Association Welcome/ });
      await cover.press("Enter");
      await expect(page.getByRole("heading", { name: "A city of ideas.", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Close book", exact: true })).toBeFocused();
      await page.getByRole("button", { name: "Highlight Tollygunge, South Kolkata" }).click();
      await expect(page.getByRole("button", { name: "Highlight Tollygunge, South Kolkata" })).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: "Next book chapter", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Good people.", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Next book chapter", exact: true }).press("Enter");
      await expect(page.getByRole("heading", { name: "Shared knowledge.", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Previous book chapter", exact: true })).toBeFocused();
      await expect(page.getByRole("button", { name: "Next book chapter", exact: true })).toBeDisabled();
      await page.emulateMedia({ reducedMotion: "reduce" });
      const motion = await page.locator(".tpa-book-chapter").evaluate((element) => getComputedStyle(element).animationName);
      assert.equal(motion, "none");
      await page.addScriptTag({ path: resolve(".local/technical-qa/node_modules/axe-core/axe.min.js") });
      const violations = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (context: Element, options: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
        const result = await axe.run(document.querySelector(".tpa-atlas")!, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
        return result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) }));
      });
      assert.deepEqual(violations, []);
      await page.screenshot({ path: `${dir}/atlas-${width}-${colorScheme}.png`, fullPage: true });
      await page.getByRole("button", { name: "Previous book chapter", exact: true }).press("Escape");
      await expect(cover).toBeFocused();
      await expect(page.getByRole("button", { name: "Close book", exact: true })).toBeHidden();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      assert.deepEqual(writes, []);
      results.push({ width, colorScheme, keyboard: true, focusReturn: true, chapterBoundaryFocus: true, liveReducedMotion: true, violations, writes });
      await context.close();
    }
  }
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Enable JavaScript to continue.", exact: true })).toBeVisible();
    await expect(page.getByText("Loading your page…", { exact: true })).toBeHidden();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    results.push({ width, javaScript: false, explicitBrowserRequirement: true });
    await context.close();
  }
  passed = true;
  console.log(JSON.stringify({ passed, interactionStates: results.length, writes: 0 }));
} finally {
  await browser.close();
  await writeFile(dir + "/results.json", JSON.stringify({ passed, buildId: (await readFile(".next/BUILD_ID", "utf8")).trim(), results }, null, 2));
}
