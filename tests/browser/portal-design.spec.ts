import { staffNavigation } from "../../src/domain/staff-navigation";
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
  const ratios = await page.locator('.application-completion strong, .profile-completion :is(strong, p, summary), .service-metrics :is(strong, .metric-label), #attention :is(strong, small), .member-service-tile :is(h3, p)').evaluateAll(elements => elements.filter(el => (el as HTMLElement).offsetHeight > 0).map(el => {
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
  const routes = ["/admin", ...staffNavigation(["administrator"]).flatMap(group=>group.items.map(item=>item.href)).filter(href=>href!=="/admin")];
  for (const route of routes.filter(route => route !== "/admin")) {
    await page.goto(route);
    await layoutFits(page);
    await expect(page.locator("#staff-navigation a[aria-current=page]")).toHaveCount(1);
  }
  await page.goto("/admin/workspaces/members");
  await expect(page.getByRole("region", { name: "Member register records", exact: true })).toBeVisible();
  await page.getByLabel("Search members", { exact: true }).fill("no-such-synthetic-member-48391");
  await page.getByRole("button", { name: "Search register", exact: true }).click();
  await expect(page.getByText(/No records match these filters/)).toBeVisible();
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

test("event creation stays simple, removed flyers stay unavailable and imports retain their workflow", async ({ page }, info) => {
  await signIn(page, "ADMIN");
  await page.route("**/api/staff/events?*", route => route.fulfill({ json: [] }));
  await page.route("**/api/staff/events", route => route.fulfill({ json: [] }));
  await page.route("**/api/staff/flyers", route => route.fulfill({ json: [] }));
  await page.goto("/admin/workspaces/events");
  await expect(page.getByRole("heading", {name:"Your next event starts here",exact:true})).toBeVisible();
  await primaryActionContrast(page);
  await page.getByRole("button",{name:"Create new event",exact:true}).first().click();
  const editor=page.getByRole("dialog",{name:"Create new event",exact:true});
  await expect(editor.getByLabel("Event title",{exact:true})).toBeVisible();
  await expect(editor.getByLabel("Starts · IST",{exact:true})).toBeVisible();
  await expect(editor.getByLabel("Venue or meeting link",{exact:true})).toBeVisible();
  await expect(editor.getByLabel("Participant limit",{exact:true})).toBeHidden();
  await editor.locator("summary").filter({hasText:"Booking settings"}).click();
  await expect(editor.getByLabel("Participant limit",{exact:true})).toHaveValue("50");
  await layoutFits(page);
  await page.screenshot({path:info.outputPath("event-editor.png"),fullPage:true});
  await editor.getByRole("button",{name:"Cancel",exact:true}).click();
  await page.goto("/admin/workspaces/flyers");
  await expect(page.getByRole("heading",{name:"A little off the beaten path.",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Generate preview",exact:true})).toHaveCount(0);
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
  const tools=page.getByRole("navigation",{name:"Communication tools",exact:true});
  for(const name of ["Email campaigns","Templates","Member invitations","Delivery activity","Inbox"]){
    const item=tools.getByRole("button",{name,exact:true});await item.click();
    await expect(item).toHaveAttribute("aria-current","page");
    await expect(page.locator("main h2").first()).toBeVisible();
    await layoutFits(page);
  }
  await page.screenshot({ path: info.outputPath("communications-inbox.png"), fullPage: true });
  await page.goto("/admin/workspaces/payments");
  await expect(page.getByRole("tab", { name: "Overview", exact: true })).toHaveAttribute("aria-selected", "true");
  const approvals=page.getByRole("tab",{name:/^Approvals/});
  await approvals.click();
  await expect(approvals).toHaveAttribute("aria-selected","true");
  await approvals.press("Home");
  await expect(page.getByRole("tab",{name:"Overview",exact:true})).toBeFocused();
  await expect(page.locator("#finance-panel-all")).toBeVisible();
  await layoutFits(page);
});


test("campaign steps preserve drafts and require a saved review before sending",async({page},info)=>{
  const actions:string[]=[];
  let saved={id:"synthetic-campaign",version:1,name:"",subject:"",body:"",audience:{city:"",profession:""},status:"draft"};
  await signIn(page,"ADMIN");
  await page.route("**/api/staff/campaigns**",async route=>{
    const request=route.request();const body=request.method()==="POST"?request.postDataJSON():null;
    if(body)actions.push(body.action);
    let response:unknown={campaigns:[]};
    if(body?.action==="save"){saved={...saved,...body,version:saved.version+1};response=saved;}
    else if(body?.action==="preview")response={matched:0,eligible:0,unsubscribed:0,unverified:0,preference_blocked:0,as_of:new Date().toISOString(),sample:[],audience:saved.audience};
    else if(body?.action==="review")response={campaign:saved,eligible:0,sample:[],reviewToken:"synthetic-review",readiness:{enabled:false,healthy:false,reasons:[]}};
    else if(request.url().includes("?id="))response={entry:saved,revisions:[],dispatches:[]};
    await route.fulfill({json:response});
  });
  await page.goto("/admin/workspaces/communications");
  await page.getByRole("button",{name:"Create email",exact:true}).click();
  const steps=page.getByRole("list",{name:"Email creation steps",exact:true});
  await expect(steps.getByRole("button",{name:/Review & send/})).toBeDisabled();
  await page.getByRole("button",{name:/Continue to message/}).click();
  await page.getByRole("textbox",{name:/^Email name/}).fill("Synthetic newsletter");
  await page.getByRole("textbox",{name:/^Subject line/}).fill("Synthetic subject");
  await page.getByRole("textbox",{name:/^Message/}).fill("Synthetic message for step navigation checks.");
  await page.getByRole("button",{name:/Save & review/}).click();
  await expect(page.getByRole("heading",{name:"Ready for a final check",exact:true})).toBeVisible();
  await expect(page.getByText("Sending is paused. Your draft is saved and ready for later.",{exact:true})).toBeVisible();
  await layoutFits(page);await page.screenshot({path:info.outputPath("campaign-review-step.png"),fullPage:true});
  await steps.getByRole("button",{name:/Message/}).click();
  await expect(page.getByRole("textbox",{name:/^Email name/})).toHaveValue("Synthetic newsletter");
  await page.getByRole("textbox",{name:/^Subject line/}).fill("Updated subject");
  await expect(steps.getByRole("button",{name:/Review & send/})).toBeDisabled();
  expect(actions).toEqual(["preview","save","review"]);
});

test("payments and email settings keep forms and empty states aligned", async ({ page }, info) => {
  await signIn(page, "ADMIN");
  let populated = false;
  await page.route(/\/api\/staff\/finance(?:\?.*)?$/, route => route.fulfill({json:{filters:{eventId:null},events:populated?[{id:"synthetic-event",title:"Synthetic event",location:"Test venue",starts_at:"2026-11-20T10:00:00Z",participant_count:1,status:"published"}]:[],entries:[],totals:{received:0,expenses:0,refunded:0,netResult:0,pendingReceipts:0,pendingExpenses:0},registrations:[],reviewer:false,actorId:"synthetic-admin"}}));
  await page.goto("/admin/workspaces/payments");
  await expect(page.getByText("No events yet.",{exact:true})).toBeVisible();
  await expect(page.getByRole("region",{name:"Event finance list",exact:true})).toHaveCount(0);
  await layoutFits(page);
  await page.screenshot({path:info.outputPath("finance-empty.png"),fullPage:true});
  populated=true;await page.reload();await page.getByRole("button",{name:"List view",exact:true}).click();
  const payments=page.getByRole("region",{name:"Event finance list",exact:true});
  await expect(payments.getByRole("table")).toBeVisible();
  const width=await payments.evaluate(el=>({region:el.clientWidth,table:el.querySelector("table")!.getBoundingClientRect().width}));
  expect(width.table).toBeGreaterThanOrEqual(width.region-2);
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

test("settings separates collection accounts and staff access from publishing", async ({ page }, info) => {
  await signIn(page, "ADMIN");
  await page.goto("/admin/workspaces/website");
  await expect(page).toHaveURL(/\/admin\/workspaces\/content$/);
  await expect(page.getByRole("heading", { name: "Publishing", exact: true })).toBeVisible();
  await page.goto("/admin/workspaces/payment-details");
  const settings = page.getByRole("navigation", { name: "Settings", exact: true });
  await expect(settings.getByRole("link")).toHaveCount(2);
  await expect(settings.getByRole("link", { name: "Website settings", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  const method = page.getByRole("combobox", { name: "Payment method", exact: true });
  await expect(page.getByLabel("UPI ID", { exact: true })).toBeVisible();
  await method.selectOption("bank");
  await expect(page.getByLabel("UPI ID", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Account number", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "← All accounts", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add account", exact: true })).toBeVisible();
  await layoutFits(page);
  await page.screenshot({ path: info.outputPath("collection-accounts.png"), fullPage: true });
  await settings.getByRole("link", { name: "Staff access", exact: true }).click();
  await expect(page.getByRole("region", { name: "Staff accounts", exact: true })).toBeVisible();
  await layoutFits(page);
  await page.screenshot({ path: info.outputPath("staff-access.png"), fullPage: true });
});

test("navigation keeps authentication isolated between requests", async ({ page }) => {
  await signIn(page, "ADMIN");
  await expect(page.locator("#staff-navigation")).toBeAttached();
  await page.context().clearCookies();
  await signIn(page, "MEMBER");
  await page.goto("/admin");
  await page.waitForURL("**/member/events");
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

test("member completion links to missing form steps and keeps approval separate",async({page},info)=>{
 await signIn(page,"MEMBER");
 const draft={version:1,plan:"Annual",category:"Professional",details:{fullName:"Synthetic member",phone:""},documentIds:[],step:4};
 const verification=await (await page.request.get("/api/member/verification")).json();
 await page.route("**/api/member/verification",route=>route.fulfill({json:{...verification,registeredContact:{email:verification.email,phone:""}}}));
 await page.route("**/api/member/application",async route=>{
   if(route.request().method()!=="GET") Object.assign(draft,route.request().postDataJSON(),{version:draft.version+1});
   await route.fulfill({json:draft});
 });
 await page.goto("/member/application?step=4");
 const progress=page.getByRole("progressbar");await expect(progress).toHaveAttribute("max","100");
 const before=Number(await progress.getAttribute("value"));expect(before).toBeLessThan(100);
 await expect(page.getByRole("region",{name:"Profile verification status"})).toHaveCount(0);
 await page.getByRole("button",{name:"Mobile number",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Personal details, contact & preferences",exact:true})).toBeAttached();
 await page.getByLabel("Mobile number *").fill("9876543210");
 await expect.poll(async()=>Number(await progress.getAttribute("value"))).toBeGreaterThan(before);
 await expect(page.getByRole("region",{name:"Profile verification status"})).toHaveCount(0);
 await layoutFits(page);await page.screenshot({path:info.outputPath("member-completion.png"),fullPage:true});
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
  await expect(page.getByRole("link", { name: "Directory", exact: true })).toHaveAttribute("aria-current", "page");
});

test("dashboard semantic colors cover themes, completion states and interactive feedback", async ({ page }, info) => {
  const baseline = process.env.TPA_DASHBOARD_CAPTURE_BASELINE === "1";
  await page.setViewportSize({ width: info.project.name === "desktop" ? 1320 : info.project.name === "tablet" ? 768 : 390, height: 900 });
  await signIn(page, "MEMBER");
  const baselineStatus=await (await page.request.get("/api/member/verification")).json();
  for(const mode of ["light","dark"]){
    for(const state of ["incomplete","submitted","verified"]){
      await page.route("**/api/member/verification",route=>route.fulfill({json:{...baselineStatus,verified:state==="verified",reviews:state==="submitted"?[{status:"pending",reason:""}]:[],latestSubmission:null}}));
      await page.goto("/member/application");
      await expect(page.getByRole("navigation",{name:"Application steps"})).toBeVisible();
      await expect(page.getByRole("region",{name:"Profile verification status"})).toHaveCount(0);
      await page.evaluate(value=>document.documentElement.setAttribute("data-color-mode",value),mode);
      await layoutFits(page);await dashboardTextContrast(page);
      if(await page.locator(".button:not(.secondary):not(:disabled)").count())await primaryActionContrast(page);
      await page.screenshot({path:info.outputPath(`member-${mode}-${state}.png`),fullPage:true});
      await page.unroute("**/api/member/verification");
    }
  }
  const tile=page.locator('#member-navigation a[href="/member/events"]');await tile.focus();await expect(tile).toBeFocused();
  await page.emulateMedia({reducedMotion:"reduce"});await expect(tile).toHaveCSS("transition-duration","0s");
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
      await expect(page.locator('#attention').getByRole('link',{name:/2 applications/})).toHaveCount(1);
      const metrics = await page.locator(".service-metrics > a").evaluateAll(elements => elements.map(el => ({ count: Number(el.querySelector("strong")!.textContent), tone: el.getAttribute("data-tone") })));
      expect(metrics.every(metric => metric.count !== 0 || metric.tone !== "warning")).toBeTruthy();
      const row=page.locator('#attention').getByRole('link',{name:/2 applications/});
      await row.scrollIntoViewIfNeeded();await row.focus();
      await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
      expect(await row.evaluate(el=>el.matches(':focus-visible'))).toBeTruthy();
      await row.hover();await expect(row).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await page.screenshot({ path: info.outputPath(`admin-${mode}-pending.png`), fullPage: true });
  }
  alerts = [];
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("region", { name: "Needs attention", exact: true }).getByText("You’re all caught up", { exact: true })).toBeVisible();
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

test("member event layout separates attendance history and upcoming registrations",async({page},info)=>{
 await signIn(page,"MEMBER");
 await page.route("**/api/member/event-journey",route=>route.fulfill({json:{attendanceCount:0,badges:[],resources:[],attendedEvents:[],historicalAttendance:[]}}));
 await page.route("**/api/member/events",route=>route.fulfill({json:[]}));
 await page.goto("/member/events");
 await expect(page.getByRole("heading",{name:"Your attendance",exact:true})).toBeVisible();
 await expect(page.getByText("No attended events are recorded for your membership yet.",{exact:false})).toBeVisible();
 await expect(page.getByLabel("From date",{exact:true})).toBeVisible();
 await expect(page.getByLabel("To date",{exact:true})).toBeVisible();
 await layoutFits(page);await page.screenshot({path:info.outputPath("member-events-refined.png"),fullPage:true});
 await page.setViewportSize({width:320,height:740});await layoutFits(page);
 await page.getByRole("button",{name:/^Upcoming registrations/}).click();
 await expect(page.getByText("You have no upcoming registrations.",{exact:false})).toBeVisible();
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
