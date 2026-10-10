import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { databaseOptions } from "../src/lib/database-options";
const name = "tpa_onboarding_test_" + randomUUID().replaceAll("-", ""),
  port = process.env.TPA_TEST_PORT || "3113";
const root = new Pool(databaseOptions());
const url = new URL(process.env.DATABASE_URL!);
url.pathname = "/" + name;
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  TPA_DATABASE_NAME: name,
  BETTER_AUTH_URL: "http://127.0.0.1:" + port,
  ONBOARDING_ENABLED: "true",
  TPA_BROWSER_CHANNEL: "chrome",
  TPA_MAIL_SINK: "true",
  TPA_TEST_URL: "http://127.0.0.1:" + port,
  TPA_TEST_STORAGE: "false",
  TPA_TEST_EXPECT_STORAGE_DISABLED: "true",
  R2_ACCESS_KEY_ID: "",
  R2_SECRET_ACCESS_KEY: "",
  CLOUDFLARE_CREDENTIAL_FILE: "",
  RESEND_API_KEY: "",
  RESEND_DOMAIN_VERIFIED: "false",
  SMTP_HOST: "",
  SMTP_USER: "",
  SMTP_PASSWORD: "",
};
const run = (args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const c = spawn(process.execPath, args, { env, stdio: "inherit" });
    c.on("error", reject);
    c.on("exit", (code) =>
      code === 0 ? resolve() : reject(Error("Test command failed.")),
    );
  });
let server: ReturnType<typeof spawn> | undefined;
try {
  await root.query(`CREATE DATABASE ${name}`);
  console.log("Created isolated onboarding test database:", name);
  await run(["scripts/migrate.mjs"]);
  if (process.env.TPA_ONBOARDING_FAST !== "true")
    await run([
      "--import",
      "tsx",
      "--test",
      "tests/database.integration.ts",
      "tests/identity.integration.ts",
      "tests/onboarding-auth.integration.ts",
      "tests/onboarding-delivery.integration.ts",
    ]);
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      port,
    ],
    { env, stdio: "inherit" },
  );
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw Error("Server stopped.");
    try {
      if ((await fetch(env.BETTER_AUTH_URL + "/login")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (process.env.TPA_ONBOARDING_BROWSER_ONLY !== "true")
    await run([
      "--import",
      "tsx",
      "--test",
      "tests/onboarding-http.integration.ts",
      "tests/workspace-ux-http.integration.ts",
    ]);
  await run([
    "node_modules/@playwright/test/cli.js",
    "test",
    ...(process.env.TPA_ONBOARDING_PROJECT
      ? ["--project=" + process.env.TPA_ONBOARDING_PROJECT]
      : []),
  ]);
  if (process.env.TPA_ONBOARDING_SKIP_BASELINE === "true") {
    console.log(
      "Focused acceptance complete; baseline suite explicitly omitted.",
    );
  } else {
    server.kill();
    await new Promise<void>((resolve) => server!.once("exit", () => resolve()));
    env.ONBOARDING_ENABLED = "false";
    server = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        port,
      ],
      { env, stdio: "inherit" },
    );
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(env.BETTER_AUTH_URL + "/login")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 1000));
    }
    await run([
      "--import",
      "tsx",
      "--test",
      "tests/http.integration.ts",
      "tests/operations.integration.ts",
      "tests/media.integration.ts",
      "tests/payment-details.integration.ts",
      "tests/inquiries.integration.ts",
      "tests/governance.integration.ts",
      "tests/portraits.integration.ts",
      "tests/campaigns.integration.ts",
      "tests/reports-news.integration.ts",
    ]);
  }
} finally {
  if (server) {
    server.kill();
    await new Promise<void>((resolve) => {
      if (server!.exitCode !== null) resolve();
      else server!.once("exit", () => resolve());
    });
  }
  await root.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1",
    [name],
  );
  await root.query(`DROP DATABASE IF EXISTS ${name}`);
  await root.end();
  console.log("Removed isolated onboarding test database.");
}
