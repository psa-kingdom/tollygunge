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
  "/admin/workspaces/events?view=participants&tab=registrations",
  "/admin/workspaces/events?view=participants&tab=payments",
  "/admin/workspaces/events?view=participants&tab=attendance",
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

// The full workflow suite also creates accounts without membership. Select the
// record kind needed by editor tests instead of relying on alphabetical order.
async function showMembershipRecords(page: Page) {
  await page
    .getByRole("combobox", { name: "Record type", exact: true })
    .selectOption("member");
  const refreshed = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === "/api/staff/members" &&
      url.searchParams.get("records") === "all" &&
      url.searchParams.get("kind") === "member"
    );
  });
  await page
    .getByRole("button", { name: "Search register", exact: true })
    .click();
  const response = await refreshed;
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.rows.length).toBeGreaterThan(0);
  expect(
    result.rows.every(
      (row: { record_kind: string }) => row.record_kind === "member",
    ),
  ).toBe(true);
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
      await showMembershipRecords(page);
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
  await showMembershipRecords(page);
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

test("combined association directory keeps membership and account identities distinct", async ({
  page,
}) => {
  await signInPortal(page, "administrator");
  const get = async (suffix: string) => {
    const response = await page.request.get(
      "/api/staff/members?view=register&records=all" + suffix,
    );
    expect(response.status()).toBe(200);
    return response.json();
  };
  const all = await get("");
  const members = await get("&kind=member");
  const accounts = await get("&kind=account");
  expect(all.total).toBe(members.total + accounts.total);
  expect(members.total).toBeGreaterThan(0);
  expect(accounts.total).toBeGreaterThan(0);
  const seen = new Set<string>();
  for (let offset = 0; offset < all.total; offset += all.pageSize) {
    const batch = await get("&offset=" + offset);
    for (const row of batch.rows) {
      if (row.user_id) {
        expect(seen.has(row.user_id)).toBe(false);
        seen.add(row.user_id);
      }
      if (row.record_kind === "account") expect(row.membership_id).toBeNull();
      else expect(row.membership_id).toBeTruthy();
    }
  }
  const linked = members.rows.find((row: { user_id?: string }) => row.user_id);
  if (linked) {
    const legacy = await page.request.get(
      "/api/staff/members?id=" + encodeURIComponent(linked.user_id),
    );
    expect(legacy.status()).toBe(200);
    expect((await legacy.json()).rows[0].id).toBe(linked.user_id);
  }
  await page.goto("/admin/workspaces/members");
  await expect(
    page.getByRole("link", { name: "Directory", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("link", { name: "Account directory", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Record type", exact: true })
    .selectOption("account");
  await page
    .getByRole("button", { name: "Search register", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Member register records", exact: true })
      .getByText("Account only", { exact: true })
      .first(),
  ).toBeVisible();
  await page.locator(".member-record-button").first().click();
  const inspector = page.locator(".portal-inspector");
  await expect(inspector).toBeVisible();
  await expect(
    inspector.getByText("Edit member contact and professional details", {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    inspector.getByRole("combobox", { name: "Membership status", exact: true }),
  ).toBeDisabled();
  await expect(
    inspector.getByRole("button", {
      name: "Review this member invitation",
      exact: true,
    }),
  ).toBeDisabled();
});

test("directory audience and participant endpoints retain all six staff permission boundaries", async ({
  browser,
}) => {
  for (const role of roles) {
    const context = await browser.newContext({
      baseURL: process.env.TPA_TEST_URL,
    });
    try {
      const page = await context.newPage();
      await signInPortal(page, role);
      const allowed = hasPermission([role], "members:review");
      const response = await page.request.get(
        "/api/staff/members?view=register&records=all",
      );
      expect(response.status()).toBe(allowed ? 200 : 403);
      const eventsAllowed = hasPermission([role], "events:manage");
      const events = await page.request.get("/api/staff/events");
      expect(events.status()).toBe(eventsAllowed ? 200 : 403);
      await page.goto(
        eventsAllowed
          ? "/admin/workspaces/events?view=participants"
          : "/admin/workspaces/members",
      );
      if (allowed || eventsAllowed) {
        const select = page.getByRole("combobox", {
          name: "Directory audience",
          exact: true,
        });
        await expect(select).toBeVisible();
        await expect(
          select.locator('option[value="participants"]'),
        ).toHaveCount(eventsAllowed ? 1 : 0);
        await expect(select.locator('option[value="members"]')).toHaveCount(
          allowed ? 1 : 0,
        );
      }
    } finally {
      await context.close();
    }
  }
});

test("participant tabs preserve event selection and accessible read-only previews (synthetic API responses)", async ({
  page,
}) => {
  await signInPortal(page, "administrator");
  const eventId = "11111111-1111-4111-8111-111111111111";
  await page.route("**/api/staff/events", (route) =>
    route.fulfill({
      json: [
        {
          id: eventId,
          title: "TPA professional seminar",
          starts_at: "2027-01-01T12:00:00Z",
          status: "published",
        },
      ],
    }),
  );
  await page.route("**/api/staff/attendance?**", (route) =>
    route.fulfill({
      json: {
        rows: [
          {
            id: "registration-ref-001",
            name: "Synthetic event guest",
            email: "guest@example.invalid",
            mobile: "9876543210",
            membership_number: null,
            status: "registered",
            payment_status: "pending",
            fee_paise: 50000,
            outcome: "unmarked",
            registered_at: "2026-10-01T12:00:00Z",
            checked_in_at: null,
            attendance_note: "",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 50,
      },
    }),
  );
  await page.goto("/admin/workspaces/members");
  await page
    .getByRole("combobox", { name: "Directory audience", exact: true })
    .selectOption("participants");
  await expect(
    page.getByRole("heading", { name: "Event participants", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", {
      name: "Event participant sections",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Event", exact: true })
    .selectOption(eventId);
  for (const [label, tab] of [
    ["Registrations", "registrations"],
    ["Payment status", "payments"],
    ["Attendance", "attendance"],
  ]) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp("tab=" + tab + "&eventId=" + eventId),
    );
    await expect(
      page.getByText("No membership recorded", { exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: /Synthetic event guest/ }).click();
  const inspector = page.getByRole("dialog", {
    name: "Synthetic event guest participant details",
    exact: true,
  });
  await expect(inspector).toBeVisible();
  await expect(
    inspector.getByText("Payment pending", { exact: true }),
  ).toBeVisible();
  await expect(inspector.getByText("Verified", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(inspector).toHaveCount(0);
});

test("TPA brand, right aligned membership tabs and single-line signup fit all target widths", async ({
  browser,
}) => {
  for (const mode of ["light", "dark"] as const) {
    const context = await browser.newContext({
      baseURL: process.env.TPA_TEST_URL,
      colorScheme: mode,
    });
    try {
      const page = await context.newPage();
      await signInPortal(page, "member");
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 932 });
        await page.goto("/member/application");
        await expect(page.locator(".portal-brand-row .brand-name")).toHaveText(
          "TPA",
        );
        await expect(
          page.locator(".portal-brand-row .brand-name"),
        ).toBeVisible();
        const rects = await page.evaluate(() => {
          const heading = document
            .querySelector(".portal-page-intro h1")!
            .getBoundingClientRect();
          const tabs = document
            .querySelector(".portal-subsections")!
            .getBoundingClientRect();
          return {
            heading: { right: heading.right, top: heading.top },
            tabs: { left: tabs.left, top: tabs.top },
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        expect(rects.overflow).toBe(false);
        if (width >= 1024) {
          expect(rects.tabs.left).toBeGreaterThan(rects.heading.right);
          expect(Math.abs(rects.tabs.top - rects.heading.top)).toBeLessThan(20);
        }
      }
      await context.clearCookies();
      await page.goto("/signup");
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 932 });
        await page.evaluate(() => document.fonts.ready);
        const title = await page
          .getByRole("heading", {
            name: "Create your TPA account",
            exact: true,
          })
          .evaluate((el) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            return {
              lines: range.getClientRects().length,
              width: el.scrollWidth,
              available: el.clientWidth,
              overflow: document.documentElement.scrollWidth > innerWidth,
            };
          });
        expect(title.lines).toBe(1);
        expect(title.width).toBeLessThanOrEqual(title.available + 1);
        expect(title.overflow).toBe(false);
      }
    } finally {
      await context.close();
    }
  }
});

test("populated participant tabs reflow at all five widths in both appearances (synthetic API responses)", async ({
  page,
}) => {
  await signInPortal(page, "administrator");
  const eventId = "22222222-2222-4222-8222-222222222222";
  await page.route("**/api/staff/events", (route) =>
    route.fulfill({
      json: [
        {
          id: eventId,
          title:
            "TPA continuing professional education — detailed event title for reflow",
          starts_at: "2027-02-01T12:00:00Z",
          status: "published",
        },
      ],
    }),
  );
  await page.route("**/api/staff/attendance?**", (route) =>
    route.fulfill({
      json: {
        rows: [
          {
            id: "synthetic-roster-reference",
            name: "Synthetic professional participant with a deliberately long name",
            email: "long-professional-participant-address@example.invalid",
            mobile: "9876543210",
            membership_number: "TPA-SYNTHETIC-2026-001",
            status: "registered",
            payment_status: "paid",
            fee_paise: 50000,
            outcome: "attended",
            registered_at: "2026-10-01T12:00:00Z",
            checked_in_at: "2026-10-01T14:00:00Z",
            attendance_note: "Synthetic check-in",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 50,
      },
    }),
  );
  for (const mode of ["light", "dark"]) {
    await page.addInitScript(
      (mode) =>
        localStorage.setItem("tpa-appearance", JSON.stringify({ mode })),
      mode,
    );
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 932 });
      for (const tab of ["registrations", "payments", "attendance"]) {
        await page.goto(
          `/admin/workspaces/events?view=participants&tab=${tab}&eventId=${eventId}`,
        );
        await expect(
          page.getByRole("region", {
            name: "Event participant records",
            exact: true,
          }),
        ).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute(
          "data-color-mode",
          mode,
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        const trigger = page.getByRole("button", {
          name: /^Open Synthetic professional participant/,
        });
        await trigger.focus();
        const card = page.getByRole("dialog", { name: /quick preview/ });
        await expect(card).toBeVisible();
        await expect
          .poll(() =>
            card.evaluate((el) => {
              const r = el.getBoundingClientRect();
              return (
                r.left >= 0 &&
                r.top >= 0 &&
                r.right <= innerWidth + 1 &&
                r.bottom <= innerHeight + 1
              );
            }),
          )
          .toBe(true);
        await page.keyboard.press("Escape");
        await expect(card).toHaveCount(0);
      }
    }
  }
});
