import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
const source = new Pool(databaseOptions()),
  local = new Pool({
    connectionString: "postgresql://tpa_qa@127.0.0.1:55439/postgres",
    ssl: false,
  });
const name = "tpa_website_restore_" + randomUUID().replaceAll("-", "");
let restored: Pool | undefined,
  created = false;
const tables = [
  'public."user"',
  'public."account"',
  "tpa.people",
  "tpa.memberships",
  "tpa.profile_portraits",
  "tpa.payment_details",
  "tpa.content_entries",
];
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
try {
  assert.equal(
    (await source.query("SELECT current_database() n")).rows[0].n,
    process.env.TPA_DATABASE_NAME,
  );
  const before = new Map<string, Record<string, unknown>[]>();
  for (const table of tables)
    before.set(
      table,
      (await source.query("SELECT * FROM " + table + " ORDER BY id")).rows,
    );
  const cli =
    "C:/Users/savag/AppData/Roaming/npm/node_modules/@railway/cli/bin/railway.js";
  const bytes = execFileSync(
    process.execPath,
    [
      cli,
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
    ],
    { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 128 * 1024 * 1024 },
  );
  await mkdir(".local/live-product", { recursive: true });
  await writeFile(".local/live-product/website-recovery.sql", bytes, {
    mode: 0o600,
  });
  for (const table of tables)
    assert.equal(
      hash(
        (await source.query("SELECT * FROM " + table + " ORDER BY id")).rows,
      ),
      hash(before.get(table)),
      "Production changed during backup; repeat the rehearsal",
    );
  await local.query("CREATE DATABASE " + name);
  created = true;
  restored = new Pool({
    connectionString: "postgresql://tpa_qa@127.0.0.1:55439/" + name,
    ssl: false,
  });
  await restored.query(
    bytes.toString("utf8").replace(/^\\(?:un)?restrict.*$/gm, ""),
  );
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    env: {
      ...process.env,
      DATABASE_URL: "postgresql://tpa_qa@127.0.0.1:55439/" + name,
      DATABASE_SSL: "false",
      TPA_DATABASE_NAME: name,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const preservation = [];
  for (const table of tables) {
    const rows = before.get(table)!;
    if (!rows.length) {
      assert.equal(
        Number(
          (await restored.query("SELECT count(*) n FROM " + table)).rows[0].n,
        ),
        0,
      );
      continue;
    }
    const columns = Object.keys(rows[0])
      .map((k) => '"' + k.replaceAll('"', '""') + '"')
      .join(",");
    assert.equal(
      hash(
        (
          await restored.query(
            "SELECT " + columns + " FROM " + table + " ORDER BY id",
          )
        ).rows,
      ),
      hash(rows),
      "Existing data changed during migrations",
    );
    preservation.push({ table, records: rows.length, unchanged: true });
  }
  assert.equal(
    Number(
      (await restored.query("SELECT count(*) n FROM public.tpa_migrations"))
        .rows[0].n,
    ),
    33,
  );
  const directory = (
    await restored.query(
      "SELECT p.id,p.published->>'name' name FROM tpa.people p WHERE p.published IS NOT NULL AND p.archived_at IS NULL ORDER BY p.id",
    )
  ).rows;
  const links = (
    await restored.query(
      "SELECT draft->>'title' title,published IS NOT NULL published FROM tpa.website_resources WHERE kind='link' ORDER BY (draft->>'order')::int",
    )
  ).rows;
  assert.equal(links.length, 12);
  const held = (
    await restored.query(
      "SELECT count(*)::int n FROM tpa.account_invitation_holds WHERE released_at IS NULL",
    )
  ).rows[0].n;
  const evidence = {
    checked: new Date().toISOString(),
    productionWrites: 0,
    backupSha256: createHash("sha256").update(bytes).digest("hex"),
    backupBytes: bytes.length,
    restoredLocally: true,
    migrations: 33,
    preservation,
    publishedPeople: directory,
    adoptedLinks: links,
    invitationHolds: held,
    noWorkersStarted: true,
  };
  await writeFile(
    ".local/live-product/website-rehearsal.json",
    JSON.stringify(evidence, null, 2),
  );
  console.log(
    JSON.stringify({
      restoredLocally: true,
      migrations: 33,
      preservation,
      publishedPeople: directory.length,
      adoptedLinks: links.length,
      invitationHolds: held,
    }),
  );
} catch {
  throw Error("Website release rehearsal failed; private diagnostics withheld");
} finally {
  await restored?.end();
  if (created) await local.query("DROP DATABASE " + name + " WITH (FORCE)");
  await local.end();
  await source.end();
}
