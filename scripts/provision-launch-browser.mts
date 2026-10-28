/** Synthetic credentials for the portal checks, only in this harness's disposable database. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { assertQaRoot } from "./launch-test-safety.mjs";

const url = new URL(process.env.DATABASE_URL || "");
const database = url.pathname.slice(1);
assert.match(database, /^tpa_onboarding_test_member_[a-f0-9]{32}$/);
assert.equal(database, process.env.TPA_DATABASE_NAME);
const bootstrap = new URL(url); bootstrap.pathname = "/postgres";
assertQaRoot(bootstrap.href);
assert.equal(process.env.TPA_MAIL_SINK, "true");
const pool = new Pool({ connectionString: url.href, ssl: false, max: 1 });
try {
  assert.equal((await pool.query("SELECT current_database() AS name")).rows[0].name, database);
  const password = await hashPassword("Launch!1234");
  await pool.query("BEGIN");
  for (const role of ["admin", "member"]) {
    const id = randomUUID();
    await pool.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',
      [id, `Synthetic portal ${role}`, `portal-${role}@example.invalid`]);
    await pool.query('INSERT INTO public."account"(id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES($1,$2,\'credential\',$2,$3,now(),now())', [randomUUID(), id, password]);
    if (role === "admin") {
      await pool.query("INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')", [id]);
      await pool.query("INSERT INTO tpa.operator_approved_identities(user_id,source) VALUES($1,'user_authorized_bootstrap')", [id]);
    }
  }
  await pool.query("COMMIT");
  console.log("Provisioned two synthetic local portal credentials; no email or production data.");
} catch (error) { await pool.query("ROLLBACK"); throw error; }
finally { await pool.end(); }
