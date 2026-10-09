import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
import {
  reviewCampaign,
  dispatchCampaign,
  cancelDispatch,
  unsubscribe,
  queueReply,
} from "../src/lib/email-service";
import {
  claimEmailJob,
  processEmailJob,
  recoverEmailLeases,
} from "../src/lib/email-worker";
import { recordEmailEvent } from "../src/lib/email-events";
import { EmailProviderError } from "../src/lib/email-provider";
const enabled = !!process.env.DATABASE_URL && !!process.env.TPA_DATABASE_NAME;
const quota = {
  daily: { used: 0, limit: 100, resets_at: "2099-01-01T00:00:00Z" },
  monthly: { used: 0, limit: 3000, resets_at: "2099-02-01T00:00:00Z" },
};
test(
  "durable campaigns, consent, quota, leases, events and private inbox preserve independent states",
  { skip: !enabled },
  async () => {
    assert.ok(
      /(?:ci|acceptance|test)/.test(process.env.TPA_DATABASE_NAME!),
      "Use an isolated test database only.",
    );
    const pool = new Pool(databaseOptions()),
      actor = randomUUID(),
      user = randomUUID(),
      campaign = randomUUID(),
      city = randomUUID(),
      owner = randomUUID();
    const old = { ...process.env };
    Object.assign(process.env, {
      EMAIL_OPERATIONS_ENABLED: "true",
      RESEND_DOMAIN_VERIFIED: "true",
      RESEND_API_KEY: "synthetic",
      RESEND_RECEIVING_API_KEY: "synthetic",
      RESEND_WEBHOOK_SECRET: "synthetic",
      BETTER_AUTH_SECRET: "synthetic-acceptance-only-secret",
      BETTER_AUTH_URL: "https://example.invalid",
    });
    let sends = 0;
    const deps = {
      quota: async () => structuredClone(quota),
      request: async (
        _path: string,
        _key: string,
        _body?: unknown,
        _idem?: string,
      ) => {
        void [_path, _key, _body, _idem];
        sends++;
        return { id: randomUUID() };
      },
    };
    const job = async () => {
      const j = await claimEmailJob(pool, owner);
      assert.ok(j);
      return j;
    };
    const state = async (id: string) =>
      (await pool.query("SELECT * FROM tpa.email_jobs WHERE id=$1", [id]))
        .rows[0];
    try {
      await pool.query(
        "INSERT INTO public.\"user\"(id,name,email,\"emailVerified\") VALUES($1,'Synthetic operator',$3,true),($2,'Synthetic subscriber',$4,true)",
        [actor, user, actor + "@example.invalid", user + "@example.invalid"],
      );
      await pool.query(
        "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'communications_operator')",
        [actor],
      );
      await pool.query(
        'INSERT INTO tpa.member_profiles(user_id,city,preferences) VALUES($1,$2,\'{"contact":"email"}\')',
        [user, city],
      );
      await pool.query(
        "INSERT INTO tpa.newsletter_consents(user_id,subscribed,source) VALUES($1,true,'synthetic')",
        [user],
      );
      await pool.query(
        "INSERT INTO tpa.email_worker_state(id,heartbeat_at,status) VALUES('email',now(),'ready') ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),status='ready'",
      );
      await pool.query(
        "INSERT INTO tpa.campaign_drafts(id,name,subject,body,audience,updated_by) VALUES($1,'Synthetic campaign','Synthetic subject','Synthetic safe message',$2,$3)",
        [campaign, { city, profession: "" }, actor],
      );
      let review = await reviewCampaign(pool, actor, campaign, 1);
      assert.equal(review.eligible, 1);
      await assert.rejects(() =>
        dispatchCampaign(pool, user, campaign, 1, review.reviewToken),
      );
      await pool.query(
        "UPDATE tpa.newsletter_consents SET subscribed=false WHERE user_id=$1",
        [user],
      );
      await assert.rejects(() =>
        dispatchCampaign(pool, actor, campaign, 1, review.reviewToken),
      );
      await pool.query(
        "UPDATE tpa.newsletter_consents SET subscribed=true WHERE user_id=$1",
        [user],
      );
      review = await reviewCampaign(pool, actor, campaign, 1);
      const dispatched = await dispatchCampaign(
        pool,
        actor,
        campaign,
        1,
        review.reviewToken,
      );
      assert.equal(dispatched.queued, 1);
      assert.equal(
        (await dispatchCampaign(pool, actor, campaign, 1, review.reviewToken))
          .duplicate,
        true,
      );
      let j = await job();
      await processEmailJob(pool, j.id, owner, process.env, {
        ...deps,
        quota: async () => {
          await pool.query(
            "UPDATE tpa.newsletter_consents SET subscribed=false WHERE user_id=$1",
            [user],
          );
          return structuredClone(quota);
        },
      });
      assert.equal((await state(j.id)).status, "skipped");
      assert.equal(sends, 0);
      await pool.query(
        "UPDATE tpa.newsletter_consents SET subscribed=true WHERE user_id=$1",
        [user],
      );
      await pool.query(
        "UPDATE tpa.email_jobs SET status='queued' WHERE id=$1",
        [j.id],
      );
      j = await job();
      await processEmailJob(pool, j.id, owner, process.env, {
        ...deps,
        quota: async () => ({ ...quota, daily: { ...quota.daily, used: 80 } }),
      });
      assert.equal((await state(j.id)).reason, "quota_wait");
      assert.equal(sends, 0);
      await pool.query(
        "UPDATE tpa.email_jobs SET available_at=now() WHERE id=$1",
        [j.id],
      );
      j = await job();
      let stable = "";
      await processEmailJob(pool, j.id, owner, process.env, {
        ...deps,
        request: async (_p, _k, _b, idem) => {
          stable = idem!;
          throw new EmailProviderError(true, true, "network");
        },
      });
      assert.equal((await state(j.id)).status, "queued");
      await pool.query(
        "UPDATE tpa.email_jobs SET available_at=now() WHERE id=$1",
        [j.id],
      );
      j = await job();
      await processEmailJob(pool, j.id, owner, process.env, {
        ...deps,
        request: async (_p, _k, body, idem) => {
          assert.equal(idem, stable);
          assert.ok((body as { headers: unknown }).headers);
          return { id: "provider_synthetic" };
        },
      });
      assert.equal((await state(j.id)).status, "accepted");
      const event = {
        type: "email.delivered",
        created_at: new Date().toISOString(),
        data: {
          email_id: "provider_synthetic",
          from: "updates@updates.tpassociation.org",
          to: [user + "@example.invalid"],
          tags: { tpa_job: j.id },
        },
      };
      assert.deepEqual(await recordEmailEvent(pool, "event_test", event), {
        recorded: true,
      });
      assert.deepEqual(await recordEmailEvent(pool, "event_test", event), {
        duplicate: true,
      });
      await recordEmailEvent(pool, "event_bounce", {
        ...event,
        type: "email.bounced",
        data: { ...event.data, bounce: { type: "Permanent" } },
      });
      assert.equal(
        (
          await pool.query(
            "SELECT reason FROM tpa.email_suppressions WHERE email=$1",
            [user + "@example.invalid"],
          )
        ).rows[0].reason,
        "bounce",
      );
      await pool.query(
        "UPDATE tpa.email_jobs SET status='leased',lease_owner=$2,lease_until=now()-interval '1 minute',first_attempt_at=now()-interval '24 hours' WHERE id=$1",
        [j.id, owner],
      );
      await recoverEmailLeases(pool);
      assert.equal((await state(j.id)).status, "review");
      const row = await state(j.id),
        token = new URLSearchParams(
          new URL(row.payload.unsubscribe).hash.slice(1),
        ).get("token")!;
      await unsubscribe(pool, token);
      await unsubscribe(pool, token);
      assert.equal(
        (
          await pool.query(
            "SELECT subscribed FROM tpa.newsletter_consents WHERE user_id=$1",
            [user],
          )
        ).rows[0].subscribed,
        false,
      );
      await cancelDispatch(pool, actor, dispatched.id, 1);
      await assert.rejects(() => cancelDispatch(pool, actor, dispatched.id, 1));
      const incoming = {
        type: "email.received",
        created_at: new Date().toISOString(),
        data: {
          email_id: "inbound_fixture",
          to: ["contact@updates.tpassociation.org"],
        },
      };
      await recordEmailEvent(pool, "event_inbound", incoming);
      await recordEmailEvent(pool, "event_wrong_recipient", {
        ...incoming,
        data: {
          email_id: "wrong_recipient",
          to: ["someone@updates.tpassociation.org"],
        },
      });
      j = await job();
      assert.equal(j.kind, "inbound");
      await processEmailJob(pool, j.id, owner, process.env, {
        ...deps,
        request: async () => ({
          to: ["contact@updates.tpassociation.org"],
          from: "Person <worker-fixture@example.invalid>",
          subject: "Safe thread",
          message_id: "<message@example.invalid>",
          html: "<script>bad()</script><p>Message</p>",
          attachments: [
            {
              filename: "private.pdf",
              content_type: "application/pdf",
              download_url: "https://never-fetch.invalid",
            },
          ],
        }),
      });
      const convo = (
        await pool.query(
          "SELECT * FROM tpa.email_conversations WHERE correspondent='worker-fixture@example.invalid'",
        )
      ).rows[0];
      assert.ok(convo);
      const message = (
        await pool.query(
          "SELECT * FROM tpa.email_messages WHERE conversation_id=$1",
          [convo.id],
        )
      ).rows[0];
      assert.equal(message.body, "Message");
      assert.deepEqual(message.attachments, [
        { name: "private.pdf", type: "application/pdf" },
      ]);
      await pool.query(
        "UPDATE tpa.email_conversations SET draft='Explicit saved reply' WHERE id=$1",
        [convo.id],
      );
      const reply = await queueReply(
        pool,
        actor,
        convo.id,
        convo.version,
        convo.draft_version,
      );
      await assert.rejects(() =>
        queueReply(pool, actor, convo.id, convo.version, convo.draft_version),
      );
      await pool.query("DELETE FROM tpa.staff_roles WHERE user_id=$1", [actor]);
      j = await job();
      assert.equal(j.id, reply.id);
      await processEmailJob(pool, j.id, owner, process.env, deps);
      assert.equal((await state(j.id)).reason, "sender_permission_revoked");
    } finally {
      // This suite is confined to the disposable database; remove exact fixture dependencies.
      await pool.query(
        "DELETE FROM tpa.email_jobs WHERE created_by=$1 OR user_id=$2 OR payload->>'emailId'='inbound_fixture'",
        [actor, user],
      );
      await pool.query(
        "DELETE FROM tpa.email_events WHERE event_id IN ('event_test','event_bounce','event_inbound')",
      );
      await pool.query(
        "DELETE FROM tpa.email_messages WHERE conversation_id IN (SELECT id FROM tpa.email_conversations WHERE correspondent='worker-fixture@example.invalid')",
      );
      await pool.query(
        "DELETE FROM tpa.email_conversations WHERE correspondent='worker-fixture@example.invalid'",
      );
      await pool.query(
        "DELETE FROM tpa.email_dispatches WHERE campaign_id=$1",
        [campaign],
      );
      await pool.query("DELETE FROM tpa.campaign_drafts WHERE id=$1", [
        campaign,
      ]);
      await pool.query(
        "DELETE FROM tpa.email_unsubscribe_tokens WHERE user_id=$1",
        [user],
      );
      await pool.query("DELETE FROM tpa.email_suppressions WHERE email=$1", [
        user + "@example.invalid",
      ]);
      await pool.query(
        "DELETE FROM tpa.audit_events WHERE actor_user_id=$1 OR entity_id=$2",
        [actor, user],
      );
      await pool.query("DELETE FROM tpa.newsletter_consents WHERE user_id=$1", [
        user,
      ]);
      await pool.query("DELETE FROM tpa.member_profiles WHERE user_id=$1", [
        user,
      ]);
      await pool.query("DELETE FROM tpa.staff_roles WHERE user_id=$1", [actor]);
      await pool.query('DELETE FROM public."user" WHERE id=ANY($1::text[])', [
        [actor, user],
      ]);
      await pool.end();
      for (const k of Object.keys(process.env))
        if (!(k in old)) delete process.env[k];
      Object.assign(process.env, old);
    }
  },
);

