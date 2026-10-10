import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
import { queueOnboardingMail } from "../src/lib/onboarding-mail";
import {
  runOnboardingTick,
  recordOnboardingEvent,
} from "../src/lib/onboarding-delivery";
import { EmailProviderError } from "../src/lib/email-provider";
test(
  "durable mail retries, lease recovery and duplicate out-of-order events",
  { skip: !process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_") },
  async () => {
    const db = new Pool(databaseOptions());
    const env = {
      ...process.env,
      ONBOARDING_ENABLED: "true",
      RESEND_API_KEY: "test",
      RESEND_RECEIVING_API_KEY: "test",
      RESEND_DOMAIN_VERIFIED: "true",
    };
    const quota = async () => ({
      daily: {
        used: 0,
        limit: 100,
        resets_at: new Date(Date.now() + 86400000).toISOString(),
      },
      monthly: {
        used: 0,
        limit: 1000,
        resets_at: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    const email = randomUUID() + "@example.invalid";
    try {
      await db.query(
        "UPDATE tpa.onboarding_mail SET available_at=now()+interval '1 day' WHERE status IN ('queued','leased')",
      );
      await queueOnboardingMail(
        db,
        null,
        email,
        "welcome",
        "http://127.0.0.1/member",
        "worker-" + email,
      );
      const keys: string[] = [];
      const fail = async (
        _path: string,
        _key: string,
        _body?: unknown,
        id?: string,
      ) => {
        keys.push(id!);
        throw new EmailProviderError(true, true, "network");
      };
      await runOnboardingTick(db, env, { quota, request: fail });
      let row = (
        await db.query("SELECT * FROM tpa.onboarding_mail WHERE recipient=$1", [
          email,
        ])
      ).rows[0];
      assert.equal(row.status, "queued");
      assert.equal(row.attempts, 1);
      await db.query(
        "UPDATE tpa.onboarding_mail SET status='leased',lease_until=now()-interval '1 minute',available_at=now() WHERE id=$1",
        [row.id],
      );
      const provider = randomUUID();
      process.env.ONBOARDING_ENABLED = "true";
      await recordOnboardingEvent(db, "early-" + provider, {
        type: "email.delivered",
        data: { email_id: provider },
      });
      await runOnboardingTick(db, env, {
        quota,
        request: async (_p, _k, _b, id) => {
          keys.push(id!);
          return { id: provider };
        },
      });
      row = (
        await db.query("SELECT * FROM tpa.onboarding_mail WHERE recipient=$1", [
          email,
        ])
      ).rows[0];
      assert.equal(row.status, "delivered");
      assert.equal(row.attempts, 2);
      assert.equal(keys[0], keys[1]);
      assert.deepEqual(row.payload, {});
      await recordOnboardingEvent(db, "bounce-" + provider, {
        type: "email.bounced",
        data: { email_id: provider },
      });
      await recordOnboardingEvent(db, "bounce-" + provider, {
        type: "email.bounced",
        data: { email_id: provider },
      });
      await recordOnboardingEvent(db, "late-" + provider, {
        type: "email.delivered",
        data: { email_id: provider },
      });
      assert.equal(
        (
          await db.query("SELECT status FROM tpa.onboarding_mail WHERE id=$1", [
            row.id,
          ])
        ).rows[0].status,
        "bounced",
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int n FROM tpa.onboarding_mail_events WHERE id=$1",
            ["bounce-" + provider],
          )
        ).rows[0].n,
        1,
      );
    } finally {
      await db.end();
    }
  },
);
