import { test, expect, type Page } from "@playwright/test";
import { signInPortal } from "../helpers/portal-browser";
import { portalNavigation } from "../../src/domain/portal-navigation";
import { staffNavigation } from "../../src/domain/staff-navigation";
import { hasPermission, roles } from "../../src/domain/access";

test.beforeEach(({}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "This suite explicitly covers all five viewport widths; project duplicates are unnecessary.",
  );
  test.skip(
    !process.env.TPA_UI_ADMIN_EMAIL || !process.env.TPA_UI_MEMBER_EMAIL,
    "Requires the disposable portal fixture harness.",
  );
});
const adminRoutes = [
  "/admin",
  ...staffNavigation(["administrator"])
    .flatMap((group) => group.items.map((item) => item.href))
    .filter((href) => href !== "/admin"),
  "/admin/workspaces/members?view=accounts",
];
const memberRoutes = portalNavigation([]).flatMap((group) =>
  group.items.map((item) => item.href),
);
const authRoutes = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/invitation",
  "/email-verification",
];
async function geometry(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  return page.evaluate(() => {
    const main = document.querySelector("main")!;
    const primary =
      main.querySelector<HTMLElement>(
        "[data-portal-primary],.workspace-body,.member-account-identity,.member-settings,.content-section,.notice,.member-event-journey,.workspace-steps,.member-form-card,.member-journey,.login-panel",
      ) ??
      Array.from(main.children).find(
        (el) => !el.matches("h1,header,a,nav,.portal-page-intro"),
      );
    return {
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      heading: main.querySelector("h1")?.getBoundingClientRect().top,
      primary: primary?.getBoundingClientRect().top,
      header: document.querySelector(".portal-topbar")?.getBoundingClientRect()
        .height,
      nav: document.querySelector(".portal-navigation")?.getBoundingClientRect()
        .height,
      nestedActions: document.querySelectorAll(
        "button button,button a,a button",
      ).length,
    };
  });
}
test("all portal routes reflow in both appearances with useful content near the top", async ({
  browser,
}, info) => {
  test.setTimeout(600000);
  const measurements: Array<
    Awaited<ReturnType<typeof geometry>> & {
      role: string | null;
      route: string;
      mode: string;
    }
  > = [];
  for (const [role, routes] of [
    ["administrator", adminRoutes],
    ["member", memberRoutes],
    [null, authRoutes],
  ] as const) {
    for (const mode of ["light", "dark"] as const) {
      const context = await browser.newContext({
        baseURL: process.env.TPA_TEST_URL,
        colorScheme: mode,
      });
      const page = await context.newPage();
      await context.addInitScript((mode) => {
        localStorage.setItem("tpa-appearance", JSON.stringify({ mode }));
      }, mode);
      if (role) await signInPortal(page, role);
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const route of routes)
          await test.step(`${role ?? "auth"} ${route} ${width} ${mode}`, async () => {
            const response = await page.goto(route);
            expect(response?.status()).toBe(200);
            await expect(page.locator("main h1")).toBeVisible();
            await expect(page.locator("html")).toHaveAttribute(
              "data-color-mode",
              mode,
            );
            await page.waitForLoadState("networkidle");
            const layout = await geometry(page);
            measurements.push({ role, route, mode, ...layout });
            expect(layout.scrollWidth, route).toBeLessThanOrEqual(width + 1);
            expect(layout.nestedActions, route).toBe(0);
            await expect(page.locator(".portal-sidebar")).toHaveCount(0);
            if (role && width >= 1024) {
              expect(layout.heading).toBeLessThanOrEqual(200);
              expect(layout.header! + layout.nav!).toBeLessThanOrEqual(110);
              expect(
                layout.primary,
                `First operational region: ${route}`,
              ).toBeLessThanOrEqual(240);
            }
          });
      }
      await context.close();
    }
  }
  await info.attach("route-geometry", {
    body: JSON.stringify(measurements, null, 2),
    contentType: "application/json",
  });
});

