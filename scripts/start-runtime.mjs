import { spawn } from "node:child_process";
// The public web process does not receive the broader receiving/usage key.
const webEnv = { ...process.env };
delete webEnv.RESEND_RECEIVING_API_KEY;
// Web readiness needs a presence flag, never the receiving credential itself.
webEnv.RESEND_RECEIVING_CONFIGURED = process.env.RESEND_RECEIVING_API_KEY
  ? "true"
  : "false";
const web = spawn(process.execPath, ["server.js"], {
  stdio: "inherit",
  env: webEnv,
});
const worker = spawn(process.execPath, ["email-worker.mjs"], {
  stdio: "inherit",
  env: process.env,
});
let stopping = false;
let exitCode = 0;
let exited = 0;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  web.kill("SIGTERM");
  worker.kill("SIGTERM");
  const timer = setTimeout(() => {
    web.kill("SIGKILL");
    worker.kill("SIGKILL");
  }, 25000);
  timer.unref();
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
for (const child of [web, worker]) {
  child.on("error", () => stop(1));
  child.on("exit", (code) => {
    stop(code ?? 1);
    if (++exited === 2) process.exit(exitCode);
  });
}
