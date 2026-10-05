import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";

const enabled = !!process.env.DATABASE_URL && !!process.env.TPA_DATABASE_NAME;
test(
  "migrations are repeatable and reject the wrong database identity",
  { skip: !enabled },
  () => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], { stdio: "pipe" });
    execFileSync(process.execPath, ["scripts/migrate.mjs"], { stdio: "pipe" });
    assert.throws(() =>
      execFileSync(process.execPath, ["scripts/migrate.mjs"], {
        stdio: "pipe",
        env: { ...process.env, TPA_DATABASE_NAME: "not-the-tpa-database" },
      }),
    );
  },
);
test(
  "database enforces staff role and private document constraints",
  { skip: !enabled },
  async () => {
    const pool = new Pool(databaseOptions());
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',
        [
          "test-user",
          "Synthetic test",
          "synthetic-" + randomUUID() + "@example.invalid",
        ],
      );
      for (const [sql, parameters] of [
        [
          "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,$2)",
          ["test-user", "invented"],
        ],
        [
          "INSERT INTO tpa.private_documents(id,owner_user_id,kind,content_type,byte_size) VALUES($1,$2,$3,$4,$5)",
          [randomUUID(), "test-user", "certificate", "image/svg+xml", 100],
        ],
        [
          "INSERT INTO tpa.private_documents(id,owner_user_id,kind,content_type,byte_size) VALUES($1,$2,$3,$4,$5)",
          [
            randomUUID(),
            "test-user",
            "certificate",
            "application/pdf",
            5242881,
          ],
        ],
      ] as [string, unknown[]][]) {
        await client.query("SAVEPOINT validation_case");
        await assert.rejects(() => client.query(sql, parameters), {
          code: "23514",
        });
        await client.query("ROLLBACK TO SAVEPOINT validation_case");
      }
      const id = randomUUID();
      await client.query(
        "INSERT INTO tpa.private_documents(id,owner_user_id,kind,content_type,byte_size) VALUES($1,$2,$3,$4,$5)",
        [id, "test-user", "certificate", "application/pdf", 100],
      );
      const { rows } = await client.query(
        "SELECT owner_user_id FROM tpa.private_documents WHERE id=$1",
        [id],
      );
      assert.equal(rows[0].owner_user_id, "test-user");
    } finally {
      await client.query("ROLLBACK");
      client.release();
      await pool.end();
    }
  },
);