test("six staff roles retain navigation, direct route, API and preview boundaries", async ({
  browser,
}) => {
  test.setTimeout(360000);
  for (const role of roles) {
    const context = await browser.newContext({
        baseURL: process.env.TPA_TEST_URL,
      }),
      page = await context.newPage();
    await signInPortal(page, role);
    const groups = portalNavigation([role]);
    expect(await page.locator("#staff-navigation a").allTextContents()).toEqual(
      groups.map((group) => group.label),
    );
    const allowed = new Set(
      staffNavigation([role]).flatMap((group) =>
        group.items.map((item) => item.href),
      ),
    );
    for (const route of adminRoutes.filter(
      (route) => !route.includes("?") && route !== "/admin",
    ))
      expect((await page.goto(route))?.status(), `${role} ${route}`).toBe(
        allowed.has(route) ? 200 : 404,
      );
    for (const [endpoint, permission] of [
      ["members?view=register", "members:review"],
      ["content", "content:publish"],
      ["events", "events:manage"],
      ["crm", "communications:manage"],
      ["access", "staff:manage"],
      ["registration-payments?status=all", "payments:manage"],
    ] as const) {
      expect(
        (await context.request.get(`/api/staff/${endpoint}`)).status(),
        `${role} ${endpoint}`,
      ).toBe(hasPermission([role], permission) ? 200 : 403);
    }
    if (hasPermission([role], "members:review")) {
      await page.goto("/admin/workspaces/members");
      const record = page.locator(".member-record-button").first();
      await expect(record).toBeVisible();
      await record.hover();
      const preview = page.getByRole("dialog", { name: /quick preview/ });
      await expect(preview).toBeVisible();
      await preview.hover();
      await expect(
        preview.getByRole("button", { name: /^Copy .*@/ }).first(),
      ).toBeVisible();
      await preview
        .getByRole("button", { name: "Open full details →" })
        .click();
      await expect(page.locator(".portal-inspector")).toBeVisible();
      await expect(
        page.getByText("Edit member contact and professional details", {
          exact: true,
        }),
      ).toHaveCount(role === "administrator" ? 1 : 0);
    }
    await context.close();
  }
});

test("inspector resize and nested dismissal preserve unsaved member edits", async ({
  page,
}) => {
  await signInPortal(page, "administrator");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/workspaces/members");
  const first = page.locator(".member-record-button").first();
  await first.click();
  const panel = page.locator(".portal-inspector");
  await panel
    .getByText("Edit member contact and professional details", { exact: true })
    .click();
  const field = panel.getByLabel("First name", { exact: true });
  await field.fill("Unsaved synthetic change");
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("Unsaved synthetic change");
  expect(await panel.evaluate((el) => el.matches(":modal"))).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("Unsaved synthetic change");
  expect(await panel.evaluate((el) => el.matches(":modal"))).toBe(false);
  await panel
    .getByRole("button", { name: "Close details", exact: true })
    .click();
  const guard = page.getByRole("alertdialog", {
    name: "Discard unsaved changes?",
  });
  await expect(guard).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(guard).toHaveCount(0);
  await expect(panel).toBeVisible();
  await expect(field).toHaveValue("Unsaved synthetic change");
  await panel
    .getByRole("button", { name: "Close details", exact: true })
    .click();
  await guard
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(panel).toHaveCount(0);
  await expect(first).toBeFocused();
});

