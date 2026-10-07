import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";
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
  { stdio: "inherit" },
);
try {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    if (server.exitCode !== null)
      throw new Error("Verification server exited.");
    try {
      if ((await fetch("http://127.0.0.1:3000/login")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await setTimeout(1000);
  }
  if (!ready) throw new Error("Verification server did not become ready.");
  const tests = spawn(
    process.execPath,
    [
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
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        TPA_TEST_URL: "http://127.0.0.1:3000",
        TPA_TEST_STORAGE: "false",
        TPA_TEST_EXPECT_STORAGE_DISABLED: "true",
      },
    },
  );
  const status = await new Promise((resolve) => tests.on("exit", resolve));
  process.exitCode = status === 0 ? 0 : 1;
} finally {
  server.kill();
}
