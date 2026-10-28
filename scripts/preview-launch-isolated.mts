/** Local interactive preview. Never reads or changes a hosted database. */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
import { hashPassword } from "better-auth/crypto";
import { assertQaRoot, syntheticEnvironment, validateBuildIdentity } from "./launch-test-safety.mjs";
import { quoteIdentifier } from "./security/database-permissions.mjs";
import { personBody } from "../src/domain/people";
import { invitationDefaults } from "../src/domain/invitation-template";
import { invitationTemplateAction, invitationTemplateState } from "../src/lib/invitation-release";

const rootUrl = assertQaRoot(process.env.DATABASE_URL);
const build = await validateBuildIdentity();
assert.ok(build.valid, build.reason);
const origin = "http://127.0.0.1:3185";
const email = "qa-admin@example.invalid";
const password = "Launch!1234";
const runId = randomUUID();
// PostgreSQL identifiers are limited to 63 bytes. Retain the entire UUID.
const database = "tpa_onboarding_test_ui_" + runId.replaceAll("-", "");
assert.ok(Buffer.byteLength(database, "utf8") <= 63);
const output = resolve(".local/launch-readiness", "interactive-202-" + runId);
await mkdir(output, { recursive: true });
const root = new Pool({ connectionString: rootUrl.href, ssl: false, max: 1 });
const fixtureUrl = new URL(rootUrl); fixtureUrl.pathname = "/" + database;
const env = await syntheticEnvironment(process.env, process.cwd(), rootUrl.href);
Object.assign(env, {
  DATABASE_URL: fixtureUrl.href, TPA_DATABASE_NAME: database,
  BETTER_AUTH_URL: origin, TPA_TEST_URL: origin,
  BETTER_AUTH_SECRET: "synthetic-interactive-preview-secret-over-32-characters",
  ONBOARDING_ENABLED: "true", TPA_MAIL_SINK: "true",
});
for (const [key, value] of Object.entries(env))
  if (/^(RESEND_.*KEY|SMTP_|R2_|CLOUDFLARE_|GOOGLE_.*SECRET)/.test(key))
    assert.ok(!value, "External service credentials are forbidden in the preview.");
const report: Record<string, unknown> = {
  runId, database, origin, syntheticOnly: true, externalProviders: false,
  emailWorkerStarted: false, initialHeldMembers: 202, passed: false,
  cleanup: false, started: new Date().toISOString(), buildId: build.identity?.buildId,
  browserAcceptance: "Recorded separately by the release coordinator.",
};
const save = () => writeFile(output + "/results.json", JSON.stringify(report, null, 2));
let created = false;
let server: ChildProcess | undefined;
let fixture: Pool | undefined;
let interrupted = false;
let stop!: () => void;
const stopped = new Promise<void>(done => { stop = done; });
const onSignal = () => { interrupted = true; stop(); };
process.once("SIGINT", onSignal); process.once("SIGTERM", onSignal);

