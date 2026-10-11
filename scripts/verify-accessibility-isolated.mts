/** Rehearse against a disposable copy of the verified recovery snapshot. */
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { databaseOptions } from "../src/lib/database-options";
const backup = JSON.parse(
  await readFile(".local/real-data/backup-verification.json", "utf8"),
);
if (!/^tpa_onboarding_test_backup_\d+$/.test(backup.db))
  throw Error("Invalid recovery snapshot identity");
const name =
  "tpa_onboarding_test_accessibility_" +
  randomUUID().replaceAll("-", "").slice(0, 20);
const url = new URL(process.env.DATABASE_URL!);
url.pathname = "/" + name;
const base = "http://127.0.0.1:3126";
const env = {
  ...process.env,
  DATABASE_URL: url.href,
  TPA_DATABASE_NAME: name,
  BETTER_AUTH_URL: base,
  TPA_ACCESSIBILITY_URL: base,
  TPA_TEST_URL: base,
  ONBOARDING_ENABLED: "true",
  TPA_MAIL_SINK: "true",
  TPA_BROWSER_CHANNEL: "chrome",
  R2_ACCESS_KEY_ID: "",
  R2_SECRET_ACCESS_KEY: "",
  CLOUDFLARE_CREDENTIAL_FILE: "",
  RESEND_API_KEY: "",
  RESEND_DOMAIN_VERIFIED: "false",
  SMTP_HOST: "",
  SMTP_USER: "",
  SMTP_PASSWORD: "",
  PLAYWRIGHT_HTML_OUTPUT_DIR: ".local/technical-qa/browser-report",
};
const root = new Pool(databaseOptions());
const run = (args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(Error(`Check failed (${code})`)),
    );
  });
let server: ReturnType<typeof spawn> | undefined;
try {
  await root.query(`CREATE DATABASE ${name} TEMPLATE ${backup.db}`);
  console.log("Created disposable recovery clone", name);
  await run(["scripts/migrate.mjs"]);
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3126",
    ],
    { env, stdio: "inherit" },
  );
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw Error("Fixed build stopped");
    try {
      if ((await fetch(base + "/login")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!ready) throw Error("Fixed build failed to start");
  for (const path of ["/", "/login", "/api/member/payment-details"]) {
    const response = await fetch(base + path);
    for (const [key, value] of [
      ["x-content-type-options", "nosniff"],
      ["x-frame-options", "SAMEORIGIN"],
      ["referrer-policy", "strict-origin-when-cross-origin"],
    ])
      if (response.headers.get(key) !== value)
        throw Error(`Missing header: ${key}`);
  }
  await run(["--import", "tsx", "scripts/audit-accessibility.mts"]);
  const audit = JSON.parse(
    await readFile(".local/real-data/accessibility-audit.json", "utf8"),
  );
  if (
    audit.scans.some(
      (scan: { violations: unknown[] }) => scan.violations.length,
    )
  )
    throw Error("Accessibility rules remain flagged");
  await writeFile(
    ".local/real-data/accessibility-isolated.json",
    JSON.stringify(audit, null, 2),
  );
  await run([
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/browser/member-platform.spec.ts",
    "--grep",
    "legacy Student draft",
    "--project=desktop",
    "--output=.local/technical-qa/browser-artifacts",
  ]);
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await new Promise<void>((resolve) => {
      server!.once("exit", () => resolve());
      setTimeout(resolve, 5000);
    });
  }
  await root.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
    [name],
  );
  await root.query(`DROP DATABASE IF EXISTS ${name}`);
  await root.end();
  console.log("Removed disposable recovery clone");
}
