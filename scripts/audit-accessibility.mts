// Rendered-state accessibility audit. Does not submit forms or change business data.
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.TPA_ACCESSIBILITY_URL ?? "https://tpassociation.org";
assert.ok(
  base === "https://tpassociation.org" ||
    /^http:\/\/127\.0\.0\.1:\d+$/.test(base),
);
const axePath =
  process.env.TPA_AXE_SCRIPT ??
  ".local/technical-qa/node_modules/axe-core/axe.min.js";
const password = /^Password: (.+)$/m.exec(
  await readFile(".local/first-admin-password.txt", "utf8"),
)?.[1];
assert.ok(password);
type Finding = {
  id: string;
  impact: string | null;
  help: string;
  helpUrl: string;
  nodes: { target: unknown; failureSummary?: string }[];
};
type AxeResult = {
  violations: Finding[];
  incomplete: Finding[];
  passes: unknown[];
};
type Scan = {
  path: string;
  mode: string;
  width: number;
  state: string;
  violations: Finding[];
  incomplete: Finding[];
  passes: number;
};
const scans: Scan[] = [];
const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const mode of ["light", "dark"])
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
      });
      await context.addInitScript(
        ({ mode }) =>
          localStorage.setItem(
            "tpa-appearance",
            JSON.stringify({ theme: "tpa", mode }),
          ),
        { mode },
      );
      const page = await context.newPage();
      let signedIn = false;
      async function scan(path: string, state = "default") {
        const result = await page.evaluate(async () => {
          const axe = (
            window as unknown as {
              axe: {
                run: (
                  context: Document,
                  options: unknown,
                ) => Promise<AxeResult>;
              };
            }
          ).axe;
          return axe.run(document, {
            runOnly: {
              type: "tag",
              values: [
                "wcag2a",
                "wcag2aa",
                "wcag21a",
                "wcag21aa",
                "wcag22aa",
                "best-practice",
              ],
            },
          });
        });
        const clean = (findings: Finding[]) =>
          findings.map(({ id, impact, help, helpUrl, nodes }) => ({
            id,
            impact,
            help,
            helpUrl,
            nodes: nodes.map(({ target, failureSummary }) => ({
              target,
              failureSummary,
            })),
          }));
        scans.push({
          path,
          mode,
          width,
          state,
          violations: clean(result.violations),
          incomplete: clean(result.incomplete),
          passes: result.passes.length,
        });
        await writeFile(
          ".local/real-data/accessibility-audit.json",
          JSON.stringify({ base, scans }, null, 2),
        );
        console.log(
          `${mode} ${width} ${path} ${state}: ${result.violations.length} rules flagged, ${result.incomplete.length} manual-review rules`,
        );
      }
      try {
        for (const path of [
          "/",
          "/governance",
          "/membership",
          "/contact",
          "/login",
          "/signup",
          "/forgot-password",
          "/account/profile",
          "/member/application",
          "/member/payments",
          "/admin",
          "/admin/workspaces/members",
          "/admin/workspaces/verification",
          "/admin/workspaces/payments",
        ]) {
          if (path === "/account/profile") {
            const login = await context.request.post(
              base + "/api/auth/sign-in/email",
              {
                headers: { origin: base },
                data: {
                  email: "tollygungecacpestudycircle@gmail.com",
                  password,
                },
              },
            );
            assert.equal(login.status(), 200, "Audit authentication failed");
            signedIn = true;
          }
          const response = await page.goto(base + path, {
            waitUntil: "networkidle",
          });
          assert.equal(response?.status(), 200);
          assert.equal(
            new URL(page.url()).pathname,
            path,
            "Audit route unexpectedly redirected",
          );
          await page.addScriptTag({ path: axePath });
          await scan(path);
          if (path === "/account/profile") {
            const trigger = page.getByRole("button", {
              name: "Account menu",
              exact: true,
            });
            await trigger.click();
            await scan(path, "account-menu-open");
            await page.keyboard.press("Escape");
            assert.equal(
              await trigger.evaluate((el) => el === document.activeElement),
              true,
              "Account menu must restore keyboard focus",
            );
          }
          if (path === "/governance") {
            await page
              .locator(".person-card details")
              .evaluateAll((elements) =>
                elements.forEach(
                  (el) => ((el as HTMLDetailsElement).open = true),
                ),
              );
            await scan(path, "biographies-expanded");
          }
          if (width === 390 && path === "/") {
            const menu = page.locator(".mobile-nav > summary");
            if (await menu.count()) {
              await menu.click();
              await scan(path, "mobile-menu-open");
            }
          }
        }
      } finally {
        if (signedIn)
          await context.request.post(base + "/api/auth/sign-out", {
            headers: { origin: base },
            data: {},
          });
        await context.close();
      }
    }
} finally {
  await browser.close();
}
const issues = new Set(
  scans.flatMap((scan) => scan.violations.map((finding) => finding.id)),
);
console.log(
  JSON.stringify({
    states: scans.length,
    statesWithViolations: scans.filter((scan) => scan.violations.length).length,
    ruleIds: [...issues],
  }),
);
assert.equal(
  issues.size,
  0,
  "Rendered states contain accessibility rule violations",
);
