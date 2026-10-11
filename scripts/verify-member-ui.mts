/** Isolated frontend acceptance. Never uses real members or sends email. */
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { databaseOptions } from "../src/lib/database-options";
const name = "tpa_onboarding_test_ui_" + randomUUID().replaceAll("-", "");
const port = process.env.TPA_UI_TEST_PORT || "3126";
if (!process.env.DATABASE_URL)
  throw Error("DATABASE_URL is required to create an isolated test database.");
const url = new URL(process.env.DATABASE_URL);
url.pathname = "/" + name;
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  TPA_DATABASE_NAME: name,
  BETTER_AUTH_URL: `http://127.0.0.1:${port}`,
  TPA_TEST_URL: `http://127.0.0.1:${port}`,
  ONBOARDING_ENABLED: "true",
  TPA_MAIL_SINK: "true",
  PLAYWRIGHT_HTML_OUTPUT_DIR: `.local/member-ui-report/${name}`,
  TPA_BROWSER_CHANNEL: process.env.TPA_BROWSER_CHANNEL || "chrome",
  R2_ACCESS_KEY_ID: "",
  R2_SECRET_ACCESS_KEY: "",
  CLOUDFLARE_CREDENTIAL_FILE: "",
  RESEND_API_KEY: "",
  RESEND_DOMAIN_VERIFIED: "false",
  SMTP_HOST: "",
  SMTP_USER: "",
  SMTP_PASSWORD: "",
};
const root = new Pool(databaseOptions());
const run = (args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(Error(`Acceptance command exited ${code}.`)),
    );
  });
let server: ReturnType<typeof spawn> | undefined;
try {
  await root.query(`CREATE DATABASE ${name}`);
  console.log("Created isolated UI acceptance database", name);
  await run(["scripts/migrate.mjs"]);
  await run(["--import", "tsx", "scripts/provision-postal.mts"]);
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
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw Error("Acceptance server stopped.");
    try {
      if ((await fetch(env.TPA_TEST_URL + "/login")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!ready) throw Error("Acceptance server did not start.");
  const projects = process.env.TPA_UI_TEST_PROJECT
    ? [`--project=${process.env.TPA_UI_TEST_PROJECT}`]
    : [];
  const filter = process.env.TPA_UI_TEST_GREP
    ? ["--grep", process.env.TPA_UI_TEST_GREP]
    : [];
  await run([
    join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
    "run",
    "test:browser",
    "--",
    ...(
      process.env.TPA_UI_TEST_FILES || "tests/browser/member-platform.spec.ts"
    ).split(","),
    "--timeout=240000",
    `--output=.local/member-ui-artifacts/${name}`,
    ...projects,
    ...filter,
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
  console.log("Removed isolated UI acceptance database.");
}
