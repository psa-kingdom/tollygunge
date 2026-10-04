import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Pool } from "pg";
if (!process.env.DATABASE_URL || !process.env.TPA_DATABASE_NAME) {
  throw new Error(
    "Set DATABASE_URL and TPA_DATABASE_NAME locally before running migrations.",
  );
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: true }
      : undefined,
  connectionTimeoutMillis: 5000,
  max: 1,
});
const client = await pool.connect();
try {
  const {
    rows: [database],
  } = await client.query("SELECT current_database() AS name");
  if (database.name !== process.env.TPA_DATABASE_NAME)
    throw new Error("Database identity does not match TPA_DATABASE_NAME.");
  await client.query("SELECT pg_advisory_lock(894212036)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS public.tpa_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  );
  for (const name of (await readdir(new URL("../migrations/", import.meta.url)))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(
      new URL(`../migrations/${name}`, import.meta.url),
      "utf8",
    );
    const checksum = createHash("sha256").update(sql).digest("hex");
    const { rows } = await client.query(
      "SELECT checksum FROM public.tpa_migrations WHERE name=$1",
      [name],
    );
    if (rows.length) {
      if (rows[0].checksum !== checksum)
        throw new Error(`Applied migration changed: ${name}`);
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO public.tpa_migrations (name,checksum) VALUES ($1,$2)",
        [name, checksum],
      );
      await client.query("COMMIT");
      console.log(`Applied ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.query("SELECT pg_advisory_unlock(894212036)");
  client.release();
  await pool.end();
}
