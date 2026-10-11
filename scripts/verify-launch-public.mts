/** Low-volume, read-only hosted browser QA; no authentication or form submission. */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const performanceOnly = process.argv.includes("--performance");
const output = ".local/launch-gate/" + (performanceOnly ? "performance" : "public");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    new PerformanceObserver(list => {
      const entry = list.getEntries().at(-1);
      if (entry) (window as unknown as { launchLcp: number }).launchLcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  const page = await context.newPage();
  for (const width of [1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 1000 });
    for (const path of (performanceOnly ? ["/", "/login", "/events"] : ["/", "/about", "/governance", "/membership", "/events", "/resources", "/contact", "/login", "/forgot-password", "/join"])) {
      const errors: string[] = [];
      const listener = (error: Error) => errors.push(error.message);
      page.on("pageerror", listener);
      const started = performance.now();
      const response = await page.goto("https://tpassociation.org" + path, { waitUntil: "networkidle", timeout: 45000 });
      const elapsed = performance.now() - started;
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        return { overflow: document.documentElement.scrollWidth > innerWidth + 1, ttfbMs: navigation.responseStart - navigation.requestStart, domContentLoadedMs: navigation.domContentLoadedEventEnd, lcpMs: (window as unknown as { launchLcp?: number }).launchLcp ?? null, title: document.title };
      });
      await page.addScriptTag({ path: resolve(".local/technical-qa/node_modules/axe-core/axe.min.js") });
      const accessibility = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (options: unknown) => Promise<{ violations: { id: string; impact: string; nodes: { target: string[] }[] }[]; incomplete: { id: string }[] }> } }).axe;
        const result = await axe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
        return { violations: result.violations.map(v => ({ id: v.id, impact: v.impact, targets: v.nodes.map(n => n.target) })), incomplete: result.incomplete.map(v => v.id) };
      });
      const name = (path === "/" ? "home" : path.slice(1)) + "-" + width;
      await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
      results.push({ path, width, status: response?.status(), elapsedMs: elapsed, ...metrics, errors, accessibility });
      page.off("pageerror", listener);
      await new Promise(r => setTimeout(r, 500));
    }
  }
} finally {
  await browser.close();
  await writeFile(`${output}/results.json`, JSON.stringify({ completed: new Date().toISOString(), readOnly: true, results }, null, 2));
}
console.log(JSON.stringify({ states: results.length, overflow: results.filter(r => r.overflow).length, failedResponses: results.filter(r => !r.status || r.status >= 400).length, runtimeErrors: results.filter(r => r.errors.length).length, accessibilityViolations: results.reduce((n, r) => n + r.accessibility.violations.length, 0) }));
if (results.some(r => r.overflow || !r.status || r.status >= 400 || r.errors.length || r.accessibility.violations.length)) process.exitCode = 1;
