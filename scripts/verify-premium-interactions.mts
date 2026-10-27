/** Read-only acceptance for the integrated reference UI against a local build. */
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.env.TPA_PUBLIC_QA_URL ?? "http://127.0.0.1:3159";
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/, "Use an isolated local preview");
const dir = process.env.TPA_INTERACTION_QA_OUTPUT ?? ".local/premium-redesign/interactions";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: process.env.TPA_BROWSER_CHANNEL || undefined, headless: true });
const results: unknown[] = [];
let passed = false;
try {
  for (const width of [1440, 1024, 768, 390, 320]) {
    for (const colorScheme of ["light", "dark"] as const) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
      const page = await context.newPage();
      const errors: string[] = [], writes: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => { if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url()); });
      await page.goto(base, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      assert.ok(await page.evaluate(() => document.fonts.check('400 16px "TPA Jakarta"') && document.fonts.check('500 48px "TPA Cormorant"')), "Both approved local fonts must load");
      const paperV3 = await page.locator(".paper-v3-home").count() === 1;
      if (paperV3) {
        await expect(page.locator("main h1")).toBeVisible();
        assert.ok(await page.locator("img").evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)), "Rendered images must load");
      } else {
        assert.ok(await page.locator(".kolkata-hero-art img").evaluate((element) => (element as HTMLImageElement).naturalWidth > 0), "Hero artwork must load");
      }
      if (width === 1440 && colorScheme === "light") {
        const destinations = [...new Set(await page.locator('.public-shell a[href^="/"]').evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).pathname)))];
        for (const destination of destinations) assert.equal((await context.request.get(base + destination)).status(), 200, destination);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 1440 && colorScheme === "light") await page.screenshot({ path: dir + "/hero-desktop.png" });
      if (width === 390 && colorScheme === "light") await page.screenshot({ path: dir + "/hero-phone.png" });
      if (!paperV3) {
      const cover = page.getByRole("button", { name: /Tollygunge Professional Association Welcome/ });
      await cover.press("Enter");
      await expect(page.getByRole("heading", { name: "A city of ideas.", exact: true })).toBeVisible();
      await expect.poll(() => page.locator(".tpa-book-art img").evaluate((element) => (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
      await expect(page.getByRole("button", { name: "Close book", exact: true })).toBeFocused();
      await page.getByRole("button", { name: "Highlight Tollygunge, South Kolkata" }).click();
      await expect(page.getByRole("button", { name: "Highlight Tollygunge, South Kolkata" })).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: "Next book chapter", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Good people.", exact: true })).toBeVisible();
      await expect.poll(() => page.locator(".tpa-book-art img").evaluate((element) => (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
      await page.getByRole("button", { name: "Next book chapter", exact: true }).press("Enter");
      await expect(page.getByRole("heading", { name: "Shared knowledge.", exact: true })).toBeVisible();
      await expect.poll(() => page.locator(".tpa-book-art img").evaluate((element) => (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
      await expect(page.getByRole("button", { name: "Previous book chapter", exact: true })).toBeFocused();
      await expect(page.getByRole("button", { name: "Next book chapter", exact: true })).toBeDisabled();
      await page.emulateMedia({ reducedMotion: "reduce" });
      const motion = await page.locator(".tpa-book-chapter").evaluate((element) => getComputedStyle(element).animationName);
      assert.equal(motion, "none");
      await page.addScriptTag({ path: resolve("node_modules/axe-core/axe.min.js") });
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
      } else {
        // The approved Paper v3 homepage replaced the legacy atlas presentation.
        // Validate its actual navigation and keyboard controls without restoring old UI.
        const navigation = page.locator("footer").getByRole("navigation", { name: "Footer", exact: true });
        await expect(navigation.getByRole("link")).toHaveCount(11);
        const first = navigation.getByRole("link").first();
        await first.focus(); await expect(first).toBeFocused();
        await page.keyboard.press("Tab"); await expect(navigation.getByRole("link").nth(1)).toBeFocused();
        assert.notEqual(await navigation.getByRole("link").nth(1).evaluate(element => getComputedStyle(element).outlineStyle), "none");
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.addScriptTag({ path: resolve("node_modules/axe-core/axe.min.js") });
        const violations = await page.evaluate(async () => {
          const axe = (window as unknown as { axe: { run: (context: Element, options: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
          const result = await axe.run(document.querySelector("main")!, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
          return result.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }));
        });
        assert.deepEqual(violations, []);
        await page.screenshot({ path: `${dir}/paper-v3-${width}-${colorScheme}.png`, fullPage: true });
      }
      await page.getByRole("button", { name: "Send inquiry", exact: true }).click();
      await expect(page.getByLabel("Full name", { exact: true })).toBeFocused();
      assert.ok(await page.locator(".public-inquiry").evaluate((form) => !(form as HTMLFormElement).checkValidity()), "Empty inquiry remains invalid and must not submit");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      assert.deepEqual(writes, []);
      results.push({ width, colorScheme, keyboard: true, layout: paperV3 ? "Paper v3" : "legacy atlas", atlas: paperV3 ? "not rendered by approved design" : "exercised", writes });
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
