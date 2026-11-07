import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const email = arg("--email"),
  database = arg("--database"),
  replace = arg("--replace-email");
if (!email || !database || database !== process.env.TPA_DATABASE_NAME)
  throw Error(
    "Usage: setup-super-admin.mts --email VERIFIED_EMAIL --database EXPECTED_DATABASE [--replace-email CURRENT_SUPER_ADMIN_EMAIL]",
  );
const pool = new Pool(databaseOptions()),
  c = await pool.connect();
try {
  await c.query("BEGIN");
  await c.query("SELECT pg_advisory_xact_lock(741902,1)");
  if (
    (await c.query("SELECT current_database() AS name")).rows[0].name !==
    database
  )
    throw Error("Database identity mismatch.");
  const user = (
    await c.query(
      'SELECT id,"emailVerified" FROM public."user" WHERE lower(email)=lower($1) FOR UPDATE',
      [email],
    )
  ).rows[0];
  if (!user || !user.emailVerified)
    throw Error(
      "Choose an existing verified account; no identity will be created or verified automatically.",
    );
  const current = (
    await c.query(
      `SELECT r.user_id,u.email FROM tpa.staff_roles r JOIN public."user" u ON u.id=r.user_id WHERE r.role='super_administrator' FOR UPDATE OF r`,
    )
  ).rows[0];
  if (current?.user_id === user.id) {
    await c.query("ROLLBACK");
    console.log("This account is already the super admin.");
  } else {
    if (
      current &&
      (!replace || current.email.toLowerCase() !== replace.toLowerCase())
    )
      throw Error(
        "An existing super admin requires an explicit matching --replace-email.",
      );
    if (current) {
      await c.query(
        "DELETE FROM tpa.staff_roles WHERE role='super_administrator' AND user_id=$1",
        [current.user_id],
      );
      await c.query(
        "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator') ON CONFLICT DO NOTHING",
        [current.user_id],
      );
    }
    await c.query(
      "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'super_administrator')",
      [user.id],
    );
    await c.query(
      'DELETE FROM public."session" WHERE "userId"=ANY($1::text[])',
      [[user.id, ...(current ? [current.user_id] : [])]],
    );
    await c.query(
      "INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,'staff.super_admin_setup',$1)",
      [user.id],
    );
    await c.query("COMMIT");
    console.log("Single super admin configured; affected sessions revoked.");
  }
} catch (error) {
  await c.query("ROLLBACK");
  throw error;
} finally {
  c.release();
  await pool.end();
}
