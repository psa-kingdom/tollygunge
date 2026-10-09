import { test, expect, type BrowserContext } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { databaseOptions } from "../../src/lib/database-options";
import { staffNavigation } from "../../src/domain/staff-navigation";
test.beforeEach(() =>
  test.skip(
    !process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_"),
    "Isolated database required",
  ),
);
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
      [id, "UX test administrator", id + "@example.invalid"],
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
async function noOverflow(page: import("@playwright/test").Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
}
test("appearance controls persist, synchronise tabs, follow system and preserve public layouts", async ({
  page,
  context,
}, info) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-mode", "system");
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  await page.getByRole("button", { name: "Appearance settings" }).click();
  await page.getByRole("radio", { name: "Light", exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute(
    "data-color-mode",
    "light",
  );
  await expect(
    page.getByRole("button", { name: "Themes Coming later" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Appearance settings" }),
  ).toBeFocused();
  const second = await context.newPage();
  await second.goto("/about");
  await expect(second.locator("html")).toHaveAttribute("data-mode", "light");
  await page.getByRole("button", { name: "Appearance settings" }).click();
  await page.getByRole("radio", { name: "Dark", exact: true }).check();
  await expect(second.locator("html")).toHaveAttribute(
    "data-color-mode",
    "dark",
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  for (const route of [
    "/",
    "/about",
    "/governance",
    "/membership",
    "/events",
    "/resources",
    "/contact",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/invitation",
    "/email-verification",
    "/unsubscribe",
  ]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await noOverflow(page);
  }
  await page.goto("/login");
  await page.getByRole("button", { name: "Appearance settings" }).click();
  await page.getByRole("radio", { name: "System", exact: true }).check();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute(
    "data-color-mode",
    "light",
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: info.outputPath("authentication-dark.png"),
    fullPage: true,
  });
  await second.close();
});
test("staff header, command search, record links and all admin layouts remain usable", async ({
  page,
  context,
}, info) => {
  const id = await staff(context);
  if (info.project.name === "desktop")
    await page.setViewportSize({ width: 1123, height: 930 });
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Needs attention" }),
  ).toBeVisible();
  await expect(page.locator(".staff-sidebar-footer")).toHaveCount(0);
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Your profile", exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Dark", exact: true }).check();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Account menu", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: /Notifications:/ }).click();
  await expect(page.getByLabel("Category", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByLabel("Search your permitted workspaces and records")
    .fill(id);
  const result = page
    .locator(".command-results a")
    .filter({ hasText: id + "@example.invalid" });
  await expect(result.first()).toBeVisible();
  await result.first().click();
  await expect(page.locator(".directory-preview")).toContainText(
    id + "@example.invalid",
  );
  for (const destination of staffNavigation(["administrator"]).flatMap(
    (g) => g.items,
  )) {
    await page.goto(destination.href);
    await expect(page.locator("main")).toBeVisible();
    await noOverflow(page);
  }
  await page.goto("/admin/workspaces/verification");
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue(
    "pending",
  );
  await expect(
    page.getByRole("textbox", { name: "Decision reason" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("verification-dark.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("radio", { name: "Light", exact: true }).check();
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: info.outputPath("verification-light.png"),
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Requirements", exact: true }).click();
  await expect(page.locator(".requirements-step")).toHaveCount(5);
  await noOverflow(page);
  await page.goto("/admin");
  await page.screenshot({
    path: info.outputPath("admin-bento.png"),
    fullPage: true,
  });
});
test("verification reasons belong to one record and corrections preserve an existing badge", async ({
  page,
  context,
}, info) => {
  await staff(context);
  const response = await context.request.get(
    process.env.TPA_TEST_URL! + "/api/staff/verification",
  );
  expect(response.ok()).toBeTruthy();
  const policy = (await response.json()).policy;
  const db = new Pool(databaseOptions());
  const marker = "Review UX " + randomUUID().slice(0, 8);
  const people: string[] = [],
    reviews: string[] = [];
  try {
    for (let i = 0; i < 2; i++) {
      const user = randomUUID(),
        person = randomUUID(),
        review = randomUUID();
      people.push(person);
      reviews.push(review);
      const body = {
        name: marker + " " + i,
        phone: "",
        organization: "",
        profession: "",
        jobTitle: "",
        city: "",
        biography: "",
        portraitId: null,
        portraitKind: "profile",
        links: [],
        assignments: [],
      };
      await db.query(
        'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',
        [user, body.name, user + "@example.invalid"],
      );
      await db.query(
        "INSERT INTO tpa.people(id,user_id,accepted,draft,accepted_verified) VALUES($1,$2,$3,$3,$4)",
        [person, user, body, i === 0],
      );
      await db.query(
        "INSERT INTO tpa.verification_submissions(id,user_id,person_id,requirement_version,snapshot,person_snapshot) VALUES($1,$2,$3,$4,$5,$6)",
        [
          review,
          user,
          person,
          policy.version,
          {
            category: "Professional",
            personVersion: 1,
            details: { fullName: body.name },
          },
          body,
        ],
      );
    }
    await page.goto("/admin/workspaces/verification");
    await page.getByLabel("Search names or email").fill(marker);
    await page
      .locator(".review-list")
      .getByRole("button")
      .filter({ hasText: marker + " 0" })
      .click();
    await expect(page.locator(".review-detail")).toContainText(
      "Existing verified badge remains active.",
    );
    await page
      .getByRole("button", { name: "Request corrections", exact: true })
      .click();
    await page
      .getByLabel("Reason (required)", { exact: true })
      .fill("Reason only for first account");
    if (info.project.name !== "desktop")
      await page.getByRole("button", { name: "Back to records" }).click();
    await page
      .locator(".review-list")
      .getByRole("button")
      .filter({ hasText: marker + " 1" })
      .click();
    await page
      .getByRole("button", { name: "Request corrections", exact: true })
      .click();
    await expect(
      page.getByLabel("Reason (required)", { exact: true }),
    ).toHaveValue("");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    if (info.project.name !== "desktop")
      await page.getByRole("button", { name: "Back to records" }).click();
    await page
      .locator(".review-list")
      .getByRole("button")
      .filter({ hasText: marker + " 0" })
      .click();
    await page
      .getByRole("button", { name: "Request corrections", exact: true })
      .click();
    await page
      .getByLabel("Reason (required)", { exact: true })
      .fill("Please update the certificate.");
    await page.screenshot({
      path: info.outputPath("selected-review-action.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Confirm decision", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Saved." }),
    ).toBeVisible();
    expect(
      (
        await db.query("SELECT accepted_verified FROM tpa.people WHERE id=$1", [
          people[0],
        ])
      ).rows[0].accepted_verified,
    ).toBe(true);
    expect(
      (
        await db.query(
          "SELECT status,reason FROM tpa.verification_submissions WHERE id=$1",
          [reviews[0]],
        )
      ).rows[0],
    ).toEqual({
      status: "corrections",
      reason: "Please update the certificate.",
    });
    await noOverflow(page);
  } finally {
    await db.end();
  }
});
