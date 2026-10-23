import { test, expect, type BrowserContext } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { databaseOptions } from "../../src/lib/database-options";
import { sharedDefaults } from "../../src/domain/website-settings";

const stage = process.env.TPA_LOGO_STAGE || "after";
const root = `output/playwright/phase8b/${stage}`;
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "desktop",
    "This suite explicitly covers all four viewport sizes",
  );
  test.skip(
    !process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_"),
    "Isolated database required",
  );
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(
    new URL(process.env.DATABASE_URL!).hostname,
  );
});
async function staff(context: BrowserContext) {
  const db = new Pool(databaseOptions());
  const id = randomUUID(),
    token = randomBytes(24).toString("hex");
  try {
    expect((await db.query("SELECT current_database() n")).rows[0].n).toBe(
      process.env.TPA_DATABASE_NAME,
    );
    await db.query(
      'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',
      [id, "Synthetic logo reviewer", id + "@example.invalid"],
    );
    await db.query(
      "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')",
      [id],
    );
    await db.query(
      'INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())',
      [randomUUID(), token, id],
    );
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: encodeURIComponent(
          token +
            "." +
            createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
              .update(token)
              .digest("base64"),
        ),
        url: process.env.TPA_TEST_URL!,
      },
    ]);
    return id;
  } finally {
    await db.end();
  }
}

test("logo reserves space, retains accessible links on failure and respects published overrides", async ({
  page,
  context,
}) => {
  test.skip(stage === "before", "Post-integration behavior");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-mode", "system");
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  const brand = page.locator(".site-header .brand");
  await expect(brand).toHaveAccessibleName(
    /Tollygunge Professional Association homepage/i,
  );
  await expect(brand.locator("img")).toHaveAttribute("alt", "");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    /icon\.png/,
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    /apple-icon\.png/,
  );
  await page.evaluate(() => document.fonts.ready);
  const before = await brand.boundingBox();
  await page.route("**/design/tpa-logo.png", (route) => route.abort());
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await expect(brand).toHaveAccessibleName(
    /Tollygunge Professional Association homepage/i,
  );
  expect(await brand.boundingBox()).toEqual(before);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute(
    "data-color-mode",
    "light",
  );
  await page.unroute("**/design/tpa-logo.png");
  const actor = await staff(context);
  const db = new Pool(databaseOptions()),
    mediaId = randomUUID();
  const previous = (
    await db.query("SELECT * FROM tpa.website_settings WHERE key='shared'")
  ).rows[0];
  try {
    const body = JSON.stringify({ ...sharedDefaults, logoMediaId: mediaId });
    await db.query(
      "INSERT INTO tpa.website_settings(key,draft,published,updated_by) VALUES('shared',$1,$1,$2) ON CONFLICT(key) DO UPDATE SET draft=$1,published=$1",
      [body, actor],
    );
    // Synthetic non-square published-media response; no external storage operation.
    await page.route(`**/media/${mediaId}`, (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80"><rect width="240" height="80" fill="navy"/></svg>',
      }),
    );
    await page.goto("/", {waitUntil:"networkidle"});
    await expect(brand.locator("img")).toHaveAttribute(
      "src",
      `/media/${mediaId}`,
    );
    await expect(brand.locator("img")).toHaveJSProperty("naturalWidth", 240);
    expect(
      await brand
        .locator("img")
        .evaluate((el) => getComputedStyle(el).objectFit),
    ).toBe("contain");
    await page.goto("/admin");
    await expect(
      page.locator(".staff-sidebar img[data-tpa-logo]"),
    ).toHaveAttribute("src", "/design/tpa-logo.png");
    await page.goto("/missing/phase8b-logo");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "TPA homepage", exact: true }),
    ).toBeFocused();
  } finally {
    if (previous)
      await db.query(
        "UPDATE tpa.website_settings SET draft=$1,published=$2 WHERE key='shared'",
        [previous.draft, previous.published],
      );
    else await db.query("DELETE FROM tpa.website_settings WHERE key='shared'");
    await db.end();
  }
});

test("logo in actual database outage recovery", async ({ page }) => {
  test.skip(
    !process.env.TPA_FALLBACK_OUTAGE_URL,
    "Requires isolated outage server",
  );
  await mkdir(root, { recursive: true });
  for (const width of [320, 390, 768, 1440])
    for (const mode of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme: mode });
      await page.goto(process.env.TPA_FALLBACK_OUTAGE_URL!);
      await expect(
        page.getByRole("heading", { name: "Let’s try that again." }),
      ).toBeVisible();
      await expect(page.locator("img[data-tpa-logo]")).toHaveJSProperty(
        "naturalWidth",
        1139,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `${root}/error-${width}-${mode}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
});

for (const width of [320, 390, 768, 1440]) {
  for (const mode of ["light", "dark"] as const) {
    test(`logo surfaces ${width} ${mode}`, async ({ page, context }) => {
      await mkdir(root, { recursive: true });
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme: mode });
      const capture = async (name: string) => {
        await page.evaluate(() => document.fonts.ready);
        if (stage === "after") {
          const images = page.locator("img[data-tpa-logo]");
          expect(await images.count()).toBeGreaterThan(0);
          for (const img of await images.all()) {
            await expect(img).toHaveJSProperty("complete", true);
            await expect.poll(
              () => img.evaluate((el: HTMLImageElement) => el.naturalWidth),
            ).toBeGreaterThan(0);
            expect(
              await img.evaluate((el) => getComputedStyle(el).objectFit),
            ).toBe("contain");
          }
        }
        await page.screenshot({
          path: `${root}/${name}-${width}-${mode}.png`,
          fullPage: true,
          animations: "disabled",
        });
      };
      await page.goto("/", {waitUntil:"networkidle"});
      await expect(page.locator("html")).toHaveAttribute(
        "data-color-mode",
        mode,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await capture("home");
      if (width <= 768) {
        await page.locator(".mobile-nav > summary").click();
        await capture("mobile-menu");
      }
      for (const [name, url] of [
        ["login", "/login"],
        ["verification", "/email-verification"],
        ["reset", "/reset-password"],
        ["404", "/missing/phase8b-logo"],
        ["preview", "/preview/admin"],
      ]) {
        await page.goto(url, {waitUntil:"networkidle"});
        await capture(name);
      }
      await staff(context);
      for (const [name, url] of [
        ["account", "/account/profile"],
        ["admin", "/admin"],
        ["settings", "/admin/workspaces/website"],
      ]) {
        await page.goto(url, {waitUntil:"networkidle"});
        await expect(page).toHaveURL(new RegExp(url + "$"));
        if (name === "settings") {
          await expect(page.locator(".content-editor-columns")).toBeVisible();
          if (stage === "after")
            await expect(
              page.frameLocator("iframe").locator("img[data-tpa-logo]").first(),
            ).toHaveJSProperty("naturalWidth", 1139);
        }
        await capture(name);
      }
    });
  }
}