test("member overview prioritizes real event payment actions and handles independent loading failures", async ({
  page,
}) => {
  await signInPortal(page, "member");
  const event = {
    id: "41d85861-8b2b-4b3d-ae04-c798827d1244",
    title: "TPA professional learning workshop",
    starts_at: new Date(Date.now() + 86400000).toISOString(),
    ends_at: new Date(Date.now() + 90000000).toISOString(),
    status: "published",
    registration_id: "synthetic",
    registration_status: "registered",
    payment_status: "pending",
    payment_reference: "",
    fee_paise: 12000,
  };
  await page.route("**/api/member/events", (route) =>
    route.fulfill({ json: [event] }),
  );
  await page.route("**/api/member/event-journey", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Synthetic service failure" },
    }),
  );
  await page.goto("/member");
  await expect(
    page.getByText("Event payment reference needed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Review event payment →", exact: true }),
  ).toHaveAttribute("href", `/member/events?eventId=${event.id}`);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Activity totals are unavailable" }),
  ).toBeVisible();
  await expect(page.locator(".member-activity-counts")).toHaveCount(0);
  await page.unroute("**/api/member/event-journey");
  await page.reload();
  await expect(page.locator(".member-activity-counts")).toBeVisible();
});

test("verification tools distinguish reviews from application and verified-profile records", async ({
  page,
}) => {
  await signInPortal(page, "administrator");
  await page.goto("/admin/workspaces/verification");
  await expect(
    page.getByRole("tab", { name: "Profile reviews", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Applications", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Verified profiles", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Verified profiles", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("tab", { name: "Requirements", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Verification requirements",
      exact: true,
    }),
  ).toBeVisible();
});

test("late account detail responses cannot replace a newer selection or survive filtering", async ({
  page,
}) => {
  await signInPortal(page, "administrator");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/workspaces/members?view=accounts");
  const records = page.locator(".directory-record .member-record-button");
  await expect(records.nth(1)).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let blocked = false;
  await page.route("**/api/staff/members?id=*", async (route) => {
    if (!blocked) {
      blocked = true;
      await gate;
    }
    await route.continue();
  });
  try {
    const name = (await records.nth(1).getAttribute("aria-label"))!
      .replace(/^Open /, "")
      .replace(/ details$/, "");
    await records.first().click();
    await expect.poll(() => blocked).toBe(true);
    await records.nth(1).click();
    const panel = page.locator(".portal-inspector");
    await expect(panel.getByRole("heading").first()).toHaveText(name);
    const oldResponse = page.waitForResponse((response) =>
      response.url().includes("/api/staff/members?id="),
    );
    release();
    await oldResponse;
    await expect(panel.getByRole("heading").first()).toHaveText(name);
    await page
      .getByLabel("Search accounts", { exact: true })
      .fill("no-such-synthetic-account");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(panel).toHaveCount(0);
    await expect(
      page.getByText("No accounts match these filters.", { exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }
});

test("Escape dismisses account settings after changing appearance without reopening on restored focus", async ({
  page,
}) => {
  await signInPortal(page, "member");
  const trigger = page.getByRole("button", {
    name: "Account menu",
    exact: true,
  });
  await trigger.click();
  const panel = page.getByRole("dialog", {
    name: "Account settings",
    exact: true,
  });
  await panel.getByRole("radio", { name: "Dark", exact: true }).check();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
});

test("quick cards fit viewport edges and explicit keyboard close stays dismissed", async ({
  page,
}) => {
  await signInPortal(page, "administrator");
  await page.goto("/admin/workspaces/members");
  const records = page.getByRole("region", {
    name: "Member register records",
    exact: true,
  });
  const trigger = records
    .getByRole("button", { name: /^Open .* details$/ })
    .first();
  await records
    .getByRole("button", { name: /^Copy .*@/ })
    .first()
    .focus();
  await page.keyboard.press("Shift+Tab");
  await expect(trigger).toBeFocused();
  const card = page.getByRole("dialog", { name: /quick preview/ });
  await expect(card).toBeVisible();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 600 });
    await trigger.scrollIntoViewIfNeeded();
    await expect
      .poll(async () =>
        card.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.left >= 0 &&
            rect.top >= 0 &&
            rect.right <= innerWidth + 1 &&
            rect.bottom <= innerHeight + 1
          );
        }),
      )
      .toBe(true);
  }
  await card
    .getByRole("button", { name: "Close quick preview", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(card).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(card).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
});
