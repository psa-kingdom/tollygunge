import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { assertQaRoot, syntheticEnvironment } from "./launch-test-safety.mjs";
import { localIdentity } from "./security/rehearse-roles.mjs";
import { quoteIdentifier as quote } from "./security/database-permissions.mjs";

const rootUrl = assertQaRoot(process.env.DATABASE_URL);
const output = resolve(process.env.TPA_SECURITY_OUTPUT || ".local/launch-readiness", "newsletter-" + new Date().toISOString().replaceAll(":", "-") + "-" + randomUUID().slice(0, 8));
await mkdir(output, { recursive: true });
const root = new pg.Pool({ connectionString: rootUrl.href, ssl: false });
const name = "tpa_onboarding_test_public_" + randomUUID().replaceAll("-", "");
const fixtureUrl = new URL(rootUrl); fixtureUrl.pathname = "/" + name;
const env = await syntheticEnvironment(process.env, process.cwd(), rootUrl.href);
Object.assign(env, {
  DATABASE_URL: fixtureUrl.href, TPA_DATABASE_NAME: name,
  BETTER_AUTH_URL: "http://127.0.0.1:3170",
  BETTER_AUTH_SECRET: "synthetic-public-subscription-secret-32-characters",
  TPA_RESTRICTED_ROLE_TESTS: process.env.TPA_RESTRICTED_ROLE_TESTS === "true" ? "true" : "false",
  TPA_ROLE_EVIDENCE_DIR: output + "/roles",
});
const report = { results: [], cleanup: false, externalProviders: false, restrictedWorkers: env.TPA_RESTRICTED_ROLE_TESTS === "true" };
const { roles } = localIdentity(env);
let created = false;
async function run(label, args) {
  const code = await new Promise((done, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: "inherit" });
    child.once("error", reject); child.once("exit", done);
  });
  report.results.push({ label, code });
  if (code !== 0) throw Error(label + " failed");
}
try {
  await root.query(`CREATE DATABASE ${quote(name)}`); created = true;
  await run("migrations", ["scripts/migrate.mjs"]);
  await run("newsletter-and-regressions", ["--import", "tsx", "--test", "--test-concurrency=1", "tests/public-newsletter.integration.ts", "tests/email.integration.ts", "tests/identity.integration.ts"]);
} finally {
  try {
    if (created) {
      await root.query(`DROP DATABASE ${quote(name)} WITH (FORCE)`);
      if ((await root.query("SELECT 1 FROM pg_database WHERE datname=$1", [name])).rowCount) throw Error("Disposable database was not removed");
      for (const role of Object.values(roles))
        if ((await root.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role])).rowCount)
          await root.query(`DROP ROLE ${quote(role)}`);
      report.remainingRoles = (await root.query("SELECT count(*)::int AS n FROM pg_roles WHERE rolname=ANY($1::text[])", [Object.values(roles)])).rows[0].n;
      if (report.remainingRoles !== 0) throw Error("Disposable roles were not removed");
    }
    report.cleanup = true;
  } finally {
    await root.end();
    await writeFile(output + "/backend-results.json", JSON.stringify(report, null, 2));
    console.log("Newsletter evidence: " + output + "/backend-results.json");
  }
}
