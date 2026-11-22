import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { emptyPerson } from "../src/domain/people";
import { databaseOptions } from "../src/lib/database-options";
import { policy, reviewVerification } from "../src/lib/verification-service";

test(
  "application approval activates the chosen plan and revocation suspends it",
  {
    skip: !process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_"),
  },
  async () => {
    const pool = new Pool(databaseOptions());
    const client = await pool.connect();
    const [adminId, userId, personId, submissionId] = Array.from(
      { length: 4 },
      () => randomUUID(),
    );
    const member = { ...emptyPerson, name: "Synthetic activation review" };
    const admin = {
      id: adminId,
      name: "Synthetic reviewer",
      email: adminId + "@example.invalid",
      roles: ["administrator"],
    };
    try {
      await client.query("BEGIN");
      assert.equal(
        (await client.query("SELECT current_database() AS name")).rows[0].name,
        process.env.TPA_DATABASE_NAME,
      );
      await client.query(
        'INSERT INTO public."user"(id,name,email,"emailVerified","requestedMembershipPlan") VALUES($1,$2,$3,true,NULL),($4,$5,$6,true,\'Patron\')',
        [
          admin.id,
          admin.name,
          admin.email,
          userId,
          member.name,
          userId + "@example.invalid",
        ],
      );
      await client.query(
        "INSERT INTO tpa.people(id,user_id,accepted,draft) VALUES($1,$2,$3,$3)",
        [personId, userId, member],
      );
      const { version } = await policy(client);
      await client.query(
        "INSERT INTO tpa.verification_submissions(id,user_id,person_id,requirement_version,snapshot,person_snapshot) VALUES($1,$2,$3,$4,$5,$6)",
        [
          submissionId,
          userId,
          personId,
          version,
          { personVersion: 1, category: "Professional", details: {} },
          member,
        ],
      );
      const membership = async () =>
        (
          await client.query(
            "SELECT type,status,membership_number FROM tpa.memberships WHERE person_id=$1",
            [personId],
          )
        ).rows[0];
      assert.equal(await membership(), undefined);
      await reviewVerification(client, admin, {
        action: "approve",
        id: submissionId,
        version: 1,
      });
      assert.deepEqual(await membership(), {
        type: "Patron",
        status: "active",
        membership_number: null,
      });
      await reviewVerification(client, admin, {
        action: "revoke",
        personId,
        version: 2,
        reason: "Synthetic review closed",
      });
      assert.deepEqual(await membership(), {
        type: "Patron",
        status: "suspended",
        membership_number: null,
      });
    } finally {
      await client.query("ROLLBACK");
      client.release();
      await pool.end();
    }
  },
);
