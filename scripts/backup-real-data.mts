import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
const cli =
  "C:/Users/savag/AppData/Roaming/npm/node_modules/@railway/cli/bin/railway.js";
function command(args: string[], maxBuffer = 64 * 1024 * 1024) {
  try {
    return execFileSync(process.execPath, [cli, ...args], {
      maxBuffer,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw Error(
      "Railway backup command failed; potentially sensitive diagnostics suppressed.",
    );
  }
}
const target = new Pool(databaseOptions()),
  restoredName = "tpa_onboarding_test_backup_" + Date.now();
const status = JSON.parse(command(["status", "--json"]).toString("utf8"));
if (
  status.project?.id !== "1f2b5099-790f-48c3-96e9-e62b142157fb" &&
  status.id !== "1f2b5099-790f-48c3-96e9-e62b142157fb"
)
  throw Error("Railway backup target mismatch.");
try {
  const name = (await target.query("SELECT current_database() n")).rows[0].n;
  if (name !== "railway" || process.env.TPA_DATABASE_NAME !== name)
    throw Error("Production backup database identity mismatch.");
  const countSql =
    'SELECT (SELECT count(*)::int FROM public."user") accounts,(SELECT count(*)::int FROM tpa.people) people,(SELECT count(*)::int FROM tpa.member_profiles) profiles';
  const before = (await target.query(countSql)).rows[0];
  const bytes = command([
    "ssh",
    "--service",
    "Postgres",
    "--environment",
    "production",
    "--",
    "pg_dump",
    "-U",
    "postgres",
    "-d",
    "railway",
    "--inserts",
    "--no-owner",
    "--no-privileges",
  ]);
  await writeFile(".local/real-data/pre-rollout-backup.sql", bytes);
  const after = (await target.query(countSql)).rows[0];
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw Error("Production changed during backup; repeat before commit.");
  if (!/^tpa_onboarding_test_backup_\d+$/.test(restoredName))
    throw Error("Unsafe restore database name.");
  await target.query('CREATE DATABASE "' + restoredName + '"');
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = "/" + restoredName;
  const restored = new Pool({
    ...databaseOptions(),
    connectionString: url.href,
  });
  try {
    await restored.query(
      bytes.toString("utf8").replace(/^\\(?:un)?restrict.*$/gm, ""),
    );
    const counts = (await restored.query(countSql)).rows[0];
    if (JSON.stringify(counts) !== JSON.stringify(before))
      throw Error("Restored backup counts differ.");
    const evidence = {
      time: new Date().toISOString(),
      sourceDatabase: name,
      db: restoredName,
      counts,
      sourceStable: true,
      restored: true,
      backupFile: "pre-rollout-backup.sql",
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
    await writeFile(
      ".local/real-data/backup-verification.json",
      JSON.stringify(evidence, null, 2),
    );
    console.log(JSON.stringify(evidence));
  } finally {
    await restored.end();
  }
} finally {
  await target.end();
}
