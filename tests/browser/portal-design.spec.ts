import { test, expect, type Page } from "@playwright/test";

type PortalCookies = Awaited<ReturnType<ReturnType<Page["context"]>["cookies"]>>;
const sessions = new Map<"ADMIN" | "MEMBER", PortalCookies>();

// Supply synthetic local accounts; these checks never change business records.
test.beforeEach(() => {
  const target = new URL(process.env.TPA_TEST_URL || "http://127.0.0.1:3112");
  test.skip(!["127.0.0.1", "localhost"].includes(target.hostname), "Portal visual checks require a local server.");
  test.skip(!process.env.TPA_UI_ADMIN_EMAIL || !process.env.TPA_UI_ADMIN_PASSWORD || !process.env.TPA_UI_MEMBER_EMAIL || !process.env.TPA_UI_MEMBER_PASSWORD, "Supply synthetic portal account credentials.");
});

async function signIn(page: Page, role: "ADMIN" | "MEMBER") {
  const destination = role === "ADMIN" ? "/admin" : "/member";
  const cookies = sessions.get(role);
  if (cookies) {
    await page.context().addCookies(cookies);
    await page.goto(destination);
    await expect(page.locator(".portal-sidebar")).toBeVisible();
    return;
  }
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(process.env[`TPA_UI_${role}_EMAIL`]!);
  await page.getByLabel("Password", { exact: true }).fill(process.env[`TPA_UI_${role}_PASSWORD`]!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(role === "ADMIN" ? "**/admin" : "**/member");
  await expect(page.locator(".portal-sidebar")).toBeVisible();
  sessions.set(role, await page.context().cookies());
}

async function layoutFits(page: Page) {
  await expect(page.locator("main#main")).toBeVisible();
  await expect(page.locator("main h1")).toBeVisible();
  // Background status polling need not stop for a layout to be ready.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  expect(await page.locator("main h1").evaluate(element => getComputedStyle(element).fontFamily)).not.toContain("Cormorant");
}

async function primaryActionContrast(page: Page) {
  const ratio = await page.locator(".button:not(.secondary):not(:disabled)").first().evaluate(element => {
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(channel => {
        const value = channel / 255;
        return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
      });
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const style = getComputedStyle(element);
    const foreground = luminance(style.color), background = luminance(style.backgroundColor);
    return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
}

async function mobileNavigation(page: Page, label: string, navigation: string) {
  const toggle = page.getByRole("button", { name: new RegExp(label) });
  if (await toggle.isVisible()) {
    await expect(page.locator(navigation)).toBeHidden();
    await toggle.click();
    await expect(page.locator(navigation)).toBeVisible();
    await page.locator(`${navigation} a`).first().focus();
    await page.keyboard.press("Escape");
    await expect(page.locator(navigation)).toBeHidden();
    await expect(toggle).toBeFocused();
  }
}

test("staff workspaces keep compact layouts, usable mobile navigation and keyboard search", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await signIn(page, "ADMIN");
  await layoutFits(page);
  await mobileNavigation(page, "Workspace navigation", "#staff-navigation");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Search workspace/ })).toBeFocused();
  const routes = await page.locator("#staff-navigation a").evaluateAll(elements => elements.map(element => element.getAttribute("href")!));
  for (const route of routes.filter(route => route !== "/admin")) {
    await page.goto(route);
    await layoutFits(page);
    await expect(page.locator(`#staff-navigation a[href="${route}"]`)).toHaveAttribute("aria-current", "page");
  }
  await page.goto("/admin/workspaces/members");
  await expect(page.getByRole("region", { name: "Member register records", exact: true })).toBeVisible();
  await page.getByLabel("Search members", { exact: true }).fill("no-such-synthetic-member-48391");
  await page.getByRole("button", { name: "Search register", exact: true }).click();
  await expect(page.getByText(/No members match these filters/)).toBeVisible();
  await layoutFits(page);
  await primaryActionContrast(page);
  await page.screenshot({ path: info.outputPath("staff-register.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("member pages retain their navigation, fit each viewport and support dark and reduced motion", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await signIn(page, "MEMBER");
  await mobileNavigation(page, "Member navigation", "#member-navigation");
  const routes = await page.locator("#member-navigation a").evaluateAll(elements => elements.map(element => element.getAttribute("href")!));
  for (const route of routes) {
    await page.goto(route);
    await layoutFits(page);
    await expect(page.locator(`#member-navigation a[href="${route}"]`)).toHaveAttribute("aria-current", "page");
  }
  await page.goto("/account/profile");
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("radio", { name: "Dark", exact: true }).check();
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  expect(await page.locator(".account-menu").evaluate(element => getComputedStyle(element).animationName)).toBe("none");
  await page.keyboard.press("Escape");
  await layoutFits(page);
  await primaryActionContrast(page);
  await page.screenshot({ path: info.outputPath("member-profile-dark.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("portal navigation does not leak its palette or typography into public pages", async ({ page }) => {
  await page.goto("/");
  const original = await page.locator(".public-shell").evaluate(element => ({
    paper: getComputedStyle(element).getPropertyValue("--paper"),
    font: getComputedStyle(element.querySelector("h1")!).fontFamily,
  }));
  await signIn(page, "ADMIN");
  await page.goto("/");
  await expect(page.locator(".portal-sidebar")).toHaveCount(0);
  expect(await page.locator(".public-shell").evaluate(element => ({
    paper: getComputedStyle(element).getPropertyValue("--paper"),
    font: getComputedStyle(element.querySelector("h1")!).fontFamily,
  }))).toEqual(original);
});

test("event, flyer and import empty states lead to the correct next task", async ({ page }, info) => {
  await signIn(page, "ADMIN");
  await page.route("**/api/staff/events?*", route => route.fulfill({ json: [] }));
  await page.route("**/api/staff/events", route => route.fulfill({ json: [] }));
  await page.route("**/api/staff/flyers", route => route.fulfill({ json: [] }));
  await page.goto("/admin/workspaces/events");
  await expect(page.getByRole("heading", { name: "Your events start here", exact: true })).toBeVisible();
  await expect(page.locator("#event-details")).toHaveCount(0);
  await primaryActionContrast(page);
  await page.getByRole("button", { name: "New event", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create event", exact: true })).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toBeVisible();
  expect(await page.getByRole("listbox", { name: "Event payment accounts", exact: true }).evaluate(element => element.closest("fieldset")?.querySelector("legend")?.textContent)).toBe("Payment");
  await page.getByRole("navigation", { name: "Event form sections" }).getByRole("link", { name: "Reminders", exact: true }).click();
  await expect(page.getByLabel("Send automatic reminders", { exact: true })).toBeInViewport();
  await layoutFits(page);
  await page.screenshot({ path: info.outputPath("event-editor.png"), fullPage: true });
  await page.goto("/admin/workspaces/flyers");
  await expect(page.getByRole("heading", { name: "Create an event before designing its flyer", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create an event", exact: true })).toHaveAttribute("href", "/admin/workspaces/events");
  await expect(page.getByRole("button", { name: "Generate preview", exact: true })).toHaveCount(0);
  await layoutFits(page);
  await page.goto("/admin/workspaces/onboarding");
  await expect(page.getByRole("heading", { name: "Prepare your import", exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Workflow progress" }).locator('li[aria-current="step"]')).toHaveText(/Choose workbook/);
  await page.getByRole("combobox", { name: "Import mode", exact: true }).selectOption("invitation");
  await expect(page.getByRole("link", { name: "CSV template", exact: true })).toHaveAttribute("href", /mode=invitation/);
  await layoutFits(page);
  await page.screenshot({ path: info.outputPath("bulk-onboarding.png"), fullPage: true });
  await page.goto("/admin/workspaces/imports");
  await expect(page.getByRole("heading", { name: "Upload historical records", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your validation preview", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose CSV", exact: true })).toBeVisible();
  await layoutFits(page);
});

test("workspace subtabs and collapsible sections preserve a usable task hierarchy", async ({ page }, info) => {
  await signIn(page, "ADMIN");
  await page.goto("/admin/workspaces/verification");
  await page.getByRole("tab", { name: "Requirements", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Verification requirements", exact: true })).toBeVisible();
  await expect(page.locator(".requirements-step")).toHaveCount(5);
  await expect(page.locator(".requirements-step[open]")).toHaveCount(1);
  const field = page.locator(".requirement-settings").first();
  await field.locator(":scope > summary").click();
  await expect(field.getByLabel("Label", { exact: true })).toBeVisible();
  const geometry = await field.locator(".form-grid > label").evaluateAll(labels => labels.map(label => {
    const control = label.querySelector("input, select")!;
    const text = document.createRange();
    text.selectNodeContents(label.firstChild!);
    const caption = text.getBoundingClientRect(), input = control.getBoundingClientRect();
    return { gap: input.top - caption.bottom, width: input.width, available: label.getBoundingClientRect().width };
  }));
  for (const item of geometry) {
    expect(item.gap).toBeGreaterThanOrEqual(5);
    expect(Math.abs(item.width - item.available)).toBeLessThanOrEqual(1);
  }
  const checks = await field.locator(".consent").evaluateAll(labels => labels.map(label => {
    const box = label.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom };
  }));
  for (let index = 1; index < checks.length; index++) {
    expect(checks[index].top - checks[index - 1].bottom).toBeGreaterThanOrEqual(8);
  }
  await layoutFits(page);
  await field.screenshot({ path: info.outputPath("verification-field-settings.png") });
  await page.locator(".requirements-step").nth(1).locator(":scope > summary").click();
  await expect(page.locator(".requirements-step").nth(1)).toHaveAttribute("open", "");
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Verification history", exact: true })).toBeVisible();
  await layoutFits(page);
  await page.goto("/admin/workspaces/communications");
  const deliveryDetails = page.getByRole("button", { name: "Delivery details", exact: true });
  await deliveryDetails.click();
  const detailsDialog = page.getByRole("dialog", { name: "Delivery details", exact: true });
  await expect(detailsDialog).toBeVisible();
  await expect(detailsDialog.getByRole("heading", { name: "Email setup", exact: true })).toBeVisible();
  await expect(detailsDialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(detailsDialog).not.toBeVisible();
  await expect(deliveryDetails).toBeFocused();
  await deliveryDetails.click();
  await detailsDialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(detailsDialog).not.toBeVisible();
  const tools = page.getByRole("tablist", { name: "Communication tools", exact: true });
  for (const name of ["Campaigns", "Email templates", "Member invitations", "Delivery logs", "Shared inbox"]) {
    const tab = tools.getByRole("tab", { name, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    const panel = await tab.getAttribute("aria-controls");
    await expect(page.locator(`#${panel}`)).toBeVisible();
    if (name === "Campaigns") {
      const campaign = page.locator(`#${panel}`);
      await expect(campaign.getByRole("heading", { name: "2. Preview message and audience", exact: true })).toBeHidden();
      await expect(campaign.getByRole("heading", { name: "3. Review and send", exact: true })).toHaveCount(0);
      await expect(campaign.getByRole("button", { name: /Preview message & audience/ })).toBeDisabled();
    }
    await layoutFits(page);
  }
  await page.screenshot({ path: info.outputPath("communications-inbox.png"), fullPage: true });
  await page.goto("/admin/workspaces/payments");
  await expect(page.getByRole("tab", { name: "Registration payments", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Payment instructions", exact: true }).click();
  await expect(page.locator("#payments-instructions-panel")).toBeVisible();
  await page.getByRole("tab", { name: "Payment instructions", exact: true }).press("Home");
  await expect(page.getByRole("tab", { name: "Registration payments", exact: true })).toBeFocused();
  await expect(page.locator("#payments-registrations-panel")).toBeVisible();
  await layoutFits(page);
});


test("campaign stepper preserves drafts and gates review without sending", async ({ page }, info) => {
  const actions: string[] = [];
  let saved = { id: "synthetic-campaign", version: 1, name: "", subject: "", body: "", audience: { city: "", profession: "" }, status: "draft" };
  await signIn(page, "ADMIN");
  await page.route("**/api/staff/campaigns**", async route => {
    const request = route.request();
    const body = request.method() === "POST" ? request.postDataJSON() : null;
    if (body) actions.push(body.action);
    let response: unknown = { campaigns: [] };
    if (body?.action === "save") {
      saved = { ...saved, ...body, version: saved.version + 1 };
      response = saved;
    } else if (body?.action === "preview") {
      response = { matched: 0, eligible: 0, unsubscribed: 0, unverified: 0, preference_blocked: 0, as_of: new Date().toISOString(), sample: [], audience: saved.audience };
    } else if (request.url().includes("?id=")) {
      response = { entry: saved, revisions: [], dispatches: [] };
    }
    await route.fulfill({ json: response });
  });
  await page.goto("/admin/workspaces/communications");
  await page.getByRole("tab", { name: "Campaigns", exact: true }).click();
  const campaign = page.locator("#communications-campaigns-panel");
  const steps = campaign.getByRole("list", { name: "Workflow progress", exact: true });
  await expect(steps.getByRole("button", { name: /Preview message & audience/ })).toBeDisabled();
  await campaign.getByLabel("Campaign name", { exact: true }).fill("Synthetic newsletter");
  await campaign.getByLabel("Campaign subject", { exact: true }).fill("Synthetic subject");
  await campaign.getByLabel("Campaign message (plain text)", { exact: true }).fill("Synthetic message for wizard navigation checks.");
  await campaign.getByRole("button", { name: "Save and continue", exact: true }).click();
  await expect(campaign.getByRole("region", { name: "Message and audience preview", exact: true })).toBeVisible();
  await expect(campaign.getByLabel("Campaign name", { exact: true })).toBeHidden();
  await expect(campaign.getByRole("button", { name: "Continue to review", exact: true })).toBeDisabled();
  await campaign.getByRole("button", { name: "Back to writing", exact: true }).click();
  await expect(campaign.getByLabel("Campaign name", { exact: true })).toHaveValue("Synthetic newsletter");
  await steps.getByRole("button", { name: /Preview message & audience/ }).click();
  await campaign.getByRole("button", { name: "Preview current audience", exact: true }).click();
  await expect(campaign.getByRole("button", { name: "Continue to review", exact: true })).toBeEnabled();
  await campaign.getByRole("button", { name: "Continue to review", exact: true }).click();
  await expect(campaign.getByRole("heading", { name: "3. Review and send", exact: true })).toBeVisible();
  await expect(campaign.getByRole("region", { name: "Message and audience preview", exact: true })).toBeHidden();
  await layoutFits(page);
  await page.screenshot({ path: info.outputPath("campaign-review-step.png"), fullPage: true });
  await steps.getByRole("button", { name: /Write campaign/ }).click();
  await campaign.getByLabel("Campaign subject", { exact: true }).fill("Updated subject");
  await expect(steps.getByRole("button", { name: /Review & send/ })).toBeDisabled();
  await expect(steps.getByRole("button", { name: /Preview message & audience/ })).toBeDisabled();
  expect(actions).toEqual(["save", "preview"]);
});

test("payments and email settings keep forms and empty states aligned", async ({ page }, info) => {
  await signIn(page, "ADMIN");
  let populated = false;
  await page.route("**/api/staff/registration-payments?**", route => route.fulfill({ json: populated ? [{ id: "synthetic-payment", version: 1, name: "Synthetic Member", email: "member@example.test", title: "Synthetic event", fee_paise: 10000, payment_status: "pending", payment_reference: "test", payment_note: "", history: [] }] : [] }));
  await page.goto("/admin/workspaces/payments");
  const payments = page.locator(".registration-payments");
  await expect(payments.getByRole("heading", { name: "No payments match this status", exact: true })).toBeVisible();
  await expect(payments.getByRole("table")).toHaveCount(0);
  await layoutFits(page);
  await page.screenshot({ path: info.outputPath("payments-empty.png"), fullPage: true });
  populated = true;
  await payments.getByLabel("Payment status").selectOption("all");
  await expect(payments.getByRole("table")).toBeVisible();
  const width = await payments.locator(".table-scroll").evaluate(el => ({ region: el.clientWidth, table: el.querySelector("table")!.getBoundingClientRect().width }));
  expect(width.table).toBeGreaterThanOrEqual(width.region - 2);
  await layoutFits(page);
  await page.route("**/api/staff/onboarding-email", route => {
    if (route.request().method() !== "GET") throw new Error("Layout checks must not save recipients or send emails");
    return route.fulfill({ json: { configured: false, settings: { version: 1, test_recipients: ["controlled-test-inbox@example.test"] }, mail: [] } });
  });
  await page.goto("/admin/workspaces/onboarding-email");
  const email = page.locator(".email-settings-workspace");
  const recipients = email.getByRole("textbox", { name: "Controlled inboxes (one per line)", exact: true });
  await expect(recipients).toHaveValue("controlled-test-inbox@example.test");
  const dimensions = await recipients.evaluate(el => ({ width: el.getBoundingClientRect().width, label: el.parentElement!.getBoundingClientRect().width, height: el.getBoundingClientRect().height }));
  expect(Math.abs(dimensions.width - dimensions.label)).toBeLessThanOrEqual(1);
  expect(dimensions.height).toBeGreaterThanOrEqual(90);
  await expect(email.getByRole("button", { name: "Send test to controlled-test-inbox@example.test", exact: true })).toBeVisible();
  await expect(email.getByRole("heading", { name: "No transactional deliveries yet", exact: true })).toBeVisible();
  await layoutFits(page);
  await page.screenshot({ path: info.outputPath("email-settings-layout.png"), fullPage: true });
});

test("website shortcuts explain destinations and content editor separates edit from preview", async ({ page }, info) => {
  await signIn(page, "ADMIN");
  await page.goto("/admin/workspaces/website");
  const directory = page.locator(".website-workspace-directory");
  await expect(directory.getByRole("navigation")).toBeHidden();
  await directory.locator("summary").click();
  await expect(directory.getByText(/These shortcuts open separate staff workspaces/)).toBeVisible();
  await expect(directory.getByRole("link", { name: /Pages and articles/ })).toHaveAttribute("href", "/admin/workspaces/content");
  await layoutFits(page);
  await page.screenshot({ path: info.outputPath("website-directory.png"), fullPage: true });
  const settingsGroup = page.locator(".website-group-selector select");
  await expect(settingsGroup).toBeVisible();
  await settingsGroup.selectOption("navigation");
  await expect(page.locator(".website-settings-editor").getByRole("textbox")).toHaveCount(0);
  await settingsGroup.selectOption("general-0");
  await expect(page.locator(".website-settings-editor").getByRole("textbox").first()).toBeVisible();
  await page.goto("/admin/workspaces/content");
  const workspace = page.locator(".page-content-workspace");
  await expect(workspace.getByRole("heading", { name: "Content library", exact: true })).toBeVisible();
  const view = workspace.getByRole("tablist", { name: "Content workspace view", exact: true });
  await expect(view.getByRole("tab", { name: "Edit", exact: true })).toBeVisible();
  await expect(workspace.locator("#content-panel-edit")).toBeVisible();
  await expect(workspace.locator("#content-panel-preview")).toBeHidden();
  const geometry = await workspace.locator(".content-editor-columns").evaluate(el => ({ available: el.getBoundingClientRect().width, editor: el.querySelector("#content-panel-edit")!.getBoundingClientRect().width }));
  expect(Math.abs(geometry.available - geometry.editor)).toBeLessThanOrEqual(1);
  const bounds = await workspace.locator(".record-list > button:has(small)").evaluateAll(buttons => buttons.map(button => {
    const box = button.getBoundingClientRect(), text = button.querySelector("small")!.getBoundingClientRect();
    return text.bottom <= box.bottom && text.top >= box.top;
  }));
  expect(bounds.every(Boolean)).toBeTruthy();
  const groups = workspace.getByRole("navigation", { name: "Draft editing groups", exact: true });
  await groups.getByRole("button", { name: "Sections", exact: true }).click();
  await expect(workspace.locator("[data-content-group=sections] > label > select")).toBeVisible();
  await expect(workspace.locator("[data-section-index]:visible")).toHaveCount(1);
  await workspace.locator("[data-content-group=sections] > label > select").selectOption("1");
  await expect(workspace.locator('[data-section-index="1"]')).toBeVisible();
  await expect(workspace.locator('[data-section-index="0"]')).toBeHidden();
  await groups.getByRole("button", { name: "Introduction", exact: true }).click();
  await expect(workspace.getByRole("textbox", { name: "Introduction", exact: true })).toBeVisible();
  await groups.getByRole("button", { name: "Page details", exact: true }).click();
  await layoutFits(page);
  await page.screenshot({ path: info.outputPath("content-edit-layout.png"), fullPage: true });
  await view.getByRole("tab", { name: "Preview", exact: true }).click();
  await expect(workspace.locator("#content-panel-preview")).toBeVisible();
  await expect(workspace.locator("#content-panel-edit")).toBeHidden();
  await view.getByRole("tab", { name: "Preview", exact: true }).press("Home");
  await expect(view.getByRole("tab", { name: "Edit", exact: true })).toBeFocused();
  await expect(workspace.locator("#content-panel-edit")).toBeVisible();
  const title = workspace.getByRole("textbox", { name: "Title", exact: true });
  await title.fill("");
  await groups.getByRole("button", { name: "Sections", exact: true }).click();
  await expect(workspace.getByRole("button", { name: "Save draft", exact: true })).toBeDisabled();
  await groups.getByRole("button", { name: "Page details", exact: true }).click();
  await expect(title).toHaveValue("");
});

test("navigation keeps authentication isolated between requests", async ({ page }) => {
  await signIn(page, "ADMIN");
  await expect(page.locator("#staff-navigation")).toBeAttached();
  await page.context().clearCookies();
  await signIn(page, "MEMBER");
  await page.goto("/admin");
  await page.waitForURL("**/member");
  await expect(page.locator("#staff-navigation")).toHaveCount(0);
  await page.context().clearCookies();
  await page.goto("/admin");
  await page.waitForURL("**/login");
  await expect(page.locator("#staff-navigation")).toHaveCount(0);
});

test("slow navigation retains the current page instead of replacing it with a loading screen", async ({ page }, info) => {
  await signIn(page, "ADMIN");
  const toggle = page.getByRole("button", { name: /Workspace navigation/ });
  if (await toggle.isVisible()) await toggle.click();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  await page.route("**/admin/workspaces/verification?**", async route => {
    requested = true;
    await gate;
    await route.continue();
  });
  const heading = await page.locator("main h1").textContent();
  try {
    await page.locator('#staff-navigation a[href="/admin/workspaces/verification"]').click();
    await expect.poll(() => requested).toBeTruthy();
    await expect(page.locator("main h1")).toHaveText(heading!);
    await expect(page.locator(".tpa-loading")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Opening page…" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Opening page…" })).toHaveCSS("opacity", "1");
    await page.screenshot({ path: info.outputPath("navigation-pending.png") });
  } finally {
    release();
  }
  await page.waitForURL("**/admin/workspaces/verification");
  await expect(page.getByRole("status").filter({ hasText: "Opening page…" })).toHaveCount(0);
  await expect(page.locator("main h1")).toHaveText("Verification");
  await page.goto("/about");
  let releasePublic!: () => void;
  const publicGate = new Promise<void>(resolve => { releasePublic = resolve; });
  let publicRequested = false;
  await page.route("**/membership?**", async route => {
    publicRequested = true;
    await publicGate;
    await route.continue();
  });
  const publicHeading = await page.locator("main h1").textContent();
  try {
    await page.locator('footer a[href="/membership"]').first().click();
    await expect.poll(() => publicRequested).toBeTruthy();
    await expect(page.locator("main h1")).toHaveText(publicHeading!);
    await expect(page.locator(".tpa-loading")).toHaveCount(0);
  } finally {
    releasePublic();
  }
  await page.waitForURL("**/membership");
  await expect(page.locator("main h1")).not.toHaveText(publicHeading!);
});

for (const role of ["ADMIN", "MEMBER"] as const) {
  test(`${role.toLowerCase()} sidebar remembers collapse and keeps navigation accessible`, async ({ page }, info) => {
    await signIn(page, role);
    const toggle = page.locator(".portal-collapse-toggle");
    if (info.project.name !== "desktop") {
      await expect(toggle).toBeHidden();
      await mobileNavigation(page, role === "ADMIN" ? "Workspace navigation" : "Member navigation", role === "ADMIN" ? "#staff-navigation" : "#member-navigation");
      return;
    }
    const sidebar = page.locator(".portal-sidebar");
    const width = () => sidebar.evaluate(element => element.getBoundingClientRect().width);
    const contentX = await page.locator(".portal-content").evaluate(element => element.getBoundingClientRect().x);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await toggle.click();
    await expect(toggle).toHaveAccessibleName("Expand sidebar");
    await expect.poll(width).toBe(72);
    expect(await page.locator(".portal-content").evaluate(element => element.getBoundingClientRect().x)).toBeLessThan(contentX);
    const link = sidebar.getByRole("link", { name: role === "ADMIN" ? "Members" : "Events", exact: true });
    await link.focus();
    await expect(page.locator(".portal-nav-tooltip")).toHaveText(role === "ADMIN" ? "Members" : "Events");
    await page.keyboard.press("Escape");
    await expect(page.locator(".portal-nav-tooltip")).toHaveCount(0);
    await link.click();
    await layoutFits(page);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await page.reload();
    await expect(toggle).toHaveAccessibleName("Expand sidebar");
    await expect.poll(width).toBe(72);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".workspace")).toHaveCSS("transition-duration", "0s");
    await link.focus();
    await expect(link.locator("svg")).toHaveCSS("transform", "none");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(toggle).toBeHidden();
    await mobileNavigation(page, role === "ADMIN" ? "Workspace navigation" : "Member navigation", role === "ADMIN" ? "#staff-navigation" : "#member-navigation");
    await layoutFits(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect.poll(width).toBe(72);
    await toggle.click();
    await expect(toggle).toHaveAccessibleName("Collapse sidebar");
    await expect.poll(width).toBe(232);
    // Fast reversals must leave a stable final rail, with no accumulated tweens.
    await toggle.click(); await toggle.click(); await toggle.click();
    await expect.poll(width).toBe(72);
    await toggle.click();
    await expect.poll(width).toBe(232);
  });
}
