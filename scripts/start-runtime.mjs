import { spawn } from "node:child_process";
import { writeFileSync, renameSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Workers retain database leases. Their failures must never kill web.
export function startRuntime({ spawnProcess = spawn, exit = process.exit, schedule = setTimeout, cancel = clearTimeout, report = console.error, publish = publishHealth, env = process.env } = {}) {
  const webEnv = { ...env };
  // Scoped URLs belong to the supervisor, never to sibling child processes.
  for (const key of ["TPA_EMAIL_DATABASE_URL", "TPA_IMPORT_DATABASE_URL", "TPA_MIGRATION_DATABASE_URL"])
    delete webEnv[key];
  delete webEnv.RESEND_RECEIVING_API_KEY;
  webEnv.RESEND_RECEIVING_CONFIGURED = env.RESEND_RECEIVING_API_KEY ? "true" : "false";
  const importEnv = { ...webEnv };
  importEnv.DATABASE_URL = env.TPA_IMPORT_DATABASE_URL || env.DATABASE_URL;
  const emailEnv = { ...env, DATABASE_URL: env.TPA_EMAIL_DATABASE_URL || env.DATABASE_URL };
  for (const key of ["TPA_EMAIL_DATABASE_URL", "TPA_IMPORT_DATABASE_URL", "TPA_MIGRATION_DATABASE_URL"])
    delete emailEnv[key];
  for (const key of Object.keys(importEnv))
    if (/^(RESEND_|SMTP_|GOOGLE_|R2_|CLOUDFLARE_)/.test(key)) delete importEnv[key];
  const children = new Set(), timers = new Set();
  const workers = { email: "starting", import: "starting" };
  let stopping = false, exitCode = 0, shutdownTimer;
  const health = () => publish({ workers, updatedAt: new Date().toISOString() });
  const finished = () => {
    if (stopping && !children.size) { cancel(shutdownTimer); exit(exitCode); }
  };
  function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    exitCode = code;
    for (const timer of timers) cancel(timer);
    workers.email = workers.import = "stopped";
    health();
    shutdownTimer = schedule(() => {
      for (const child of children) child.kill("SIGKILL");
      exit(exitCode);
    }, 25000);
    shutdownTimer.unref?.();
    for (const child of children) child.kill("SIGTERM");
    finished();
  }
  function launch(file, childEnv, name, failures = 0) {
    if (stopping) return;
    const started = Date.now();
    const child = spawnProcess(process.execPath, [file], { stdio: "inherit", env: childEnv });
    children.add(child);
    if (name) {
      workers[name] = "starting";
      child.once("spawn", () => { workers[name] = "running"; health(); });
      health();
    }
    child.once("error", () => {
      report(`${name ?? "web"} process could not start.`);
      if (!name) stop(1);
    });
    child.once("close", (code) => {
      children.delete(child);
      if (stopping) { finished(); return; }
      if (!name) { stop(code || 1); return; }
      const next = Date.now() - started >= 60000 ? 0 : failures + 1;
      const delay = Math.min(60000, 5000 * 2 ** Math.min(next - 1, 4));
      workers[name] = "restarting";
      health();
      report(`${name} worker unavailable; restarting in ${delay}ms. Web remains available.`);
      const timer = schedule(() => {
        timers.delete(timer);
        launch(file, childEnv, name, next);
      }, delay);
      timers.add(timer);
    });
  }
  launch("server.js", webEnv);
  launch("email-worker.mjs", emailEnv, "email");
  launch("member-import-worker.mjs", importEnv, "import");
  function heartbeat() {
    if (stopping) return;
    health();
    const timer = schedule(() => { timers.delete(timer); heartbeat(); }, 30000);
    timers.add(timer);
  }
  heartbeat();
  return { stop };
}

function publishHealth(value) {
  const file = join(tmpdir(), `tpa-runtime-health-${process.env.PORT || "3000"}.json`);
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(value), { mode: 0o600 });
    renameSync(temporary, file);
  } catch { console.error("Runtime health publication unavailable."); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const runtime = startRuntime();
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => runtime.stop());
}