async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await fixture!.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT"); return result;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
async function snapshot() {
  return (await fixture!.query(`SELECT
    (SELECT count(*)::int FROM tpa.account_invitation_holds WHERE released_at IS NULL) AS held,
    (SELECT count(*)::int FROM tpa.onboarding_mail WHERE kind='invitation') AS invitation_messages,
    (SELECT count(*)::int FROM tpa.onboarding_mail WHERE kind='invitation' AND status='queued') AS queued,
    (SELECT count(*)::int FROM tpa.onboarding_invitations) AS invitation_tokens,
    (SELECT count(*)::int FROM tpa.invitation_release_reviews WHERE confirmed_at IS NOT NULL) AS confirmed_reviews,
    (SELECT count(*)::int FROM public."account" WHERE "providerId"='credential') AS credentials,
    (SELECT count(*)::int FROM tpa.memberships) AS memberships`)).rows[0];
}
try {
  // Refuse a busy port; never terminate an existing listener.
  await new Promise<void>((done, reject) => {
    const probe = createServer(); probe.once("error", reject);
    probe.listen(3185, "127.0.0.1", () => probe.close(error => error ? reject(error) : done()));
  });
  await root.query(`CREATE DATABASE ${quoteIdentifier(database)}`); created = true;
  await save();
  const migrationCode = await new Promise<number | null>((done, reject) => {
    const child = spawn(process.execPath, ["scripts/migrate.mjs"], { env, stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    child.stdout.on("data", chunk => { log += chunk; });
    child.stderr.on("data", chunk => { log += chunk; });
    child.once("error", reject);
    child.once("close", async code => { await writeFile(output + "/migrations.log", log); done(code); });
  });
  assert.equal(migrationCode, 0, "Disposable migrations failed; inspect the local evidence.");
  assert.ok(!interrupted, "Preview startup interrupted.");
  fixture = new Pool({ connectionString: fixtureUrl.href, ssl: false, max: 3 });
  assert.equal((await fixture.query("SELECT current_database() AS name")).rows[0].name, database);
  const administrator = randomUUID();
  const hashed = await hashPassword(password);
  await transaction(async client => {
    await client.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Synthetic QA administrator\',$2,false)', [administrator, email]);
    await client.query('INSERT INTO public."account"(id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES($1,$2,\'credential\',$2,$3,now(),now())', [randomUUID(), administrator, hashed]);
    await client.query("INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')", [administrator]);
    await client.query("INSERT INTO tpa.operator_approved_identities(user_id,source) VALUES($1,'user_authorized_bootstrap')", [administrator]);
    await client.query("UPDATE tpa.onboarding_settings SET test_recipients=$1", [JSON.stringify([email])]);
    for (let index = 1; index <= 202; index++) {
      const suffix = String(index).padStart(3, "0");
      const user = randomUUID(), person = randomUUID();
      const memberEmail = `synthetic-member-${suffix}@example.invalid`;
      const body = personBody({ name: `Synthetic Member ${suffix}`, firstName: "Synthetic", lastName: `Member ${suffix}`, email: memberEmail });
      await client.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,false)', [user, body.name, memberEmail]);
      await client.query("INSERT INTO tpa.people(id,user_id,accepted,draft,contact_email) VALUES($1,$2,$3,$3,$4)", [person, user, body, memberEmail]);
      await client.query("INSERT INTO tpa.memberships(id,person_id,membership_number,type,status,source) VALUES($1,$2,$3,'Annual','active','staff')", [randomUUID(), person, "SYNTHETIC-" + suffix]);
      await client.query("INSERT INTO tpa.account_invitation_holds(user_id) VALUES($1)", [user]);
    }
    const state = await invitationTemplateState(client);
    const saved = await invitationTemplateAction(client, administrator, { action: "save", revision: state.revision, ...invitationDefaults });
    await invitationTemplateAction(client, administrator, { action: "approve", id: saved.latest_id, revision: saved.revision });
  });
  report.initialSnapshot = await snapshot();
  assert.equal((report.initialSnapshot as Record<string, number>).held, 202);
  assert.equal((report.initialSnapshot as Record<string, number>).invitation_messages, 0);
  assert.equal((report.initialSnapshot as Record<string, number>).invitation_tokens, 0);
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3185"], { env, stdio: ["ignore", "pipe", "pipe"] });
  let logs = Promise.resolve();
  for (const stream of [server.stdout!, server.stderr!]) stream.on("data", chunk => { logs = logs.then(() => appendFile(output + "/server.log", chunk)); });
  server.once("error", stop); server.once("exit", stop);
  let ready = false;
  for (let attempt = 0; attempt < 60 && !interrupted; attempt++) {
    assert.equal(server.exitCode, null, "Preview server stopped before readiness.");
    try { if ((await fetch(origin + "/api/health", { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch { /* Wait for the owned server. */ }
    await new Promise(done => setTimeout(done, 500));
  }
  assert.ok(ready, "Local preview did not become ready.");
  report.passed = true; report.readyAt = new Date().toISOString(); await save();
  console.log(JSON.stringify({ url: origin, email, password, syntheticHeldMembers: 202 }));
  await stopped;
  report.stopReason = interrupted ? "Owner interruption" : "Preview process exited";
  if (!interrupted) process.exitCode = 1;
  await logs;
} finally {
  try {
    if (server && server.exitCode === null) {
      const exited = new Promise(done => server!.once("exit", done)); server.kill("SIGTERM");
      await Promise.race([exited, new Promise(done => setTimeout(done, 10000))]);
      if (server.exitCode === null) { server.kill("SIGKILL"); await exited; }
    }
    if (fixture) {
      try { report.finalSnapshot = await snapshot(); }
      catch { report.finalSnapshotUnavailable = true; }
      finally { await fixture.end(); }
    }
    if (created) {
      await root.query(`DROP DATABASE ${quoteIdentifier(database)} WITH (FORCE)`);
      report.remainingOwnDatabases = (await root.query("SELECT count(*)::int AS n FROM pg_database WHERE datname=$1", [database])).rows[0].n;
      assert.equal(report.remainingOwnDatabases, 0);
    }
    report.cleanup = true;
  } finally { await root.end(); report.completed = new Date().toISOString(); await save(); }
}
