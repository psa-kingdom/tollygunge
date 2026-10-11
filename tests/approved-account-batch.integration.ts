import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
import {
  createApprovedAccountPreview,
  memberBatchAction,
} from "../src/lib/member-import";
import { memberHeaders } from "../src/domain/member-import";
import { approvedAccountSourceHash } from "../src/domain/approved-account-batch";
import { createAuth } from "../src/lib/auth-options";
import { hashPassword } from "better-auth/crypto";
const enabled = process.env.TPA_DATABASE_NAME?.startsWith(
  "tpa_onboarding_test_",
);
test(
  "approved accounts retain incomplete addresses, hold invitations, resume and replay safely",
  { skip: !enabled },
  async () => {
    const pool = new Pool(databaseOptions()),
      c = await pool.connect(),
      actor = randomUUID();
    try {
      await c.query("BEGIN");
      await c.query(
        'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Synthetic actor\',$2,false)',
        [actor, actor + "@example.invalid"],
      );
      const cells = [
        memberHeaders,
        ...Array.from({ length: 211 }, (_, i) => [
          "CA",
          i < 28 ? "First" : "",
          "Member",
          String(i).padStart(5, "0"),
          `${actor}-${i}@example.invalid`,
          "",
          "Partner",
          "Firm",
          i % 2 ? "" : "Source line",
          "India",
          "Unknown state",
          "Unknown city",
          "",
        ]),
      ];
      cells[2][4] = cells[1][4].toUpperCase();
      const before = (
        await c.query(
          "SELECT (SELECT count(*) FROM tpa.onboarding_mail)::int mail,(SELECT count(*) FROM tpa.onboarding_invitations)::int invitations",
        )
      ).rows[0];
      await assert.rejects(
        createApprovedAccountPreview(c, actor, cells, "wrong"),
      );
      const preview = await createApprovedAccountPreview(
        c,
        actor,
        cells,
        approvedAccountSourceHash,
      );
      assert.equal(preview.rows[1].status, "conflict");
      await assert.rejects(
        memberBatchAction(c, actor, {
          id: preview.id,
          action: "choices",
          version: 1,
          provisionAccounts: false,
          updateRows: [],
        }),
      );
      let result;
      do {
        result = await memberBatchAction(c, actor, {
          id: preview.id,
          action: "commit",
          version: 1,
        });
      } while ("complete" in result && !result.complete);
      assert.ok("totals" in result && result.totals);
      assert.equal(result.totals.created, 27);
      assert.equal(result.totals.conflict, 1);
      const replay = await memberBatchAction(c, actor, {
        id: preview.id,
        action: "commit",
      });
      assert.equal(replay.duplicate, true);
      const rows = (
        await c.query(
          'SELECT p.accepted,p.accepted_verified,p.published,u."emailVerified",h.released_at FROM tpa.account_invitation_holds h JOIN public."user" u ON u.id=h.user_id JOIN tpa.people p ON p.user_id=u.id WHERE h.source_batch_id=$1',
          [preview.id],
        )
      ).rows;
      assert.equal(rows.length, 27);
      for (const r of rows) {
        assert.equal(r.accepted.addresses.correspondence.district, "");
        assert.equal(r.accepted.addresses.correspondence.city, "Unknown city");
        assert.equal(r.accepted_verified, false);
        assert.equal(r.published, null);
        assert.equal(r.emailVerified, false);
        assert.equal(r.released_at, null);
      }
      assert.deepEqual(
        (
          await c.query(
            "SELECT (SELECT count(*) FROM tpa.onboarding_mail)::int mail,(SELECT count(*) FROM tpa.onboarding_invitations)::int invitations",
          )
        ).rows[0],
        before,
      );
      assert.equal(
        (
          await c.query(
            'SELECT count(*)::int n FROM public."account" a JOIN tpa.account_invitation_holds h ON h.user_id=a."userId" WHERE h.source_batch_id=$1',
            [preview.id],
          )
        ).rows[0].n,
        0,
      );
      const again = await createApprovedAccountPreview(
        c,
        actor,
        cells,
        approvedAccountSourceHash,
      );
      assert.ok(again.rows.slice(0, 28).every((r) => r.status === "conflict"));
    } finally {
      await c.query("ROLLBACK");
      c.release();
      await pool.end();
    }
  },
);

