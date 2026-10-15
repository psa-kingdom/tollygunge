/** Disposable Linux container acceptance; no hosted credentials or providers. */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { Pool } from "pg";

const rootUrl = new URL(process.env.DATABASE_URL || "");
assert.equal(rootUrl.hostname, "127.0.0.1");
assert.equal(rootUrl.port, "55439");
const suffix = randomUUID().replaceAll("-", "");
const database = "tpa_acceptance_container_" + suffix;
const container = "tpa-runtime-" + suffix;
const image = "tpa-runtime-acceptance:" + suffix;
const root = new Pool({ connectionString: rootUrl.href, ssl: false });
const output = process.env.TPA_CONTAINER_QA_OUTPUT;
const results = { image, database, externalProviders: false, checks: [] };
let created = false, started = false, built = false;
const docker = (args) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024 });
try {
  docker(["version", "--format", "{{.Server.Version}}"]);
  await root.query("CREATE DATABASE " + database); created = true;
  const localUrl = new URL(rootUrl); localUrl.pathname = "/" + database;
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, DATABASE_URL: localUrl.href, DATABASE_SSL: "false", TPA_DATABASE_NAME: database },
    stdio: "pipe",
  });
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const build = spawnSync("docker", ["build", "--label", "org.opencontainers.image.revision=" + revision, "-t", image, "."], {
    encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
  });
  if (output) await writeFile(output + ".build.log", (build.stdout || "") + (build.stderr || ""));
  assert.equal(build.status, 0, "Linux container build"); built = true;
  const runtimeUrl = new URL(localUrl); runtimeUrl.hostname = "host.docker.internal";
  const flags = {
    DATABASE_URL: runtimeUrl.href, DATABASE_SSL: "false", TPA_DATABASE_NAME: database,
    BETTER_AUTH_SECRET: "synthetic-container-acceptance-secret-32-characters",
    BETTER_AUTH_URL: "http://127.0.0.1:3196", ONBOARDING_ENABLED: "false",
    EMAIL_OPERATIONS_ENABLED: "false", MEMBER_IMPORT_WORKER_ENABLED: "false",
    EVENT_REMINDERS_ENABLED: "false", EVENT_PROMOTIONS_ENABLED: "false",
  };
  docker(["run", "-d", "--name", container, "--add-host=host.docker.internal:host-gateway", "-p", "127.0.0.1:3196:3000", ...Object.entries(flags).flatMap(([k,v]) => ["-e", k + "=" + v]), image]); started = true;
  let ready = false;
  for (let n = 0; n < 40; n++) {
    try { if ((await fetch("http://127.0.0.1:3196/api/health")).status === 200) { ready = true; break; } } catch { /* bounded readiness polling */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  assert.ok(ready, "Container readiness");
  const inspect = `const f=require('fs'),c=require('crypto');const workers={};for(const id of f.readdirSync('/proc').filter(x=>/^\\d+$/.test(x))){try{const a=f.readFileSync('/proc/'+id+'/cmdline','utf8').split('\\0');for(const file of ['email-worker.mjs','member-import-worker.mjs'])if(a.includes(file))workers[file]=Number(id);}catch{}}console.log(JSON.stringify({uid:process.getuid(),node:process.versions.node,temp:require('os').tmpdir(),workers,workerHashes:Object.fromEntries(['email-worker.mjs','member-import-worker.mjs','start-runtime.mjs'].map(x=>[x,c.createHash('sha256').update(f.readFileSync('/app/'+x)).digest('hex')])),devPackages:['braces','micromatch','fast-glob','eslint-config-next','@next/eslint-plugin-next'].filter(x=>{try{require.resolve(x);return true}catch{return false}}),privateFiles:['.env.local','Credential.md','.local'].filter(x=>f.existsSync('/app/'+x)),static:f.existsSync('/app/.next/static'),public:f.existsSync('/app/public')}));`;
  const runtime = () => JSON.parse(docker(["exec", container, "node", "-e", inspect]));
  const before = runtime();
  assert.notEqual(before.uid, 0); assert.match(before.node, /^24\./);
  assert.equal(before.temp, "/tmp"); assert.equal(Object.keys(before.workers).length, 2);
  assert.deepEqual(before.devPackages, []); assert.deepEqual(before.privateFiles, []);
  assert.ok(before.static && before.public); results.runtime = before; results.revision = revision;
  results.digest = docker(["image", "inspect", image, "--format", "{{.Id}}"]).trim();
  for (const path of ["/", "/login", "/api/health"]) {
    const response = await fetch("http://127.0.0.1:3196" + path);
    const status = response.status;
    results.checks.push({ path, status }); assert.equal(status, 200);
    assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  }
  docker(["exec", container, "node", "-e", Object.values(before.workers).map(pid => `process.kill(${pid},'SIGKILL')`).join(";")]);
  assert.equal((await fetch("http://127.0.0.1:3196/login")).status, 200);
  let after;
  for (let n = 0; n < 30; n++) {
    await new Promise(r => setTimeout(r, 1000)); after = runtime();
    if (Object.keys(after.workers).length === 2 && Object.keys(before.workers).every(k => before.workers[k] !== after.workers[k])) break;
  }
  assert.equal(Object.keys(after.workers).length, 2);
  assert.ok(Object.keys(before.workers).every(k => before.workers[k] !== after.workers[k]));
  assert.equal((await fetch("http://127.0.0.1:3196/login")).status, 200);
  results.bothWorkersRestarted = true; results.webSurvived = true; results.passed = true;
} catch (error) {
  results.passed = false;
  results.failure = error instanceof assert.AssertionError ? error.message : "Container acceptance failed; private diagnostics suppressed";
  process.exitCode = 1;
} finally {
  if (started) { if (output) await writeFile(output + ".log", docker(["logs", container])); docker(["rm", "-f", container]); }
  if (created) { await root.query("DROP DATABASE " + database + " WITH (FORCE)"); assert.equal((await root.query("SELECT count(*)::int n FROM pg_database WHERE datname=$1", [database])).rows[0].n, 0); }
  await root.end();
  if (built) docker(["image", "rm", image]);
  results.cleanup = true;
  if (output) await writeFile(output, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
}
