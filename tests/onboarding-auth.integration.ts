import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { Pool } from "pg";
import { createAuth } from "../src/lib/auth-options";
import { databaseOptions } from "../src/lib/database-options";
import { openMail } from "../src/lib/onboarding-mail";
test(
  "signup, verification mail, session limits and reset use real auth/database paths",
  { skip: !process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_") },
  async () => {
    const db = new Pool(databaseOptions()),
      email = randomUUID() + "@example.invalid",
      password = randomBytes(24).toString("hex");
    const auth = createAuth(db, { ...process.env, ONBOARDING_ENABLED: "true" });
    const request = (path: string, body: object, keep = false) =>
      auth.handler(
        new Request(process.env.BETTER_AUTH_URL + "/api/auth/" + path, {
          method: "POST",
          headers: {
            origin: process.env.BETTER_AUTH_URL!,
            "content-type": "application/json",
            "x-tpa-keep-signed-in": String(keep),
          },
          body: JSON.stringify(body),
        }),
      );
    try {
      const signup = await request("sign-up/email", {
        email,
        name: "Onboarding test",
        password,
      });
      assert.equal(signup.status, 200);
      const user = (
        await db.query('SELECT * FROM public."user" WHERE email=$1', [email])
      ).rows[0];
      assert.equal(user.emailVerified, false);
      assert.equal(
        (
          await db.query("SELECT 1 FROM tpa.staff_roles WHERE user_id=$1", [
            user.id,
          ])
        ).rowCount,
        0,
      );
      const jobs = (
        await db.query("SELECT * FROM tpa.onboarding_mail WHERE user_id=$1", [
          user.id,
        ])
      ).rows;
      assert.deepEqual(jobs.map((j) => j.kind).sort(), [
        "verification",
        "welcome",
      ]);
      const verification = openMail(
        jobs.find((j) => j.kind === "verification").payload,
      ).text;
      const url = verification
        .split("\n")
        .find((s: string) => s.startsWith("http"));
      assert.ok(url);
      const verify = await auth.handler(new Request(url));
      assert.ok([200, 302].includes(verify.status));
      assert.equal(
        (
          await db.query(
            'SELECT "emailVerified" FROM public."user" WHERE id=$1',
            [user.id],
          )
        ).rows[0].emailVerified,
        true,
      );
      const login = await request(
        "sign-in/email",
        { email, password, rememberMe: true },
        true,
      );
      assert.equal(login.status, 200);
      const sessions = (
        await db.query(
          'SELECT "durationDays","expiresAt" FROM public."session" WHERE "userId"=$1 ORDER BY "createdAt" DESC',
          [user.id],
        )
      ).rows;
      assert.equal(sessions[0].durationDays, 30);
      assert.ok(
        new Date(sessions[0].expiresAt).getTime() - Date.now() > 29 * 86400000,
      );
      await db.query(
        "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')",
        [user.id],
      );
      assert.equal(
        (await request("sign-in/email", { email, password }, true)).status,
        200,
      );
      assert.equal(
        (
          await db.query(
            'SELECT "durationDays" FROM public."session" WHERE "userId"=$1 ORDER BY "createdAt" DESC',
            [user.id],
          )
        ).rows[0].durationDays,
        7,
      );
      assert.notEqual(
        (await request("sign-up/email", { email, name: "Duplicate", password }))
          .status,
        200,
      );
    } finally {
      await db.end();
    }
  },
);
