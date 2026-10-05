import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
import { createAuth } from "../src/lib/auth-options";
import { execFileSync } from "node:child_process";
const enabled = Boolean(
  process.env.DATABASE_URL && process.env.TPA_DATABASE_NAME,
);
test(
  "PostgreSQL sessions revoke immediately and identity foreign keys reject orphan records",
  { skip: !enabled },
  async () => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], { stdio: "pipe" });
    const pool = new Pool(databaseOptions());
    const secret = randomBytes(32).toString("hex");
    const auth = createAuth(pool, {
      BETTER_AUTH_SECRET: secret,
      BETTER_AUTH_URL: "http://127.0.0.1:3000",
    });
    const id = randomUUID(),
      token = randomBytes(32).toString("hex"),
      sessionId = randomUUID();
    const cookie =
      "better-auth.session_token=" +
      encodeURIComponent(
        token +
          "." +
          createHmac("sha256", secret).update(token).digest("base64"),
      );
    try {
      await pool.query(
        'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',
        [id, "Identity fixture", id + "@example.invalid"],
      );
      await pool.query(
        'INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())',
        [sessionId, token, id],
      );
      const session = await auth.api.getSession({
        headers: new Headers({ cookie }),
      });
      assert.equal(session?.user.id, id);
      assert.equal(await auth.api.getSession({ headers: new Headers() }), null);
      await pool.query('DELETE FROM public."session" WHERE id=$1', [sessionId]);
      assert.equal(
        await auth.api.getSession({ headers: new Headers({ cookie }) }),
        null,
      );
      for (const sql of [
        "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')",
        "INSERT INTO tpa.member_profiles(user_id) VALUES($1)",
        "INSERT INTO tpa.private_documents(id,owner_user_id,kind,content_type,byte_size) VALUES(gen_random_uuid(),$1,'certificate','application/pdf',10)",
      ]) {
        await assert.rejects(pool.query(sql, [randomUUID()]), {
          code: "23503",
        });
      }
      await pool.query("INSERT INTO tpa.member_profiles(user_id) VALUES($1)", [
        id,
      ]);
      await assert.rejects(
        pool.query("INSERT INTO tpa.member_profiles(user_id) VALUES($1)", [id]),
        { code: "23505" },
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM tpa.staff_roles WHERE user_id=$1",
            [id],
          )
        ).rows[0].count,
        0,
      );
    } finally {
      await pool.query("DELETE FROM tpa.member_profiles WHERE user_id=$1", [
        id,
      ]);
      await pool.query('DELETE FROM public."user" WHERE id=$1', [id]);
      await pool.end();
    }
  },
);
