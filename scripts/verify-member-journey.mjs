import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import pg from "pg";
import { chromium } from "playwright";
import { hashPassword } from "better-auth/crypto";
import { openMail } from "../src/lib/onboarding-mail.ts";

const root = new URL(process.env.DATABASE_URL);
assert.equal(root.hostname, "127.0.0.1");
assert.ok(
  root.port === "55439" ||
    (root.port === "5432" && root.pathname === "/tpa_onboarding_test_ci"),
  "Use a dedicated local QA database.",
);
root.pathname = "/postgres";
const adminPool = new pg.Pool({ connectionString: root.href });
const database =
  "tpa_onboarding_test_journey_" + randomUUID().replaceAll("-", "");
const secret = "synthetic-full-journey-secret-32-characters";
const origin = "http://127.0.0.1:3148";
const objects = new Map();
const storage = createServer(async (req, res) => {
  let chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const key = new URL(req.url, "http://localhost").pathname;
  if (req.method === "PUT") {
    objects.set(key, Buffer.concat(chunks));
    res.setHeader("etag", '"fixture"');
    res.end();
  } else if (req.method === "DELETE") {
    objects.delete(key);
    res.statusCode = 204;
    res.end();
  } else if (objects.has(key)) {
    res.end(objects.get(key));
  } else {
    res.statusCode = 404;
    res.end();
  }
});
let db,
  server,
  browser,
  created = false;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XkZkAAAAASUVORK5CYII=",
  "base64",
);
const pdf = Buffer.from("%PDF-1.4\n% Synthetic evidence only\n%%EOF");
function check(step) {
  console.log("PASS " + step);
}
try {
  await adminPool.query("CREATE DATABASE " + database);
  created = true;
  root.pathname = "/" + database;
  db = new pg.Pool({ connectionString: root.href });
  await new Promise((resolve) => storage.listen(0, "127.0.0.1", resolve));
  const env = {};
  for (const key of [
    "PATH",
    "SystemRoot",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "LOCALAPPDATA",
  ])
    env[key] = process.env[key];
  for (const file of [
    ".env",
    ".env.local",
    ".env.production",
    ".env.production.local",
  ])
    if (fs.existsSync(file)) {
      for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        const key = line.match(/^\s*(\w+)\s*=/)?.[1];
        if (key && !(key in env)) env[key] = "";
      }
    }
  Object.assign(env, {
    DATABASE_URL: root.href,
    DATABASE_SSL: "false",
    TPA_DATABASE_NAME: database,
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: origin,
    ONBOARDING_ENABLED: "true",
    TPA_SIGNUP_OTP_REQUIRED: "true",
    TPA_MAIL_SINK: "true",
    TPA_DEPLOYMENT_ENV: "local",
    R2_BUCKET_NAME: "tpa-private-documents",
    R2_ACCOUNT_ID: "0".repeat(32),
    R2_ACCESS_KEY_ID: "synthetic-key",
    R2_SECRET_ACCESS_KEY: "synthetic-secret",
    TPA_LOCAL_STORAGE_ENDPOINT: "http://127.0.0.1:" + storage.address().port,
  });
  const migration = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
    env,
    encoding: "utf8",
  });
  assert.equal(migration.status, 0, migration.stderr);
  check("disposable migrations");
  const adminId = randomUUID(),
    adminEmail = "journey-admin@example.invalid",
    password = "Journey!42";
  await db.query(
    'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',
    [adminId, "Journey Admin", adminEmail],
  );
  await db.query(
    'INSERT INTO public."account"(id,"accountId","providerId","userId",password,"updatedAt") VALUES($1,$2,\'credential\',$2,$3,now())',
    [randomUUID(), adminId, await hashPassword(password)],
  );
  await db.query(
    "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')",
    [adminId],
  );
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3148",
    ],
    { env, stdio: "inherit" },
  );
  let ready = false;
  for (let i = 0; i < 45; i++) {
    if (server.exitCode !== null) throw Error("Test server exited");
    if (
      await fetch(origin + "/signup")
        .then((r) => r.ok)
        .catch(() => false)
    ) {
      ready = true;
      break;
    }
    await wait(500);
  }
  assert.ok(ready, "The disposable application did not start.");
  browser = await chromium.launch({
    channel:
      process.env.TPA_BROWSER_CHANNEL ||
      (process.platform === "win32" ? "msedge" : undefined),
    headless: true,
  });
  const memberCtx = await browser.newContext({ baseURL: origin }),
    adminCtx = await browser.newContext({ baseURL: origin });
  const member = await memberCtx.newPage(),
    admin = await adminCtx.newPage();
  const req = async (ctx, method, path, data, expected = 200, files) => {
    const r = await ctx.request.fetch(path, {
      method,
      headers: { origin },
      ...(files ? { multipart: files } : data ? { data } : {}),
    });
    assert.equal(
      r.status(),
      expected,
      method +
        " " +
        path +
        ": " +
        (r.status() === expected ? "" : await r.text()),
    );
    return r.headers()["content-type"]?.includes("json") ? r.json() : r;
  };
  await req(adminCtx, "POST", "/api/onboarding/sign-in", {
    email: adminEmail,
    password,
    keepSignedIn: false,
  });
  for (const path of [
    "/admin",
    "/admin/workspaces/members",
    "/admin/workspaces/events",
    "/admin/workspaces/content",
    "/admin/workspaces/communications",
    "/admin/workspaces/payments",
    "/admin/workspaces/payment-details",
  ]) {
    assert.equal(
      (await adminCtx.request.get(path, { maxRedirects: 0 })).status(),
      200,
      path,
    );
  }
  check("all seven admin sections open with an administrator session");
  const email = "journey-member@example.invalid";
  await member.goto("/signup");
  await member.getByLabel("Full name").fill("Journey Member");
  await member.getByLabel("Email", { exact: true }).fill(email);
  await member.locator("input[name=password]").fill(password);
  await member.getByLabel("Membership type").selectOption("Patron");
  await member.getByRole("button", { name: "Send registration code" }).click();
  await member.getByLabel("Registration code").waitFor();
  assert.equal(
    (await db.query('SELECT 1 FROM public."user" WHERE email=$1', [email]))
      .rowCount,
    0,
  );
  const job = (
    await db.query(
      "SELECT payload FROM tpa.onboarding_mail WHERE recipient=$1 AND kind='verification'",
      [email],
    )
  ).rows[0];
  const code = openMail(job.payload, secret).text.match(/\b\d{6}\b/)[0];
  await member.getByLabel("Registration code").fill(code);
  await member
    .getByRole("button", { name: "Confirm code and create account" })
    .click();
  await member.waitForURL("**/member/application");
  const user = (
    await db.query(
      'SELECT id,"requestedMembershipPlan","emailVerified" FROM public."user" WHERE email=$1',
      [email],
    )
  ).rows[0];
  assert.equal(user.requestedMembershipPlan, "Patron");
  assert.equal(user.emailVerified, true);
  check("browser signup selects Patron and creates account only after OTP");
  let rows = await req(
    adminCtx,
    "GET",
    "/api/staff/members?view=register&records=all&plan=Patron",
  );
  assert.equal(rows.rows.find((x) => x.user_id === user.id)?.status, null);
  const memberStatus = await req(memberCtx, "GET", "/api/member/verification");
  const answers = {
    fullName: "Journey Member",
    qualification: "Chartered Accountant",
    professionalStatus: "In Service",
    professionalBody: "None",
    phone: "+919000000002",
    officeAddress: "Synthetic office, Kolkata",
    residenceAddress: "Synthetic residence, Kolkata",
    place: "Kolkata",
    declaration: "true",
  };
  let draft = await req(memberCtx, "POST", "/api/member/application", {
    version: 0,
    plan: "Patron",
    category: "Professional",
    step: 4,
    details: answers,
    documentIds: [],
  });
  assert.equal(draft.plan, "Patron");
  for (const f of memberStatus.policy.fields.filter(
    (f) => f.required && f.visible && f.type === "document",
  )) {
    const image = f.documentKind === "photograph";
    await req(memberCtx, "POST", "/api/documents", null, 201, {
      kind: f.documentKind,
      fieldId: f.id,
      applicationVersion: String(draft.version),
      file: {
        name: image ? "fixture.png" : "fixture.pdf",
        mimeType: image ? "image/png" : "application/pdf",
        buffer: image ? png : pdf,
      },
    });
    draft = await req(memberCtx, "GET", "/api/member/application");
  }
  await req(memberCtx, "POST", "/api/member/verification", {
    version: draft.version,
  });
  check(
    "member saves correct plan, uploads required private evidence and submits",
  );
  const review = (
    await req(adminCtx, "GET", "/api/staff/verification?status=pending")
  ).reviews.find((r) => r.user_id === user.id);
  assert.ok(review);
  await req(
    memberCtx,
    "POST",
    "/api/staff/verification",
    { action: "approve", id: review.id, version: review.version },
    403,
  );
  await admin.goto("/admin");
  await admin.getByRole("button", { name: /^Review: .*application/i }).click();
  const overviewReview = admin.getByRole("dialog", {
    name: "Review membership applications",
  });
  await overviewReview.getByRole("button", { name: /Journey Member/ }).click();
  assert.equal(await overviewReview.locator("select, summary").count(), 0);
  await overviewReview
    .getByRole("button", { name: "Approve account", exact: true })
    .click();
  assert.equal(await overviewReview.locator("textarea").count(), 0);
  await overviewReview
    .getByRole("button", { name: "Close details", exact: true })
    .click();
  check("Overview review is compact and approval does not request a reason");
  await admin.goto("/admin/workspaces/members?personId=" + review.person_id);
  const dialog = admin.getByRole("dialog", { name: /Journey Member/ });
  await dialog
    .getByRole("button", { name: "Application review", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Approve account", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Confirm account approval", exact: true })
    .click();
  await admin.waitForFunction(() =>
    document.body.textContent.includes("Account approval saved."),
  );
  rows = await req(
    adminCtx,
    "GET",
    "/api/staff/members?view=register&records=all&plan=Patron",
  );
  const activated = rows.rows.find((x) => x.user_id === user.id);
  assert.equal(activated.status, "active");
  assert.equal(activated.membership_number, null);
  assert.equal(
    (
      await req(
        adminCtx,
        "GET",
        "/api/staff/members?view=register&records=all&plan=Life",
      )
    ).rows.some((x) => x.user_id === user.id),
    false,
  );
  assert.equal(
    (await req(memberCtx, "GET", "/api/member/verification")).verified,
    true,
  );
  check(
    "browser admin approval activates membership, honors plan and only permits staff",
  );
  assert.equal(
    (await req(memberCtx, "GET", "/api/member/verification")).membershipStatus,
    "active",
  );
  const payment = {
    id: randomUUID(),
    personId: review.person_id,
    membershipVersion: activated.membership_version,
    amount: "250.00",
    paidOn: new Date().toISOString().slice(0, 10),
    method: "UPI",
    reference: "JOURNEY-QA",
    confirmed: true,
  };
  const paymentBlocked = await req(
    adminCtx,
    "POST",
    "/api/staff/membership-payments",
    payment,
    409,
  );
  assert.match(paymentBlocked.error, /Assign a membership number/);
  await admin.goto("/admin/workspaces/members?personId=" + review.person_id);
  const editor = admin.getByRole("dialog", { name: /Journey Member/ });
  await editor
    .getByRole("button", { name: "Edit details", exact: true })
    .click();
  await editor.getByLabel("First name", { exact: true }).fill("Journey");
  await editor.getByLabel("Last name", { exact: true }).fill("Member");
  await editor
    .getByLabel("Membership number", { exact: true })
    .fill("JOURNEY-001");
  await editor
    .getByRole("button", { name: "Save member details", exact: true })
    .click();
  await admin.waitForFunction(() =>
    document.body.textContent.includes("JOURNEY-001"),
  );
  const lookup = await req(
    adminCtx,
    "GET",
    "/api/staff/membership-payments?number=JOURNEY-001",
  );
  await req(adminCtx, "POST", "/api/staff/membership-payments", {
    ...payment,
    membershipVersion: lookup.member.version,
  });
  check(
    "staff can assign a number after approval and record a payment receipt",
  );
  const legacy = randomUUID();
  await db.query(
    'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',
    [legacy, "Legacy QA", "journey-legacy@example.invalid"],
  );
  await req(adminCtx, "POST", "/api/staff/member-actions", {
    action: "membership-plan",
    userId: legacy,
    plan: "Life",
  });
  await req(
    adminCtx,
    "POST",
    "/api/staff/member-actions",
    { action: "membership-plan", userId: legacy, plan: "Patron" },
    409,
  );
  assert.equal(
    (
      await req(
        adminCtx,
        "GET",
        "/api/staff/members?view=register&records=all&plan=Life",
      )
    ).rows.find((r) => r.user_id === legacy).status,
    null,
  );
  check(
    "admin assigns missing plan without activating legacy account or overwriting a plan",
  );
  draft = await req(
    adminCtx,
    "GET",
    "/api/staff/member-application?userId=" + user.id,
  );
  await req(adminCtx, "POST", "/api/staff/member-application", {
    userId: user.id,
    version: draft.version,
    changes: { organization: "Edited QA organisation" },
  });
  draft = await req(
    adminCtx,
    "GET",
    "/api/staff/member-application?userId=" + user.id,
  );
  await req(adminCtx, "POST", "/api/documents", null, 201, {
    memberUserId: user.id,
    kind: "certificate",
    fieldId: "certificate",
    applicationVersion: String(draft.version),
    file: { name: "certificate.pdf", mimeType: "application/pdf", buffer: pdf },
  });
  draft = await req(memberCtx, "GET", "/api/member/application");
  assert.equal(draft.details.organization, "Edited QA organisation");
  assert.ok(draft.details.certificate);
  await req(
    adminCtx,
    "GET",
    "/api/documents/" + draft.details.certificate,
    null,
    200,
  );
  const anonymous = await browser.newContext({ baseURL: origin });
  await req(
    anonymous,
    "GET",
    "/api/documents/" + draft.details.certificate,
    null,
    401,
  );
  check("admin saves onboarding fields and adds evidence visible to its owner");
  const start = new Date(Date.now() + 86400000 * 5),
    end = new Date(start.getTime() + 3600000);
  const eventData = {
    action: "save",
    version: 0,
    title: "Journey banner event",
    description: "Synthetic journey fixture",
    location: "Kolkata",
    capacity: 20,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    feePaise: 0,
    visibility: "public",
  };
  const event = await req(adminCtx, "POST", "/api/staff/events", null, 200, {
    details: JSON.stringify(eventData),
    banner: { name: "banner.png", mimeType: "image/png", buffer: png },
  });
  await req(anonymous, "GET", "/api/event-banners/" + event.id, null, 404);
  await req(adminCtx, "GET", "/api/event-banners/" + event.id);
  const published = await req(adminCtx, "POST", "/api/staff/events", {
    action: "publish",
    id: event.id,
    version: event.version,
  });
  await req(anonymous, "GET", "/api/event-banners/" + event.id);
  assert.equal(
    (await req(memberCtx, "GET", "/api/member/events")).find(
      (e) => e.id === event.id,
    ).has_banner,
    true,
  );
  await req(adminCtx, "POST", "/api/staff/events", {
    ...eventData,
    id: event.id,
    version: published.version,
    removeBanner: true,
  });
  await req(anonymous, "GET", "/api/event-banners/" + event.id, null, 404);
  const without = await req(adminCtx, "POST", "/api/staff/events", {
    ...eventData,
    title: "Event without a banner",
    visibility: "members",
  });
  await req(adminCtx, "GET", "/api/event-banners/" + without.id, null, 404);
  await req(adminCtx, "POST", "/api/staff/events", {
    action: "publish",
    id: without.id,
    version: without.version,
  });
  assert.ok(
    (await req(memberCtx, "GET", "/api/member/events")).some(
      (event) => event.id === without.id,
    ),
  );
  check(
    "event banner is optional, private while draft, public after publish, and removable",
  );
  for (const width of [390, 1204]) {
    await admin.setViewportSize({ width, height: 720 });
    await admin.goto("/admin/workspaces/members");
    const row = admin
      .locator("[data-member-record]")
      .filter({ hasText: "Journey Member" });
    await row
      .getByRole("button", { name: "Open Journey Member details" })
      .hover();
    assert.equal(
      await admin.getByRole("dialog", { name: /quick preview/ }).count(),
      0,
    );
    await row.getByRole("cell").last().click();
    const detail = admin.getByRole("dialog", { name: /Journey Member/ });
    await detail.waitFor();
    if (width === 1204) {
      const contact = detail
        .getByRole("heading", { name: "Contact & preferences", exact: true })
        .locator("..");
      const office = contact.getByText("Office address", { exact: true });
      const residence = contact.getByText("Residence address", { exact: true });
      await office.waitFor();
      const [firstAddress, secondAddress] = await Promise.all([
        office.boundingBox(),
        residence.boundingBox(),
      ]);
      assert.equal(firstAddress.y, secondAddress.y);
      assert.notEqual(firstAddress.x, secondAddress.x);
    }
    const close = detail.getByRole("button", {
      name: "Close details",
      exact: true,
    });
    const target = await close.evaluate(button => [button.offsetWidth, button.offsetHeight]);
    assert.ok(target.every(size => size >= 44), `Close target at ${width}px measured ${target.join(" × ")}`);
    await close.click();
    await admin
      .getByRole("button", { name: "Create member", exact: false })
      .first()
      .click();
    const create = admin.getByRole("dialog", { name: "Create new member" });
    await create.waitFor();
    const columns = await create
      .locator("form.member-settings")
      .evaluate(
        (form) =>
          getComputedStyle(form).gridTemplateColumns.split(/\s+/).length,
      );
    assert.ok(width === 390 ? columns === 1 : columns > 1);
    await admin
      .getByRole("button", { name: "Close details", exact: true })
      .click();
  }
  check(
    "admin row click, no hover popup, close target, and create form at phone and desktop widths",
  );
  const publicPage = await anonymous.newPage();
  await publicPage.goto("/");
  assert.equal(
    await publicPage.locator(".brand-wordmark-name").first().textContent(),
    "Tollygunge",
  );
  check("public Classic wordmark");

  await req(adminCtx, "POST", "/api/staff/member-actions", {
    action: "membership",
    personId: review.person_id,
    version: lookup.member.version,
    status: "suspended",
  });
  assert.equal(
    (await req(memberCtx, "GET", "/api/member/verification")).membershipStatus,
    "suspended",
  );
  const suspended = (
    await req(
      adminCtx,
      "GET",
      "/api/staff/members?view=register&records=all&plan=Patron",
    )
  ).rows.find((x) => x.user_id === user.id);
  assert.equal(suspended.status, "suspended");
  assert.equal(
    (await req(memberCtx, "GET", "/api/member/events")).some(
      (event) => event.id === without.id,
    ),
    false,
  );
  await member.goto("/member/application");
  await member.getByText("Not active", { exact: true }).waitFor();
  check(
    "suspension shows Not active in the member application and updates the admin record",
  );
} finally {
  await browser?.close();
  if (server) {
    server.kill();
    for (let i = 0; i < 20 && server.exitCode === null; i++) await wait(100);
  }
  await new Promise((resolve) => storage.close(resolve));
  await db?.end();
  if (created)
    await adminPool.query("DROP DATABASE " + database + " WITH (FORCE)");
  await adminPool.end();
}
