import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { Pool } from "pg";
import { createAuth } from "../src/lib/auth-options";
import { databaseOptions } from "../src/lib/database-options";
import { openMail } from "../src/lib/onboarding-mail";
import { issueRegistrationCode } from "../src/lib/registration-code";
test(
  "signup, verification mail, session limits and reset use real auth/database paths",
  { skip: !process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_") },
  async () => {
    const db = new Pool(databaseOptions()),
      email = randomUUID() + "@example.invalid",
      password = randomBytes(6).toString("hex");
    const auth = createAuth(db, { ...process.env, ONBOARDING_ENABLED: "true", TPA_SIGNUP_OTP_REQUIRED: "false" });
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

test(
  "registration requires a chosen plan and a single-use code before sign-in",
  { skip: !process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_") },
  async () => {
    const db = new Pool(databaseOptions());
    const email = randomUUID() + "@example.invalid";
    const password = "Apply!123";
    const origin = process.env.BETTER_AUTH_URL!;
    const auth = createAuth(db, {
      ...process.env,
      ONBOARDING_ENABLED: "true",
      TPA_SIGNUP_OTP_REQUIRED: "true",
    });
    const request = (path: string, body: object) =>
      auth.handler(new Request(origin + "/api/auth/" + path, {
        method: "POST",
        headers: { origin, "content-type": "application/json", "x-forwarded-for": "192.0.2.44" },
        body: JSON.stringify(body),
      }));
    try {
      const signup = { name: "Registration code test", email, password };
      assert.equal((await request("sign-up/email", signup)).status, 400);
      const details = { ...signup, requestedMembershipPlan: "Patron" };
      assert.equal((await request("sign-up/email", details)).status, 400);
      const connection = await db.connect();
      try {
        await connection.query("BEGIN");
        await issueRegistrationCode(connection, email, process.env.BETTER_AUTH_SECRET!);
        await connection.query("COMMIT");
      } finally {
        connection.release();
      }
      const { rows: [job] } = await db.query(
        "SELECT payload FROM tpa.onboarding_mail WHERE recipient=$1 AND kind='verification'",
        [email],
      );
      const otp = openMail(job.payload).text.match(/\b\d{6}\b/)?.[0];
      assert.ok(otp);
      const incorrect = otp === "000000" ? "111111" : "000000";
      assert.equal((await request("sign-up/email", { ...details, registrationCode: incorrect })).ok, false);
      assert.equal((await db.query('SELECT 1 FROM public."user" WHERE email=$1', [email])).rowCount, 0);
      const verified = await request("sign-up/email", { ...details, registrationCode: otp });
      assert.equal(verified.status, 200, await verified.clone().text());
      assert.equal(verified.headers.has("set-cookie"), true);
      assert.equal((await request("sign-up/email", { ...details, registrationCode: otp })).ok, false);
      const { rows: [user] } = await db.query(
        'SELECT "requestedMembershipPlan","emailVerified" FROM public."user" WHERE email=$1',
        [email],
      );
      assert.deepEqual(user, { requestedMembershipPlan: "Patron", emailVerified: true });
    } finally {
      await db.query("DELETE FROM tpa.onboarding_mail WHERE recipient=$1", [email]);
      await db.query("DELETE FROM tpa.registration_codes WHERE email=$1", [email]);
      await db.query('DELETE FROM public."user" WHERE email=$1', [email]);
      await db.end();
    }
  },
);
