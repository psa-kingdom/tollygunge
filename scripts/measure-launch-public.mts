/** Anonymous, GET-only laboratory measurements; never a field Web Vitals claim. */
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.argv[2] || "https://tpassociation.org";
assert.ok(origin === "https://tpassociation.org" || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin));
const output = ".local/launch-readiness/public-lab-" + new Date().toISOString().replaceAll(":", "-");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.TPA_BROWSER_CHANNEL || undefined });
const observations: unknown[] = [];
try {
  for (const width of [390, 1440]) for (const path of ["/", "/about", "/contact"]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
    const page = await context.newPage();
    const errors: string[] = [], blockedWrites: string[] = [];
    await context.route("**/*", route => {
      if (["GET", "HEAD"].includes(route.request().method())) return route.continue();
      blockedWrites.push(new URL(route.request().url()).pathname); return route.abort();
    });
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      const values = { lcpMs: 0, cls: 0 };
      Object.assign(window, { tpaLabVitals: values });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) values.lcpMs = entry.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) { const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number }; if (!shift.hadRecentInput) values.cls += shift.value; } }).observe({ type: "layout-shift", buffered: true });
    });
    const response = await page.goto(origin + path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1000); // Defined quiet observation window, not a readiness assertion.
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      return { ...(window as unknown as { tpaLabVitals: { lcpMs: number; cls: number } }).tpaLabVitals,
        ttfbMs: navigation.responseStart - navigation.requestStart, domContentLoadedMs: navigation.domContentLoadedEventEnd,
        resourceCount: resources.length, resourceTransferBytes: resources.reduce((total, row) => total + row.transferSize, 0),
        largestResources: resources.filter(row => row.transferSize > 100000).map(row => ({ path: new URL(row.name).pathname, bytes: row.transferSize, durationMs: row.duration })),
        images: [...document.images].map(image => ({ path: new URL(image.currentSrc || image.src).pathname, alt: image.alt, loading: image.loading, width: image.naturalWidth })),
      };
    });
    observations.push({ path, width, status: response?.status(), metrics, errors, blockedWrites });
    assert.equal(response?.status(), 200); assert.deepEqual(errors, []); assert.deepEqual(blockedWrites, []);
    await page.screenshot({ path: `${output}/${path.slice(1) || "home"}-${width}.png`, fullPage: true });
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(output + "/results.json", JSON.stringify({ origin, observed: new Date().toISOString(), environment: "cold-context Chromium laboratory; this workstation/network; no CPU/network throttling", limitations: "Six navigations, one-second post-network quiet window; no field INP, no physical-device or percentile claim. No source optimization inferred from a score.", observations }, null, 2));
}
console.log("Laboratory evidence: " + output + "/results.json");
