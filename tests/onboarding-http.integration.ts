import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { databaseOptions } from "../src/lib/database-options";
import { openMail } from "../src/lib/onboarding-mail";
const base = process.env.TPA_TEST_URL;
test(
  "saved form, pinned review, badge retention, privileges, bulk commit and invitation redemption",
  {
    skip:
      !base ||
      !process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_"),
  },
  async () => {
    const db = new Pool(databaseOptions());
    const accounts = [randomUUID(), randomUUID(), randomUUID()];
    const cookies: string[] = [];
    try {
      for (const id of accounts) {
        const token = randomBytes(32).toString("hex");
        await db.query(
          'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,false)',
          [id, "HTTP fixture", id + "@example.invalid"],
        );
        await db.query(
          'INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())',
          [randomUUID(), token, id],
        );
        cookies.push(
          "better-auth.session_token=" +
            encodeURIComponent(
              token +
                "." +
                createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
                  .update(token)
                  .digest("base64"),
            ),
        );
      }
      await db.query(
        "INSERT INTO tpa.operator_approved_identities(user_id,source) VALUES($1,'user_authorized_bootstrap')",
        [accounts[0]],
      );
      await db.query(
        "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')",
        [accounts[0]],
      );
      const request = (path: string, person = 1, body?: unknown) =>
        fetch(base + path, {
          method: body ? "POST" : "GET",
          headers: {
            cookie: cookies[person],
            ...(body
              ? { "content-type": "application/json", origin: base! }
              : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      const get = async (path: string, p = 1) => {
        const r = await request(path, p);
        assert.equal(r.status, 200);
        return r.json();
      };
      let draft = {
        version: 0,
        plan: "Annual",
        category: "Professional",
        step: 2,
        documentIds: [] as string[],
        details: {
          fullName: "Test professional",
          phone: "1234567890",
          qualification: "CA",
          professionalStatus: "In Practice",
          professionalBody: "CA",
          registration: "TEST123",
          correspondenceAddress: "Residence",
          residenceAddress: "Kolkata",
          declaration: "true",
          signature: "Test professional",
        } as Record<string, string>,
      };
      const initialProfile = await get("/api/member/profile");
      assert.equal(initialProfile.onboardingDetails, true);
      assert.equal(
        (
          await request("/api/member/profile", 1, {
            action: "save",
            version: initialProfile.person.version,
            body: { name: "Competing copy" },
          })
        ).status,
        409,
      );
      let r = await request("/api/member/application", 1, draft);
      assert.equal(r.status, 200);
      draft = await r.json();
      assert.equal((await get("/api/member/application")).step, 2);
      assert.equal(
        (await request("/api/member/application", 1, { ...draft, version: 0 }))
          .status,
        409,
      );
      assert.equal(
        (
          await request("/api/member/verification", 1, {
            version: draft.version,
          })
        ).status,
        400,
      );
      assert.equal((await request("/api/staff/verification", 1)).status, 403);
      assert.equal(
        await (await request("/api/member/application", 2)).json(),
        null,
      );
      for (const kind of ["photograph", "certificate"]) {
        const id = randomUUID();
        await db.query(
          "INSERT INTO tpa.private_documents(id,owner_user_id,kind,content_type,byte_size) VALUES($1,$2,$3,'image/png',10)",
          [id, accounts[1], kind],
        );
        draft.details[kind] = id;
        draft.documentIds.push(id);
      }
      await db.query(
        'UPDATE public."user" SET "emailVerified"=true WHERE id=$1',
        [accounts[1]],
      );
      r = await request("/api/member/application", 1, draft);
      draft = await r.json();
      r = await request("/api/member/verification", 1, {
        version: draft.version,
      });
      assert.equal(r.status, 200);
      const submission = await r.json();
      const queue = await get("/api/staff/verification", 0),
        original = queue.policy;
      const fields = [
        ...original.fields,
        {
          id: "newRequirement",
          label: "New requirement",
          type: "text",
          step: 1,
          required: true,
          visible: true,
          categories: ["Professional", "Student"],
        },
      ];
      r = await request("/api/staff/verification", 0, {
        action: "save",
        fields,
        version: queue.draft?.version ?? 0,
      });
      assert.equal(r.status, 200);
      const saved = await r.json();
      assert.equal(
        (
          await request("/api/staff/verification", 0, {
            action: "publish",
            fields,
            version: saved.version,
          })
        ).status,
        200,
      );
      r = await request("/api/staff/verification", 0, {
        action: "approve",
        id: submission.id,
        version: 1,
      });
      assert.equal(r.status, 200);
      let status = await get("/api/member/verification");
      assert.equal(status.verified, true);
      assert.equal(status.updateRequested, true);
      assert.equal(status.approvedVersion, original.version);
      draft.details.newRequirement = "Updated";
      draft = await (await request("/api/member/application", 1, draft)).json();
      assert.equal((await get("/api/member/verification")).verified, true);
      assert.equal(
        (
          await request("/api/member/verification", 1, {
            version: draft.version,
          })
        ).status,
        200,
      );
      const next = await get("/api/staff/verification", 0);
      const review = next.reviews.find(
        (x: { user_id: string; status: string }) =>
          x.user_id === accounts[1] && x.status === "pending",
      );
      assert.equal(
        (
          await request("/api/staff/verification", 0, {
            action: "reject",
            id: review.id,
            version: review.version,
            reason: "Please check details",
          })
        ).status,
        200,
      );
      status = await get("/api/member/verification");
      assert.equal(status.verified, true);
      // An unreviewed edit cannot replace accepted profile data.
      const accepted = (
        await db.query("SELECT accepted FROM tpa.people WHERE user_id=$1", [
          accounts[1],
        ])
      ).rows[0].accepted;
      assert.equal(accepted.name, "Test professional");
      await db.query(
        "INSERT INTO tpa.operator_approved_identities(user_id,source) VALUES($1,'user_authorized_bootstrap')",
        [accounts[2]],
      );
      await db.query(
        "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'membership_reviewer')",
        [accounts[2]],
      );
      assert.equal(
        (
          await request("/api/staff/verification", 2, {
            action: "approve",
            id: review.id,
            version: review.version,
          })
        ).status,
        403,
      );
      const resubmission = await (
        await request("/api/member/verification", 1, { version: draft.version })
      ).json();
      assert.equal(
        (
          await request("/api/staff/verification", 2, {
            action: "corrections",
            id: resubmission.id,
            version: 1,
            reason: "Check evidence",
          })
        ).status,
        200,
      );
      assert.equal((await get("/api/member/verification")).verified, true);
      const finalSubmission = await (
        await request("/api/member/verification", 1, { version: draft.version })
      ).json();
      assert.equal(
        (
          await request("/api/staff/verification", 0, {
            action: "approve",
            id: finalSubmission.id,
            version: 1,
          })
        ).status,
        200,
      );
      assert.equal(
        (await get("/api/member/verification")).updateRequested,
        false,
      );
      const profile = (
        await db.query("SELECT id,version FROM tpa.people WHERE user_id=$1", [
          accounts[1],
        ])
      ).rows[0];
      assert.equal(
        (
          await request("/api/staff/verification", 0, {
            action: "revoke",
            personId: profile.id,
            version: profile.version,
            reason: "",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request("/api/staff/verification", 0, {
            action: "revoke",
            personId: profile.id,
            version: profile.version,
            reason: "Synthetic revocation test",
          })
        ).status,
        200,
      );
      assert.equal((await get("/api/member/verification")).verified, false);
      const mail = randomUUID() + "@example.invalid",
        form = new FormData();
      form.set(
        "file",
        new File(
          [
            `name,email\nImported,${mail}\nDuplicate,${accounts[1]}@example.invalid`,
          ],
          "users.csv",
          { type: "text/csv" },
        ),
      );
      form.set("mapping", JSON.stringify({ name: "name", email: "email" }));
      r = await fetch(base + "/api/staff/onboarding-import", {
        method: "POST",
        headers: { origin: base!, cookie: cookies[0] },
        body: form,
      });
      assert.equal(r.status, 200);
      const preview = await r.json();
      r = await request("/api/staff/onboarding-import", 0, {
        action: "commit",
        id: preview.id,
      });
      assert.equal(r.status, 200);
      const results = await r.json();
      assert.equal(
        (await get("/api/staff/onboarding-import?id=" + preview.id, 0))
          .results[0].emailStatus,
        "queued",
      );
      assert.deepEqual(
        results.results.map((x: { status: string }) => x.status),
        ["created", "skipped"],
      );
      assert.equal(
        (
          await (
            await request("/api/staff/onboarding-import", 0, {
              action: "commit",
              id: preview.id,
            })
          ).json()
        ).duplicate,
        true,
      );
      const job = (
        await db.query(
          "SELECT * FROM tpa.onboarding_mail WHERE recipient=$1 AND kind='invitation'",
          [mail],
        )
      ).rows[0];
      const text = openMail(job.payload).text;
      let token = new URL(
        text.split("\n").find((x: string) => x.startsWith("http")),
      ).hash.split("token=")[1];
      assert.ok(token);
      const redeem = () =>
        fetch(base + "/api/onboarding/invitation", {
          method: "POST",
          headers: { origin: base!, "content-type": "application/json" },
          body: JSON.stringify({
            token,
            password: "test-password-at-least-12",
          }),
        });
      await db.query(
        "UPDATE tpa.onboarding_invitations SET expires_at=now()-interval '1 minute' WHERE user_id=$1",
        [job.user_id],
      );
      assert.equal((await redeem()).status, 410);
      assert.equal(
        (
          await request("/api/staff/onboarding-import", 0, {
            action: "reissue",
            id: job.id,
          })
        ).status,
        200,
      );
      const reissued = (
        await db.query(
          "SELECT payload FROM tpa.onboarding_mail WHERE recipient=$1 AND kind='invitation' ORDER BY created_at DESC LIMIT 1",
          [mail],
        )
      ).rows[0];
      token = new URL(
        openMail(reissued.payload)
          .text.split("\n")
          .find((x: string) => x.startsWith("http")),
      ).hash.split("token=")[1];
      assert.equal((await redeem()).status, 200);
      assert.equal((await redeem()).status, 410);
      assert.equal(
        (
          await db.query(
            'SELECT "emailVerified" FROM public."user" WHERE email=$1',
            [mail],
          )
        ).rows[0].emailVerified,
        true,
      );
      assert.equal(
        (
          await db.query("SELECT 1 FROM tpa.staff_roles WHERE user_id=$1", [
            job.user_id,
          ])
        ).rowCount,
        0,
      );
    } finally {
      await db.end();
    }
  },
);
