/** Compare computed portal styles with the accepted baseline; synthetic markup,
 * not a substitute for authenticated application/browser regression tests. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const baseline = "3c1583b";
const files = ["src/app/globals.css", "src/app/premium.css"];
const before = files.map((file) => execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }));
const after = await Promise.all(files.map((file) => readFile(file, "utf8")));
const dir = ".local/phase2/styles";
await mkdir(dir, { recursive: true });
const markup = `<div class="member-shell"><header class="site-header account-header"><a class="brand" href="#"><span class="brand-mark">tpa·</span><span class="brand-name">TPA</span></a><nav><a aria-current="page" href="#">Overview</a><a href="#">Events</a></nav></header><main class="page-content member-home"><header class="member-welcome"><h1>Hello, synthetic member.</h1><span class="member-welcome-mark">tpa·</span></header><section class="member-card"><h2>Profile</h2><p class="member-footnote">Private profile details.</p><span class="member-badge is-verified">Reviewed</span><button id="member-action" class="button">Member action</button></section><section class="member-services"><h2>Your member space</h2><div class="member-service-grid"><a class="member-service-tile" href="#"><h3>Events</h3><p>Manage registrations.</p></a></div></section></main><div class="member-content"><section class="member-form-card"><h2>Verification</h2><label>Name<input value="Synthetic member"></label><label>Type<select><option>Professional</option></select></label><textarea aria-label="Biography">Synthetic biography</textarea><button class="button secondary">Save private draft</button><button class="button" disabled>Saving…</button></section></div></div><div class="workspace staff-shell"><aside class="sidebar staff-sidebar"><a class="brand" href="#"><span class="brand-mark">tpa·</span></a><p class="staff-label">Association workspace</p><nav class="staff-nav-group"><span>Workspace</span><a aria-current="page" href="#">Overview</a><a href="#">Members</a></nav></aside><div class="staff-content"><header class="workspace-topbar"><span>Search workspace</span><button class="button">Staff action</button></header><main class="workspace-main"><h1>Members</h1><section class="bento-card"><h2>Attention</h2><p class="notice">Synthetic notice</p><span class="status-new">New</span></section><table class="operations-table"><thead><tr><th>Name</th><th>State</th></tr></thead><tbody><tr><td>Synthetic person</td><td>Pending</td></tr></tbody></table><select aria-label="Status"><option>Pending</option></select><input aria-label="Filter"><button id="staff-action" class="button">Review selection</button></main></div></div><div class="preview-viewport"><div class="content-preview"><div class="public-shell"><h2>Authored preview</h2><button class="button gold">Preview action</button></div></div></div>`;
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname.startsWith("/design/fonts/")) {
    const name = url.pathname.split("/").at(-1)!;
    if (!["jakarta-latin.woff2", "cormorant-latin.woff2"].includes(name)) { response.writeHead(404).end(); return; }
    response.setHeader("Content-Type", "font/woff2");
    response.end(await readFile("public/design/fonts/" + name));
    return;
  }
  const css = url.searchParams.get("version") === "before" ? before : after;
  const mode = url.searchParams.get("mode") === "dark" ? "dark" : "light";
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(`<!doctype html><html data-color-mode="${mode}"><head><style>${css[0]}</style><style>${css[1]}</style></head><body class="tpa-premium">${markup}</body></html>`);
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results: unknown[] = [];
let passed = false;
try {
  for (const width of [1440, 1024, 768, 390, 320]) for (const mode of ["light", "dark"] as const) for (const media of ["screen", "print"] as const) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, colorScheme: mode });
    await page.emulateMedia({ media, reducedMotion: "no-preference" });
    const captures: unknown[] = [];
    for (const version of ["before", "after"]) {
      await page.goto(`${base}/?version=${version}&mode=${mode}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.locator("#staff-action").focus();
      const values = await page.evaluate(() => [...document.querySelectorAll("body, body *")].map((element) => {
        const style = getComputedStyle(element);
        const css: Record<string, string> = {};
        for (const key of style) if (!key.startsWith("--")) css[key] = style.getPropertyValue(key);
        return { element: element.tagName + "." + element.className, css };
      }));
      captures.push(values);
    }
    assert.deepEqual(captures[1], captures[0], `Portal computed styles changed at ${width}px, ${mode}, ${media}`);
    results.push({ width, mode, media, identical: true });
    await page.close();
  }
  passed = true;
  console.log(JSON.stringify({ passed, states: results.length, baseline, computedPortalStyles: "identical" }));
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await writeFile(dir + "/results.json", JSON.stringify({ passed, baseline, results }, null, 2));
}
