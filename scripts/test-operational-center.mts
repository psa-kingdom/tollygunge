import { Pool } from "pg";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { databaseOptions } from "../src/lib/database-options";
import { openMail } from "../src/lib/onboarding-mail";
import { memberHeaders } from "../src/domain/member-import";
const visualOnly = process.argv.includes("--visual-only");
const check = expect.configure({ timeout: 45000 });
const count = visualOnly ? 1 : process.argv.includes("--quick") ? 20 : 200;
const name = "tpa_operations_test_" + randomUUID().replaceAll("-", ""),
  port = process.env.TPA_OPERATIONAL_TEST_PORT || "3139",
  base = "http://127.0.0.1:" + port;
const root = new Pool(databaseOptions()),
  url = new URL(process.env.DATABASE_URL!);
url.pathname = "/" + name;
const env = {
  ...process.env,
  DATABASE_URL: url.href,
  TPA_DATABASE_NAME: name,
  BETTER_AUTH_URL: base,
  BETTER_AUTH_SECRET: "synthetic-operational-center-secret-32-characters",
  ONBOARDING_ENABLED: "true",
  TPA_MAIL_SINK: "true",
  RESEND_API_KEY: "",
  SMTP_HOST: "",
  SMTP_USER: "",
  SMTP_PASSWORD: "",
  RESEND_DOMAIN_VERIFIED: "false",
  R2_ACCESS_KEY_ID: "",
  R2_SECRET_ACCESS_KEY: "",
  CLOUDFLARE_CREDENTIAL_FILE: "",
};
let server: ReturnType<typeof spawn> | undefined;
const db = new Pool(databaseOptions(env));
async function run(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const p = spawn(process.execPath, args, { env, stdio: "inherit" });
    p.on("error", reject);
    p.on("exit", (c) =>
      c === 0 ? resolve() : reject(Error("Command failed")),
    );
  });
}
try {
  await root.query(`CREATE DATABASE ${name}`);
  if (visualOnly) {
    // The full acceptance uses the migration runner. Visual fixtures apply the same
    // ordered SQL in one transaction to avoid dozens of remote round trips.
    const files = (await readdir(new URL("../migrations/", import.meta.url)))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const sql = await Promise.all(
      files.map((f) =>
        readFile(new URL("../migrations/" + f, import.meta.url), "utf8"),
      ),
    );
    await db.query("BEGIN;\n" + sql.join("\n") + "\nCOMMIT;");
    console.log(
      "Isolated visual schema initialized from all ordered migrations.",
    );
  } else await run(["scripts/migrate.mjs"]);
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      port,
    ],
    { env, stdio: "ignore" },
  );
  for (let n = 0; n < 60; n++) {
    if (server.exitCode !== null) throw Error("Server stopped");
    try {
      if ((await fetch(base + "/api/health")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  const admin = randomUUID(),
    token = randomBytes(32).toString("hex");
  await db.query(
    "INSERT INTO public.\"user\"(id,name,email,\"emailVerified\") VALUES($1,'Operations administrator','admin@example.invalid',true)",
    [admin],
  );
  await db.query(
    "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')",
    [admin],
  );
  async function cookie(user: string, t = randomBytes(32).toString("hex")) {
    await db.query(
      'INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())',
      [randomUUID(), t, user],
    );
    return encodeURIComponent(
      t +
        "." +
        createHmac("sha256", env.BETTER_AUTH_SECRET).update(t).digest("base64"),
    );
  }
  const adminCookie = await cookie(admin, token);
  async function request(
    path: string,
    body?: unknown,
    value = adminCookie,
    expected = 200,
  ) {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        cookie: "better-auth.session_token=" + value,
        origin: base,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json();
    assert.equal(r.status, expected, JSON.stringify(data));
    return data;
  }
  let chunks = 0;
  let members: { rows: { person_id: string; membership_number: string }[] };
  const invited: { accountId: string }[] = [];
  if (visualOnly) {
    const user = randomUUID(),
      person = randomUUID();
    await db.query(
      `INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,'Operational Member','visual@example.invalid',true)`,
      [user],
    );
    await db.query(
      "INSERT INTO tpa.people(id,user_id,accepted,draft,contact_email) VALUES($1,$2,$3,$3,'visual@example.invalid')",
      [
        person,
        user,
        {
          name: "Operational Member",
          firstName: "Operational",
          lastName: "Member",
          email: "visual@example.invalid",
          addresses: {},
        },
      ],
    );
    await db.query(
      "INSERT INTO tpa.memberships(id,person_id,membership_number,source) VALUES($1,$2,'OP-VISUAL','staff')",
      [randomUUID(), person],
    );
    members = { rows: [{ person_id: person, membership_number: "OP-VISUAL" }] };
    invited.push({ accountId: user });
    console.log(
      "Synthetic visual fixture created; import/invitation/activation are covered by the completed 200-member API run.",
    );
  } else {
    const csv = [
      memberHeaders.join(","),
      ...Array.from({ length: count }, (_, i) =>
        [
          "Mr.",
          "Operational",
          "Member" + i,
          "OP-" + i,
          `member${i}@example.invalid`,
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ].join(","),
      ),
    ].join("\n");
    const form = new FormData();
    form.set("mode", "members");
    form.set("file", new File([csv], "200-members.csv", { type: "text/csv" }));
    const upload = await fetch(base + "/api/staff/onboarding-import", {
      method: "POST",
      headers: {
        cookie: "better-auth.session_token=" + adminCookie,
        origin: base,
      },
      body: form,
    });
    const batch = await upload.json();
    assert.equal(upload.status, 200, JSON.stringify(batch));
    assert.equal(batch.rows.length, count);
    let result;

    do {
      result = await request("/api/staff/onboarding-import", {
        id: batch.id,
        version: 1,
        action: "commit",
      });
      chunks++;
      assert.ok(result.processed <= chunks * 25);
      console.log(`Import progress: ${result.processed}/${count}`);
    } while (!result.complete);
    assert.equal(result.totals.created, count);
    assert.equal(chunks, Math.ceil(count / 25));
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM tpa.onboarding_mail"))
        .rows[0].n,
      0,
    );
    assert.equal(
      (
        await request("/api/staff/onboarding-import", {
          id: batch.id,
          action: "commit",
        })
      ).duplicate,
      true,
    );
    console.log(
      "A: Member import completed in resumable chunks, no invitations sent.",
    );
    members = await request("/api/staff/members?view=register");

    for (const m of members.rows.slice(0, 10))
      invited.push(
        await request("/api/staff/member-actions", {
          personId: m.person_id,
          action: "invite",
        }),
      );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM tpa.onboarding_mail WHERE kind='invitation'",
        )
      ).rows[0].n,
      10,
    );
    await request(
      "/api/staff/member-actions",
      { personId: members.rows[0].person_id, action: "invite" },
      adminCookie,
      409,
    );
    await request(
      "/api/staff/member-actions",
      { personId: members.rows[0].person_id, action: "resend" },
      adminCookie,
      409,
    );
    console.log(
      "B: Ten selected invitations queued; duplicate and immediate resend blocked.",
    );
    const job = (
      await db.query(
        "SELECT * FROM tpa.onboarding_mail WHERE user_id=$1 AND kind='invitation'",
        [invited[0].accountId],
      )
    ).rows[0];
    const mail = openMail(job.payload, env.BETTER_AUTH_SECRET),
      inviteToken = /#token=([\w-]+)/.exec(mail.text)![1];
    await request("/api/onboarding/invitation", {
      token: inviteToken,
      password: "Synthetic-activation-password-2026!",
    });
    await request(
      "/api/onboarding/invitation",
      { token: inviteToken, password: "Synthetic-activation-password-2026!" },
      adminCookie,
      410,
    );
    const activated = (
      await request(
        "/api/staff/members?view=register&id=" + members.rows[0].person_id,
      )
    ).rows[0];
    assert.equal(activated.invitation_status, "accepted");
    console.log(
      "C: Member activated; invitation accepted and single use enforced.",
    );
  }
  const memberCookie = await cookie(invited[0].accountId);
  await request(
    "/api/staff/registration-payments",
    undefined,
    memberCookie,
    403,
  );
  const startsAt = new Date(Date.now() + 86400000 * 3).toISOString(),
    endsAt = new Date(Date.now() + 86400000 * 3 + 3600000).toISOString();
  let event = await request("/api/staff/events", {
    action: "save",
    version: 0,
    title: "Operational launch workshop",
    description: "A realistic manual-payment event.",
    location: "TPA association office",
    startsAt,
    endsAt,
    capacity: 20,
    feePaise: 75000,
    visibility: "public",
    deliveryMode: "location",
    registrationStartsAt: new Date(Date.now() - 3600000).toISOString(),
    registrationEndsAt: new Date(Date.now() + 86400000 * 2).toISOString(),
  });
  event = await request("/api/staff/events", {
    action: "publish",
    id: event.id,
    version: event.version,
  });
  console.log("D: Paid event drafted and published with registration window.");
  const registration = await request(
    "/api/member/events",
    { action: "register", eventId: event.id },
    memberCookie,
  );
  assert.equal(registration.payment_status, "pending");
  const duplicate = await request(
    "/api/member/events",
    { action: "register", eventId: event.id },
    memberCookie,
  );
  assert.equal(duplicate.id, registration.id);
  console.log("E/F: Member registered once; payment pending, not confirmed.");
  let roster = await request("/api/staff/attendance?eventId=" + event.id);
  assert.equal(roster[0].payment_status, "pending");
  await request(
    "/api/staff/registration-payments",
    {
      id: registration.id,
      version: registration.version,
      status: "paid",
      reference: "",
      note: "Checked bank",
    },
    adminCookie,
    400,
  );
  await request("/api/staff/registration-payments", {
    id: registration.id,
    version: registration.version,
    status: "paid",
    reference: "BANK-OP-001",
    note: "Verified against bank credit of INR 750.",
  });
  await request(
    "/api/staff/registration-payments",
    {
      id: registration.id,
      version: registration.version,
      status: "paid",
      reference: "BANK-OP-001",
      note: "Duplicate",
    },
    adminCookie,
    409,
  );
  console.log(
    "G: Payment verified with evidence note; stale verification blocked.",
  );
  roster = await request("/api/staff/attendance?eventId=" + event.id);
  assert.equal(roster[0].payment_status, "paid");
  assert.equal(roster[0].membership_number, members.rows[0].membership_number);
  assert.equal(
    (await request("/api/member/events", undefined, memberCookie)).find(
      (e: { id: string }) => e.id === event.id,
    ).payment_status,
    "paid",
  );
  const audit = (
    await db.query("SELECT action FROM tpa.audit_events WHERE entity_id=$1", [
      registration.id,
    ])
  ).rows;
  assert.ok(audit.some((a) => a.action === "payment.pending_to_paid"));
  console.log(
    "H: Final registration includes member identity, paid status and audit history.",
  );
  await mkdir(".local/operational-center", { recursive: true });
  await writeFile(
    `.local/operational-center/api-${count}.json`,
    JSON.stringify({
      passed: true,
      apiScenarios: visualOnly
        ? ["D", "E", "F", "G", "H"]
        : ["A", "B", "C", "D", "E", "F", "G", "H"],
      importSize: visualOnly ? 0 : count,
      chunks,
      syntheticOnly: true,
      browserValidated: false,
    }),
  );
  const paidRows = await request(
    "/api/staff/registration-payments?status=paid",
  );
  assert.ok(
    paidRows.some((r: { id: string }) => r.id === registration.id),
    "Paid payment list must include confirmed registration",
  );
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.TPA_BROWSER_CHANNEL || "chrome",
  });
  try {
    await mkdir(".local/operational-center", { recursive: true });
    const context = await browser.newContext();
    await context.addCookies([
      { name: "better-auth.session_token", value: adminCookie, url: base },
    ]);
    const page = await context.newPage();
    page.on("dialog", (d) => d.accept());
    page.on("pageerror", (e) =>
      console.log("Synthetic browser error:", e.message),
    );
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(base + "/admin");
      await check(page.getByText("Total members")).toBeVisible();
      await check(
        page.getByRole("heading", { name: "Recent activity" }),
      ).toBeVisible();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await page.screenshot({
        path: `.local/operational-center/dashboard-${viewport.width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + "/admin/workspaces/events?id=" + event.id);
    await check(
      page.getByRole("cell").filter({ hasText: /confirmed/ }),
    ).toBeVisible();
    await check(page.getByText("BANK-OP-001", { exact: false })).toHaveCount(0);
    await page.getByLabel(/^Registration status/).selectOption("confirmed");
    await page.screenshot({
      path: ".local/operational-center/final-registration.png",
      fullPage: true,
    });
    await page.goto(base + "/admin/workspaces/payments");
    await page.getByLabel(/^Payment status/).selectOption("paid");
    await page.screenshot({
      path: ".local/operational-center/payment-filter-before-review.png",
      fullPage: true,
    });
    await check(
      page.getByRole("button", { name: "Review payment" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Review payment" }).click();
    await check(page.getByLabel("Bank / payment reference")).toHaveValue(
      "BANK-OP-001",
    );
    await page.screenshot({
      path: ".local/operational-center/payment-review.png",
      fullPage: true,
    });
    const mc = await browser.newContext();
    await mc.addCookies([
      { name: "better-auth.session_token", value: memberCookie, url: base },
    ]);
    const mp = await mc.newPage();
    await mp.goto(base + "/member/events");
    await check(
      mp.getByText("Registration confirmed", { exact: true }),
    ).toBeVisible();
    await mp.screenshot({
      path: ".local/operational-center/member-confirmation.png",
      fullPage: true,
    });
    await mc.close();
    await context.close();
    console.log(
      "Browser: dashboard desktop/tablet/phone, final roster, payment review and member confirmation passed.",
    );
  } finally {
    await browser.close();
  }
  const latest = (await request("/api/staff/events?id=" + event.id))[0];
  const edit = {
    action: "save",
    id: event.id,
    version: latest.version,
    title: latest.title,
    description: "Updated event agenda",
    location: latest.location,
    startsAt,
    endsAt,
    capacity: 20,
    feePaise: 75000,
    visibility: "public",
    deliveryMode: "location",
    registrationStartsAt: latest.registration_starts_at,
    registrationEndsAt: latest.registration_ends_at,
  };
  await request(
    "/api/staff/events",
    { ...edit, feePaise: 80000 },
    adminCookie,
    409,
  );
  const updated = await request("/api/staff/events", edit);
  assert.equal(updated.description, "Updated event agenda");
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int n FROM tpa.onboarding_mail WHERE kind='event_update'",
      )
    ).rows[0].n,
    1,
  );
  await request("/api/staff/registrations", {
    action: "cancel",
    id: registration.id,
    version: roster[0].version,
  });
  const cancelled = (
    await request("/api/staff/attendance?eventId=" + event.id)
  )[0];
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.payment_status, "paid");
  await request(
    "/api/member/events",
    { action: "register", eventId: event.id },
    memberCookie,
    409,
  );
  await request("/api/staff/registration-payments", {
    id: registration.id,
    version: cancelled.version,
    status: "refunded",
    reference: "REFUND-OP-001",
    note: "Refund already issued and checked.",
  });
  const privateEvent = await request("/api/staff/events", {
    action: "save",
    version: 0,
    title: "Members only meeting",
    description: "Private event",
    location: "Online",
    startsAt,
    endsAt,
    capacity: 1,
    feePaise: 0,
    visibility: "members",
  });
  await request("/api/staff/events", {
    action: "publish",
    id: privateEvent.id,
    version: privateEvent.version,
  });
  await request(
    "/api/member/events",
    { action: "register", eventId: privateEvent.id },
    memberCookie,
    403,
  );
  assert.equal((await fetch(base + "/events/" + privateEvent.id)).status, 404);
  const publicEvent = await request("/api/staff/events", {
    action: "save",
    version: 0,
    title: "One seat workshop",
    description: "Capacity test",
    location: "Office",
    startsAt,
    endsAt,
    capacity: 1,
    feePaise: 0,
  });
  await request("/api/staff/events", {
    action: "publish",
    id: publicEvent.id,
    version: publicEvent.version,
  });
  const capacity = await Promise.all(
    [adminCookie, memberCookie].map((value) =>
      fetch(base + "/api/member/events", {
        method: "POST",
        headers: {
          cookie: "better-auth.session_token=" + value,
          origin: base,
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "register", eventId: publicEvent.id }),
      }),
    ),
  );
  assert.deepEqual(capacity.map((r) => r.status).sort(), [200, 409]);
  console.log(
    "Additional: published changes notify registrants; price changes, private access and overbooking blocked; cancellations preserve paid history and manual refunds are recorded.",
  );
  await writeFile(
    `.local/operational-center/acceptance-${count}.json`,
    JSON.stringify(
      {
        passed: true,
        scenarios: visualOnly
          ? ["D", "E", "F", "G", "H"]
          : ["A", "B", "C", "D", "E", "F", "G", "H"],
        visualOnly,
        importSize: count,
        chunks,
        syntheticOnly: true,
        completed: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
} finally {
  server?.kill();
  if (server && server.exitCode === null)
    await new Promise((r) => server!.once("exit", r));
  await db.end();
  await root.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await root.end();
}
