import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { databaseOptions } from "../src/lib/database-options";
const name = "tpa_onboarding_test_accounts_" + randomUUID().replaceAll("-", ""),
  root = new Pool(databaseOptions());
const url = new URL(process.env.DATABASE_URL!);
url.pathname = "/" + name;
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  TPA_DATABASE_NAME: name,
  ONBOARDING_ENABLED: "true",
  TPA_MAIL_SINK: "true",
  SMTP_HOST: "",
  SMTP_PASSWORD: "",
  RESEND_API_KEY: "",
  BETTER_AUTH_URL: "http://127.0.0.1:3128",
};
async function run(args: string[]) {
  const code = await new Promise((resolve) => {
    const p = spawn(process.execPath, args, { env, stdio: "inherit" });
    p.on("error", (e) => {
      throw e;
    });
    p.on("exit", resolve);
  });
  assert.equal(code, 0);
}
try {
  await root.query(`CREATE DATABASE ${name}`);
  console.log("Created isolated account test database", name);
  await run(["scripts/migrate.mjs"]);
  await run([
    "--conditions=react-server",
    "--import",
    "tsx",
    "--test",
    ...process.argv.slice(2),
    ...(
      process.env.TPA_ACCOUNT_TEST_FILES ||
      "tests/approved-account-batch.integration.ts"
    ).split(","),
  ]);
} finally {
  await root.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await root.end();
  console.log("Removed isolated account test database");
}
