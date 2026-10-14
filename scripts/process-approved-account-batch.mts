/* eslint-disable @typescript-eslint/no-explicit-any -- Restricted operational JSON evidence is checked with assertions below. */
// Authenticated, resumable execution of the explicitly approved source batch.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
import {
  approvedAccountPolicy,
  approvedAccountSourceHash,
} from "../src/domain/approved-account-batch";
const base = process.env.TPA_ACCOUNT_BATCH_URL!;
assert.ok(
  base === "https://tpassociation.org" ||
    /^http:\/\/127\.0\.0\.1:\d+$/.test(base),
);
const production = base === "https://tpassociation.org";
if (production)
  assert.equal(process.env.TPA_EXECUTE_APPROVED_ACCOUNT_BATCH, "true");
const folder = ".local/account-batch",
  kind = production ? "production" : "rehearsal";
await mkdir(folder, { recursive: true });
const bytes = await readFile("../client/Database-200 CA.xlsx");
assert.equal(
  createHash("sha256").update(bytes).digest("hex"),
  approvedAccountSourceHash,
);
const db = new Pool(databaseOptions());
let cookie: string;
const reportPath = `${folder}/${kind}-results.json`;
let report: Record<string, any> = {
  sourceHash: approvedAccountSourceHash,
  policy: approvedAccountPolicy,
};
async function persist() {
  await writeFile(reportPath, JSON.stringify(report, null, 2));
}
async function api(path: string, body?: unknown) {
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      cookie,
      origin: base,
      ...(body && !(body instanceof FormData)
        ? { "content-type": "application/json" }
        : {}),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(240000),
  });
  const data = await response.json();
  assert.ok(
    response.ok,
    `API ${response.status}: ${data.error ?? "request failed"}`,
  );
  return data;
}
async function counts() {
  return (
    await db.query(
      'SELECT (SELECT count(*)::int FROM public."user") accounts,(SELECT count(*)::int FROM tpa.people) people,(SELECT count(*)::int FROM tpa.memberships) memberships,(SELECT count(*)::int FROM tpa.onboarding_mail) mail,(SELECT count(*)::int FROM tpa.onboarding_invitations) invitations',
    )
  ).rows[0];
}
try {
  const database = (await db.query("SELECT current_database() n")).rows[0].n;
  assert.equal(database, process.env.TPA_DATABASE_NAME);
  assert.ok(
    production
      ? database === "railway"
      : database.startsWith("tpa_onboarding_test_"),
  );
  if (production) {
    const backup = JSON.parse(
      await readFile(folder + "/backup-verification.json", "utf8"),
    );
    assert.ok(backup.restored && backup.sourceDatabase === "railway");
    assert.ok(Date.now() - Date.parse(backup.time) < 24 * 60 * 60 * 1000);
    const password = /^Password: (.+)$/m.exec(
      await readFile(".local/first-admin-password.txt", "utf8"),
    )?.[1];
    assert.ok(password);
    const res = await fetch(base + "/api/auth/sign-in/email", {
      method: "POST",
      headers: { origin: base, "content-type": "application/json" },
      body: JSON.stringify({
        email: "tollygungecacpestudycircle@gmail.com",
        password,
      }),
    });
    assert.equal(res.status, 200);
    cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
  } else
    cookie = (
      await readFile(".local/account-batch/rehearsal-cookie.txt", "utf8")
    ).trim();
  if (process.env.TPA_ACCOUNT_BATCH_RESUME === "true") {
    report = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(report.sourceHash, approvedAccountSourceHash);
    assert.equal(report.database, database);
    // A previous HTTP response may have been interrupted after a chunk committed.
    // The database batch is authoritative; resume never recreates its preview.
  } else {
    // Never silently create another preview when a prior operation may have started.
    try {
      await readFile(reportPath);
      throw new Error("Report exists. Explicitly resume the recorded batch.");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    report.database = database;
    report.before = await counts();
    report.existingAccounts = (
      await db.query(
        'SELECT id,name,email,"emailVerified" FROM public."user" ORDER BY id',
      )
    ).rows;
    report.existingCredentials = (
      await db.query(
        'SELECT id,"userId","providerId",password FROM public."account" ORDER BY id',
      )
    ).rows;
    report.existingPeople = (
      await db.query(
        "SELECT id,user_id,accepted,draft,published,accepted_verified FROM tpa.people ORDER BY id",
      )
    ).rows;
    const form = new FormData();
    form.set("mode", "approved-accounts");
    form.set("file", new File([bytes], "Database-200 CA.xlsx"));
    report.preview = await api("/api/staff/onboarding-import", form);
    report.batchId = report.preview.id;
    await persist();
  }
  const saved = (
    await db.query(
      "SELECT choices,source_hash FROM tpa.onboarding_batches WHERE id=$1",
      [report.batchId],
    )
  ).rows[0];
  assert.deepEqual(saved.choices, approvedAccountPolicy);
  assert.equal(saved.source_hash, approvedAccountSourceHash);
  const forecast = Object.fromEntries(
    ["created", "updated", "skipped", "conflict", "failed"].map((s) => [
      s,
      report.preview.rows.filter((r: any) => r.status === s).length,
    ]),
  );
  report.forecast = forecast;
  if (production) {
    const rehearsal = JSON.parse(
      await readFile(folder + "/rehearsal-results.json", "utf8"),
    );
    assert.equal(rehearsal.verified, true);
    assert.deepEqual(forecast, rehearsal.forecast);
    assert.deepEqual(
      report.preview.rows.map((r: any) => [
        r.sourceRow,
        r.email,
        r.membershipNumber,
        r.status,
      ]),
      rehearsal.preview.rows.map((r: any) => [
        r.sourceRow,
        r.email,
        r.membershipNumber,
        r.status,
      ]),
    );
  }
  let result;
  do {
    result = await api("/api/staff/onboarding-import", {
      action: "commit",
      id: report.batchId,
      version: 1,
    });
    report.results = result.results;
    await persist();
    console.log(
      JSON.stringify({
        processed: result.processed ?? result.results.length,
        total: 211,
        totals: result.totals,
      }),
    );
  } while (result.complete === false);
  const replay = await api("/api/staff/onboarding-import", {
    action: "commit",
    id: report.batchId,
  });
  assert.equal(replay.duplicate, true);
  assert.deepEqual(replay.results, report.results);
  const created = report.results.filter((r: any) => r.status === "created");
  assert.equal(created.length, forecast.created);
  assert.equal(report.results.length, 211);
  report.after = await counts();
  assert.equal(report.after.accounts - report.before.accounts, created.length);
  assert.equal(report.after.people - report.before.people, created.length);
  assert.equal(
    report.after.memberships - report.before.memberships,
    created.length,
  );
  assert.equal(report.after.mail, report.before.mail);
  assert.equal(report.after.invitations, report.before.invitations);
  assert.deepEqual(
    (
      await db.query(
        'SELECT id,name,email,"emailVerified" FROM public."user" WHERE id=ANY($1::text[]) ORDER BY id',
        [report.existingAccounts.map((r: any) => r.id)],
      )
    ).rows,
    report.existingAccounts,
  );
  assert.deepEqual(
    (
      await db.query(
        "SELECT id,user_id,accepted,draft,published,accepted_verified FROM tpa.people WHERE id=ANY($1::uuid[]) ORDER BY id",
        [report.existingPeople.map((r: any) => r.id)],
      )
    ).rows,
    report.existingPeople,
  );
  assert.deepEqual(
    (
      await db.query(
        'SELECT id,"userId","providerId",password FROM public."account" WHERE id=ANY($1::text[]) ORDER BY id',
        [report.existingCredentials.map((r: any) => r.id)],
      )
    ).rows,
    report.existingCredentials,
  );
  const held = (
    await db.query(
      'SELECT h.user_id,p.accepted,p.accepted_verified,p.published,u."emailVerified" FROM tpa.account_invitation_holds h JOIN tpa.people p ON p.user_id=h.user_id JOIN public."user" u ON u.id=h.user_id WHERE source_batch_id=$1 AND released_at IS NULL',
      [report.batchId],
    )
  ).rows;
  assert.equal(held.length, created.length);
  for (const r of held) {
    const outcome = created.find((o: any) => o.accountId === r.user_id);
    assert.ok(outcome);
    const source = report.preview.rows.find(
      (o: any) => o.sourceRow === outcome.sourceRow,
    );
    assert.deepEqual(r.accepted.addresses, source.member.addresses);
    assert.equal(r.accepted.organization, source.member.organization);
    assert.equal(r.accepted.jobTitle, source.member.designation);
    assert.equal(r.accepted.addresses.correspondence.district, "");
    assert.equal(r.accepted_verified, false);
    assert.equal(r.published, null);
    assert.equal(r.emailVerified, false);
  }
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int n FROM public."account" a JOIN tpa.account_invitation_holds h ON h.user_id=a."userId" WHERE h.source_batch_id=$1',
        [report.batchId],
      )
    ).rows[0].n,
    0,
  );
  const register = await api("/api/staff/members?view=register");
  assert.equal(register.total, report.after.memberships);
  const directory = await api("/api/staff/members?view=accounts");
  assert.equal(directory.total, report.after.accounts);
  report.verified = true;
  report.completed = new Date().toISOString();
  await persist();
  console.log(
    JSON.stringify({
      created: created.length,
      held: 211 - created.length,
      invitationsSent: 0,
      verified: true,
    }),
  );
} finally {
  await db.end();
}
