import { spawn } from "node:child_process";
const env = {
  ...process.env,
  ONBOARDING_ENABLED: "true",
  TPA_MAIL_SINK: "true",
  TPA_TEST_URL: process.env.BETTER_AUTH_URL,
};
if (!/^tpa_onboarding_test_/.test(env.TPA_DATABASE_NAME || ""))
  throw Error("Use an isolated onboarding test database.");
const run = (args) =>
  new Promise((resolve, reject) => {
    const p = spawn(process.execPath, args, { env, stdio: "inherit" });
    p.on("exit", (c) =>
      c === 0 ? resolve() : reject(Error("Onboarding acceptance failed.")),
    );
    p.on("error", reject);
  });
await run(["scripts/migrate.mjs"]);
await run([
  "--import",
  "tsx",
  "--test",
  "tests/onboarding-auth.integration.ts",
  "tests/onboarding-delivery.integration.ts",
]);
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3000",
  ],
  { env, stdio: "inherit" },
);
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(env.TPA_TEST_URL + "/login")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!ready) throw Error("Acceptance server unavailable.");
  await run([
    "--import",
    "tsx",
    "--test",
    "tests/onboarding-http.integration.ts",
    "tests/workspace-ux-http.integration.ts",
  ]);
  await run(["node_modules/@playwright/test/cli.js", "test"]);
} finally {
  server.kill();
}
