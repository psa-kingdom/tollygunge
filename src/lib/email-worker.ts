import { sealMail, openMail } from "./onboarding-mail";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import {
  campaignAddress,
  campaignEmail,
  emailAddress,
  inboxAddress,
  incomingText,
  messageId,
  quotaPause,
  type EmailQuota,
} from "../domain/email";
import { emailTransaction } from "./email-service";
import {
  EmailProviderError,
  fetchEmailQuota,
  providerRequest,
} from "./email-provider";
export type WorkerDependencies = {
  request: typeof providerRequest;
  quota: (key: string) => Promise<EmailQuota>;
};
const provider: WorkerDependencies = {
  request: providerRequest,
  quota: fetchEmailQuota,
};
export async function recoverEmailLeases(pool: Pool) {
  await pool.query(
    "UPDATE tpa.email_jobs SET status='review',reason='uncertain_send_expired',updated_at=now() WHERE status='queued' AND kind<>'inbound' AND first_attempt_at<now()-interval '23 hours'",
  );
  await pool.query(
    "UPDATE tpa.email_jobs SET status=CASE WHEN kind<>'inbound' AND first_attempt_at<now()-interval '23 hours' THEN 'review' ELSE 'queued' END,reason=CASE WHEN kind<>'inbound' AND first_attempt_at<now()-interval '23 hours' THEN 'uncertain_send_expired' ELSE 'lease_expired' END,lease_owner=NULL,lease_until=NULL,updated_at=now() WHERE status='leased' AND lease_until<now()",
  );
}
export async function claimEmailJob(pool: Pool, owner: string) {
  return emailTransaction(pool, async (c) => {
    const job = (
      await c.query(
        "SELECT * FROM tpa.email_jobs WHERE status='queued' AND available_at<=now() ORDER BY CASE kind WHEN 'inbound' THEN 0 WHEN 'reply' THEN 1 ELSE 2 END,created_at,id FOR UPDATE SKIP LOCKED LIMIT 1",
      )
    ).rows[0];
    if (!job) return null;
    return (
      await c.query(
        "UPDATE tpa.email_jobs SET status='leased',lease_owner=$2,lease_until=now()+interval '2 minutes',updated_at=now() WHERE id=$1 RETURNING *",
        [job.id, owner],
      )
    ).rows[0];
  });
}
export async function processEmailJob(
  pool: Pool,
  id: string,
  owner: string,
  env: Record<string, string | undefined>,
  deps = provider,
) {
  const job = (
    await pool.query(
      "SELECT * FROM tpa.email_jobs WHERE id=$1 AND status='leased' AND lease_owner=$2 AND lease_until>now()",
      [id, owner],
    )
  ).rows[0];
  if (!job) return;
  const finish = async (
    status: string,
    reason: string | null = null,
    delay?: Date,
  ) => {
    await pool.query(
      "UPDATE tpa.email_jobs SET status=$3,reason=$4,lease_owner=NULL,lease_until=NULL,available_at=coalesce($5,available_at),updated_at=now() WHERE id=$1 AND status='leased' AND lease_owner=$2",
      [id, owner, status, reason, delay ?? null],
    );
  };
  try {
    if (job.kind === "inbound") {
      await pool.query(
        "UPDATE tpa.email_jobs SET attempts=attempts+1 WHERE id=$1",
        [id],
      );
      const email = await deps.request(
        `/emails/receiving/${encodeURIComponent(job.payload.emailId)}`,
        env.RESEND_RECEIVING_API_KEY!,
      );
      const addresses = Array.isArray(email.to)
        ? email.to.map(emailAddress)
        : [];
      if (!addresses.includes(inboxAddress)) {
        await finish("skipped", "recipient_not_allowed");
        return;
      }
      const sender = emailAddress(email.from);
      let reply = sender;
      const headers: Record<string, string> = Object.fromEntries(
        Object.entries(email.headers ?? {})
          .filter(([, v]) => typeof v === "string")
          .map(([k, v]) => [k.toLowerCase(), v as string]),
      );
      try {
        if (Array.isArray(email.reply_to) && email.reply_to.length === 1)
          reply = emailAddress(email.reply_to[0]);
        else if (headers["reply-to"]) reply = emailAddress(headers["reply-to"]);
      } catch {
        reply = sender;
      }
      const ownId = messageId(email.message_id ?? headers["message-id"]),
        parent = messageId(headers["in-reply-to"]);
      const references =
        String(headers.references ?? "")
          .slice(0, 4000)
          .match(/<[^<>\r\n]{1,250}>/g) ?? [];
      const ancestors = [
        ...new Set([...(parent ? [parent] : []), ...references]),
      ];
      await emailTransaction(pool, async (c) => {
        const existing = (
          await c.query(
            "SELECT id FROM tpa.email_messages WHERE provider_id=$1",
            [job.payload.emailId],
          )
        ).rows[0];
        if (existing) return;
        // Only known references plus matching correspondent can join a conversation.
        const candidates = ancestors.length
          ? (
              await c.query(
                "SELECT DISTINCT c.id FROM tpa.email_messages m JOIN tpa.email_conversations c ON c.id=m.conversation_id WHERE m.message_id=ANY($1::text[]) AND c.correspondent=$2 LIMIT 2",
                [ancestors, sender],
              )
            ).rows
          : [];
        const conversation =
          candidates.length === 1 ? candidates[0].id : randomUUID();
        if (candidates.length !== 1)
          await c.query(
            "INSERT INTO tpa.email_conversations(id,subject,correspondent,reply_to) VALUES($1,$2,$3,$4)",
            [
              conversation,
              String(email.subject ?? "(No subject)")
                .replace(/[\r\n\x00]/g, " ")
                .slice(0, 500),
              sender,
              reply,
            ],
          );
        else
          await c.query(
            "UPDATE tpa.email_conversations SET unread=true,archived=false,status='in_progress',reply_to=$2,version=version+1,updated_at=now() WHERE id=$1",
            [conversation, reply],
          );
        const attachments = Array.isArray(email.attachments)
          ? email.attachments
              .slice(0, 100)
              .map((x: { filename?: unknown; content_type?: unknown }) => ({
                name: String(x.filename ?? "Attachment").slice(0, 255),
                type: String(x.content_type ?? "").slice(0, 100),
              }))
          : [];
        await c.query(
          "INSERT INTO tpa.email_messages(id,conversation_id,provider_id,message_id,parent_message_id,direction,sender,recipient,body,attachments) VALUES($1,$2,$3,$4,$5,'incoming',$6,$7,$8,$9)",
          [
            randomUUID(),
            conversation,
            job.payload.emailId,
            ownId,
            parent,
            sender,
            inboxAddress,
            incomingText(email.text, email.html),
            JSON.stringify(attachments),
          ],
        );
      });
      await finish("accepted");
      return;
    }
    if (
      job.first_attempt_at &&
      Date.now() - new Date(job.first_attempt_at).getTime() > 23 * 3600000
    ) {
      await finish("review", "uncertain_send_expired");
      return;
    }
    const eligibleNow = async () => {
      const authority = (
        await pool.query(
          "SELECT 1 FROM tpa.staff_roles r JOIN public.\"user\" u ON u.id=r.user_id WHERE r.user_id=$1 AND role IN ('administrator','communications_operator') AND (u.\"emailVerified\" OR EXISTS(SELECT 1 FROM tpa.operator_approved_identities a WHERE a.user_id=u.id))",
          [job.created_by],
        )
      ).rowCount;
      if (!authority) {
        await finish("skipped", "sender_permission_revoked");
        return false;
      }
      if (job.kind === "campaign") {
        const eligible = (
          await pool.query(
            "SELECT 1 FROM public.\"user\" u JOIN tpa.newsletter_consents n ON n.user_id=u.id LEFT JOIN tpa.member_profiles p ON p.user_id=u.id JOIN tpa.email_dispatches d ON d.id=$3 WHERE u.id=$1 AND lower(u.email)=$2 AND u.\"emailVerified\" AND n.subscribed AND coalesce(p.preferences->>'contact','email')='email' AND d.cancelled_at IS NULL",
            [job.user_id, job.recipient, job.dispatch_id],
          )
        ).rowCount;
        if (!eligible) {
          await finish("skipped", "recipient_no_longer_eligible");
          return false;
        }
      }
      if (
        (
          await pool.query(
            "SELECT 1 FROM tpa.email_suppressions WHERE email=$1",
            [job.recipient],
          )
        ).rowCount
      ) {
        await finish("skipped", "suppressed");
        return false;
      }
      return true;
    };
    if (!(await eligibleNow())) return;
    const quota = await deps.quota(env.RESEND_RECEIVING_API_KEY!);
    await pool.query(
      "UPDATE tpa.email_worker_state SET quota=$1,quota_checked_at=now() WHERE id='email'",
      [quota],
    );
    const pause = quotaPause(quota, job.kind);
    if (pause) {
      await finish("queued", "quota_wait", pause);
      return;
    }
    if (!(await eligibleNow())) return;
    let unsubscribeUrl: string | undefined;
    try {
      if (job.kind === "campaign")
        unsubscribeUrl = openMail(
          job.payload.unsubscribe,
          env.BETTER_AUTH_SECRET,
        );
    } catch {
      throw new EmailProviderError(
        false,
        !!job.first_attempt_at,
        "payload_unavailable",
      );
    }
    const body =
      job.kind === "campaign"
        ? campaignEmail(job.payload.body, unsubscribeUrl!)
        : { text: job.payload.body };
    const parent = messageId(job.payload.parent);
    const unsubscribe = new URL(unsubscribeUrl ?? env.BETTER_AUTH_URL!);
    const token = new URLSearchParams(unsubscribe.hash.slice(1)).get("token");
    let savedRequest;
    try {
      if (job.provider_request)
        savedRequest = openMail(job.provider_request, env.BETTER_AUTH_SECRET);
    } catch {
      throw new EmailProviderError(false, true, "payload_unavailable");
    }
    const request = savedRequest ?? {
      from: job.kind === "campaign" ? campaignAddress : inboxAddress,
      to: [job.recipient],
      reply_to: inboxAddress,
      subject: job.payload.subject,
      ...body,
      headers:
        job.kind === "campaign"
          ? {
              "List-Unsubscribe": `<${env.BETTER_AUTH_URL}/api/email/unsubscribe?token=${token}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            }
          : parent
            ? { "In-Reply-To": parent, References: parent }
            : {},
      tags: [{ name: "tpa_job", value: id }],
    };
    await pool.query(
      "UPDATE tpa.email_jobs SET provider_request=coalesce(provider_request,$3),first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1 WHERE id=$1 AND status='leased' AND lease_owner=$2",
      [id, owner, sealMail(request, env.BETTER_AUTH_SECRET)],
    );
    const result = await deps.request(
      "/emails",
      env.RESEND_API_KEY!,
      request,
      `tpa-email-${id}`,
    );
    if (typeof result.id !== "string" || !result.id)
      throw new EmailProviderError(true, true, "invalid_receipt");
    await emailTransaction(pool, async (c) => {
      await c.query(
        "UPDATE tpa.email_jobs SET status='accepted',provider_id=$3,lease_owner=NULL,lease_until=NULL,reason=NULL,updated_at=now() WHERE id=$1 AND (lease_owner=$2 OR provider_id=$3)",
        [id, owner, result.id],
      );
      if (job.kind === "reply")
        await c.query(
          "INSERT INTO tpa.email_messages(id,conversation_id,provider_id,message_id,parent_message_id,direction,sender,recipient,body) VALUES($1,$2,$3,NULL,$4,'outgoing',$5,$6,$7) ON CONFLICT(provider_id) DO NOTHING",
          [
            randomUUID(),
            job.conversation_id,
            result.id,
            parent,
            inboxAddress,
            job.recipient,
            job.payload.body,
          ],
        );
    });
  } catch (error) {
    const providerError = error instanceof EmailProviderError ? error : null;
    // Unknown failures after an attempted send are uncertain, never reported as unsent.
    const current = (
      await pool.query(
        "SELECT attempts,first_attempt_at FROM tpa.email_jobs WHERE id=$1",
        [id],
      )
    ).rows[0];
    if (providerError?.code === "invalid_recipient" && job.recipient)
      await pool.query(
        "INSERT INTO tpa.email_suppressions(email,reason) VALUES($1,'permanent_failure') ON CONFLICT DO NOTHING",
        [job.recipient],
      );
    if (providerError?.code === "configuration") {
      await finish(
        "queued",
        "provider_configuration",
        new Date(Date.now() + 60000),
      );
      return;
    }
    if (providerError?.transient || !providerError) {
      if ((current?.attempts ?? 0) >= 6) {
        await finish(
          job.kind !== "inbound" && current.first_attempt_at
            ? "review"
            : "failed",
          providerError?.code ?? "processing_failure",
        );
        return;
      }
      await finish(
        "queued",
        providerError?.code ?? "processing_failure",
        new Date(
          Date.now() + Math.min(3600000, 60000 * 2 ** (current?.attempts ?? 0)),
        ),
      );
      return;
    }
    await finish(
      providerError.ambiguous ? "review" : "failed",
      providerError.code,
    );
  }
}
