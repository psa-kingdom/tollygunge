/** Synthetic restricted-role acceptance; hosted credentials are never inherited. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { assertQaRoot, syntheticEnvironment } from "./launch-test-safety.mjs";
import { localIdentity } from "./security/rehearse-roles.mjs";
import { quoteIdentifier as quote } from "./security/database-permissions.mjs";

const stages = [
  ["roles", ["scripts/security/verify-database-roles.mjs"]],
  ["email-runtime", ["scripts/security/verify-email-role-runtime.mjs"]],
  ["core-browser", ["scripts/verify-launch-isolated.mjs", "--fallback-outage", "--public-interactions"]],
  ["member-foundation", ["--import", "tsx", "scripts/test-member-foundation.mts", "--http"]],
  ["approved-accounts", ["--import", "tsx", "scripts/test-approved-accounts.mts"]],
  ["import-jobs", ["--import", "tsx", "scripts/test-member-import-jobs.mts", "--http"]],
  ["invitation-db", ["--import", "tsx", "scripts/test-invitation-release.mts"]],
  ["invitation-http", ["--import", "tsx", "scripts/test-invitation-release.mts", "--http"]],
  ["website-control", ["--import", "tsx", "scripts/test-website-control.mts", "--browser"]],
  ["event-flow", ["--import", "tsx", "scripts/test-event-flow.mts"]],
  ["engagement", ["--import", "tsx", "scripts/test-event-engagement.mts"]],
  ["event-operations", ["--import", "tsx", "scripts/test-event-operational.mts", "--browser"]],
];
const args = process.argv.slice(2);
assert.ok(!args.length || (args.length === 2 && args[0] === "--only" && args[1]), "Use --only with comma-separated stage names.");
const requested = args.length ? args[1].split(",") : stages.map(([name]) => name);
assert.ok(requested.length && requested.every(name => stages.some(([label]) => label === name)), "Unknown restricted acceptance stage.");
const selected = stages.filter(([name]) => requested.includes(name));
const rootUrl = assertQaRoot(process.env.DATABASE_URL);
const runId = new Date().toISOString().replaceAll(":", "-") + "-" + randomUUID().slice(0, 8);
const output = resolve(process.env.TPA_SECURITY_OUTPUT || ".local/launch-readiness", "restricted-" + runId);
const rolesDirectory = output + "/roles";
await mkdir(rolesDirectory, { recursive: true });
const env = await syntheticEnvironment(process.env, process.cwd(), rootUrl.href);
Object.assign(env, {
  TPA_BROWSER_CHANNEL: process.env.TPA_BROWSER_CHANNEL ?? "",
  TPA_JOB_BROWSER: "true", TPA_RESTRICTED_ROLE_TESTS: "true",
  TPA_ROLE_EVIDENCE_DIR: rolesDirectory, TPA_SECURITY_OUTPUT: output,
  TPA_ISOLATED_OUTPUT: output + "/core-results.json",
  TPA_PUBLIC_INTERACTION_OUTPUT: output + "/public-interactions",
});
assert.ok(["", "chrome", "msedge"].includes(env.TPA_BROWSER_CHANNEL), "Unsupported browser channel.");
const report = { results: [], complete: false, cleanup: false, externalProviders: false, started: new Date().toISOString() };
const save = () => writeFile(output + "/results.json", JSON.stringify(report, null, 2));

async function cleanup() {
  const root = new Pool({ connectionString: rootUrl.href, ssl: false, max: 1 });
  const rows = [];
  try {
    for (const file of (await readdir(rolesDirectory)).filter(name => name.endsWith(".json"))) {
      const record = JSON.parse(await readFile(rolesDirectory + "/" + file, "utf8"));
      const connection = new URL(rootUrl); connection.pathname = "/" + record.database;
      const expected = localIdentity({ DATABASE_URL: connection.href, TPA_DATABASE_NAME: record.database, DATABASE_SSL: "false" });
      assert.deepEqual(record.roles, expected.roles, "Only exact roles derived from this registered fixture may be removed.");
      assert.equal((await root.query("SELECT 1 FROM pg_database WHERE datname=$1", [record.database])).rowCount, 0, "Harness must clean its own disposable database first.");
      for (const role of Object.values(expected.roles))
        if ((await root.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role])).rowCount)
          await root.query(`DROP ROLE ${quote(role)}`);
      const remaining = (await root.query("SELECT count(*)::int AS n FROM pg_roles WHERE rolname=ANY($1::text[])", [Object.values(expected.roles)])).rows[0].n;
      assert.equal(remaining, 0);
      rows.push({ database: record.database, remainingRoles: remaining, remainingDatabases: 0 });
    }
    return rows;
  } finally { await root.end(); }
}

await save();
try {
  for (const [label, stageArgs] of selected) {
    let log = "";
    const start = Date.now();
    const code = await new Promise((done, reject) => {
      const child = spawn(process.execPath, ["--import", "./tests/helpers/restricted-runtime.mjs", ...stageArgs], { env, stdio: ["ignore", "pipe", "pipe"] });
      child.stdout.on("data", chunk => { log += chunk; });
      child.stderr.on("data", chunk => { log += chunk; });
      child.once("error", reject); child.once("close", done);
    });
    await writeFile(output + "/" + label + ".log", log);
    report.results.push({ label, code, elapsedMs: Date.now() - start });
    for (const artifact of ["test-results", "playwright-report"])
      try { await cp(artifact, output + "/" + label + "/" + artifact, { recursive: true }); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    await save();
    console.log(JSON.stringify(report.results.at(-1)));
  }
  report.complete = true;
} finally {
  try { report.cleanupResults = await cleanup(); report.cleanup = true; }
  finally { report.completed = new Date().toISOString(); await save(); console.log("Restricted evidence: " + output + "/results.json"); }
}
if (report.results.some(row => row.code !== 0)) process.exitCode = 1;
