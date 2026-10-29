/** Synthetic credentials for the portal checks, only in this harness's disposable database. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { assertQaRoot } from "./launch-test-safety.mjs";
import { roles } from "../src/domain/access";
import { personBody } from "../src/domain/people";

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
  for (const role of [...roles, "member"]) {
    const id = randomUUID();
    const alias = role === "administrator" ? "admin" : role;
    await pool.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',
      [id, `Synthetic portal ${role}`, `portal-${alias}@example.invalid`]);
    await pool.query('INSERT INTO public."account"(id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES($1,$2,\'credential\',$2,$3,now(),now())', [randomUUID(), id, password]);
    if (role !== "member") {
      await pool.query("INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,$2)", [id, role]);
      await pool.query("INSERT INTO tpa.operator_approved_identities(user_id,source) VALUES($1,'user_authorized_bootstrap')", [id]);
    }
  }
  for (let index = 0; index < 32; index++) {
    const user = randomUUID(), person = randomUUID();
    const email = `synthetic-member-${String(index+1).padStart(2,"0")}@example.invalid`;
    const name = index === 0 ? "Synthetic member with a deliberately long professional name" : `Synthetic professional ${index+1}`;
    const body = personBody({name,firstName:"Synthetic",lastName:`Professional ${index+1}`,email,organization:"Synthetic TPA practice",jobTitle:"Chartered Accountant"});
    await pool.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,$4)',[user,name,email,index%3!==0]);
    await pool.query('INSERT INTO tpa.people(id,user_id,accepted,draft,contact_email) VALUES($1,$2,$3,$3,$4)',[person,user,body,email]);
    await pool.query("INSERT INTO tpa.memberships(id,person_id,membership_number,type,status,source) VALUES($1,$2,$3,'Annual',$4,'staff')",[randomUUID(),person,`TPA-QA-${String(index+1).padStart(3,"0")}`,index%4===0?"expired":"active"]);
    await pool.query('INSERT INTO tpa.account_invitation_holds(user_id) VALUES($1)',[user]);
  }
  await pool.query("COMMIT");
  console.log("Provisioned six staff roles, one member and 32 held synthetic register records; no email or production data.");
} catch (error) { await pool.query("ROLLBACK"); throw error; }
finally { await pool.end(); }
