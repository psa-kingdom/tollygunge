/** Production read-only snapshot; restore only to a new, isolated loopback PG18 cluster. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { parseEnv } from "node:util";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
const args = process.argv.slice(2);
assert.equal(args[0], "--production-readonly");
const option = (name: string) => args[args.indexOf(name) + 1];
assert.ok(args.includes("--env-file") && args.includes("--tools") && args.includes("--archive"));
const archive = resolve(option("--archive"));
assert.equal(archive, resolve("D:/Downloads/Workspace/TPA-recovery/20261028-v1"));
const sourceFile = resolve(option("--env-file"));
const source = parseEnv(await readFile(sourceFile, "utf8"));
assert.equal(source.DATABASE_SSL, "true", "Verified production TLS is required.");
if (source.DATABASE_CA_FILE) source.DATABASE_CA_FILE = resolve(dirname(sourceFile), source.DATABASE_CA_FILE);
const url = new URL(source.DATABASE_URL);
assert.ok(!["127.0.0.1", "localhost"].includes(url.hostname));
const bin = resolve(option("--tools"));
const output = join(archive, "production-backup-" + randomUUID());
await mkdir(output);
const cluster = join(output, "restore-cluster");
assert.ok(!existsSync(cluster), "A restore cluster must be new.");
const report: Record<string, unknown> = { started: new Date().toISOString(), sourceReadOnly: true, appWorkersStarted: false, transportInvoked: false, passed: false, cleanup: false };
const save = () => writeFile(join(output, "results.json"), JSON.stringify(report, null, 2));
const system: NodeJS.ProcessEnv = {};
for (const [key, value] of Object.entries(process.env)) if (["path", "systemroot", "windir", "temp", "tmp", "userprofile"].includes(key.toLowerCase())) system[key] = value;
async function native(program: string, parameters: string[], env = system) {
  let stdout = "", stderr = "";
  const code = await new Promise<number | null>((done, reject) => {
    // A Windows daemon must not inherit captured pg_ctl pipes: it keeps "close"
    // pending after pg_ctl exits. The server has its own explicit private log.
    const child = spawn(join(bin, program + ".exe"), parameters, { env, windowsHide: true, stdio: program === "pg_ctl" ? "ignore" : ["ignore", "pipe", "pipe"] });
    child.stdout?.on("data", data => { stdout += data; }); child.stderr?.on("data", data => { stderr += data; });
    child.once("error", reject); child.once("close", done);
  });
  await writeFile(join(output, program + ".log"), stdout + stderr);
  assert.equal(code, 0, `${program} failed; private diagnostics retained outside Git.`);
  return stdout;
}
const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';
async function fingerprint(pool: Pool) {
  const tables = (await pool.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','tpa') ORDER BY schemaname,tablename")).rows as {schemaname:string;tablename:string}[];
  const counts = tables.length ? (await pool.query(tables.map(t => `SELECT '${t.schemaname}.${t.tablename.replaceAll("'", "''")}' AS name,count(*)::text AS count FROM ${quote(t.schemaname)}.${quote(t.tablename)}`).join(" UNION ALL ") + " ORDER BY name")).rows : [];
  const constraints = (await pool.query("SELECT n.nspname AS schema,t.relname AS table,c.conname AS name,c.contype AS type,c.convalidated AS validated,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname IN ('public','tpa') ORDER BY n.nspname,t.relname,c.conname")).rows;
  const extensions = (await pool.query("SELECT extname,extversion FROM pg_extension ORDER BY extname")).rows;
  const indexes = (await pool.query("SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname IN ('public','tpa') ORDER BY schemaname,tablename,indexname")).rows;
  return { counts, constraints, extensions, indexes };
}
const production = new Pool({ ...databaseOptions(source), max: 1, options: "-c default_transaction_read_only=on -c statement_timeout=120000" });
let started = false, created = false;
const database = "tpa_restore_" + randomUUID().replaceAll("-", "");
let maintenance: Pool | undefined, restored: Pool | undefined;
try {
  assert.match(await native("pg_dump", ["--version"]), /PostgreSQL\) 18\./);
  assert.equal(Math.floor(Number((await production.query("SHOW server_version_num")).rows[0].server_version_num) / 10000), 18);
  await production.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  assert.equal((await production.query("SHOW transaction_read_only")).rows[0].transaction_read_only, "on");
  const snapshot = (await production.query("SELECT pg_export_snapshot() AS id")).rows[0].id;
  const expected = await fingerprint(production);
  const tlsHost = source.DATABASE_TLS_SERVERNAME || url.hostname;
  const ca = source.DATABASE_CA_PEM || await readFile(source.DATABASE_CA_FILE, "utf8");
  const caFile = join(output, "database-ca.pem"); await writeFile(caFile, ca);
  const env = { ...system, PGHOST: tlsHost, PGHOSTADDR: (await lookup(url.hostname)).address, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGSSLMODE: "verify-full", PGSSLROOTCERT: caFile, PGCONNECT_TIMEOUT: "20" };
  const dump = join(output, "production.dump");
  // Dump the complete database: schema-filtered dumps omit extension objects
  // such as pg_trgm, whose operator classes are required by application indexes.
  await native("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--snapshot=" + snapshot, "--file=" + dump], env);
  await production.query("COMMIT");
  report.dumpSha256 = createHash("sha256").update(await readFile(dump)).digest("hex");
  await writeFile(join(output, "source-fingerprint.json"), JSON.stringify(expected, null, 2));
  await native("initdb", ["-D", cluster, "-U", "tpa_restore", "-A", "trust", "--encoding=UTF8", "--no-locale"]);
  await native("pg_ctl", ["-D", cluster, "-l", join(output, "restore-server.log"), "-o", "-h 127.0.0.1 -p 55448", "-w", "start"]); started = true;
  maintenance = new Pool({ connectionString: "postgresql://tpa_restore@127.0.0.1:55448/postgres", ssl: false, max: 1 });
  await maintenance.query("CREATE DATABASE " + quote(database)); created = true;
  restored = new Pool({ connectionString: `postgresql://tpa_restore@127.0.0.1:55448/${database}`, ssl: false, max: 1 });
  assert.equal((await restored.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname IN ('public','tpa')")).rows[0].n, 0);
  // PG18 dumps include CREATE SCHEMA public; remove only the empty default in
  // this newly created, UUID-owned rehearsal database before replaying it.
  await restored.query("DROP SCHEMA public");
  const restoreEnv = { ...system, PGHOST: "127.0.0.1", PGPORT: "55448", PGUSER: "tpa_restore", PGDATABASE: database, PGSSLMODE: "disable" };
  await native("pg_restore", ["--exit-on-error", "--no-owner", "--no-acl", "--dbname=" + database, dump], restoreEnv);
  const actual = await fingerprint(restored);
  assert.deepEqual(actual, expected, "Restored table counts and constraints must exactly match the consistent source snapshot.");
  report.tablesVerified = expected.counts.length; report.constraintsVerified = expected.constraints.length;
  report.indexesVerified = expected.indexes.length; report.extensionsVerified = expected.extensions.length;
  report.productionVersionMajor = 18; report.restoreVersionMajor = 18; report.passed = true;
} catch (error) {
  report.failure = error instanceof assert.AssertionError ? error.message : "Backup/restore prerequisite failed; private logs retained.";
  process.exitCode = 1;
} finally {
  await production.query("ROLLBACK").catch(() => {}); await production.end();
  await restored?.end();
  if (created) await maintenance!.query("DROP DATABASE " + quote(database));
  await maintenance?.end();
  if (started) await native("pg_ctl", ["-D", cluster, "-m", "fast", "-w", "stop"]);
  report.cleanup = true; report.completed = new Date().toISOString(); await save();
  console.log(JSON.stringify({ evidence: join(output, "results.json"), passed: report.passed, tablesVerified: report.tablesVerified, constraintsVerified: report.constraintsVerified, cleanup: report.cleanup }));
}