test(
  "concurrent chunk requests serialize and a new account collision leaves no partial member",
  { skip: !enabled },
  async () => {
    const pool = new Pool(databaseOptions()),
      c = await pool.connect(),
      actor = randomUUID(),
      existing = randomUUID();
    try {
      await c.query("BEGIN");
      await c.query(
        'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Synthetic concurrent actor\',$2,false)',
        [actor, actor + "@example.invalid"],
      );
      const cells = [
        memberHeaders,
        ...Array.from({ length: 211 }, (_, i) => [
          "CA",
          i < 2 ? "Concurrent" : "",
          "Member",
          actor + "-" + i,
          `${actor}-${i}@example.invalid`,
          "",
          "Partner",
          "Firm",
          "Original line",
          "India",
          "Unknown state",
          "Unknown city",
          "",
        ]),
      ];
      const preview = await createApprovedAccountPreview(
        c,
        actor,
        cells,
        approvedAccountSourceHash,
      );
      await c.query("COMMIT");
      await c.query(
        'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Existing collision\',$2,false)',
        [existing, cells[1][4]],
      );
      async function chunk() {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await memberBatchAction(client, actor, {
            id: preview.id,
            action: "commit",
            version: 1,
          });
          await client.query("COMMIT");
          return result;
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        } finally {
          client.release();
        }
      }
      await Promise.all([chunk(), chunk()]);
      const batch = (
        await c.query(
          "SELECT results FROM tpa.onboarding_batches WHERE id=$1",
          [preview.id],
        )
      ).rows[0];
      assert.equal(batch.results.length, 50);
      assert.equal(
        batch.results.filter((r: { status: string }) => r.status === "created")
          .length,
        1,
      );
      assert.equal(batch.results[0].status, "conflict");
      assert.equal(
        (
          await c.query(
            "SELECT count(*)::int n FROM tpa.people WHERE contact_email=$1",
            [cells[1][4]],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await c.query(
            "SELECT count(*)::int n FROM tpa.memberships WHERE membership_number=$1",
            [cells[1][3]],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await c.query('SELECT name FROM public."user" WHERE id=$1', [
            existing,
          ])
        ).rows[0].name,
        "Existing collision",
      );
      assert.equal(
        (
          await c.query(
            "SELECT count(*)::int n FROM tpa.account_invitation_holds WHERE source_batch_id=$1",
            [preview.id],
          )
        ).rows[0].n,
        1,
      );
    } finally {
      await c.query("ROLLBACK");
      c.release();
      await pool.end();
    }
  },
);

test(
  "held account cannot use recovery, verification or sign-in before explicit release",
  { skip: !enabled },
  async () => {
    const pool = new Pool(databaseOptions()),
      id = randomUUID(),
      email = id + "@example.invalid",
      password = "Synthetic-held-password-123!";
    let sends = 0;
    const origin = "http://127.0.0.1:3128",
      auth = createAuth(
        pool,
        { ...process.env, BETTER_AUTH_URL: origin, ONBOARDING_ENABLED: "true" },
        async () => {
          sends++;
        },
      );
    const request = (path: string, body: object) =>
      auth.handler(
        new Request(origin + "/api/auth/" + path, {
          method: "POST",
          headers: { origin, "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    try {
      await pool.query(
        `INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,'Held auth fixture',$2,true)`,
        [id, email],
      );
      await pool.query(
        "INSERT INTO tpa.account_invitation_holds(user_id) VALUES($1)",
        [id],
      );
      const before = (
        await pool.query("SELECT count(*)::int n FROM tpa.onboarding_mail")
      ).rows[0].n;
      assert.equal(
        (await request("request-password-reset", { email })).status,
        200,
      );
      assert.equal(
        (await request("send-verification-email", { email })).status,
        200,
      );
      assert.equal(sends, 0);
      assert.equal(
        (
          await pool.query(
            'SELECT count(*)::int n FROM public."verification" WHERE value=$1',
            [id],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM tpa.onboarding_mail"))
          .rows[0].n,
        before,
      );
      // Defense in depth: even a credential introduced outside this batch cannot bypass the hold.
      await pool.query(
        `INSERT INTO public."account"(id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES($1,$2,'credential',$2,$3,now(),now())`,
        [randomUUID(), id, await hashPassword(password)],
      );
      assert.equal(
        (await request("sign-in/email", { email, password })).status,
        403,
      );
      assert.equal(
        (
          await pool.query(
            'SELECT count(*)::int n FROM public."session" WHERE "userId"=$1',
            [id],
          )
        ).rows[0].n,
        0,
      );
      await pool.query(
        "UPDATE tpa.account_invitation_holds SET released_at=now() WHERE user_id=$1",
        [id],
      );
      assert.equal(
        (await request("sign-in/email", { email, password })).status,
        200,
      );
    } finally {
      await pool.end();
    }
  },
);
