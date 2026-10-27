import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

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
