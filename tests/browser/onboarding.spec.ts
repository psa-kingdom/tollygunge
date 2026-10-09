import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../../src/lib/database-options";
import { openMail } from "../../src/lib/onboarding-mail";
import { createEmailVerificationToken } from "better-auth/api";
test.beforeEach(async () => {
  test.skip(
    !process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_"),
    "Requires an isolated database and mail sink.",
  );
  // Each journey models a different visitor. Keep the production limiter active,
  // but do not share its synthetic loopback bucket between isolated test cases.
  const db = new Pool(databaseOptions());
  try {
    const actual = (await db.query("SELECT current_database() AS name")).rows[0]
      .name;
    expect(actual).toBe(process.env.TPA_DATABASE_NAME);
    await db.query('DELETE FROM public."rateLimit"');
  } finally {
    await db.end();
  }
});
test("verification links show their own account for signed-out visitors and an unrelated staff session", async ({
  browser,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Session boundaries are independent of viewport.",
  );
  const db = new Pool(databaseOptions());
  const target = await browser.newContext(),
    staff = await browser.newContext();
  const origin = process.env.TPA_TEST_URL!;
  const targetEmail = randomUUID() + "@example.invalid",
    staffEmail = randomUUID() + "@example.invalid";
  try {
    for (const [context, email] of [
      [target, targetEmail],
      [staff, staffEmail],
    ] as const) {
      const response = await context.request.post(
        origin + "/api/auth/sign-up/email",
        {
          headers: { origin },
          data: {
            name: "Verification link test",
            email,
            password: "Browser-test-password-123!",
          },
        },
      );
      expect(response.ok()).toBeTruthy();
    }
    const staffId = (
      await db.query('SELECT id FROM public."user" WHERE email=$1', [
        staffEmail,
      ])
    ).rows[0].id;
    await db.query(
      'UPDATE public."user" SET "emailVerified"=true WHERE id=$1',
      [staffId],
    );
    await db.query(
      "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')",
      [staffId],
    );
    const payload = (
      await db.query(
        "SELECT payload FROM tpa.onboarding_mail WHERE recipient=$1 AND kind='verification' ORDER BY created_at DESC LIMIT 1",
        [targetEmail],
      )
    ).rows[0].payload;
    const link = openMail(payload)
      .text.split("\n")
      .find((line: string) => line.startsWith("http"))!;
    await target.clearCookies();
    const anonymousPage = await target.newPage();
    await anonymousPage.goto(link);
    await expect(
      anonymousPage.getByRole("heading", {
        name: "Email verified.",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      anonymousPage.getByRole("link", {
        name: "Sign in to your verified account",
        exact: true,
      }),
    ).toBeVisible();
    const staffPage = await staff.newPage();
    await staffPage.goto(link);
    await expect(
      staffPage.getByRole("heading", { name: "Email verified.", exact: true }),
    ).toBeVisible();
    await expect(
      staffPage.getByText("You are currently signed in as", { exact: false }),
    ).toContainText(staffEmail);
    const session = await staff.request.get(origin + "/api/auth/get-session");
    expect((await session.json()).user.id).toBe(staffId);
    await staffPage
      .getByRole("link", { name: "Continue current account", exact: true })
      .click();
    await expect(staffPage).toHaveURL(/\/admin$/);
    await staffPage.goto(
      origin + "/login?switch=1&email=" + encodeURIComponent(targetEmail),
    );
    await expect(
      staffPage.getByRole("heading", {
        name: "Sign in to another account.",
        exact: true,
      }),
    ).toBeVisible();
    await expect(staffPage.getByLabel("Email", { exact: true })).toHaveValue(
      targetEmail,
    );
    expect(
      (await (await staff.request.get(origin + "/api/auth/get-session")).json())
        .user.id,
    ).toBe(staffId);
    const recovery = await staff.request.post(
      origin + "/api/auth/request-password-reset",
      {
        headers: { origin },
        data: { email: targetEmail, redirectTo: origin + "/reset-password" },
      },
    );
    expect(recovery.ok()).toBeTruthy();
    const resetPayload = (
      await db.query(
        "SELECT payload FROM tpa.onboarding_mail WHERE recipient=$1 AND kind='recovery' ORDER BY created_at DESC LIMIT 1",
        [targetEmail],
      )
    ).rows[0].payload;
    const resetLink = openMail(resetPayload)
      .text.split("\n")
      .find((line: string) => line.startsWith("http"))!;
    await staffPage.goto(resetLink);
    await staffPage
      .getByLabel("New password", { exact: true })
      .fill("Cross-account-recovery-password-123!");
    await staffPage
      .getByLabel("Confirm new password", { exact: true })
      .fill("Cross-account-recovery-password-123!");
    await staffPage
      .getByRole("button", { name: "Reset password", exact: true })
      .click();
    await expect(
      staffPage.getByRole("heading", { name: "Password saved.", exact: true }),
    ).toBeVisible();
    expect(
      (await (await staff.request.get(origin + "/api/auth/get-session")).json())
        .user.id,
    ).toBe(staffId);
    await staffPage
      .getByRole("link", {
        name: "Sign in with your new password",
        exact: true,
      })
      .click();
    await expect(
      staffPage.getByRole("heading", {
        name: "Sign in to another account.",
        exact: true,
      }),
    ).toBeVisible();
    await staffPage.getByLabel("Email", { exact: true }).fill(targetEmail);
    await staffPage
      .getByLabel("Password", { exact: true })
      .fill("Cross-account-recovery-password-123!");
    await staffPage
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(staffPage).toHaveURL(/\/member$/);
    expect(
      (await (await staff.request.get(origin + "/api/auth/get-session")).json())
        .user.email,
    ).toBe(targetEmail);
    const expired = await createEmailVerificationToken(
      process.env.BETTER_AUTH_SECRET!,
      targetEmail,
      undefined,
      -60,
    );
    await anonymousPage.goto(
      origin +
        "/api/auth/verify-email?token=" +
        expired +
        "&callbackURL=%2Fmember",
    );
    await expect(
      anonymousPage.getByRole("heading", {
        name: "Verification link expired.",
        exact: true,
      }),
    ).toBeVisible();
    await anonymousPage.goto(
      origin + "/api/auth/verify-email?token=invalid&callbackURL=%2Fmember",
    );
    await expect(
      anonymousPage.getByRole("heading", {
        name: "Check your verification link.",
        exact: true,
      }),
    ).toBeVisible();
    await anonymousPage.goto(
      origin + "/email-verification?status=verified&email=fake@example.invalid",
    );
    await expect(
      anonymousPage.getByRole("heading", {
        name: "Email verified.",
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    await target.close();
    await staff.close();
    await db.end();
  }
});
test("invitation activation offers explicit sign-in when another staff account is active", async ({
  browser,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Session boundaries are independent of viewport.",
  );
  const db = new Pool(databaseOptions()),
    context = await browser.newContext();
  const origin = process.env.TPA_TEST_URL!,
    staffEmail = randomUUID() + "@example.invalid",
    email = randomUUID() + "@example.invalid";
  try {
    expect(
      (
        await context.request.post(origin + "/api/auth/sign-up/email", {
          headers: { origin },
          data: {
            name: "Invitation test staff",
            email: staffEmail,
            password: "Browser-test-password-123!",
          },
        })
      ).ok(),
    ).toBeTruthy();
    const staffId = (
      await db.query('SELECT id FROM public."user" WHERE email=$1', [
        staffEmail,
      ])
    ).rows[0].id;
    await db.query(
      'UPDATE public."user" SET "emailVerified"=true WHERE id=$1',
      [staffId],
    );
    await db.query(
      "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')",
      [staffId],
    );
    const preview = await context.request.post(
      origin + "/api/staff/onboarding-import",
      {
        headers: { origin },
        multipart: {
          file: {
            name: "invite.csv",
            mimeType: "text/csv",
            buffer: Buffer.from("name,email\nInvited browser member," + email),
          },
          mapping: JSON.stringify({ name: "name", email: "email" }),
        },
      },
    );
    expect(preview.ok()).toBeTruthy();
    const id = (await preview.json()).id;
    expect(
      (
        await context.request.post(origin + "/api/staff/onboarding-import", {
          headers: { origin },
          data: { action: "commit", id },
        })
      ).ok(),
    ).toBeTruthy();
    const payload = (
      await db.query(
        "SELECT payload FROM tpa.onboarding_mail WHERE recipient=$1 AND kind='invitation' ORDER BY created_at DESC LIMIT 1",
        [email],
      )
    ).rows[0].payload;
    const link = openMail(payload)
      .text.split("\n")
      .find((line: string) => line.startsWith("http"))!;
    const page = await context.newPage();
    await page.goto(link);
    await page
      .getByLabel("New password", { exact: true })
      .fill("Invited-browser-password-123!");
    await page
      .getByRole("button", { name: "Set password", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Account activated.", exact: true }),
    ).toBeVisible();
    expect(
      (
        await (
          await context.request.get(origin + "/api/auth/get-session")
        ).json()
      ).user.id,
    ).toBe(staffId);
    await page
      .getByRole("link", { name: "Sign in to your account", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Sign in to another account.",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .fill("Invited-browser-password-123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/member$/);
    expect(
      (
        await (
          await context.request.get(origin + "/api/auth/get-session")
        ).json()
      ).user.email,
    ).toBe(email);
  } finally {
    await context.close();
    await db.end();
  }
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
      await expect(
        page.getByRole("heading", { name: "Edit person", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Continue your details", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: info.outputPath("member-dashboard-unverified.png"),
        fullPage: true,
      });
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
      await page.getByText("Family & health details", { exact: false }).click();
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
      await page.locator("summary").filter({ hasText: "Referrals" }).click();
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
      await expect(
        page.getByRole("heading", { name: "Email verified.", exact: true }),
      ).toBeVisible();
      await expect(page.getByText(email, { exact: true })).toBeVisible();
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
      await expect(
        page.getByRole("heading", { name: "Password saved.", exact: true }),
      ).toBeVisible();
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
      await page
        .getByRole("link", {
          name: "Sign in with your new password",
          exact: true,
        })
        .click();
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page
        .getByLabel("Password", { exact: true })
        .fill("Replacement-password-123!");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/member$/);
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

test("member dashboard separates verification states and keeps the editor off the landing page", async ({
  page,
}, info) => {
  const origin = process.env.TPA_TEST_URL!;
  const email = randomUUID() + "@example.invalid";
  const signup = await page.request.post(origin + "/api/auth/sign-up/email", {
    headers: { origin },
    data: {
      name: "Portal design test",
      email,
      password: "Browser-test-password-123!",
    },
  });
  expect(signup.ok()).toBeTruthy();
  const states = [
    {
      label: "Not verified",
      verified: false,
      updateRequested: false,
      reviews: [],
    },
    {
      label: "Under review",
      verified: false,
      updateRequested: false,
      reviews: [{ status: "pending", reason: "" }],
    },
    {
      label: "Corrections requested",
      verified: false,
      updateRequested: false,
      reviews: [
        {
          status: "corrections",
          reason: "Please upload a clearer certificate.",
        },
      ],
    },
    { label: "Verified", verified: true, updateRequested: false, reviews: [] },
    {
      label: "Verified · Update requested",
      verified: true,
      updateRequested: true,
      reviews: [],
    },
  ];
  for (const [index, state] of states.entries()) {
    await page.route("**/api/member/verification", (route) =>
      route.fulfill({
        json: {
          email,
          emailVerified: index > 0,
          missing: index > 2 ? [] : ["Photograph"],
          ...state,
        },
      }),
    );
    await page.goto("/member");
    await expect(page.locator(".member-badge")).toHaveText(state.label);
    await expect(
      page.getByRole("heading", { name: "Edit person", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Manage profile", exact: false }),
    ).toBeVisible();
    if (state.reviews[0]?.reason)
      await expect(page.getByText(state.reviews[0].reason)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.getByRole("link", { name: "Overview", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Verification", exact: true }),
    ).toBeFocused();
    await page.screenshot({
      path: info.outputPath(`dashboard-state-${index}.png`),
      fullPage: true,
    });
    await page.unroute("**/api/member/verification");
  }
});