test(
  "audiences above 10,000 are explicitly rejected without creating a dispatch",
  { skip: !enabled },
  async () => {
    assert.ok(/ci|acceptance|test/.test(process.env.TPA_DATABASE_NAME!));
    const pool = new Pool(databaseOptions()),
      prefix = randomUUID(),
      campaign = randomUUID();
    try {
      await pool.query(
        `INSERT INTO public."user"(id,name,email,"emailVerified") SELECT $1||'-'||n,'Synthetic cap fixture',$1||'-'||n||'@example.invalid',true FROM generate_series(1,10001)n`,
        [prefix],
      );
      await pool.query(
        "INSERT INTO tpa.member_profiles(user_id,city) SELECT id,$1 FROM public.\"user\" WHERE id LIKE $1||'-%'",
        [prefix],
      );
      await pool.query(
        "INSERT INTO tpa.newsletter_consents(user_id,subscribed,source) SELECT id,true,'synthetic_cap_test' FROM public.\"user\" WHERE id LIKE $1||'-%'",
        [prefix],
      );
      await pool.query(
        "INSERT INTO tpa.campaign_drafts(id,name,subject,body,audience,updated_by) VALUES($1,'Cap fixture','Cap fixture','Synthetic cap message',$2,$3)",
        [campaign, { city: prefix, profession: "" }, prefix + "-1"],
      );
      await assert.rejects(
        () => reviewCampaign(pool, prefix + "-1", campaign, 1),
        /10,000/,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM tpa.email_dispatches WHERE campaign_id=$1",
            [campaign],
          )
        ).rows[0].n,
        0,
      );
    } finally {
      await pool.query("DELETE FROM tpa.campaign_drafts WHERE id=$1", [
        campaign,
      ]);
      await pool.query(
        "DELETE FROM tpa.newsletter_consents WHERE user_id LIKE $1||'-%'",
        [prefix],
      );
      await pool.query("DELETE FROM tpa.member_profiles WHERE city=$1", [
        prefix,
      ]);
      await pool.query("DELETE FROM public.\"user\" WHERE id LIKE $1||'-%'", [
        prefix,
      ]);
      await pool.end();
    }
  },
);
