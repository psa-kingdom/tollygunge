import { createHash, randomUUID } from "node:crypto";
import { publicInquiry } from "@/domain/inquiries";
import { currentActor } from "@/lib/actor";
import { isSameOrigin } from "@/lib/request-policy";
import {
  operation,
  jsonBody,
  transaction,
  OperationError,
} from "@/lib/operation-api";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return operation(async () => {
    if (!process.env.DATABASE_URL)
      throw new OperationError(
        "Inquiries are temporarily unavailable. Please try again later.",
        503,
      );
    if (!isSameOrigin(request))
      throw new OperationError("Request origin is not allowed.", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new OperationError("Use the inquiry form.", 415);
    const raw = await jsonBody(request, 10000);
    let input: ReturnType<typeof publicInquiry>;
    try {
      input = publicInquiry(raw);
    } catch (error) {
      throw new OperationError(
        error instanceof Error ? error.message : "Check the inquiry details.",
      );
    }
    const hash = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    const actor = await currentActor(request.headers);
    return transaction(async (client) => {
      // Shared database lock serializes retries and quotas across app instances.
      await client.query("SELECT pg_advisory_xact_lock(74672010)");
      const previous = (
        await client.query(
          "SELECT id,submission_hash FROM tpa.inquiries WHERE submission_id=$1",
          [input.submissionId],
        )
      ).rows[0];
      if (previous) {
        if (previous.submission_hash !== hash)
          throw new OperationError(
            "This submission changed. Start a new inquiry.",
            409,
          );
        return { id: previous.id, saved: true };
      }
      const counts = (
        await client.query(
          "SELECT count(*) FILTER(WHERE contact_email=$1 AND created_at>now()-interval '1 day')::int AS sender,count(*) FILTER(WHERE source<>'member' AND created_at>now()-interval '1 hour')::int AS total FROM tpa.inquiries WHERE created_at>now()-interval '1 day'",
          [input.email],
        )
      ).rows[0];
      if (counts.sender >= 3 || counts.total >= 100)
        throw new OperationError(
          "Please wait before sending another inquiry.",
          429,
        );
      const id = randomUUID();
      await client.query(
        "INSERT INTO tpa.inquiries(id,user_id,subject,message,contact_name,contact_email,phone,organization,job_title,location,topic,contact_preference,consent_at,source,submission_id,submission_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),$13,$14,$15)",
        [
          id,
          actor?.email.toLowerCase() === input.email ? actor.id : null,
          input.subject,
          input.message,
          input.name,
          input.email,
          input.phone,
          input.organization,
          input.jobTitle,
          input.location,
          input.topic,
          input.preference,
          input.source,
          input.submissionId,
          hash,
        ],
      );
      await client.query(
        "INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,'inquiry.public_created',$2)",
        [actor?.id ?? null, id],
      );
      return { id, saved: true };
    });
  });
}
