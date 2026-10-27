import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

/**
 * Accept only the separately provisioned local QA maintenance database.
 * @param {string | undefined} value
 * @returns {URL}
 */
export function assertQaRoot(value) {
  let url;
  try { url = new URL(value || ""); } catch { throw Error("Set DATABASE_URL to the dedicated local QA database."); }
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol), "QA requires PostgreSQL.");
  assert.equal(url.hostname, "127.0.0.1", "QA refuses hosted databases.");
  assert.equal(url.port, "55439", "QA requires the dedicated local port 55439.");
  assert.equal(url.pathname, "/postgres", "QA requires the maintenance database postgres.");
  assert.ok(["tpa_qa", "postgres"].includes(url.username), "QA requires a dedicated local administrative identity.");
  assert.ok(!url.search && !url.hash, "QA connection options and fragments are forbidden.");
  return url;
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {string} source
 * @returns {Record<string, string | undefined>}
 */
export function blankDotenvKeys(env, source) {
  for (const line of source.split(/\r?\n/)) {
    const key = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1];
    if (key && !(key in env)) env[key] = "";
  }
  return env;
}

/**
 * No inherited provider, scoped database, Node injection or application settings.
 * @param {Record<string, string | undefined>} [source]
 * @param {string} [cwd]
 * @param {string} [databaseUrl]
 * @returns {Promise<Record<string, string | undefined>>}
 */
export async function syntheticEnvironment(source = process.env, cwd = process.cwd(), databaseUrl) {
  const qaUrl = assertQaRoot(databaseUrl || "postgresql://tpa_qa:synthetic@127.0.0.1:55439/postgres");
  /** @type {Record<string, string | undefined>} */
  const env = {};
  const systemKeys = new Set(["path", "systemroot", "windir", "temp", "tmp", "tmpdir", "userprofile", "home", "localappdata", "appdata", "comspec", "pathext"]);
  for (const [key, value] of Object.entries(source)) if (systemKeys.has(key.toLowerCase())) env[key] = value;
  Object.assign(env, {
    CI: source.CI === "true" ? "true" : "",
    NEXT_TELEMETRY_DISABLED: "1",
    DATABASE_URL: qaUrl.href,
    DATABASE_SSL: "false", TPA_DATABASE_NAME: "postgres",
    BETTER_AUTH_URL: "http://127.0.0.1:3145",
    BETTER_AUTH_SECRET: "synthetic-launch-readiness-secret-over-32-characters",
    TPA_MAIL_SINK: "true", ONBOARDING_ENABLED: "true",
    EMAIL_OPERATIONS_ENABLED: "false", MEMBER_IMPORT_WORKER_ENABLED: "false",
    EVENT_REMINDERS_ENABLED: "false", EVENT_PROMOTIONS_ENABLED: "false",
    RESEND_DOMAIN_VERIFIED: "false", TPA_TEST_STORAGE: "false",
    TPA_TEST_EXPECT_STORAGE_DISABLED: "true", TPA_BROWSER_CHANNEL: "",
  });
  for (const name of [".env", ".env.local", ".env.production", ".env.production.local", ".env.test", ".env.test.local"]) {
    try { blankDotenvKeys(env, await readFile(join(cwd, name), "utf8")); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return env;
}

/** Test totals remain separate from command/phase outcomes and browser totals.
 * @param {string} text
 */
export function parseTestSummaries(text) {
  const plain = text.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
  const node = { tests: 0, passed: 0, failed: 0, skipped: 0, cancelled: 0, summaries: 0 };
  for (const match of plain.matchAll(/^(?:#|ℹ) (tests|pass|fail|skipped|cancelled) (\d+)\s*$/gm)) {
    const key = { tests: "tests", pass: "passed", fail: "failed", skipped: "skipped", cancelled: "cancelled" }[match[1]];
    node[key] += Number(match[2]);
    if (key === "tests") node.summaries++;
  }
  const playwright = { passed: 0, failed: 0, skipped: 0, flaky: 0, interrupted: 0, notRun: 0, summaryLines: 0 };
  for (const match of plain.matchAll(/^\s*(\d+) (passed|failed|skipped|flaky|interrupted|did not run)(?=\s|\(|$)/gm)) {
    const key = match[2] === "did not run" ? "notRun" : match[2];
    playwright[key] += Number(match[1]);
    playwright.summaryLines++;
  }
  return { node: node.summaries ? node : null, playwright: playwright.summaryLines ? playwright : null };
}

/** Hash actual build inputs, including additions/removals; docs/tests and QA-only
 * scripts are intentionally excluded so evidence updates do not stale an app build.
 * @param {string} [cwd]
 */
export async function buildInputIdentity(cwd = process.cwd()) {
  /** @type {{path: string, sha256: string | null}[]} */
  const inputs = [];
  const digest = bytes => createHash("sha256").update(bytes).digest("hex");
  async function file(path) {
    try { inputs.push({ path, sha256: digest(await readFile(join(cwd, path))) }); }
    catch (error) { if (error.code !== "ENOENT") throw error; inputs.push({ path, sha256: null }); }
  }
  async function directory(path) {
    let entries;
    try { entries = await readdir(join(cwd, path), { withFileTypes: true }); }
    catch (error) { if (error.code !== "ENOENT") throw error; inputs.push({ path: path + "/", sha256: null }); return; }
    for (const entry of entries) {
      const child = path + "/" + entry.name;
      if (entry.isDirectory()) await directory(child);
      else if (entry.isFile()) await file(child);
      else throw Error("Build-input identity refuses symbolic links or special files.");
    }
  }
  for (const path of ["src", "public", "data", "migrations"]) await directory(path);
  for (const path of ["next.config.mjs", "package.json", "package-lock.json", "tsconfig.json", "next-env.d.ts", "scripts/build-worker.mjs", "scripts/start-runtime.mjs", "scripts/email-worker.mts", "scripts/member-import-worker.mts"]) await file(path);
  inputs.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { inputDigest: digest(JSON.stringify(inputs)), fileCount: inputs.filter(row => row.sha256 !== null).length, inputs };
}

/** @param {string} [cwd] */
export async function validateBuildIdentity(cwd = process.cwd()) {
  const rebuild = "Run node scripts/verify-launch-readiness.mjs --stage build,worker-build to rebuild and record the candidate identity.";
  try {
    const identity = JSON.parse(await readFile(join(cwd, ".local/launch-readiness/build-identity.json"), "utf8"));
    if (identity.schemaVersion !== 1 || identity.status !== "READY") return { valid: false, reason: "Completed web/worker build identity is unavailable. " + rebuild };
    const buildId = (await readFile(join(cwd, ".next/BUILD_ID"), "utf8")).trim();
    if (!buildId || identity.buildId !== buildId) return { valid: false, reason: "The recorded and current Next build IDs differ. " + rebuild };
    const current = await buildInputIdentity(cwd);
    if (identity.inputDigest !== current.inputDigest) return { valid: false, reason: "Candidate build inputs changed since the recorded build. " + rebuild };
    return { valid: true, reason: "Build ID and source input digest match.", identity };
  } catch { return { valid: false, reason: "Build identity is missing, unreadable, or its inputs cannot be verified. " + rebuild }; }
}
