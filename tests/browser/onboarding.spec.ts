import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../../src/lib/database-options";
import { openMail } from "../../src/lib/onboarding-mail";
test.beforeEach(() => {
  test.skip(
    !process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_"),
    "Requires an isolated database and mail sink.",
  );
});
test(
  "new account resumes details, verifies email, recovers password and stays signed in",
  { tag: "@onboarding" },
  async ({ page, context }, info) => {
    const db = new Pool(databaseOptions()),
      email = randomUUID() + "@example.invalid",
      password = "Browser-test-password-123!";
    try {
      await page.goto("/signup");
      await page.getByLabel("Full name", { exact: true }).fill("Browser test");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Password (12–128 characters)").fill(password);
      await page
        .getByRole("button", { name: "Create account", exact: true })
        .click();
      await expect(page).toHaveURL(/\/member$/);
      await expect(
        page.getByRole("heading", { name: "Your profile verification" }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: "Continue your details", exact: true })
        .click();
      await page
        .getByLabel("Qualification / course *")
        .fill("Test qualification");
      await expect(page.getByRole("status").last()).toHaveText("Saved");
      await page.reload();
      await expect(page.getByLabel("Qualification / course *")).toHaveValue(
        "Test qualification",
      );
      await page
        .getByRole("button", { name: "2. Personal details", exact: true })
        .click();
      await page.getByLabel("Father’s name (optional)").fill("Test parent");
      await expect(page.getByRole("status").last()).toHaveText("Saved");
      await page.reload();
      await expect(page.getByLabel("Father’s name (optional)")).toHaveValue(
        "Test parent",
      );
      await page
        .getByRole("button", { name: "3. Contact & preferences", exact: true })
        .click();
      await page.getByLabel("Mobile number *").fill("1234567890");
      await page
        .getByLabel("Correspondence address *")
        .selectOption("Residence");
      await page
        .getByLabel("Residence address (optional)")
        .fill("Test correspondence address");
      await expect(page.getByRole("status").last()).toHaveText("Saved");
      await page.reload();
      await expect(page.getByLabel("Mobile number *")).toHaveValue(
        "1234567890",
      );
      await page
        .getByRole("button", { name: "4. Evidence & referrals", exact: true })
        .click();
      await page
        .getByLabel("Proposer name (optional)")
        .fill("Unverified test referral");
      await expect(page.getByRole("status").last()).toHaveText("Saved");
      await page.getByLabel("Passport photograph *").setInputFiles({
        name: "test.png",
        mimeType: "image/png",
        buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      });
      await expect(page.getByRole("status").last()).toContainText(
        "being configured",
      );
      await page
        .getByRole("button", { name: "5. Review & declaration", exact: true })
        .click();
      await page.getByLabel("Typed applicant signature *").fill("Browser test");
      await expect(page.getByRole("status").last()).toHaveText("Saved");
      await page.reload();
      await expect(page.getByLabel("Typed applicant signature *")).toHaveValue(
        "Browser test",
      );
      await expect(
        page.getByRole("button", {
          name: "Submit for profile verification",
          exact: true,
        }),
      ).toBeDisabled();
      await page.screenshot({
        path: info.outputPath("five-step-review.png"),
        fullPage: true,
      });
      await expect(page.locator("body")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy();
      const user = (
        await db.query('SELECT id FROM public."user" WHERE email=$1', [email])
      ).rows[0];
      const verification = (
        await db.query(
          "SELECT payload FROM tpa.onboarding_mail WHERE user_id=$1 AND kind='verification' ORDER BY created_at DESC LIMIT 1",
          [user.id],
        )
      ).rows[0];
      const link = openMail(verification.payload)
        .text.split("\n")
        .find((x: string) => x.startsWith("http"));
      await page.goto(link);
      await expect
        .poll(
          async () =>
            (
              await db.query(
                'SELECT "emailVerified" FROM public."user" WHERE id=$1',
                [user.id],
              )
            ).rows[0].emailVerified,
        )
        .toBeTruthy();
      await page.goto("/member");
      await expect(
        page.getByRole("link", { name: "Continue your details", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Email: Verified", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Loading your profile…", { exact: true }),
      ).toHaveCount(0);
      const header = await page.locator(".account-header").boundingBox(),
        main = await page.locator("main").boundingBox();
      expect(header!.y + header!.height).toBeLessThanOrEqual(main!.y + 1);
      await page.screenshot({
        path: info.outputPath("member-dashboard.png"),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Sign out", exact: true })
        .first()
        .click();
      await expect(page).toHaveURL(/\/login$/);
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByLabel("Keep me signed in").check();
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/member$/);
      const storage = await context.storageState();
      expect(
        storage.cookies.some(
          (c) =>
            c.name.includes("session_token") &&
            c.expires > Date.now() / 1000 + 29 * 86400,
        ),
      ).toBeTruthy();
      const resumed = await context
        .browser()!
        .newContext({ storageState: storage });
      const tab = await resumed.newPage();
      await tab.goto(process.env.TPA_TEST_URL + "/member");
      await expect(
        tab.getByRole("heading", { name: "Your profile verification" }),
      ).toBeVisible();
      await resumed.close();
      await page.goto("/forgot-password");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page
        .getByRole("button", { name: "Send reset link", exact: true })
        .click();
      await expect
        .poll(
          async () =>
            (
              await db.query(
                "SELECT count(*)::int AS n FROM tpa.onboarding_mail WHERE user_id=$1 AND kind='recovery'",
                [user.id],
              )
            ).rows[0].n,
        )
        .toBeGreaterThan(0);
      const reset = (
        await db.query(
          "SELECT payload FROM tpa.onboarding_mail WHERE user_id=$1 AND kind='recovery' ORDER BY created_at DESC LIMIT 1",
          [user.id],
        )
      ).rows[0];
      const resetLink = openMail(reset.payload)
        .text.split("\n")
        .find((x: string) => x.startsWith("http"));
      await page.goto(resetLink);
      await page
        .getByLabel("New password", { exact: true })
        .fill("Replacement-password-123!");
      await page
        .getByLabel("Confirm new password", { exact: true })
        .fill("Replacement-password-123!");
      await page
        .getByRole("button", { name: "Reset password", exact: true })
        .click();
      await expect
        .poll(
          async () =>
            (
              await db.query(
                'SELECT count(*)::int AS n FROM public."session" WHERE "userId"=$1',
                [user.id],
              )
            ).rows[0].n,
        )
        .toBe(0);
    } finally {
      await db.end();
    }
  },
);

test("failed saves recover locally, reconnect saves, and stale tabs cannot overwrite", async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== "desktop" ||
      !process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_"),
    "Isolated desktop persistence check",
  );
  await page.goto("/signup");
  await page.getByLabel("Full name", { exact: true }).fill("Persistence test");
  await page
    .getByLabel("Email", { exact: true })
    .fill(randomUUID() + "@example.invalid");
  await page
    .getByLabel("Password (12–128 characters)")
    .fill("Persistence-password-123!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/member$/);
  await page
    .getByRole("link", { name: "Continue your details", exact: true })
    .click();
  const qualification = page.getByLabel("Qualification / course *");
  await qualification.fill("Server baseline");
  await expect(page.getByRole("status").last()).toHaveText("Saved");
  await page.route("**/api/member/application", async (route) => {
    if (route.request().method() === "POST") await route.abort();
    else await route.continue();
  });
  await qualification.fill("Recovered local change");
  await expect(page.getByRole("status").last()).not.toHaveText("Saved");
  await expect(page.getByRole("status").last()).toContainText(
    /fetch|failed|unavailable/i,
  );
  page.on("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Recover details", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/member/application");
  await page
    .getByRole("button", { name: "Recover details", exact: true })
    .click();
  await expect(qualification).toHaveValue("Recovered local change");
  await expect(page.getByRole("status").last()).toHaveText("Saved");
  await context.setOffline(true);
  await qualification.fill("Offline change");
  await expect(page.getByRole("status").last()).toContainText("Offline");
  await context.setOffline(false);
  await expect(page.getByRole("status").last()).toHaveText("Saved");
  const stale = await context.newPage();
  await stale.goto("/member/application");
  await expect(stale.getByLabel("Qualification / course *")).toHaveValue(
    "Offline change",
  );
  await qualification.fill("Winning tab");
  await expect(page.getByRole("status").last()).toHaveText("Saved");
  await stale.getByLabel("Qualification / course *").fill("Stale tab");
  await expect(stale.getByRole("status").last()).toContainText("another tab");
  await expect(
    stale.getByRole("button", {
      name: "Reload latest form (recovery retained)",
    }),
  ).toBeVisible();
  await page.reload();
  await expect(qualification).toHaveValue("Winning tab");
  await stale.close();
  await page.screenshot({
    path: info.outputPath("persistence-desktop.png"),
    fullPage: true,
  });
});
