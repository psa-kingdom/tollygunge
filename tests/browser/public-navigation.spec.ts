import { test, expect } from "@playwright/test";

const pages = [
  "/",
  "/governance",
  "/membership",
  "/events",
  "/resources",
  "/contact",
];

test("public pages share a responsive footer and reachable section navigation", async ({
  page,
}, info) => {
  for (const path of pages) {
    await page.goto(path);
    const footer = page.locator("footer.footer-complete");
    await expect(footer.locator(".footer-group h2")).toHaveText([
      "Association",
      "Explore",
      "Connect",
    ]);
    await expect(footer.locator(".footer-group a")).toHaveCount(11);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      path,
    ).toBe(true);
    const positions = await footer
      .locator(".footer-group")
      .evaluateAll((nodes) =>
        nodes.map((el) => ({
          x: el.getBoundingClientRect().x,
          y: el.getBoundingClientRect().y,
        })),
      );
    expect(positions[1].x).toBeGreaterThan(positions[0].x);
    expect(Math.abs(positions[1].y - positions[0].y)).toBeLessThan(2);
    if (page.viewportSize()!.width > 600)
      expect(positions[2].x).toBeGreaterThan(positions[1].x);
    if (path !== "/") {
      const index = page.getByRole("navigation", {
        name: "On this page",
        exact: true,
      });
      const hrefs = await index
        .locator("a")
        .evaluateAll((nodes) => nodes.map((el) => el.getAttribute("href")!));
      for (const href of hrefs) await expect(page.locator(href)).toHaveCount(1);
      await index.locator("a").first().click();
      const top = await page
        .locator("#section-0")
        .evaluate((el) => el.getBoundingClientRect().top);
      const headerBottom = await page
        .locator("header.site-header")
        .evaluate((el) => el.getBoundingClientRect().bottom);
      expect(top).toBeGreaterThanOrEqual(headerBottom - 1);
    }
    await footer.screenshot({
      path: info.outputPath(`${path.slice(1) || "home"}-footer.png`),
    });
  }
});

test("native public disclosures close on Escape, outside click and destination selection", async ({
  page,
}) => {
  await page.goto("/governance");
  const desktop = page.viewportSize()!.width > 1100;
  const menu = desktop
    ? page.locator(".desktop-nav .nav-menu").nth(1)
    : page.locator(".mobile-nav");
  const trigger = menu.locator(":scope > summary");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open", "");
  await expect(trigger).toBeFocused();
  expect(
    await trigger.evaluate((el) => getComputedStyle(el).outlineStyle),
  ).not.toBe("none");
  await trigger.click();
  await expect(menu).toHaveAttribute("open", "");
  await page.mouse.click(5, 5);
  await expect(menu).not.toHaveAttribute("open", "");
  await trigger.click();
  if (!desktop)
    await menu.locator("nav details").nth(1).locator("summary").click();
  await menu
    .getByRole("link", { name: "Executive Committee", exact: true })
    .click();
  await expect(page).toHaveURL(/\/governance#section-0$/);
  await expect(menu).not.toHaveAttribute("open", "");
  await trigger.focus();
  await page.keyboard.press("Enter");
  const panel = desktop
    ? menu.locator(".dropdown")
    : menu.locator(":scope > nav");
  expect(
    await panel.evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  await page.keyboard.press("Escape");
});

test("320px menu scrolls within the viewport and closes after navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/resources");
  await page.locator(".mobile-nav > summary").click();
  const nav = page.getByRole("navigation", { name: "Mobile", exact: true });
  await nav.locator("details").nth(4).locator("summary").click();
  const rect = await nav.boundingBox();
  expect(rect!.x).toBeGreaterThanOrEqual(0);
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(321);
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(568);
  await nav.getByRole("link", { name: "Important Links", exact: true }).click();
  await expect(page).toHaveURL(/\/resources#section-3$/);
  await expect(page.locator(".mobile-nav")).not.toHaveAttribute("open", "");
});

test("contact optional details remain usable and inquiry failure preserves input", async ({
  page,
}) => {
  await page.goto("/contact");
  const form = page.locator("form.public-inquiry");
  await expect(form.locator(".inquiry-additional")).not.toHaveAttribute(
    "open",
    "",
  );
  await form
    .getByLabel("Full name", { exact: true })
    .fill("Synthetic Design Review");
  await form
    .getByLabel("Email address", { exact: true })
    .fill("design-review@example.invalid");
  await form
    .getByLabel("How can we help?", { exact: true })
    .fill("This is a synthetic interface check only.");
  await form.getByRole("checkbox").check();
  await form.locator(".inquiry-additional > summary").click();
  await form
    .getByLabel("Subject (optional)", { exact: true })
    .fill("Synthetic layout check");
  await page.route("**/api/inquiries", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Please try again later." }),
    }),
  );
  await form.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await expect(form.getByRole("status")).toContainText(
    "temporarily unavailable",
  );
  await expect(form.getByLabel("Email address", { exact: true })).toHaveValue(
    "design-review@example.invalid",
  );
  await expect(
    form.getByRole("button", { name: "Send inquiry", exact: true }),
  ).toBeEnabled();
});
