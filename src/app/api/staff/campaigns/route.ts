import { randomUUID } from "node:crypto";
import { campaignAudience, campaignDetails } from "@/domain/campaigns";
import { record, uuid, version } from "@/domain/operations";
import { getDatabase } from "@/lib/database";
import {
  authorized,
  operation,
  jsonBody,
  transaction,
  audit,
  OperationError,
} from "@/lib/operation-api";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return operation(async () => {
    await authorized(request, "communications:manage");
    const params = new URL(request.url).searchParams;
    if (params.has("id")) {
      const id = uuid(params.get("id"));
      const entry = (
        await getDatabase().query(
          "SELECT * FROM tpa.campaign_drafts WHERE id=$1",
          [id],
        )
      ).rows[0];
      if (!entry) throw new OperationError("Campaign not found.", 404);
      const revisions = (
        await getDatabase().query(
          'SELECT r.version,r.snapshot,r.created_at,u.name AS actor_name FROM tpa.campaign_revisions r JOIN public."user" u ON u.id=r.actor_user_id WHERE campaign_id=$1 ORDER BY r.version DESC LIMIT 30',
          [id],
        )
      ).rows;
      return { entry, revisions, deliveryEnabled: false };
    }
    const status = params.get("status") || "all";
    if (!["all", "draft", "archived"].includes(status))
      throw new OperationError("Choose a valid campaign state.");
    return {
      campaigns: (
        await getDatabase().query(
          "SELECT * FROM tpa.campaign_drafts WHERE ($1='all' OR status=$1) ORDER BY updated_at DESC,id LIMIT 100",
          [status],
        )
      ).rows,
      deliveryEnabled: false,
    };
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "communications:manage", true);
    const input = record(await jsonBody(request, 40000));
    if (input.action === "preview") {
      const audience = campaignAudience(input.audience);
      const values = [audience.city, audience.profession];
      const base =
        "FROM public.\"user\" u LEFT JOIN tpa.member_profiles p ON p.user_id=u.id LEFT JOIN tpa.newsletter_consents n ON n.user_id=u.id WHERE ($1='' OR lower(coalesce(p.city,''))=lower($1)) AND ($2='' OR lower(coalesce(p.profession,''))=lower($2))";
      const subscribed = "coalesce(n.subscribed,false)";
      const email = 'u."emailVerified"';
      const contact = "coalesce(p.preferences->>'contact','email')='email'";
      const client = await getDatabase().connect();
      try {
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const counts = (
          await client.query(
            `SELECT now() AS as_of,count(*)::int AS matched,count(*) FILTER(WHERE ${subscribed} AND ${email} AND ${contact})::int AS eligible,count(*) FILTER(WHERE NOT ${subscribed})::int AS unsubscribed,count(*) FILTER(WHERE ${subscribed} AND NOT ${email})::int AS unverified,count(*) FILTER(WHERE ${subscribed} AND ${email} AND NOT (${contact}))::int AS preference_blocked ${base}`,
            values,
          )
        ).rows[0];
        const sample = (
          await client.query(
            `SELECT u.name,u.email ${base} AND ${subscribed} AND ${email} AND ${contact} ORDER BY u.id LIMIT 20`,
            values,
          )
        ).rows;
        await client.query("COMMIT");
        return { ...counts, sample, audience, deliveryEnabled: false };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
    if (!["save", "archive", "restore"].includes(String(input.action)))
      throw new OperationError(
        "Campaign sending awaits consent-safe jobs, unsubscribe and delivery events. No messages were sent.",
        409,
      );
    const id = input.id ? uuid(input.id) : randomUUID();
    const expected = version(input.version);
    if (!input.id && (input.action !== "save" || expected !== 0))
      throw new OperationError("Save a new campaign draft first.");
    const details =
      input.action === "save" ? campaignDetails(input) : undefined;
    return transaction(async (client) => {
      if (input.id) {
        const existing = (
          await client.query(
            "SELECT version,status FROM tpa.campaign_drafts WHERE id=$1 FOR UPDATE",
            [id],
          )
        ).rows[0];
        if (!existing) throw new OperationError("Campaign not found.", 404);
        if (existing.version !== expected)
          throw new OperationError(
            "Campaign changed. Reload before editing.",
            409,
          );
        if (input.action === "save" && existing.status !== "draft")
          throw new OperationError(
            "Restore this archived draft before editing.",
            409,
          );
        if (
          (input.action === "archive" && existing.status !== "draft") ||
          (input.action === "restore" && existing.status !== "archived")
        )
          throw new OperationError(
            "Campaign state changed. Reload first.",
            409,
          );
      }
      const result = !input.id
        ? await client.query(
            "INSERT INTO tpa.campaign_drafts(id,name,subject,body,audience,updated_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
            [
              id,
              details!.name,
              details!.subject,
              details!.body,
              details!.audience,
              actor.id,
            ],
          )
        : details
          ? await client.query(
              "UPDATE tpa.campaign_drafts SET name=$2,subject=$3,body=$4,audience=$5,version=version+1,updated_by=$6,updated_at=now() WHERE id=$1 RETURNING *",
              [
                id,
                details.name,
                details.subject,
                details.body,
                details.audience,
                actor.id,
              ],
            )
          : await client.query(
              "UPDATE tpa.campaign_drafts SET status=$2,version=version+1,updated_by=$3,updated_at=now() WHERE id=$1 RETURNING *",
              [id, input.action === "archive" ? "archived" : "draft", actor.id],
            );
      const entry = result.rows[0];
      await client.query(
        "INSERT INTO tpa.campaign_revisions(campaign_id,version,snapshot,actor_user_id) VALUES($1,$2,$3,$4)",
        [
          id,
          entry.version,
          {
            name: entry.name,
            subject: entry.subject,
            body: entry.body,
            audience: entry.audience,
            status: entry.status,
          },
          actor.id,
        ],
      );
      await audit(client, actor.id, `campaign.${input.action}`, id);
      return entry;
    });
  });
}
