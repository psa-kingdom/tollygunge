import { test, expect, type Page } from "@playwright/test";
import { signInPortal } from "../helpers/portal-browser";

// Supply synthetic local accounts; these checks never change business records.
test.beforeEach(() => {
  const target = new URL(process.env.TPA_TEST_URL || "http://127.0.0.1:3112");
  test.skip(!["127.0.0.1", "localhost"].includes(target.hostname), "Portal visual checks require a local server.");
  test.skip(!process.env.TPA_UI_ADMIN_EMAIL || !process.env.TPA_UI_ADMIN_PASSWORD || !process.env.TPA_UI_MEMBER_EMAIL || !process.env.TPA_UI_MEMBER_PASSWORD, "Supply synthetic portal account credentials.");
});

async function signIn(page: Page, role: "ADMIN" | "MEMBER") {
  await signInPortal(page, role === "ADMIN" ? "administrator" : "member");
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

async function dashboardTextContrast(page: Page) {
  // Theme changes transition tile surfaces for 140ms. Measure the completed
  // colors rather than an intermediate frame with the new text and old surface.
  await page.locator('.member-service-tile').evaluateAll(async elements => {
    await Promise.all(elements.flatMap(element => element.getAnimations()
      .map(animation => animation.finished.catch(() => undefined))));
  });
  const ratios = await page.locator('.profile-completion :is(strong, p, summary), .service-metrics :is(strong, .metric-label), .attention-row :is(span, small), .member-service-tile :is(h3, p)').evaluateAll(elements => elements.filter(el => (el as HTMLElement).offsetHeight > 0).map(el => {
    const luminance = (color: string) => {
      const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(channel => {
        const value = channel / 255;
        return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
      });
      return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    };
    let surface: Element | null = el;
    while (surface && getComputedStyle(surface).backgroundColor === 'rgba(0, 0, 0, 0)') surface = surface.parentElement;
    const color = getComputedStyle(el).color;
    const backgroundColor = surface ? getComputedStyle(surface).backgroundColor : 'rgb(255, 255, 255)';
    const foreground = luminance(color);
    const background = luminance(backgroundColor);
    return { text: el.textContent?.slice(0, 60), color, backgroundColor, mode: document.documentElement.dataset.colorMode, ratio: (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05) };
  }));
  expect(ratios.filter(value => value.ratio < 4.5)).toEqual([]);
}

async function mobileNavigation(page: Page, _label: string, navigation: string) {
  const nav = page.locator(navigation);
  await expect(nav).toBeVisible();
  await expect(page.locator(".portal-sidebar")).toHaveCount(0);
  const last = nav.getByRole("link").last();
  await last.focus();
  await expect(last).toBeFocused();
  await expect.poll(() => last.evaluate(el => { const parent = el.parentElement!.getBoundingClientRect(), item = el.getBoundingClientRect(); return item.left >= parent.left - 1 && item.right <= parent.right + 1; })).toBeTruthy();
  expect(await nav.evaluate(el => el.scrollHeight <= el.clientHeight + 3)).toBeTruthy();
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
  const routes = ["/admin", ...["reports","members","verification","onboarding","events","flyers","imports","content","media","governance","communications","crm","onboarding-email","payments","website","access"].map(slug => "/admin/workspaces/"+slug)];
  for (const route of routes.filter(route => route !== "/admin")) {
    await page.goto(route);
    await layoutFits(page);
    await expect(page.locator("#staff-navigation a[aria-current=page]")).toHaveCount(1);
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
  const routes = ["/member","/member/application","/member/payments","/member/events","/member/inquiries","/account/profile","/member/security"];
  for (const route of routes) {
    await page.goto(route);
    await layoutFits(page);
    await expect(page.locator("#member-navigation a[aria-current=page]")).toHaveCount(1);
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
  await page.goto("/admin/workspaces/members");
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
    await page.locator('.portal-subsections a[href="/admin/workspaces/verification"]').click();
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

test("member completion links to missing form steps and keeps approval separate", async ({ page }, info) => {
  await signIn(page, "MEMBER");
  await page.route("**/api/member/verification", route => route.fulfill({ json: {
    email: "member@example.test", emailVerified: false, verified: false, updateRequested: false, missing: ["Mobile number"], reviews: [],
    progress: { total: 10, completed: 6, percent: 60, remaining: [{ id: "phone", label: "Mobile number", step: 2, href: "/member/application?step=2" }, { id: "photograph", label: "Passport photograph", step: 3, href: "/member/application?step=3" }, { id: "signature", label: "Typed applicant signature", step: 4, href: "/member/application?step=4" }, { id: "email", label: "Verify your account email", step: -1, href: "/member#verification-email-action" }] },
  } }));
  await page.reload();
  await expect(page.getByText("60% complete", { exact: true })).toBeVisible();
  const progress = page.getByRole("progressbar", { name: "Profile completion", exact: true });
  await expect(progress).toHaveAttribute("value", "6");
  await expect(progress).toHaveAttribute("max", "10");
  await expect(page.getByText("Not verified", {exact:true})).toBeVisible();
  await layoutFits(page);
  await page.screenshot({ path: info.outputPath("member-completion.png"), fullPage: true });
  // Let the actual application endpoints supply the full policy/schema after navigation.
  await page.unroute("**/api/member/verification");
  await page.getByRole("link", { name: /Go to Contact & preferences/ }).click();
  await expect(page).toHaveURL(/\/member\/application\?step=2/);
  await expect(page.getByRole("heading", { name: "Contact & preferences", exact: true })).toBeVisible();
});

test("admin dashboard updates signup and application notifications without approving accounts", async ({ page }) => {
  await signIn(page, "ADMIN");
  let items = [{ id: "new-signups", label: "2 new sign-ups awaiting applications (last 7 days)", href: "/admin/workspaces/members?view=accounts", category: "Account", priority: "Low", count: 2 }];
  await page.route("**/api/attention", route => route.fulfill({ json: { items } }));
  await page.reload();
  const dashboard = page.getByRole("region", { name: "Needs attention", exact: true });
  await expect(dashboard.getByRole("link", { name: /2 new sign-ups/ })).toBeVisible();
  items = [{ id: "verification", label: "1 applications awaiting profile review", href: "/admin/workspaces/verification", category: "Verification", priority: "Normal", count: 1 }];
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(dashboard.getByRole("link", { name: /1 applications awaiting profile review/ })).toBeVisible();
  await expect(dashboard.getByRole("link", { name: /2 new sign-ups/ })).toHaveCount(0);
  await dashboard.getByRole("link", { name: /1 applications awaiting profile review/ }).click();
  await expect(page.getByRole("heading", { name: "Verification", exact: true })).toBeVisible();
  await page.goto("/admin/workspaces/members?view=accounts");
  await expect(page.getByRole("link", { name: "Account directory", exact: true })).toHaveAttribute("aria-current", "page");
});

test("dashboard semantic colors cover themes, completion states and interactive feedback", async ({ page }, info) => {
  const baseline = process.env.TPA_DASHBOARD_CAPTURE_BASELINE === "1";
  await page.setViewportSize({ width: info.project.name === "desktop" ? 1320 : info.project.name === "tablet" ? 768 : 390, height: 900 });
  await signIn(page, "MEMBER");
  let state = "empty";
  await page.route("**/api/member/verification", route => {
    const completed = state === "empty" ? 0 : state === "incomplete" ? 6 : 10;
    return route.fulfill({ json: {
      email: "member@example.test", emailVerified: completed === 10, verified: state === "verified", updateRequested: false,
      missing: [], reviews: state === "submitted" ? [{ status: "pending", reason: "" }] : [],
      progress: { total: 10, completed, percent: completed * 10, remaining: Array.from({ length: 10 - completed }, (_, index) => ({ id: `item-${index}`, label: index === 0 ? "Qualification" : `Required item ${index + 1}`, step: 0, href: "/member/application?step=0" })) },
    } });
  });
  for (const mode of ["light", "dark"]) {
    for (const value of ["empty", "incomplete", "complete", "submitted", "verified"]) {
      state = value;
      await page.goto("/member");
      await expect(page.getByText(`${value === "empty" ? 0 : value === "incomplete" ? 60 : 100}% complete`, { exact: true })).toBeVisible();
      await page.evaluate(value => document.documentElement.setAttribute("data-color-mode", value), mode);
      await layoutFits(page);
      if (!baseline) {
        await dashboardTextContrast(page);
        await primaryActionContrast(page);
        const profileCard = await page.locator('.member-overview-activity').boundingBox();
        expect(profileCard!.height).toBeLessThan(440);
        if (info.project.name === 'desktop') {
          const verificationCard = await page.locator('.member-verification').boundingBox();
          expect(profileCard!.y).toEqual(verificationCard!.y);
          expect(verificationCard!.height).toBeLessThan(500);
        }
        if (info.project.name === "phone") {
          for (const target of await page.locator('.member-home :is(.button, .member-service-tile)').all()) expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
        await expect(page.locator(".profile-completion-ready")).toHaveCount(value === "complete" ? 1 : 0);
        if (value === "complete") await expect(page.locator(".member-verification .member-card-heading [data-tone]")).toHaveText("Not verified");
        if (value === "submitted") await expect(page.locator(".member-verification .member-card-heading [data-tone]")).toHaveText("Under review");
        if (value === "verified") await expect(page.locator(".member-verification .member-card-heading [data-tone]")).toHaveText("Verified");
      }
      await page.screenshot({ path: info.outputPath(`member-${mode}-${value}.png`), fullPage: true });
    }
  }
  if (!baseline) {
    const tile = page.locator('#member-navigation a[href="/member/events"]');
    await tile.scrollIntoViewIfNeeded();
    const before = await tile.boundingBox();
    await tile.hover();
    await expect(tile).toHaveCSS("transform", "none");
    const after = await tile.boundingBox();
    expect(after).toEqual(before);
    await tile.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    expect(await tile.evaluate(el => el.matches(":focus-visible"))).toBeTruthy();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(tile).toHaveCSS("transition-duration", "0s");
  }
  await page.context().clearCookies();
  await signIn(page, "ADMIN");
  let alerts = [{ id: "verification", label: "2 applications awaiting profile review", href: "/admin/workspaces/verification", category: "Verification", priority: "Normal", count: 2 }];
  await page.route("**/api/attention", route => route.fulfill({ json: { items: alerts } }));
  await page.reload();
  for (const mode of ["light", "dark"]) {
    await page.evaluate(value => document.documentElement.setAttribute("data-color-mode", value), mode);
    await expect(page.getByRole("region", { name: "Needs attention", exact: true }).getByRole("link", { name: /2 applications/ })).toBeVisible();
    await layoutFits(page);
    if (!baseline) {
      await dashboardTextContrast(page);
      await expect(page.locator('.portal-overview .attention-row[data-tone="warning"]')).toHaveCount(1);
      const metrics = await page.locator(".service-metrics > a").evaluateAll(elements => elements.map(el => ({ count: Number(el.querySelector("strong")!.textContent), tone: el.getAttribute("data-tone") })));
      expect(metrics.every(metric => metric.count !== 0 || metric.tone !== "warning")).toBeTruthy();
      const row = page.locator('.portal-overview .attention-row').first();
      await row.scrollIntoViewIfNeeded();
      await row.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      expect(await row.evaluate(el => el.matches(':focus-visible'))).toBeTruthy();
      await row.hover();
      const hoverBackground = await row.evaluate(el => getComputedStyle(el).backgroundColor);
      await page.mouse.down();
      await expect(row).not.toHaveCSS('background-color', hoverBackground);
      await page.mouse.move(0, 0);
      await page.mouse.up();
      await row.blur();
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await page.screenshot({ path: info.outputPath(`admin-${mode}-pending.png`), fullPage: true });
  }
  alerts = [];
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("region", { name: "Needs attention", exact: true }).getByText("You’re up to date in your permitted workspaces.", { exact: true })).toBeVisible();
  if (!baseline) {
    const attentionLink = page.locator('#staff-navigation a').first();
    await attentionLink.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(attentionLink).toBeFocused();
    if (info.project.name === "phone") {
      for (const target of await page.locator('.service-metrics > a').all()) expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.goto('/');
    expect(await page.locator('main').evaluate(el => getComputedStyle(el).getPropertyValue('--dashboard-blue-bg'))).toBe('');
  }
});

for (const role of ["ADMIN", "MEMBER"] as const) {
  test(`${role.toLowerCase()} horizontal navigation scrolls without a sidebar`, async ({page}) => {
    await signIn(page, role);
    await page.setViewportSize({width:320,height:800});
    await mobileNavigation(page, "", role === "ADMIN" ? "#staff-navigation" : "#member-navigation");
    await layoutFits(page);
    await page.setViewportSize({width:1440,height:1000});
    expect(await page.locator("main h1").evaluate(el => el.getBoundingClientRect().top)).toBeLessThanOrEqual(200);
  });
}

test("member previews support copying, stable pinning and accessible dismissal", async ({page, context}, info) => {
  await signIn(page, "ADMIN");
  await page.goto("/admin/workspaces/members");
  const records = page.getByRole("region", {name: "Member register records", exact:true});
  const first = records.getByRole("button", {name:/^Open .* details$/}).first();
  await expect(first).toBeVisible();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  if (info.project.name === "desktop") {
    await first.hover();
    const quick = page.getByRole("dialog", {name:/quick preview/});
    await expect(quick).toBeVisible();
    await quick.hover();
    await expect(quick).toBeVisible();
    const copy = quick.getByRole("button", {name:/^Copy .*@/}).first();
    const copiedValue = (await copy.getAttribute("aria-label"))!.slice(5);
    await copy.click();
    await expect(quick.getByRole("status").filter({hasText:"Copied"})).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(copiedValue);
    await quick.getByRole("button", {name:"Open full details →"}).click();
  } else await first.click();
  const details = page.getByRole("dialog", {name:/member details$/});
  await expect(details).toBeVisible();
  const name = await details.getByRole("heading").first().textContent();
  if (info.project.name === "desktop" && await records.getByRole("button", {name:/^Open .* details$/}).count() > 1) {
    await records.getByRole("button", {name:/^Open .* details$/}).nth(1).hover();
    await expect(page.getByRole("dialog", {name:/quick preview/})).toHaveCount(0);
    await expect(details.getByRole("heading").first()).toHaveText(name!);
  }
  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);
  await expect(first).toBeFocused();
});

test("copy failure keeps the contact selectable and does not open a record", async ({page}) => {
  await signIn(page, "ADMIN");
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", {value:{writeText:async()=>{throw Error("Synthetic clipboard denial");}}}));
  await page.goto("/admin/workspaces/members");
  const region = page.getByRole("region", {name:"Member register records",exact:true});
  const copy = region.getByRole("button", {name:/^Copy .*@/}).first();
  await expect(copy).toBeVisible();
  await copy.click();
  await expect(region.getByRole("status").filter({hasText:"Clipboard unavailable"})).toBeVisible();
  await expect(page.getByRole("dialog", {name:/member details$/})).toHaveCount(0);
  expect(await copy.evaluate(element=>getComputedStyle(element).userSelect)).toBe("text");
});

test("member event layout separates attendance, guidance and event filtering", async ({ page }, info) => {
  await signIn(page, "MEMBER");
  await page.route("**/api/member/event-journey", route => route.fulfill({ json: { attendanceCount: 0, badges: [], resources: [] } }));
  await page.route("**/api/member/events", route => route.fulfill({ json: [] }));
  await page.goto("/member/events");
  await expect(page.getByRole("heading", { name: "Your event journey" })).toBeVisible();
  await expect(page.getByText("No milestone badges yet", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Event period")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Registration and attendance information" })).toBeVisible();
  await layoutFits(page);
  await page.screenshot({ path: info.outputPath("member-events-refined.png"), fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 });
  await layoutFits(page);
  await expect(page.getByLabel("Event period")).toBeVisible();
});

test("member notifications have readable controls, category states and keyboard dismissal", async ({ page }, info) => {
  await signIn(page, "MEMBER");
  let items: { id: string; label: string; href: string; category: string; priority: string; count: number }[] = [];
  await page.route("**/api/attention", route => route.fulfill({ json: { items } }));
  await page.goto("/member");
  const bell = page.getByRole("button", { name: /Notifications:/ });
  await bell.focus(); await page.keyboard.press("Enter");
  const panel = page.getByRole("region", { name: "Notifications", exact: true });
  await expect(panel.getByText("You’re all caught up")).toBeVisible();
  expect(await panel.getByLabel("Category").evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(40);
  await page.screenshot({ path: info.outputPath("notifications-refined.png") });
  await page.keyboard.press("Escape"); await expect(panel).toBeHidden(); await expect(bell).toBeFocused();
  items = [{ id: "fixture", label: "Review your saved profile details", href: "/member/application", category: "Verification", priority: "Normal", count: 1 }];
  await page.keyboard.press("Enter");
  await expect(panel.getByRole("link", { name: /Review your saved profile details/ })).toBeVisible();
  await panel.getByLabel("Category").selectOption("Account");
  await expect(panel.getByText("Nothing in this category")).toBeVisible();
  await panel.getByRole("button", { name: "Close notifications" }).click();
  await expect(bell).toBeFocused();
  await layoutFits(page);
});

test("profile submission confirms success, preserves the submitted copy and keeps failed attempts editable", async ({ page }, info) => {
  await signIn(page, "MEMBER");
  const fields = [
    { id: "fullName", label: "Full name", type: "text", step: 0, required: true, visible: true, categories: ["Professional"] },
    { id: "contributions", label: "Areas of interest", type: "multiselect", step: 2, required: false, visible: true, categories: ["Professional"], options: ["Mentoring", "Learning"] },
    { id: "declaration", label: "Declaration", type: "checkbox", step: 4, required: true, visible: true, categories: ["Professional"] },
  ];
  const draft = { version: 1, plan: "Annual", category: "Professional", details: { fullName: "Synthetic Test Member", contributions: '["Mentoring","Learning"]', declaration: "true" }, documentIds: [], step: 4 };
  const snapshot = { ...structuredClone(draft), submittedAt: "2026-10-28T10:00:00Z" };
  let submitted = false, fail = true;
  await page.route("**/api/member/application", route => route.fulfill({ json: draft }));
  await page.route("**/api/member/verification", route => {
    if (route.request().method() === "POST") {
      if (fail) return route.fulfill({ status: 409, json: { error: "Please reload your latest draft." } });
      submitted = true;
      return route.fulfill({ json: { submitted: true, id: "synthetic" } });
    }
    return route.fulfill({ json: { policy: { version: 1, fields }, email: "portal-member@example.invalid", emailVerified: true, verified: false, updateRequested: false, missing: [], reviews: submitted ? [{ status: "pending", reason: "", created_at: "2026-10-28T10:00:00Z" }] : [], latestSubmission: submitted ? snapshot : null } });
  });
  await page.goto("/member/application");
  const submit = page.getByRole("button", { name: "Submit for profile verification", exact: true });
  await expect(submit).toBeEnabled(); await submit.click();
  await expect(page.getByRole("status").filter({ hasText: "Please reload your latest draft" })).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden(); await expect(submit).toBeEnabled();
  fail = false; await submit.click();
  const dialog = page.getByRole("dialog", { name: "Profile submitted successfully" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "View submitted details" })).toBeFocused();
  await dialog.getByRole("button").click();
  await expect(page.getByRole("heading", { name: "Your submitted profile" })).toBeFocused();
  await expect(page.locator(".verification-summary-section").getByText("Confirmed", { exact: true })).toBeVisible();
  await expect(page.getByText("Mentoring, Learning", { exact: true })).toBeVisible();
  await expect(page.locator(".member-form-card")).toBeHidden();
  await layoutFits(page);
  await page.screenshot({ path: info.outputPath("profile-submitted-refined.png"), fullPage: true });
  // A subsequently saved draft must not replace the immutable submission receipt.
  draft.details.fullName = "Later draft name";
  await page.reload();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("Synthetic Test Member", { exact: true })).toBeVisible();
  await expect(page.getByText("Later draft name", { exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "Edit saved details" })).toBeVisible();
  await page.getByRole("button", { name: "Edit saved details" }).click();
  await expect(page.locator(".member-form-card")).toBeVisible();
  await expect(submit).toBeEnabled();
});
