import { randomBytes, randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { databaseOptions } from "../src/lib/database-options";

// Explicit, one-time operator action. Never run automatically on deployment.
const email = "tollygungecacpestudycircle@gmail.com";
if (process.env.TPA_PROVISION_ADMIN !== email)
  throw new Error("Explicit approved administrator required");
const pool = new Pool(databaseOptions());
const connection = await pool.connect();
const passwordFile = resolve(".local/first-admin-password.txt");
let written = false;
try {
  if (
    (await connection.query("SELECT current_database() AS name")).rows[0]
      .name !== process.env.TPA_DATABASE_NAME
  )
    throw new Error("Wrong database");
  await connection.query("BEGIN");
  await connection.query("SELECT pg_advisory_xact_lock(734207)");
  if (
    (
      await connection.query(
        'SELECT 1 FROM public."user" WHERE lower(email)=lower($1)',
        [email],
      )
    ).rowCount ||
    (
      await connection.query(
        "SELECT 1 FROM tpa.staff_roles WHERE role='administrator'",
      )
    ).rowCount
  ) {
    throw new Error(
      "Existing identity or administrator: manual review required; no password or role changed",
    );
  }
  const id = randomUUID();
  const password = randomBytes(24).toString("base64url");
  const hashed = await hashPassword(password);
  await connection.query(
    'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,false)',
    [id, "TPA Administrator", email],
  );
  await connection.query(
    'INSERT INTO public."account"(id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES($1,$2,\'credential\',$2,$3,now(),now())',
    [randomUUID(), id, hashed],
  );
  await connection.query(
    "INSERT INTO tpa.operator_approved_identities(user_id,source) VALUES($1,'user_authorized_bootstrap')",
    [id],
  );
  await connection.query(
    "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')",
    [id],
  );
  await connection.query(
    "INSERT INTO tpa.member_profiles(user_id) VALUES($1)",
    [id],
  );
  await connection.query(
    "INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,'identity.operator_approved',$1),($1,'staff.administrator_provisioned',$1)",
    [id],
  );
  await writeFile(
    passwordFile,
    `TPA initial administrator\nEmail: ${email}\nPassword: ${password}\n\nSign in at http://127.0.0.1:3000/login and change this password in Account security. Delete this handoff file after saving it in your password manager.\n`,
    { flag: "wx", mode: 0o600 },
  );
  written = true;
  await connection.query("COMMIT");
  console.log(
    "Approved administrator provisioned. Password saved to the access-restricted local handoff file; no password printed.",
  );
} catch (error) {
  await connection.query("ROLLBACK");
  if (written) await unlink(passwordFile);
  throw error;
} finally {
  connection.release();
  await pool.end();
}
