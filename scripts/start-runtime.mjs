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
const importEnv = { ...webEnv };
for (const key of Object.keys(importEnv))
  if (/^(RESEND_|SMTP_|GOOGLE_|R2_|CLOUDFLARE_)/.test(key)) delete importEnv[key];
let importer;
let importerRestart;
let stopping = false;
let exitCode = 0;
const activeChildren = new Set([web, worker]);
function launchImporter() {
  if (stopping) return;
  const child = spawn(process.execPath, ["member-import-worker.mjs"], {
    stdio: "inherit", env: importEnv,
  });
  importer = child;
  activeChildren.add(child);
  child.once("error", () => console.error("Import worker unavailable; web login remains available."));
  child.once("close", () => {
    activeChildren.delete(child);
    if (stopping) { if (!activeChildren.size) process.exit(exitCode); }
    else importerRestart = setTimeout(launchImporter, 5000);
  });
}
launchImporter();
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  web.kill("SIGTERM");
  worker.kill("SIGTERM");
  clearTimeout(importerRestart);
  importer?.kill("SIGTERM");
  const timer = setTimeout(() => {
    web.kill("SIGKILL");
    worker.kill("SIGKILL");
    importer?.kill("SIGKILL");
  }, 25000);
  timer.unref();
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
for (const child of [web, worker]) {
  child.on("error", () => stop(1));
  child.on("close", (code) => {
    activeChildren.delete(child);
    stop(code ?? 1);
    if (!activeChildren.size) process.exit(exitCode);
  });
}
