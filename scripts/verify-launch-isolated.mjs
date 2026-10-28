/** Run backend/browser launch regressions in a local disposable database. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import pg from "pg";
const url = new URL(process.env.DATABASE_URL || "");
assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "55439");
const root = new pg.Pool({ connectionString: url.href, ssl: false });
const port = Number(process.env.TPA_ISOLATED_PORT || 3145);
assert.ok(Number.isInteger(port) && port >= 3145 && port <= 3199);
const name = "tpa_onboarding_test_member_" + randomUUID().replaceAll("-", "");
url.pathname = "/" + name;
const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
  TEMP: process.env.TEMP, TMP: process.env.TMP, USERPROFILE: process.env.USERPROFILE,
  DATABASE_URL: url.href, DATABASE_SSL: "false", TPA_DATABASE_NAME: name,
  BETTER_AUTH_URL: `http://127.0.0.1:${port}`, BETTER_AUTH_SECRET: "synthetic-launch-isolated-secret-32-characters",
  ONBOARDING_ENABLED: "true", TPA_MAIL_SINK: "true", TPA_BROWSER_CHANNEL: process.env.TPA_BROWSER_CHANNEL ?? "",
  TPA_TEST_URL: `http://127.0.0.1:${port}`, TPA_PRIVATE_HEADER_TEST_URL: `http://127.0.0.1:${port}`, TPA_DESIGN_QA_OUTPUT: process.env.TPA_DESIGN_QA_OUTPUT, TPA_TEST_STORAGE: "false", TPA_TEST_EXPECT_STORAGE_DISABLED: "true",
  TPA_RESTRICTED_ROLE_TESTS:process.env.TPA_RESTRICTED_ROLE_TESTS,TPA_ROLE_EVIDENCE_DIR:process.env.TPA_ROLE_EVIDENCE_DIR,
  RESEND_WEBHOOK_SECRET: "whsec_" + Buffer.from("synthetic-disposable-secret").toString("base64") };
const results = [];
// Next also reads local dotenv files. Explicitly blank keys not deliberately
// configured above so a disposable run cannot inherit hosted provider access.
for (const file of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  try {
    for (const line of (await readFile(file, "utf8")).split(/\r?\n/)) {
      const key = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];
      if (key && !(key in env)) env[key] = "";
    }
  } catch (error) { if (error.code !== "ENOENT") throw error; }
}
const browserOnly = process.argv.includes("--browser-only");
const grepIndex = process.argv.indexOf("--browser-grep");
assert.ok(grepIndex < 0 || process.argv[grepIndex + 1], "Supply a browser grep expression");
let server, outageServer;
async function run(label, args) {
  const start = performance.now();
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: "inherit" });
    child.once("error", reject); child.once("exit", resolve);
  });
  results.push({ label, code, elapsedMs: performance.now() - start });
  return code;
}
try {
  await root.query(`CREATE DATABASE ${name}`);
  assert.equal(await run("migrations", ["scripts/migrate.mjs"]), 0);
  assert.equal(await run("postal-fixtures", ["--import", "tsx", "scripts/provision-postal.mts"]), 0);
  if (!browserOnly) {
    await run("backend", ["--import", "tsx", "--test", "tests/database.integration.ts", "tests/identity.integration.ts", "tests/email.integration.ts", "tests/onboarding-auth.integration.ts", "tests/onboarding-delivery.integration.ts"]);
    await run("member-foundation", ["--conditions=react-server", "--import", "tsx", "--test", "tests/member-foundation.integration.ts"]);
  }
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env, stdio: "inherit" });
  let ready = false;
  for (let n = 0; n < 60; n++) {
    if (server.exitCode !== null) throw Error("QA server stopped");
    try { if ((await fetch(env.TPA_TEST_URL + "/login")).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  assert.ok(ready);
  if (process.argv.includes("--fallback-outage")) {
    assert.ok(port < 3199);
    env.TPA_FALLBACK_OUTAGE_URL = `http://127.0.0.1:${port + 1}`;
    outageServer = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port + 1)], {
      env: { ...env, DATABASE_URL: "postgresql://synthetic@127.0.0.1:1/tpa_unreachable", BETTER_AUTH_URL: env.TPA_FALLBACK_OUTAGE_URL }, stdio: "inherit",
    });
    let outageReady = false;
    for (let n = 0; n < 60; n++) {
      if (outageServer.exitCode !== null) throw Error("Outage QA server stopped");
      try { await fetch(env.TPA_FALLBACK_OUTAGE_URL + "/api/health"); outageReady = true; break; } catch {}
      await new Promise(r => setTimeout(r, 1000));
    }
    assert.ok(outageReady);
  }
  if (!browserOnly) await run("onboarding-http", ["--import", "tsx", "--test", "tests/onboarding-http.integration.ts", "tests/workspace-ux-http.integration.ts"]);
  // The lifecycle test publishes an extra required field. Restore baseline policy
  // in this disposable database before browser fixtures expecting initialFields.
  await run("browser-policy-fixture", ["--import", "tsx", "--input-type=module", "-e", "import {Pool} from 'pg';import {initialFields} from './src/domain/verification.ts';const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:false});try{await p.query('INSERT INTO tpa.verification_policies(version,fields) SELECT coalesce(max(version),0)+1,$1::jsonb FROM tpa.verification_policies',[JSON.stringify(initialFields)]);}finally{await p.end();}"]);
  if (!process.argv.includes("--skip-browser")) {
    assert.equal(await run("portal-browser-fixtures", ["--import", "tsx", "scripts/provision-launch-browser.mts"]), 0);
    Object.assign(env, {
      TPA_UI_ADMIN_EMAIL: "portal-admin@example.invalid", TPA_UI_ADMIN_PASSWORD: "Launch!1234",
      TPA_UI_MEMBER_EMAIL: "portal-member@example.invalid", TPA_UI_MEMBER_PASSWORD: "Launch!1234",
    });
    const code = await run("browser", ["node_modules/@playwright/test/cli.js", "test", ...(grepIndex < 0 ? [] : ["--grep", process.argv[grepIndex + 1]])]);
    // Preserve the first result; the outer runner archives traces before another stage.
    if (code !== 0) console.error("Browser acceptance failed; no automatic retry was run.");
  }
  if(process.argv.includes('--public-interactions')){
    env.TPA_PUBLIC_QA_URL=env.TPA_TEST_URL;
    env.TPA_INTERACTION_QA_OUTPUT=process.env.TPA_PUBLIC_INTERACTION_OUTPUT||'.local/phase7b/public-interactions';
    await run('public-interactions',['--import','tsx','scripts/verify-premium-interactions.mts']);
  }
  if (process.argv.includes("--design-audit")) await run("design-audit", ["--import", "tsx", "scripts/verify-phase3-design.mts", ...(process.argv.includes("--phase4") ? ["--phase4"] : []), ...(process.argv.includes("--scout") ? ["--scout"] : []), ...(process.argv.includes("--table-refinement") ? ["--table-refinement"] : []), ...(process.argv.includes("--resume-from") ? ["--resume-from", process.argv[process.argv.indexOf("--resume-from") + 1]] : [])]);
  if (!browserOnly) {
  server.kill();
  if (server.exitCode === null) await new Promise(r => server.once("exit", r));
  env.ONBOARDING_ENABLED = "false";
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env, stdio: "inherit" });
  ready = false;
  for (let n = 0; n < 60; n++) {
    if (server.exitCode !== null) throw Error("Baseline server stopped");
    try { if ((await fetch(env.TPA_TEST_URL + "/login")).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  assert.ok(ready);
  await run("baseline-http", ["--import", "tsx", "--test", "tests/http.integration.ts", "tests/operations.integration.ts", "tests/media.integration.ts", "tests/payment-details.integration.ts", "tests/inquiries.integration.ts", "tests/governance.integration.ts", "tests/portraits.integration.ts", "tests/campaigns.integration.ts", "tests/reports-news.integration.ts", "tests/email-http.integration.ts", "tests/private-download-headers.integration.ts"]);
  }
} finally {
  outageServer?.kill();
  if (outageServer && outageServer.exitCode === null) await new Promise(r => outageServer.once("exit", r));
  server?.kill();
  if (server && server.exitCode === null) await new Promise(r => server.once("exit", r));
  await root.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  assert.equal((await root.query("SELECT count(*)::int n FROM pg_database WHERE datname=$1", [name])).rows[0].n, 0);
  await root.end();
  await mkdir(".local/launch-gate", { recursive: true });
  await writeFile(process.env.TPA_ISOLATED_OUTPUT || ".local/launch-gate/isolated-results.json", JSON.stringify({ results, cleanup: true, externalProviders: false, completed: new Date().toISOString() }, null, 2));
}
if (results.some(result => result.code !== 0)) process.exitCode = 1;
