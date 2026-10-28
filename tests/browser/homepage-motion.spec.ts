import { test, expect } from "@playwright/test";

test("homepage headings stay accessible and keyboard input settles motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute(
    "data-motion-ready",
    "true",
  );
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveAccessibleName(
    "Good people. Shared knowledge. Greater possibilities.",
  );
  expect(
    await heading.locator('[data-home-word][aria-hidden="true"]').count(),
  ).toBeGreaterThan(3);
  await page.keyboard.press("Tab");
  await expect(page.locator("main")).toHaveAttribute(
    "data-motion-state",
    "idle",
  );
  await expect(page.locator("html")).not.toHaveClass(/lenis/);
  const word = heading.locator("[data-home-word]").first();
  expect(await word.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  expect(await word.evaluate((el) => getComputedStyle(el).transform)).toBe(
    "none",
  );
  await page.locator(".v3-membership-grid").scrollIntoViewIfNeeded();
  await expect(page.locator("main")).toHaveAttribute(
    "data-motion-state",
    "idle",
  );
  await page.locator(".hero .button").first().focus();
  expect(
    await page
      .locator(".hero .button")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
});

test("reduced motion bypasses scrolling and leaves every section visible", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute(
    "data-motion-ready",
    "true",
  );
  await expect(page.locator("html")).not.toHaveClass(/lenis/);
  for (const selector of [
    ".hero h1",
    ".editorial-grid",
    ".v3-membership-grid",
    ".contact-intake",
  ]) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    await expect(page.locator(selector)).toBeVisible();
    expect(
      await page
        .locator(selector)
        .evaluate((el) => getComputedStyle(el).opacity),
    ).toBe("1");
  }
  await expect(page.locator("main")).not.toHaveAttribute(
    "data-motion-state",
    "running",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("changing motion preferences stops animations and preserves forms", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute(
    "data-motion-ready",
    "true",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("main")).toHaveAttribute(
    "data-motion-state",
    "idle",
  );
  await expect(page.locator("html")).not.toHaveClass(/lenis/);
  const form = page.locator("form.public-inquiry");
  await form.getByLabel("Full name", { exact: true }).fill("Synthetic Review");
  await expect(form.getByLabel("Full name", { exact: true })).toHaveValue(
    "Synthetic Review",
  );
  expect(await form.evaluate((el) => getComputedStyle(el).transform)).toBe(
    "none",
  );
});

test("one smooth-scroll owner cleans up when leaving the homepage", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute(
    "data-motion-ready",
    "true",
  );
  const fine = await page.evaluate(
    () => matchMedia("(hover: hover) and (pointer: fine)").matches,
  );
  if (fine)
    await expect(page.locator("main")).toHaveAttribute(
      "data-smooth-scroll",
      "lenis",
    );
  else await expect(page.locator("html")).not.toHaveClass(/lenis/);
  await page
    .locator(".hero")
    .screenshot({ path: info.outputPath("hero.png") });
  await page.keyboard.press("Tab");
  await page.locator(".hero .button").first().click();
  await expect(page).not.toHaveURL(/\/$/);
  await expect(page.locator("html")).not.toHaveClass(/lenis/);
});
