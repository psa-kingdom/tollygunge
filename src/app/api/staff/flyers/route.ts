import { getDatabase } from "@/lib/database";
import { record, text, uuid, version } from "@/domain/operations";
import {
  operation,
  authorized,
  jsonBody,
  transaction,
  audit,
  OperationError,
} from "@/lib/operation-api";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return operation(async () => {
    await authorized(request, "events:manage");
    const value = new URL(request.url).searchParams.get("id");
    const id = value ? uuid(value) : null;
    return (
      await getDatabase().query(
        "SELECT e.id,e.title,e.location,e.starts_at,t.speakers,coalesce(t.version,0) AS template_version FROM tpa.events e LEFT JOIN tpa.flyer_templates t ON t.event_id=e.id WHERE e.status='published' AND ($1::uuid IS NULL OR e.id=$1) ORDER BY e.starts_at DESC LIMIT 200",
        [id],
      )
    ).rows;
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "events:manage", true),
      input = record(await jsonBody(request, 4000)),
      id = uuid(input.eventId),
      expected = version(input.version);
    if (
      !Array.isArray(input.speakers) ||
      input.speakers.length < 1 ||
      input.speakers.length > 2
    )
      throw new OperationError("Choose one or two speakers.");
    const speakers = input.speakers.map((value) => {
      const speaker = record(value);
      return {
        name: text(speaker.name, "Speaker name", 60, 2),
        credentials: text(speaker.credentials, "Speaker credentials", 120),
      };
    });
    return transaction(async (client) => {
      const event = (
        await client.query(
          "SELECT id FROM tpa.events WHERE id=$1 AND status='published' FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!event) throw new OperationError("Choose a published event.", 409);
      const old = (
        await client.query(
          "SELECT version FROM tpa.flyer_templates WHERE event_id=$1",
          [id],
        )
      ).rows[0];
      if ((old?.version ?? 0) !== expected)
        throw new OperationError(
          "Template changed. Reload before saving.",
          409,
        );
      const row = (
        await client.query(
          "INSERT INTO tpa.flyer_templates(event_id,speakers,updated_by) VALUES($1,$2,$3) ON CONFLICT(event_id) DO UPDATE SET speakers=$2,updated_by=$3,updated_at=now(),version=tpa.flyer_templates.version+1 RETURNING *",
          [id, JSON.stringify(speakers), actor.id],
        )
      ).rows[0];
      await audit(client, actor.id, "flyer.template_saved", id);
      return row;
    });
  });
}
