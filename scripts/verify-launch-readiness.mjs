/** Safe local orchestration. Never deploys, provisions hosted resources or contacts real recipients. */
import { spawn, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, cp, appendFile, readdir, stat } from "node:fs/promises";
import { resolve, dirname, relative, join } from "node:path";
import { assertQaRoot, syntheticEnvironment, parseTestSummaries, buildInputIdentity, validateBuildIdentity } from "./launch-test-safety.mjs";

const stages = [
  { id: "lint", group: "static", args: ["node_modules/eslint/bin/eslint.js", "."] },
  { id: "structure", group: "static", args: ["scripts/check-repository-structure.mjs"] },
  { id: "unit", group: "static", args: ["--import", "tsx", "--test", "tests/*.test.ts"] },
  { id: "runtime", group: "static", args: ["--test", "tests/runtime-supervisor.test.mjs", "tests/runtime-database-environment.test.mjs", "tests/restricted-adapter.test.mjs"] },
  { id: "build", group: "static", args: ["node_modules/next/dist/bin/next", "build"] },
  { id: "worker-build", group: "static", args: ["scripts/build-worker.mjs"] },
  { id: "typecheck", group: "static", args: ["node_modules/typescript/bin/tsc", "--noEmit"] },
  { id: "core", group: "integration", args: ["scripts/verify-launch-isolated.mjs", "--fallback-outage", "--public-interactions"] },
  { id: "auth", group: "integration", args: ["scripts/verify-phase7b.mjs", "--only", "auth"] },
  { id: "newsletter", group: "integration", args: ["scripts/verify-public-newsletter.mjs"] },
  { id: "member", group: "integration", args: ["--import", "tsx", "scripts/test-member-foundation.mts", "--http"] },
  { id: "accounts", group: "integration", args: ["--import", "tsx", "scripts/test-approved-accounts.mts"] },
  { id: "import-jobs", group: "integration", args: ["--import", "tsx", "scripts/test-member-import-jobs.mts", "--http"], env: { TPA_JOB_BROWSER: "true" } },
  { id: "invitation-db", group: "integration", args: ["--import", "tsx", "scripts/test-invitation-release.mts"] },
  { id: "invitation-http", group: "integration", args: ["--import", "tsx", "scripts/test-invitation-release.mts", "--http"] },
  { id: "website", group: "integration", args: ["--import", "tsx", "scripts/test-website-control.mts", "--browser"] },
  { id: "event-flow", group: "integration", args: ["--import", "tsx", "scripts/test-event-flow.mts", "--payment-table"] },
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
if (requested && new Set(requested).size !== requested.length) throw Error("Stage names must be unique within a run.");
const selected = requested ? requested.map(id => stages.find(s => s.id === id)) : stages.filter(s => args.includes("--" + s.group));
if (!selected.length) throw Error("Choose --static, --integration or --stage; use --list for stage names.");
const channel = option("--browser-channel") || "";
if (!["", "chrome", "msedge"].includes(channel)) throw Error("Unsupported browser channel.");
const cwd = process.cwd();
const runId = new Date().toISOString().replaceAll(":", "-") + "-" + randomUUID().slice(0, 8);
const output = resolve(".local/launch-readiness", runId);
await mkdir(output, { recursive: true });
const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const report = { runId, branch: git("branch", "--show-current"), commit: git("rev-parse", "HEAD"), dirty: Boolean(git("status", "--porcelain")), environment: "local synthetic QA only", started: new Date().toISOString(), results: [], phaseCounts: {}, testCounts: {}, complete: false };
const save = async () => {
  report.buildId = (await readFile(".next/BUILD_ID", "utf8").catch(() => "")).trim() || null;
  report.phaseCounts = Object.fromEntries(["PASS", "FAIL", "BLOCKED", "NOT TESTED"].map(status => [status, status === "NOT TESTED" ? stages.length - new Set(report.results.map(r => r.stage)).size : report.results.filter(r => r.result === status).length]));
  report.testCounts = { node: null, playwright: null };
  for (const row of report.results) for (const dimension of ["node", "playwright"]) {
    if (!row.testCounts[dimension]) continue;
    report.testCounts[dimension] ||= {};
    for (const [key, value] of Object.entries(row.testCounts[dimension])) report.testCounts[dimension][key] = (report.testCounts[dimension][key] || 0) + value;
  }
  report.countPolicy = "phaseCounts counts commands; testCounts separately counts parsed node:test and Playwright summaries. Null means no summary observed. Skipped/cancelled/flaky tests are never promoted to passes. Repeated tests in separate phases remain separate executions.";
  await writeFile(output + "/results.json", JSON.stringify(report, null, 2));
};
async function filesUnder(directory) {
  try {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await filesUnder(path));
      else if (entry.isFile()) files.push(path);
    }
    return files;
  } catch (error) { if (error.code === "ENOENT") return []; throw error; }
}
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
let webBuildIdentity;
const buildIdentityPath = resolve(".local/launch-readiness/build-identity.json");
for (const stage of selected) {
  const started = Date.now();
  let result = "BLOCKED", code = null;
  const logPath = output + "/" + stage.id + ".log";
  let log = "";
  const script = stage.args.find(a => a.startsWith("scripts/") || a.startsWith("node_modules/"));
  const buildValidation = stage.group === "integration" && !preflight ? await validateBuildIdentity(cwd) : null;
  if (buildValidation?.valid) await writeFile(output + "/accepted-build-identity.json", JSON.stringify(buildValidation.identity, null, 2));
  if (stage.group === "integration" && preflight) log = preflight;
  else if (buildValidation && !buildValidation.valid) log = buildValidation.reason;
  else if (script && !(await readFile(script).then(() => true).catch(() => false))) log = "Required stage entrypoint or dependencies unavailable.";
  else {
    console.log(`START ${stage.id}; log: ${logPath}`);
    const stageEnv = { ...env, ...stage.env };
    if (stage.id === "build") {
      const previous = await readFile(buildIdentityPath, "utf8").catch(() => null);
      if (previous !== null) await writeFile(output + "/build-identity-before.json", previous);
      await writeFile(buildIdentityPath, JSON.stringify({ schemaVersion: 1, status: "BUILDING", runId }, null, 2));
      webBuildIdentity = null;
    }
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
    if (stage.id === "build" && result === "PASS") {
      webBuildIdentity = { ...await buildInputIdentity(cwd), buildId: (await readFile(".next/BUILD_ID", "utf8")).trim() };
      await writeFile(buildIdentityPath, JSON.stringify({ schemaVersion: 1, status: "WEB_BUILD_COMPLETE", runId, ...webBuildIdentity }, null, 2));
    }
    if (stage.id === "worker-build" && result === "PASS" && webBuildIdentity) {
      const current = await buildInputIdentity(cwd);
      const buildId = (await readFile(".next/BUILD_ID", "utf8")).trim();
      if (buildId !== webBuildIdentity.buildId || current.inputDigest !== webBuildIdentity.inputDigest) {
        result = "FAIL"; code = 1;
        log += "\nBuild inputs changed between web and worker compilation; rebuild both before integration.\n";
      } else {
        const identity = { schemaVersion: 1, status: "READY", runId, commit: report.commit, builtAt: new Date().toISOString(), buildId, ...current };
        await writeFile(buildIdentityPath, JSON.stringify(identity, null, 2));
        await writeFile(output + "/build-identity.json", JSON.stringify(identity, null, 2));
        log += "\nRecorded matching web/worker build ID and source input digest.\n";
      }
    }
  }
  await writeFile(logPath, log);
  const summarySources = [logPath];
  let summaryText = log;
  if (["restricted", "auth"].includes(stage.id) && result !== "BLOCKED") {
    for (const path of await filesUnder(output + "/security")) {
      if (!/(?:^|[\\/])(?:core-browser|email-runtime|auth)\.log$/.test(path)) continue;
      summarySources.push(path);
      summaryText += "\n" + await readFile(path, "utf8");
    }
  }
  const testCounts = parseTestSummaries(summaryText);
  const artifactFiles = [];
  // Shared report directories may contain prior evidence. Copy only regular files
  // changed during an actually executed browser-capable stage, retaining provenance.
  const browserStages = new Set(["core", "auth", "import-jobs", "website", "event-flow", "engagement", "event-operations", "restricted"]);
  if (result !== "BLOCKED" && browserStages.has(stage.id)) for (const artifact of ["test-results", "playwright-report"]) {
    for (const source of await filesUnder(resolve(artifact))) {
      const metadata = await stat(source);
      if (metadata.mtimeMs < started) continue;
      const destination = join(output, stage.id, artifact, relative(resolve(artifact), source));
      await mkdir(dirname(destination), { recursive: true });
      await cp(source, destination);
      artifactFiles.push({ source, destination, modified: metadata.mtime.toISOString(), provenance: "Shared browser output modified during this serial phase; no assertion-level attribution implied." });
    }
  }
  report.results.push({ stage: stage.id, result, code, elapsedMs: Date.now() - started, log: logPath, testCounts, summarySources, artifactFiles, buildIdentity: buildValidation?.valid ? { buildId: buildValidation.identity.buildId, inputDigest: buildValidation.identity.inputDigest, builtCommit: buildValidation.identity.commit, manifest: output + "/accepted-build-identity.json" } : null, limitation: result === "BLOCKED" ? log : "", command: ["node", ...stage.args] });
  await save();
  console.log(`${result} ${stage.id} (${Date.now() - started}ms)`);
}
report.complete = true;
report.completed = new Date().toISOString();
report.notSelected = stages.filter(s => !selected.includes(s)).map(s => ({ stage: s.id, result: "NOT TESTED" }));
await save();
console.log(`Evidence: ${output}/results.json`);
console.log(JSON.stringify({ phaseCounts: report.phaseCounts, testCounts: report.testCounts }));
if (report.results.some(r => r.result !== "PASS")) process.exitCode = 1;
