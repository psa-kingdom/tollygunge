/** Local-only population acceptance. Never loads .env.local or contacts production. */
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { memberHeaders } from "../src/domain/member-import";

const rootUrl = new URL(process.env.DATABASE_URL || "");
assert.equal(rootUrl.hostname, "127.0.0.1", "Local disposable PostgreSQL required");
assert.equal(rootUrl.port, "55439", "Dedicated QA port required");
const name = "tpa_onboarding_test_launch_" + randomUUID().replaceAll("-", "");
const root = new Pool({ connectionString: rootUrl.href, ssl: false });
const url = new URL(rootUrl); url.pathname = "/" + name;
const base = "http://127.0.0.1:3141";
const secret = randomBytes(32).toString("hex");
// Deliberate allowlist: no inherited provider credentials or credential-file paths.
const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
  TEMP: process.env.TEMP, TMP: process.env.TMP, USERPROFILE: process.env.USERPROFILE,
  DATABASE_URL: url.href, DATABASE_SSL: "false", TPA_DATABASE_NAME: name,
  BETTER_AUTH_URL: base, BETTER_AUTH_SECRET: secret, ONBOARDING_ENABLED: "true",
  TPA_MAIL_SINK: "true", TPA_TEST_STORAGE: "false" };
const db = new Pool({ connectionString: url.href, ssl: false });
let server: ReturnType<typeof spawn> | undefined;
const measurements: { operation: string; ms: number }[] = [];
async function command(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(Error(`Command failed: ${code}`)));
  });
}
try {
  await root.query(`CREATE DATABASE ${name}`);
  await command(["scripts/migrate.mjs"]);
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3141"], { env, stdio: "ignore" });
  let ready = false;
  for (let n = 0; n < 60; n++) {
    if (server.exitCode !== null) throw Error("QA server stopped");
    try { if ((await fetch(base + "/login")).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  assert.ok(ready, "QA server ready");
  const actor = randomUUID(), token = randomBytes(32).toString("hex");
  await db.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)', [actor, "Launch QA administrator", "launch-admin@example.invalid"]);
  await db.query("INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')", [actor]);
  await db.query('INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())', [randomUUID(), token, actor]);
  const cookie = "better-auth.session_token=" + encodeURIComponent(token + "." + createHmac("sha256", secret).update(token).digest("base64"));
  async function request(path: string, body?: unknown) {
    const started = performance.now();
    const response = await fetch(base + path, { method: body ? "POST" : "GET", headers: { cookie, origin: base, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    measurements.push({ operation: path.split("?")[0], ms: performance.now() - started });
    assert.equal(response.status, 200, `${path}: ${response.status}`);
    return response.json();
  }
  for (let batchIndex = 0; batchIndex < 2; batchIndex++) {
    const csv = [memberHeaders.join(","), ...Array.from({ length: 250 }, (_, row) => {
      const i = batchIndex * 250 + row;
      return ["Mr.", "Launch", "Member" + i, "LG-" + i, `launch-${i}@example.invalid`, "", "", "", "", "", "", "", ""].join(",");
    })].join("\n");
    const form = new FormData(); form.set("mode", "members");
    form.set("file", new File([csv], "launch-250.csv", { type: "text/csv" }));
    const start = performance.now();
    const response = await fetch(base + "/api/staff/onboarding-import", { method: "POST", headers: { cookie, origin: base }, body: form });
    assert.equal(response.status, 200); const preview = await response.json();
    assert.equal(preview.rows.length, 250);
    let result, chunks = 0;
    do { result = await request("/api/staff/onboarding-import", { id: preview.id, version: 1, action: "commit" }); chunks++; assert.ok(chunks <= 10); } while (!result.complete);
    assert.equal(result.totals.created, 250); assert.equal(chunks, 10);
    assert.equal((await request("/api/staff/onboarding-import", { id: preview.id, action: "commit" })).duplicate, true);
    measurements.push({ operation: "250-row-import", ms: performance.now() - start });
  }
  assert.equal((await db.query("SELECT count(*)::int n FROM tpa.onboarding_mail")).rows[0].n, 0);
  const people = [];
  for (let offset = 0; offset < 500; offset += 25) {
    const page = await request(`/api/staff/members?view=register&offset=${offset}`);
    assert.equal(page.total, 500); people.push(...page.rows);
  }
  assert.equal(new Set(people.map(p => p.person_id)).size, 500);
  for (const person of people) await request("/api/staff/member-actions", { personId: person.person_id, action: "invite" });
  const counts = (await db.query("SELECT (SELECT count(*) FROM tpa.people WHERE user_id IS NOT NULL)::int linked, (SELECT count(*) FROM tpa.memberships)::int memberships, (SELECT count(*) FROM tpa.onboarding_invitations)::int invitations, (SELECT count(*) FROM tpa.onboarding_mail WHERE kind='invitation')::int mail, (SELECT count(*) FROM public.\"user\")::int accounts")).rows[0];
  assert.deepEqual(counts, { linked: 500, memberships: 500, invitations: 500, mail: 500, accounts: 501 });
  await mkdir(".local/launch-gate", { recursive: true });
  await writeFile(".local/launch-gate/population.json", JSON.stringify({ passed: true, syntheticOnly: true, mailSink: true, counts, measurements, completed: new Date().toISOString() }, null, 2));
  console.log("PASS: two 250-row imports; 500 distinct linked member accounts; 500 sink-only invitation jobs; idempotent replay.");
} finally {
  server?.kill();
  if (server && server.exitCode === null) await new Promise(r => server!.once("exit", r));
  await db.end();
  await root.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  assert.equal((await root.query("SELECT count(*)::int n FROM pg_database WHERE datname=$1", [name])).rows[0].n, 0);
  await root.end(); console.log("PASS: exact disposable database removed.");
}
