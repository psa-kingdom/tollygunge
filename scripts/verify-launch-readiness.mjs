/** Safe local orchestration. Never deploys, provisions hosted resources or contacts real recipients. */
import { spawn, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, cp, appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertQaRoot, syntheticEnvironment } from "./launch-test-safety.mjs";

const stages = [
  { id: "lint", group: "static", args: ["node_modules/eslint/bin/eslint.js", "."] },
  { id: "structure", group: "static", args: ["scripts/check-repository-structure.mjs"] },
  { id: "unit", group: "static", args: ["--import", "tsx", "--test", "tests/*.test.ts"] },
  { id: "runtime", group: "static", args: ["--test", "tests/runtime-supervisor.test.mjs", "tests/runtime-database-environment.test.mjs", "tests/restricted-adapter.test.mjs"] },
  { id: "build", group: "static", args: ["node_modules/next/dist/bin/next", "build"] },
  { id: "worker-build", group: "static", args: ["scripts/build-worker.mjs"] },
  { id: "typecheck", group: "static", args: ["node_modules/typescript/bin/tsc", "--noEmit"] },
  { id: "core", group: "integration", args: ["scripts/verify-launch-isolated.mjs", "--fallback-outage", "--public-interactions"] },
  { id: "newsletter", group: "integration", args: ["scripts/verify-public-newsletter.mjs"] },
  { id: "member", group: "integration", args: ["--import", "tsx", "scripts/test-member-foundation.mts", "--http"] },
  { id: "accounts", group: "integration", args: ["--import", "tsx", "scripts/test-approved-accounts.mts"] },
  { id: "import-jobs", group: "integration", args: ["--import", "tsx", "scripts/test-member-import-jobs.mts", "--http"], env: { TPA_JOB_BROWSER: "true" } },
  { id: "invitation-db", group: "integration", args: ["--import", "tsx", "scripts/test-invitation-release.mts"] },
  { id: "invitation-http", group: "integration", args: ["--import", "tsx", "scripts/test-invitation-release.mts", "--http"] },
  { id: "website", group: "integration", args: ["--import", "tsx", "scripts/test-website-control.mts", "--browser"] },
  { id: "event-flow", group: "integration", args: ["--import", "tsx", "scripts/test-event-flow.mts"] },
  { id: "engagement", group: "integration", args: ["--import", "tsx", "scripts/test-event-engagement.mts"] },
  { id: "event-operations", group: "integration", args: ["--import", "tsx", "scripts/test-event-operational.mts", "--browser"] },
  { id: "roles", group: "integration", args: ["scripts/security/verify-database-roles.mjs"] },
  { id: "restricted", group: "integration", args: ["scripts/verify-phase7b.mjs", "--only", "email-runtime,core-browser"] },
];
const args = process.argv.slice(2);
if (args.includes("--list")) { console.log(stages.map(({ id, group }) => `${group}: ${id}`).join("\n")); process.exit(0); }
const option = (key) => args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
const known = new Set(["--static", "--integration", "--stage", "--browser-channel"]);
for (let n = 0; n < args.length; n++) {
  if (!known.has(args[n])) throw Error("Unknown launch-readiness argument.");
  if (["--stage", "--browser-channel"].includes(args[n])) {
    if (args[n + 1] === undefined || args[n + 1].startsWith("--")) throw Error("Supply the requested option value.");
    n++;
  }
}
const requested = option("--stage")?.split(",");
if (requested?.some(id => !stages.some(s => s.id === id))) throw Error("Unknown stage. Use --list.");
const selected = requested ? requested.map(id => stages.find(s => s.id === id)) : stages.filter(s => args.includes("--" + s.group));
if (!selected.length) throw Error("Choose --static, --integration or --stage; use --list for stage names.");
const channel = option("--browser-channel") || "";
if (!["", "chrome", "msedge"].includes(channel)) throw Error("Unsupported browser channel.");
const cwd = process.cwd();
const runId = new Date().toISOString().replaceAll(":", "-") + "-" + randomUUID().slice(0, 8);
const output = resolve(".local/launch-readiness", runId);
await mkdir(output, { recursive: true });
const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const report = { runId, branch: git("branch", "--show-current"), commit: git("rev-parse", "HEAD"), dirty: Boolean(git("status", "--porcelain")), environment: "local synthetic QA only", started: new Date().toISOString(), results: [], counts: {}, complete: false };
const save = async () => {
  report.buildId = (await readFile(".next/BUILD_ID", "utf8").catch(() => "")).trim() || null;
  report.counts = Object.fromEntries(["PASS", "FAIL", "BLOCKED", "NOT TESTED"].map(status => [status, status === "NOT TESTED" ? stages.length - report.results.length : report.results.filter(r => r.result === status).length]));
  await writeFile(output + "/results.json", JSON.stringify(report, null, 2));
};
let databaseUrl, preflight;
if (selected.some(s => s.group === "integration")) {
  try {
    databaseUrl = assertQaRoot(process.env.DATABASE_URL).href;
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: databaseUrl, ssl: false, connectionTimeoutMillis: 5000 });
    try {
      const { rows } = await pool.query("SELECT current_database() AS database, current_user AS username, r.rolsuper OR r.rolcreatedb AS can_create FROM pg_roles r WHERE r.rolname=current_user");
      if (rows[0]?.database !== "postgres" || !["tpa_qa", "postgres"].includes(rows[0]?.username) || !rows[0]?.can_create) throw Error("QA database identity or CREATEDB privilege failed.");
    } finally { await pool.end(); }
  } catch { preflight = "Dedicated loopback QA database unavailable or safety preflight rejected its identity. No integration command ran."; }
}
const env = await syntheticEnvironment(process.env, cwd, databaseUrl);
env.TPA_BROWSER_CHANNEL = channel;
env.TPA_ISOLATED_OUTPUT = output + "/core-results.json";
env.TPA_PUBLIC_INTERACTION_OUTPUT = output + "/public-interactions";
env.TPA_SECURITY_OUTPUT = output + "/security";
env.TPA_CONTAINER_QA_OUTPUT = output + "/container.json";
await save();
for (const stage of selected) {
  const started = Date.now();
  let result = "BLOCKED", code = null;
  const logPath = output + "/" + stage.id + ".log";
  let log = "";
  const script = stage.args.find(a => a.startsWith("scripts/") || a.startsWith("node_modules/"));
  if (stage.group === "integration" && preflight) log = preflight;
  else if (stage.group === "integration" && !(await readFile(".next/BUILD_ID", "utf8").catch(() => ""))) log = "Run the build stage before integration acceptance.";
  else if (script && !(await readFile(script).then(() => true).catch(() => false))) log = "Required stage entrypoint or dependencies unavailable.";
  else {
    console.log(`START ${stage.id}; log: ${logPath}`);
    const stageEnv = { ...env, ...stage.env };
    await writeFile(logPath, "");
    let writing = Promise.resolve();
    code = await new Promise(resolveCode => {
      const child = spawn(process.execPath, stage.args, { cwd, env: stageEnv, stdio: ["ignore", "pipe", "pipe"] });
      const capture = b => { const chunk = b.toString(); log += chunk; writing = writing.then(() => appendFile(logPath, chunk)); };
      child.stdout.on("data", capture);
      child.stderr.on("data", capture);
      child.once("error", () => { log += "\nStage process could not start.\n"; });
      child.once("close", status => resolveCode(status));
    });
    await writing;
    result = code === 0 ? "PASS" : "FAIL";
  }
  await writeFile(logPath, log);
  const counts = {};
  for (const kind of ["tests", "pass", "fail", "skipped", "cancelled"]) {
    const values = [...log.matchAll(new RegExp(`^(?:#|ℹ) ${kind} (\\d+)\\s*$`, "gm"))].map(m => Number(m[1]));
    if (values.length) counts[kind] = values.reduce((a, b) => a + b, 0);
  }
  report.results.push({ stage: stage.id, result, code, elapsedMs: Date.now() - started, log: logPath, testCounts: counts, limitation: result === "BLOCKED" ? log : "", command: ["node", ...stage.args] });
  // Browser runners share these destinations: preserve each stage before another can overwrite it.
  if (stage.group === "integration") for (const artifact of ["test-results", "playwright-report"]) {
    try { await cp(artifact, output + "/" + stage.id + "/" + artifact, { recursive: true }); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  await save();
  console.log(`${result} ${stage.id} (${Date.now() - started}ms)`);
}
report.complete = true;
report.completed = new Date().toISOString();
report.notSelected = stages.filter(s => !selected.includes(s)).map(s => ({ stage: s.id, result: "NOT TESTED" }));
await save();
console.log(`Evidence: ${output}/results.json`);
console.log(JSON.stringify(report.counts));
if (report.results.some(r => r.result !== "PASS")) process.exitCode = 1;
