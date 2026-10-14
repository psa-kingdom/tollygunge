import { test, expect, type BrowserContext } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { databaseOptions } from "../../src/lib/database-options";
test.beforeEach(() =>
  test.skip(
    !process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_"),
    "Isolated database required",
  ),
);
async function signedIn(context: BrowserContext, finance: boolean) {
  const db = new Pool(databaseOptions()),
    id = randomUUID(),
    token = randomBytes(24).toString("hex");
  try {
    expect((await db.query("SELECT current_database() n")).rows[0].n).toBe(
      process.env.TPA_DATABASE_NAME,
    );
    await db.query(
      'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Payment browser fixture\',$2,true)',
      [id, id + "@example.invalid"],
    );
    await db.query(
      'INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())',
      [randomUUID(), token, id],
    );
    if (finance)
      await db.query(
        "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'finance_operator')",
        [id],
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
test("bank editor, saved activation and member display remain responsive", async ({
  page,
  context,
  browser,
}) => {
  const db = new Pool(databaseOptions()),
    finance = await signedIn(context, true),
    memberContext = await browser.newContext({
      viewport: page.viewportSize()!,
    }),
    member = await signedIn(memberContext, false),
    label = "Synthetic bank " + randomUUID();
  let paymentId: string | undefined;
  try {
    await page.goto("/admin/workspaces/payments", {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByRole("combobox", { name: "Payment method", exact: true })
      .selectOption("bank");
    await page.getByLabel("Label", { exact: true }).fill(label);
    await page
      .getByLabel("Payee name", { exact: true })
      .fill("Synthetic association");
    await page
      .getByLabel("Account number", { exact: true })
      .fill("00123456789");
    await page.getByLabel("IFSC", { exact: true }).fill("ABCD0123456");
    await page.getByLabel("Bank", { exact: true }).fill("Synthetic bank");
    await page.getByLabel("Branch", { exact: true }).fill("Synthetic branch");
    await expect(page.getByLabel("UPI ID", { exact: true })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Upload QR photo", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Save draft details", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Draft saved" }),
    ).toBeVisible();
    paymentId = (
      await db.query(
        "SELECT id FROM tpa.payment_details WHERE draft->>'label'=$1",
        [label],
      )
    ).rows[0].id;
    await expect(
      page.getByRole("button", { name: "Activate saved revision" }),
    ).toBeDisabled();
    await page
      .getByLabel(
        "I verified that the saved payment instructions and payee belong to TPA.",
      )
      .check();
    await page.getByRole("button", { name: "Activate saved revision" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "set to active" }),
    ).toBeVisible();
    const memberPage = await memberContext.newPage();
    await memberPage.goto("/member/payments", {
      waitUntil: "domcontentloaded",
    });
    const section = memberPage.locator("section").filter({
      has: memberPage.getByRole("heading", { name: label, exact: true }),
    });
    await expect(section).toContainText("00123456789");
    await expect(section).toContainText("ABCD0123456");
    await expect(section).not.toContainText("UPI ID");
    for (const p of [page, memberPage])
      expect(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBeTruthy();
  } finally {
    if (paymentId) {
      await db.query(
        "DELETE FROM tpa.payment_detail_revisions WHERE detail_id=$1",
        [paymentId],
      );
      await db.query("DELETE FROM tpa.payment_details WHERE id=$1", [
        paymentId,
      ]);
    }
    await db.query(
      "DELETE FROM tpa.audit_events WHERE actor_user_id=ANY($1::text[])",
      [[finance, member]],
    );
    await db.query("DELETE FROM tpa.people WHERE user_id=ANY($1::text[])", [
      [finance, member],
    ]);
    await db.query('DELETE FROM public."user" WHERE id=ANY($1::text[])', [
      [finance, member],
    ]);
    await memberContext.close();
    await db.end();
  }
});
test("supplied committee photographs, details, failure fallback and public header", async ({
  page,
}, info) => {
  test.skip(
    process.env.TPA_REAL_CONTENT_TEST !== "true",
    "Requires supplied content rehearsal",
  );
  await page.goto("/governance");
  const names = [
    "CA R. N. Singh",
    "CA Pankaj Kumar Verma",
    "CA Sanjeev Mishra",
    "CA Lalan Sinha",
    "CA Shambhu Jha",
    "Dr. CA C. B. Sinha",
    "CA Prem Suman",
    "CA Umesh Chandra Giri",
  ];
  for (const name of names) {
    const card = page
      .locator(".person-card")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
    await expect(card).toHaveCount(1);
    const img = card.locator("img");
    await img.scrollIntoViewIfNeeded();
    await expect(img).toHaveAttribute("loading", "lazy");
    await expect
      .poll(() =>
        img.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      )
      .toBeTruthy();
    await card.locator("summary").click();
    await expect(card.locator("details")).toHaveAttribute("open", "");
  }
  await page.screenshot({
    path: `.local/real-data/governance-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
  await page.evaluate(() => window.scrollTo(0, 900));
  const header = page.locator(".site-header");
  await expect(header).toHaveCount(1);
  await expect(header).toHaveClass(/is-scrolled/);
  expect((await header.boundingBox())!.y).toBeGreaterThanOrEqual(-1);
  await page.route("**/api/profile-portraits/**", (r) => r.abort());
  await page.reload();
  const first = page.locator(".person-card").filter({
    has: page.getByRole("heading", { name: names[0], exact: true }),
  });
  await first.scrollIntoViewIfNeeded();
  await expect(first.locator(".person-avatar")).toBeVisible();
});
