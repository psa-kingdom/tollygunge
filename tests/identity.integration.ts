import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
import { createAuth } from "../src/lib/auth-options";
import { execFileSync } from "node:child_process";
import { hashPassword } from "better-auth/crypto";
const enabled = Boolean(
  process.env.DATABASE_URL && process.env.TPA_DATABASE_NAME,
);

test(
  "password recovery is single-use, expires and revokes sessions; public password signup stays closed",
  { skip: !enabled },
  async () => {
    const pool = new Pool(databaseOptions());
    const id = randomUUID(),
      email = `${id}@example.invalid`;
    const initial = randomBytes(24).toString("hex"),
      replacement = randomBytes(24).toString("hex");
    let capturedToken = "",
      deliveries = 0;
    const auth = createAuth(
      pool,
      {
        BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
        BETTER_AUTH_URL: "http://127.0.0.1:3000",
      },
      async (_email, _url, token) => {
        capturedToken = token;
        deliveries++;
      },
    );
    const request = (path: string, body: object, cookie?: string) =>
      auth.handler(
        new Request(`http://127.0.0.1:3000/api/auth/${path}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://127.0.0.1:3000",
            ...(cookie ? { cookie } : {}),
          },
          body: JSON.stringify(body),
        }),
      );
    try {
      await pool.query(
        'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Password fixture\',$2,false)',
        [id, email],
      );
      await pool.query(
        'INSERT INTO public."account"(id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES($1,$2,\'credential\',$2,$3,now(),now())',
        [randomUUID(), id, await hashPassword(initial)],
      );
      assert.equal(
        (
          await request("sign-up/email", {
            email: `${randomUUID()}@example.invalid`,
            name: "Closed signup",
            password: initial,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request("sign-in/email", {
            email,
            password: "incorrect-password",
          })
        ).status,
        401,
      );
      const login = await request("sign-in/email", {
        email,
        password: initial,
      });
      assert.equal(login.status, 200);
      const cookie = login.headers.get("set-cookie")!.split(";")[0];
      assert.equal(
        (await auth.api.getSession({ headers: new Headers({ cookie }) }))?.user
          .id,
        id,
      );
      assert.equal(
        (
          await request("request-password-reset", {
            email: `${randomUUID()}@example.invalid`,
          })
        ).status,
        200,
      );
      assert.equal(deliveries, 0);
      assert.equal(
        (await request("request-password-reset", { email })).status,
        200,
      );
      assert.equal(deliveries, 1);
      assert.equal(
        (
          await request("reset-password", {
            token: capturedToken,
            newPassword: replacement,
          })
        ).status,
        200,
      );
      assert.equal(
        await auth.api.getSession({ headers: new Headers({ cookie }) }),
        null,
      );
      assert.equal(
        (
          await request("reset-password", {
            token: capturedToken,
            newPassword: initial,
          })
        ).status,
        400,
      );
      assert.equal(
        (await request("sign-in/email", { email, password: initial })).status,
        401,
      );
      const renewed = await request("sign-in/email", {
        email,
        password: replacement,
      });
      assert.equal(renewed.status, 200);
      const renewedCookie = renewed.headers.get("set-cookie")!.split(";")[0];
      assert.equal(
        (
          await request(
            "change-password",
            {
              currentPassword: "incorrect-password",
              newPassword: initial,
              revokeOtherSessions: true,
            },
            renewedCookie,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            "change-password",
            {
              currentPassword: replacement,
              newPassword: initial,
              revokeOtherSessions: true,
            },
            renewedCookie,
          )
        ).status,
        200,
      );
      await request("request-password-reset", { email });
      await pool.query(
        'UPDATE public."verification" SET "expiresAt"=now()-interval \'1 minute\' WHERE identifier=$1',
        [`reset-password:${capturedToken}`],
      );
      assert.equal(
        (
          await request("reset-password", {
            token: capturedToken,
            newPassword: replacement,
          })
        ).status,
        400,
      );
      const disabledAuth = createAuth(pool, {
        BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
        BETTER_AUTH_URL: "http://127.0.0.1:3000",
      });
      const response = await disabledAuth.handler(
        new Request("http://127.0.0.1:3000/api/auth/request-password-reset", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://127.0.0.1:3000",
          },
          body: JSON.stringify({ email }),
        }),
      );
      assert.equal(response.status, 400);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM tpa.audit_events WHERE actor_user_id=$1 AND action IN ('identity.password_reset','identity.password_changed')",
            [id],
          )
        ).rows[0].n,
        2,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM tpa.staff_roles WHERE user_id=$1",
            [id],
          )
        ).rows[0].n,
        0,
      );
    } finally {
      await pool.query("DELETE FROM tpa.audit_events WHERE actor_user_id=$1", [
        id,
      ]);
      await pool.query('DELETE FROM public."verification" WHERE value=$1', [
        id,
      ]);
      await pool.query('DELETE FROM public."user" WHERE id=$1', [id]);
      await pool.end();
    }
  },
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
