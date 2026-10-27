import {
  test,
  expect,
  request as playwrightRequest,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../../src/lib/database-options";

const password = "Launch!1234";

test.beforeEach(async () => {
  test.skip(
    !process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_"),
    "Requires the disposable onboarding database and mail sink.",
  );
  const origin = new URL(process.env.TPA_TEST_URL!);
  expect(origin.protocol).toBe("http:");
  expect(origin.hostname).toBe("127.0.0.1");
  const db = new Pool(databaseOptions());
  try {
    expect((await db.query("SELECT current_database() AS name")).rows[0].name)
      .toBe(process.env.TPA_DATABASE_NAME);
    // Independent synthetic visitors share loopback; retain the real limiter.
    await db.query('DELETE FROM public."rateLimit"');
  } finally {
    await db.end();
  }
});

async function identity(options: { staff?: boolean; verified?: boolean; held?: boolean } = {}) {
  const email = `${randomUUID()}@example.invalid`;
  const origin = process.env.TPA_TEST_URL!;
  const client = await playwrightRequest.newContext();
  const db = new Pool(databaseOptions());
  try {
    const response = await client.post(origin + "/api/auth/sign-up/email", {
      headers: { origin },
      data: { name: "Launch authentication fixture", email, password },
    });
    expect(response.status()).toBe(200);
    const user = (await db.query('SELECT id FROM public."user" WHERE email=$1', [email])).rows[0];
    expect(user?.id).toBeTruthy();
    if (options.verified !== false)
      await db.query('UPDATE public."user" SET "emailVerified"=true WHERE id=$1', [user.id]);
    if (options.staff)
      await db.query("INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')", [user.id]);
    if (options.held)
      await db.query("INSERT INTO tpa.account_invitation_holds(user_id) VALUES($1)", [user.id]);
    // Registration must not lend its session to the browser login under test.
    await db.query('DELETE FROM public."session" WHERE "userId"=$1', [user.id]);
    return { id: user.id as string, email };
  } finally {
    await client.dispose();
    await db.end();
  }
}

async function submit(page: Page, email: string, value = password, keep = false) {
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(value);
  await page.getByRole("checkbox", { name: "Keep me signed in for 30 days on this device" }).setChecked(keep);
  const response = page.waitForResponse((item) =>
    new URL(item.url()).pathname === "/api/onboarding/sign-in" && item.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  return response;
}

for (const staff of [false, true]) {
  test(`actual ${staff ? "administrator" : "member"} form login persists, isolates roles and logs out`, async ({ page, context }) => {
    const user = await identity({ staff });
    const destination = staff ? "/admin" : "/member";
    await page.goto(destination);
    await expect(page).toHaveURL(/\/login$/);
    expect((await context.request.get("/api/member/events")).status()).toBe(401);

    expect((await submit(page, user.email, "Wrong!1234")).status()).toBe(401);
    await expect(page.getByRole("alert").filter({ hasText: "Check your email and password." })).toBeVisible();
    expect(await (await context.request.get("/api/auth/get-session")).json()).toBeNull();

    expect((await submit(page, user.email, password, true)).status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(destination + "$"));
    await page.reload();
    await expect(page.getByRole("button", { name: "Account menu", exact: true })).toBeVisible();
    const session = await (await context.request.get("/api/auth/get-session")).json();
    expect(session.user.id).toBe(user.id);
    expect(session.session.durationDays).toBe(staff ? 7 : 30);
    const cookie = (await context.cookies()).find((item) => item.name.endsWith("session_token"));
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect((await context.request.get("/api/staff/members")).status()).toBe(staff ? 200 : 403);
    if (!staff) {
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/member$/);
    }

    await page.getByRole("button", { name: "Account menu", exact: true }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await (await context.request.get("/api/auth/get-session")).json()).toBeNull();
    expect((await context.request.get("/api/member/events")).status()).toBe(401);
    expect((await context.request.get("/api/staff/members")).status()).toBe(401);
    await page.goto(destination);
    await expect(page).toHaveURL(/\/login$/);
  });
}

test("expired database session denies APIs and protected navigation", async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop", "Session expiry is independent of viewport.");
  const user = await identity();
  await page.goto("/login");
  expect((await submit(page, user.email)).status()).toBe(200);
  await expect(page).toHaveURL(/\/member$/);
  const db = new Pool(databaseOptions());
  try {
    await db.query('UPDATE public."session" SET "expiresAt"=now()-interval \'1 minute\' WHERE "userId"=$1', [user.id]);
  } finally {
    await db.end();
  }
  expect(await (await context.request.get("/api/auth/get-session")).json()).toBeNull();
  expect((await context.request.get("/api/member/events")).status()).toBe(401);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
});

test("unverified staff require operator approval and held accounts cannot sign in", async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop", "Account eligibility is independent of viewport.");
  const staff = await identity({ staff: true, verified: false });
  await page.goto("/login");
  expect((await submit(page, staff.email)).status()).toBe(200);
  // Password authentication alone does not grant an unapproved staff actor.
  await expect(page).toHaveURL(/\/login$/);
  expect((await context.request.get("/api/staff/members")).status()).toBe(401);
  const db = new Pool(databaseOptions());
  try {
    await db.query("INSERT INTO tpa.operator_approved_identities(user_id,source) VALUES($1,'user_authorized_bootstrap')", [staff.id]);
  } finally {
    await db.end();
  }
  await page.goto("/admin");
  await expect(page.getByRole("button", { name: "Account menu", exact: true })).toBeVisible();
  expect((await context.request.get("/api/staff/members")).status()).toBe(200);
  await context.request.post("/api/auth/sign-out", { headers: { origin: process.env.TPA_TEST_URL! } });
  await context.clearCookies();

  const held = await identity({ held: true });
  await page.goto("/login");
  expect((await submit(page, held.email)).status()).toBe(403);
  await expect(page.getByRole("alert").filter({ hasText: "Check your email and password." })).toBeVisible();
  expect(await (await context.request.get("/api/auth/get-session")).json()).toBeNull();
  expect((await context.request.get("/api/member/events")).status()).toBe(401);
});
