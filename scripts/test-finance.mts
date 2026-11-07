import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { openSync, closeSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { chromium } from "@playwright/test";
import ExcelJS from "exceljs";
const rootUrl = new URL(
  process.env.TPA_FINANCE_QA_DATABASE_URL ??
    "postgresql://finance_qa:synthetic@127.0.0.1:55449/postgres",
);
assert.equal(rootUrl.hostname, "127.0.0.1");
assert.equal(rootUrl.port, "55449", "Use the isolated finance QA server");
const name = "tpa_finance_" + randomUUID().replaceAll("-", ""),
  root = new Pool({ connectionString: rootUrl.href }),
  url = new URL(rootUrl);
url.pathname = "/" + name;
const db = new Pool({ connectionString: url.href }),
  base = "http://127.0.0.1:3192",
  dir = resolve(".local/finance/acceptance");
await mkdir(dir, { recursive: true });
const env: NodeJS.ProcessEnv = { ...process.env };
for (const file of [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
])
  try {
    for (const line of (await readFile(file, "utf8")).split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      if (m) env[m[1]] = "";
    }
  } catch {}
Object.assign(env, {
  DATABASE_URL: url.href,
  DATABASE_SSL: "false",
  TPA_DATABASE_NAME: name,
  BETTER_AUTH_URL: base,
  BETTER_AUTH_SECRET: "synthetic-finance-qa-secret-at-least-32-chars",
  TPA_MAIL_SINK: "true",
  ONBOARDING_ENABLED: "true",
  EMAIL_OPERATIONS_ENABLED: "false",
  R2_ACCOUNT_ID: "0".repeat(32),
  R2_ACCESS_KEY_ID: "synthetic",
  R2_SECRET_ACCESS_KEY: "synthetic",
  R2_BUCKET_NAME: "tpa-private-documents",
  NODE_OPTIONS: "",
});
const users: string[] = [],
  cookies: string[] = [];
let server: ReturnType<typeof spawn> | undefined,
  created = false;
const objects = new Map<string, Buffer>();
const storage = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk);
  if (req.method === "PUT") {
    objects.set(req.url!.split("?")[0], Buffer.concat(chunks));
    res.end();
  } else if (req.method === "DELETE") {
    objects.delete(req.url!.split("?")[0]);
    res.statusCode = 204;
    res.end();
  } else if (objects.has(req.url!.split("?")[0]))
    res.end(objects.get(req.url!.split("?")[0]));
  else {
    res.statusCode = 404;
    res.end();
  }
});
async function call(path: string, body?: unknown, actor = 0, status = 200) {
  const r = await fetch(base + path, {
    redirect: "manual",
    method: body ? "POST" : "GET",
    headers: {
      Cookie: "better-auth.session_token=" + cookies[actor],
      Origin: base,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  assert.equal(r.status, status, `${path}: ${JSON.stringify(d)}`);
  return d;
}
let eventId = "",
  registrationId = "";
const id = () => randomUUID();
const receipt = (extra: object = {}) => ({
  action: "receipt.create",
  id: id(),
  eventId,
  amountPaise: 50000,
  date: "2026-11-05",
  label: "Community sponsor",
  method: "UPI",
  reference: "SYNTHETIC-REF",
  note: "Synthetic collection verified",
  ...extra,
});
const line = (amountPaise: number) => ({
  header: "Custom stage lighting",
  description: "Lighting for workshop",
  date: "2026-11-05",
  amountPaise,
  vendor: "Synthetic vendor",
  note: "",
});
async function entry(entryId: string) {
  return (
    await db.query("SELECT * FROM tpa.finance_entries WHERE id=$1", [entryId])
  ).rows[0];
}
async function review(entryId: string, actor = 1, action = "approve") {
  const e = await entry(entryId);
  return call(
    "/api/staff/finance",
    {
      action,
      id: entryId,
      eventId,
      version: e.version,
      reason: "Checked supporting records",
    },
    actor,
  );
}
async function upload(
  actor: number,
  extra: object = {},
  file = true,
  status = 200,
) {
  const form = new FormData();
  form.set("details", JSON.stringify(receipt({ registrationId, ...extra })));
  if (file)
    form.set(
      "file",
      new Blob(["%PDF-1.4 synthetic proof"], { type: "application/pdf" }),
      "proof.pdf",
    );
  const r = await fetch(
    base +
      (actor === 2 ? "/api/member/receipts" : "/api/staff/finance/receipts"),
    {
      method: "POST",
      headers: {
        Cookie: "better-auth.session_token=" + cookies[actor],
        Origin: base,
      },
      body: form,
    },
  );
  const data = await r.json();
  assert.equal(r.status, status, JSON.stringify(data));
  return data;
}
try {
  await root.query("CREATE DATABASE " + name);
  created = true;
  for (const f of (await readdir("migrations"))
    .filter((n) => n.endsWith(".sql") && n < "038")
    .sort())
    await db.query(await readFile("migrations/" + f, "utf8"));
  for (const role of [
    "administrator",
    "super_administrator",
    "member",
    "member",
  ]) {
    const user = id(),
      token = randomBytes(24).toString("hex");
    users.push(user);
    await db.query(
      'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',
      [user, role + " QA", `${user}@example.invalid`],
    );
    if (role === "administrator")
      await db.query(
        "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')",
        [user],
      );
    await db.query(
      `INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval '2 hours',now())`,
      [id(), token, user],
    );
    cookies.push(
      encodeURIComponent(
        token +
          "." +
          createHmac("sha256", env.BETTER_AUTH_SECRET!)
            .update(token)
            .digest("base64"),
      ),
    );
  }
  eventId = id();
  registrationId = id();
  await db.query(
    "INSERT INTO tpa.events(id,title,description,location,starts_at,ends_at,capacity,status,updated_by,fee_paise) VALUES($1,'Finance acceptance workshop','Synthetic event','Test hall',now()+interval '3 days',now()+interval '4 days',100,'published',$2,50000)",
    [eventId, users[0]],
  );
  await db.query(
    "INSERT INTO tpa.event_registrations(id,event_id,user_id,status,payment_status,fee_paise) VALUES($1,$2,$3,'registered','pending',50000)",
    [registrationId, eventId, users[2]],
  );
  await db.query(
    "INSERT INTO tpa.event_expenses(id,event_id,category,description,amount_paise,expense_date,updated_by) VALUES($1,$2,'venue','Legacy hall hire',20000,'2026-11-04',$3)",
    [id(), eventId, users[0]],
  );
  const legacyReg = id();
  await db.query(
    "INSERT INTO tpa.event_registrations(id,event_id,user_id,status,payment_status,fee_paise) VALUES($1,$2,$3,'cancelled','refunded',10000)",
    [legacyReg, eventId, users[3]],
  );
  await db.query(
    "INSERT INTO tpa.event_payment_history(registration_id,to_status,fee_paise,reference,note) VALUES($1,'refunded',10000,'LEGACY','Legacy baseline')",
    [legacyReg],
  );
  await db.query(
    await readFile("migrations/038_finance_approvals.sql", "utf8"),
  );
  await db.query(
    "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'super_administrator')",
    [users[1]],
  );
  await assert.rejects(
    db.query(
      "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'super_administrator')",
      [users[0]],
    ),
    { code: "23505" },
  );
  await db.query(
    await readFile("migrations/039_manual_participant_receipts.sql", "utf8"),
  );
  await db.query(
    await readFile(
      "migrations/040_independent_expense_submissions.sql",
      "utf8",
    ),
  );
  console.log("PASS migrations, nullable legacy actor and single super admin");
  await new Promise<void>((r) => storage.listen(0, "127.0.0.1", r));
  const storagePort = (storage.address() as { port: number }).port;
  const shim = resolve(dir, "storage.cjs");
  await writeFile(
    shim,
    `const https=require('node:https'),http=require('node:http');https.request=function(o,cb){if((o.hostname??o.host)?.endsWith('.r2.cloudflarestorage.com'))return http.request({...o,hostname:'127.0.0.1',host:undefined,port:${storagePort},protocol:'http:',agent:undefined},cb);throw Error('External HTTPS disabled in finance QA');};`,
  );
  const log = openSync(resolve(dir, "server.log"), "w");
  server = spawn(
    process.execPath,
    [
      "--require",
      shim,
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3192",
    ],
    { env, stdio: ["ignore", log, log] },
  );
  closeSync(log);
  let ready = false;
  for (let n = 0; n < 60; n++) {
    try {
      if ((await fetch(base + "/api/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(ready, "Server readiness");
  let data = await call("/api/staff/finance?eventId=" + eventId);
  assert.equal(data.totals.received, 10000);
  assert.equal(data.totals.refunded, 10000);
  assert.equal(data.totals.expenses, 20000);
  await call("/api/staff/finance?eventId=" + eventId, undefined, 2, 403);
  await call("/api/staff/finance", receipt(), 1, 403);
  await call("/api/staff/access", undefined, 0);
  const member = await upload(2);
  await upload(2, {}, true, 409);
  await upload(2, {}, false, 400);
  const proof = (
    await db.query("SELECT id FROM tpa.finance_proofs WHERE entry_id=$1", [
      member.id,
    ])
  ).rows[0].id;
  await call("/api/finance/proofs/" + proof, undefined, 3, 404);
  const ownerProof = await fetch(base + "/api/finance/proofs/" + proof, {
    redirect: "manual",
    headers: { Cookie: "better-auth.session_token=" + cookies[2] },
  });
  assert.equal(ownerProof.status, 200);
  assert.equal(await ownerProof.text(), "%PDF-1.4 synthetic proof");
  await call(
    "/api/staff/finance",
    {
      action: "approve",
      id: member.id,
      eventId,
      version: 1,
      reason: "Wrong reviewer",
    },
    1,
    403,
  );
  await review(member.id, 0, "return");
  const memberBrowser = await chromium.launch({
    channel: process.env.TPA_BROWSER_CHANNEL ?? "msedge",
    headless: true,
  });
  try {
    const context = await memberBrowser.newContext();
    await context.addCookies([
      { name: "better-auth.session_token", value: cookies[2], url: base },
    ]);
    const p = await context.newPage();
    await p.goto(base + "/member/events");
    await p
      .getByRole("button", { name: "Submit receipt for admin review" })
      .waitFor();
    await p
      .getByText("Checked supporting records", { exact: false })
      .first()
      .waitFor();
    console.log("PASS member-event receipt form and rejection reason");
  } finally {
    await memberBrowser.close();
  }

  const resubmitted = await upload(2);
  await review(resubmitted.id, 0);
  assert.equal(
    (
      await db.query(
        "SELECT payment_status FROM tpa.event_registrations WHERE id=$1",
        [registrationId],
      )
    ).rows[0].payment_status,
    "paid",
  );
  await upload(2, {}, true, 409);
  console.log(
    "PASS proof storage, private access, duplicate protection, rejection and direct admin approval",
  );
  const adminReceipt = await call("/api/staff/finance", receipt());
  await call(
    "/api/staff/finance",
    {
      action: "approve",
      id: adminReceipt.id,
      eventId,
      version: 1,
      reason: "Admin bypass",
    },
    0,
    403,
  );
  const competing = await Promise.allSettled([
    review(adminReceipt.id),
    review(adminReceipt.id),
  ]);
  assert.equal(competing.filter((r) => r.status === "fulfilled").length, 1);
  data = await call("/api/staff/finance?eventId=" + eventId);
  assert.equal(data.totals.received, 110000);
  assert.equal(
    data.entries.find((e: { id: string }) => e.id === adminReceipt.id)
      .entry_date,
    "2026-11-05",
  );
  const sheet = await call("/api/staff/finance", {
    action: "sheet.save",
    id: id(),
    eventId,
    date: "2026-11-05",
    lines: Array.from({ length: 80 }, () => line(1000)),
    note: "Revised actual expenses",
    submit: false,
  });
  let current = await entry(sheet.id);
  await call("/api/staff/finance", {
    action: "sheet.save",
    id: id(),
    existingId: sheet.id,
    version: current.version,
    eventId,
    date: "2026-11-05",
    lines: Array.from({ length: 80 }, () => line(1000)),
    note: "Ready for review",
    submit: true,
  });
  await review(sheet.id, 1, "return");
  current = await entry(sheet.id);
  await call("/api/staff/finance", {
    action: "sheet.save",
    id: id(),
    existingId: sheet.id,
    version: current.version,
    eventId,
    date: "2026-11-05",
    lines: Array.from({ length: 80 }, () => line(1000)),
    note: "Corrected",
    submit: true,
  });
  data = await call("/api/staff/finance?eventId=" + eventId);
  assert.equal(data.totals.expenses, 20000);
  await review(sheet.id);
  data = await call("/api/staff/finance?eventId=" + eventId);
  assert.equal(data.totals.expenses, 80000);
  assert.equal(data.totals.netResult, 20000);
  await call(
    "/api/staff/events/operations",
    { action: "expense.save", eventId, version: 1 },
    0,
    409,
  );
  await call(
    "/api/staff/registration-payments",
    { id: registrationId, status: "refunded", version: 1 },
    0,
    409,
  );
  const refund = await call(
    "/api/staff/finance",
    receipt({ action: "refund.create", registrationId }),
  );
  await review(refund.id);
  data = await call("/api/staff/finance?eventId=" + eventId);
  assert.equal(data.totals.netResult, -30000);
  const dated = await call(
    "/api/staff/finance?eventId=" + eventId + "&from=2026-11-05&to=2026-11-05",
  );
  assert.equal(dated.totals.expenses, 80000);
  console.log(
    "PASS receipt approvals, immutable expense revision, refunds, date filters and signed balances",
  );
  for (const format of ["pdf", "xlsx"]) {
    const r = await fetch(
      base +
        "/api/staff/finance/export?eventId=" +
        eventId +
        "&format=" +
        format,
      { headers: { Cookie: "better-auth.session_token=" + cookies[0] } },
    );
    assert.equal(r.status, 200);
    const bytes = Buffer.from(await r.arrayBuffer());
    await writeFile(resolve(dir, "report." + format), bytes);
    if (format === "xlsx") {
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(bytes as never);
      assert.equal(book.worksheets.length, 5);
      assert.equal(book.getWorksheet("Summary")!.getCell("B10").value, -300);
    } else assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
  }
  console.log(
    "PASS PDF and Excel report generation and numeric balance parity",
  );
  const browser = await chromium.launch({
    channel: process.env.TPA_BROWSER_CHANNEL ?? "msedge",
    headless: true,
  });
  try {
    const context = await browser.newContext();
    await context.addCookies([
      { name: "better-auth.session_token", value: cookies[0], url: base },
    ]);
    const page = await context.newPage();

    const manualUser = id(),
      manualRegistration = id();
    await db.query(
      'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',
      [manualUser, "Manual fee participant", manualUser + "@example.invalid"],
    );
    await db.query(
      "INSERT INTO tpa.event_registrations(id,event_id,user_id,status,payment_status,fee_paise) VALUES($1,$2,$3,'registered','pending',50000)",
      [manualRegistration, eventId, manualUser],
    );
    await page.goto(base + "/admin/workspaces/payments");
    assert.equal(await page.getByRole("tab").count(), 2);
    await page.getByRole("tab", { name: "Overview", exact: true }).waitFor();
    await page.getByRole("tab", { name: "Approvals", exact: true }).waitFor();
    const card = page.locator(
      `a[href="/admin/workspaces/payments/events/${eventId}"]`,
    );
    await card
      .getByRole("heading", { name: "Finance acceptance workshop" })
      .waitFor();
    await card.getByText("Test hall", { exact: false }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Refresh", exact: true }).count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Export PDF", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Export Excel", exact: true })
        .count(),
      0,
    );
    const moneyInCard = await card
      .locator("dl")
      .last()
      .locator("dd")
      .allTextContents();
    assert.deepEqual(moneyInCard, ["₹1,100.00", "₹800.00"]);
    await page.getByRole("button", { name: "List view", exact: true }).click();
    const eventRow = page
      .getByRole("region", { name: "Event finance list", exact: true })
      .getByRole("row")
      .filter({ hasText: "Finance acceptance workshop" });
    assert.deepEqual(
      (await eventRow.getByRole("cell").allTextContents()).slice(-2),
      moneyInCard,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "List view", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await page.screenshot({
      path: resolve(dir, "overview-list-desktop.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Card view", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Add fee collection", exact: true })
        .count(),
      0,
    );
    const freshEvent = await call("/api/staff/events", {
      action: "save",
      version: 0,
      title: "Fresh expense workflow",
      description: "Synthetic draft created through Events",
      location: "Test hall",
      startsAt: "2026-12-01T05:30:00Z",
      endsAt: "2026-12-01T07:30:00Z",
      capacity: 30,
      feePaise: 0,
      visibility: "members",
      deliveryMode: "location",
    });
    const september = await call("/api/staff/events", {
      action: "save",
      version: 0,
      title: "September finance fixture",
      description: "Synthetic September event",
      location: "Test hall",
      startsAt: "2026-09-12T05:30:00Z",
      endsAt: "2026-09-12T07:30:00Z",
      capacity: 30,
      feePaise: 0,
      visibility: "members",
      deliveryMode: "location",
    });
    const septemberExpense = await call("/api/staff/finance", {
      action: "sheet.add",
      id: id(),
      eventId: september.id,
      date: "2026-11-05",
      lines: [line(2500)],
      submit: true,
    });
    await call(
      "/api/staff/finance",
      {
        action: "approve",
        id: septemberExpense.id,
        eventId: september.id,
        version: 1,
        reason: "Verified September fixture",
      },
      1,
    );
    await page.reload();
    await page.getByRole("link", { name: /Fresh expense workflow/ }).waitFor();
    const filter = page.locator("summary").filter({ hasText: /^Filter/ });
    await filter.click();
    await page.getByRole("checkbox", { name: "December", exact: true }).check();
    await page
      .getByRole("checkbox", { name: "September", exact: true })
      .check();
    await filter.locator("..").locator("select").selectOption("2026");
    await page.getByRole("link", { name: /Fresh expense workflow/ }).waitFor();
    assert.equal(await card.count(), 0);
    await filter.click();
    await page.getByLabel("Export filtered events").click();
    const downloaded = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export Excel", exact: true })
      .click();
    const downloadPath = await (await downloaded).path();
    assert.ok(downloadPath);
    const filteredWorkbook = new ExcelJS.Workbook();
    await filteredWorkbook.xlsx.readFile(downloadPath);
    const exportedEvents = filteredWorkbook.getWorksheet("Events")!;
    assert.equal(exportedEvents.getCell("A5").value, "Fresh expense workflow");
    assert.equal(
      exportedEvents.getCell("A6").value,
      "September finance fixture",
    );
    assert.equal(exportedEvents.rowCount, 6);
    assert.equal(
      filteredWorkbook.getWorksheet("Summary")!.getCell("B10").value,
      -25,
    );
    assert.equal(
      filteredWorkbook.getWorksheet("Event 2")!.getCell("A1").value,
      "September finance fixture",
    );
    const filteredPdf = await context.request.get(
      base +
        "/api/staff/finance/export?scope=events&format=pdf&months=09,12&year=2026",
    );
    assert.equal(filteredPdf.status(), 200);
    const pdfText = (await filteredPdf.body()).toString("latin1");
    for (const text of [
      "September finance fixture",
      "Fresh expense workflow",
      "Collections and refunds",
      "Event totals",
      "Period deficit",
    ])
      assert.ok(pdfText.includes(text), text);

    assert.match(
      String(filteredWorkbook.getWorksheet("Summary")!.getCell("B3").value),
      /September, December.*2026/,
    );
    const eventSheet = filteredWorkbook.getWorksheet("Event 1")!;
    assert.equal(eventSheet.getCell("A1").value, "Fresh expense workflow");
    assert.ok(
      ["Collections and refunds", "Expenses", "Event totals"].every((heading) =>
        eventSheet.getColumn(1).values.includes(heading),
      ),
    );

    await page.getByRole("link", { name: /Fresh expense workflow/ }).click();
    await page
      .getByRole("heading", { name: "No expenses yet", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Add Expense", exact: true })
      .click();
    await page.getByLabel("Expense header", { exact: true }).fill("Venue");
    await page
      .getByLabel("Description", { exact: true })
      .fill("Synthetic venue");
    await page.getByLabel("Amount (₹)", { exact: true }).fill("150");
    const expenseSubmission = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/staff/finance") &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Submit expenses for approval" })
      .click();
    const expenseResponse = await expenseSubmission;
    assert.equal(expenseResponse.status(), 200);
    const expenseId = (await expenseResponse.json()).id;
    await page
      .getByRole("button", { name: "Add Expense", exact: true })
      .click();
    const additional = await call("/api/staff/finance", {
      action: "sheet.add",
      id: id(),
      eventId: freshEvent.id,
      date: "2026-11-05",
      lines: [line(2500)],
      note: "Another expense while first awaits review",
      submit: true,
    });
    assert.equal(
      (await call("/api/staff/finance?eventId=" + freshEvent.id)).totals
        .expenses,
      0,
    );

    await call(
      "/api/staff/finance",
      {
        action: "approve",
        id: expenseId,
        eventId: freshEvent.id,
        version: 1,
        reason: "Verified synthetic expense",
      },
      1,
    );
    assert.equal(
      (await call("/api/staff/finance?eventId=" + freshEvent.id)).totals
        .expenses,
      15000,
    );
    const later = await call("/api/staff/finance", {
      action: "sheet.add",
      id: id(),
      eventId: freshEvent.id,
      date: "2026-11-05",
      lines: [line(5000)],
      note: "New expense after approval",
      submit: true,
    });
    assert.equal(
      (await call("/api/staff/finance?eventId=" + freshEvent.id)).totals
        .expenses,
      15000,
    );
    for (const entry of [additional, later]) {
      await call(
        "/api/staff/finance",
        {
          action: "approve",
          id: entry.id,
          eventId: freshEvent.id,
          version: 1,
          reason: "Verified additional expense",
        },
        1,
      );
    }
    assert.equal(
      (await call("/api/staff/finance?eventId=" + freshEvent.id)).totals
        .expenses,
      22500,
    );
    await page
      .getByRole("link", { name: "Back to Finance", exact: false })
      .click();
    const search = page.getByRole("searchbox", {
      name: "Search events by name",
    });
    const toolbarTops = await search.evaluate((node) =>
      Array.from(node.parentElement!.children).map(
        (child) => child.getBoundingClientRect().top,
      ),
    );
    assert.equal(toolbarTops.length, 3);
    assert.ok(
      Math.max(...toolbarTops) - Math.min(...toolbarTops) < 8,
      "Search, filter and export share a row",
    );
    await search.fill("missing event");
    await page
      .getByText("No events match your search and filters.", { exact: true })
      .waitFor();
    await search.fill("Finance acceptance");
    await card.waitFor();
    await page.screenshot({
      path: resolve(dir, "overview-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: resolve(dir, "overview-phone.png"),
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Overview has no page-level horizontal overflow",
    );
    await page.setViewportSize({ width: 1280, height: 900 });
    await card.click();
    await page
      .getByRole("button", { name: "Add fee collection", exact: true })
      .click();
    await page.locator('select[name="kind"]').selectOption("registered");
    await page
      .getByRole("combobox", { name: "Participant", exact: true })
      .selectOption(manualRegistration);
    await page
      .getByLabel("Transaction date", { exact: true })
      .fill("2026-11-05");
    await page.getByLabel("Method", { exact: true }).fill("UPI");
    await page
      .getByLabel("Reference", { exact: true })
      .fill("MANUAL-FEE-COLLECTION");
    await page
      .getByLabel("Note / correction reason", { exact: true })
      .fill("Participant fee received manually");
    const submitted = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/staff/finance/receipts") &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Submit to super admin", exact: true })
      .click();
    assert.equal((await submitted).status(), 200);
    await page
      .getByText(
        "Saved. Entries awaiting approval are shown separately from approved totals.",
        { exact: true },
      )
      .waitFor();
    const manualEntry = (
      await db.query(
        "SELECT id FROM tpa.finance_entries WHERE registration_id=$1",
        [manualRegistration],
      )
    ).rows[0].id;
    assert.equal(
      (await call("/api/staff/finance")).totals.received,
      110000,
      "Pending manual collection does not change lifetime total",
    );
    await page.getByRole("tab", { name: "Expenses", exact: true }).click();
    await page
      .getByRole("heading", {
        name: "Finance acceptance workshop",
        exact: true,
      })
      .waitFor();
    assert.equal(await page.getByRole("tab").count(), 2);
    await page.getByRole("tab", { name: "Expenses", exact: true }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Refresh", exact: true }).count(),
      0,
    );
    const summary = page.locator('dl[aria-label="Event financial summary"]');
    await summary.waitFor();
    assert.deepEqual(await summary.locator("dt").allTextContents(), [
      "Total collected",
      "Total expenses",
      "Net balance",
    ]);
    assert.equal(
      await page
        .getByRole("tabpanel")
        .locator('dl[aria-label="Event financial summary"]')
        .count(),
      0,
    );
    for (const name of [
      "Add Expense",
      "Add fee collection",
      "Export PDF",
      "Export Excel",
    ]) {
      const button = page.getByRole("button", { name, exact: true });
      await button.waitFor();
      const buttonBox = await button.boundingBox(),
        tabBox = await page
          .getByRole("tab", { name: "Expenses", exact: true })
          .boundingBox();
      assert.ok(
        buttonBox &&
          tabBox &&
          buttonBox.x > tabBox.x &&
          buttonBox.y < tabBox.y + tabBox.height &&
          buttonBox.y + buttonBox.height > tabBox.y,
        "Event actions share the tab row",
      );
    }
    assert.equal(
      await page
        .getByRole("heading", {
          name: "Expenses — event expense sheets",
          exact: true,
        })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByText("Enter actual spending under your own expense headers.", {
          exact: false,
        })
        .count(),
      0,
    );
    await page.screenshot({
      path: resolve(dir, "event-expenses-desktop.png"),
      fullPage: true,
    });

    await page
      .getByRole("button", { name: "Add Expense", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Submit expenses for approval",
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("button", { name: "Cancel edit", exact: true })
      .click();
    await page
      .getByRole("tab", { name: "Participant collections", exact: true })
      .click();
    const roster = page.getByRole("region", {
      name: "Participant fee collections",
      exact: true,
    });
    const participantRow = roster
      .getByRole("row")
      .filter({ hasText: "Manual fee participant" });
    await participantRow
      .getByText("Awaiting approval:", { exact: false })
      .waitFor();
    await page
      .getByText("Collection history and corrections", { exact: true })
      .click();
    await page
      .getByRole("region", { name: "Event receipts", exact: true })
      .getByText("Manual fee participant", { exact: false })
      .waitFor();
    await page
      .getByText("Collection history and corrections", { exact: true })
      .click();
    await review(manualEntry);
    await page.reload();
    await page
      .getByRole("tab", { name: "Participant collections", exact: true })
      .click();
    await participantRow.getByText("Collected", { exact: true }).waitFor();
    await page.screenshot({
      path: resolve(dir, "desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: resolve(dir, "phone.png"), fullPage: true });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Event collections have no page-level horizontal overflow",
    );
    const reverseManual = await call(
      "/api/staff/finance",
      receipt({ action: "refund.create", registrationId: manualRegistration }),
    );
    await review(reverseManual.id);
    await page
      .getByRole("link", { name: "Back to Finance", exact: false })
      .click();
    await page.getByRole("tab", { name: "Approvals", exact: true }).click();
    await page
      .getByRole("heading", {
        name: "Member receipt verification",
        exact: true,
      })
      .waitFor();
    console.log(
      "PASS Card/list totals match; only event exports; no Refresh; header summary has three fields; actions share the tab row; manual collection and expense workflows pass on desktop/mobile",
    );
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(
      base + "/admin/workspaces/payments/events/" + freshEvent.id,
    );
    await page
      .getByRole("button", { name: "Add fee collection", exact: true })
      .click();
    await page
      .getByLabel("Participant name", { exact: true })
      .fill("Walk-in finance test");
    await page.getByLabel("Amount (₹)", { exact: true }).fill("275.50");
    await page
      .getByLabel("Transaction date", { exact: true })
      .fill("2026-11-05");
    await page.getByLabel("Method", { exact: true }).fill("Cash");
    await page.getByLabel("Reference", { exact: true }).fill("WALKIN-TEST");
    await page
      .getByLabel("Note / correction reason", { exact: true })
      .fill("Synthetic walk-in receipt");
    assert.equal(
      await page
        .getByLabel("Participant name", { exact: true })
        .evaluate(
          (node) =>
            getComputedStyle(
              node.closest("fieldset")!,
            ).gridTemplateColumns.split(" ").length,
        ),
      3,
    );
    const manual = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/staff/finance/receipts") &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Submit to super admin", exact: true })
      .click();
    const manualResponse = await manual;
    assert.equal(manualResponse.status(), 200);
    const manualId = (await manualResponse.json()).id;
    await page
      .getByRole("row")
      .filter({ hasText: "Walk-in finance test" })
      .getByText(/Awaiting approval/)
      .waitFor();
    await call(
      "/api/staff/finance",
      {
        action: "approve",
        id: manualId,
        eventId: freshEvent.id,
        version: 1,
        reason: "Verified walk-in receipt",
      },
      1,
    );
    const manualData = await call(
      "/api/staff/finance?eventId=" + freshEvent.id,
    );
    assert.equal(manualData.totals.received, 27550);
    assert.equal(
      manualData.entries.find((entry: { id: string }) => entry.id === manualId)
        .participant_name,
      "Walk-in finance test",
    );
    console.log("PASS typed participant receipt, editable amount and approval");
    await context.close();
  } finally {
    await browser.close();
  }
  console.log("PASS authenticated desktop and mobile finance rendering");

  const voidSheet = await call("/api/staff/finance", {
    action: "sheet.save",
    id: id(),
    eventId,
    replacesId: sheet.id,
    void: true,
    submit: true,
    date: "2026-11-05",
    note: "Void incorrect expense sheet",
  });
  assert.equal(
    (await call("/api/staff/finance?eventId=" + eventId)).totals.expenses,
    80000,
  );
  await review(voidSheet.id);
  assert.equal(
    (await call("/api/staff/finance?eventId=" + eventId)).totals.expenses,
    0,
  );
  const voidReceipt = await call(
    "/api/staff/finance",
    receipt({
      action: "receipt.correct",
      replacesId: adminReceipt.id,
      void: true,
      amountPaise: 0,
      note: "Void incorrect sponsor receipt",
    }),
  );
  await review(voidReceipt.id);
  assert.equal(
    (await call("/api/staff/finance?eventId=" + eventId)).totals.netResult,
    0,
  );
  console.log(
    "PASS approved-record void revisions preserve balances until approval",
  );
  await db.query("UPDATE tpa.events SET completed_at=now() WHERE id=$1", [
    eventId,
  ]);
  await call("/api/staff/finance", receipt(), 0, 409);
  console.log("PASS closed-event restrictions");
  const previousHolder = (
    await db.query('SELECT email FROM public."user" WHERE id=$1', [users[1]])
  ).rows[0].email;
  const nextHolder = (
    await db.query('SELECT email FROM public."user" WHERE id=$1', [users[3]])
  ).rows[0].email;
  const setup = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/setup-super-admin.mts",
      "--email",
      nextHolder,
      "--database",
      name,
      "--replace-email",
      previousHolder,
    ],
    { env, encoding: "utf8" },
  );
  assert.equal(setup.status, 0, setup.stderr);
  assert.equal(
    (
      await db.query(
        "SELECT user_id FROM tpa.staff_roles WHERE role='super_administrator'",
      )
    ).rows[0].user_id,
    users[3],
  );
  console.log("PASS explicit super-admin replacement and session revocation");
  console.log(
    "Finance acceptance PASS: synthetic database only; no production migration or role assignment.",
  );
} finally {
  server?.kill();
  await new Promise((r) => setTimeout(r, 1000));
  storage.close();
  await db.end();
  if (created) await root.query("DROP DATABASE " + name + " WITH (FORCE)");
  await root.end();
}
