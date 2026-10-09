import { authorized, OperationError } from "@/lib/operation-api";
import { getDatabase } from "@/lib/database";
import { emailOperation } from "@/lib/email-operation";
import { emailReadiness } from "@/lib/email-service";
import { deliveryOutcome } from "@/domain/email";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return emailOperation(async () => {
    await authorized(request, "communications:manage");
    const params = new URL(request.url).searchParams,
      p = Number(params.get("page") ?? "1"),
      status = params.get("status") ?? "all";
    if (
      !Number.isInteger(p) ||
      p < 1 ||
      p > 10000 ||
      ![
        "all",
        "queued",
        "leased",
        "accepted",
        "skipped",
        "failed",
        "review",
        "cancelled",
      ].includes(status)
    )
      throw new OperationError("Check delivery filters.");
    const db = getDatabase(),
      rows = (
        await db.query(
          "SELECT j.id,j.kind,j.status,j.reason,j.recipient,j.attempts,j.provider_id,j.dispatch_id,j.conversation_id,j.created_at,j.updated_at,j.available_at,coalesce((SELECT jsonb_agg(jsonb_build_object('type',e.type,'at',e.occurred_at) ORDER BY e.occurred_at) FROM tpa.email_events e WHERE e.provider_id=coalesce(j.provider_id,CASE WHEN j.kind='inbound' THEN j.payload->>'emailId' END)),'[]') AS events FROM tpa.email_jobs j WHERE ($1='all' OR j.status=$1) ORDER BY j.created_at DESC,j.id LIMIT 51 OFFSET $2",
          [status, (p - 1) * 50],
        )
      ).rows;
    const counts = (
      await db.query(
        "SELECT count(*) FILTER(WHERE status='queued')::int AS queued,count(*) FILTER(WHERE status='failed')::int AS failed,count(*) FILTER(WHERE status='review')::int AS review,count(*) FILTER(WHERE reason='quota_wait' AND status='queued')::int AS quota_wait FROM tpa.email_jobs",
      )
    ).rows[0];
    return {
      entries: rows.slice(0, 50).map((row) => ({
        ...row,
        outcome: deliveryOutcome(
          row.events.map((e: { type: string }) => e.type),
        ),
      })),
      hasMore: rows.length > 50,
      page: p,
      counts,
      readiness: await emailReadiness(db),
      recovery: (
        await db.query(
          "SELECT r.provider_id,r.created_at,coalesce((SELECT jsonb_agg(jsonb_build_object('type',e.type,'at',e.occurred_at) ORDER BY e.occurred_at) FROM tpa.email_events e WHERE e.provider_id=r.provider_id),'[]') AS events FROM tpa.email_receipts r ORDER BY r.created_at DESC LIMIT 50",
        )
      ).rows.map((row) => ({
        ...row,
        outcome: deliveryOutcome(
          row.events.map((e: { type: string }) => e.type),
        ),
      })),
    };
  });
}
