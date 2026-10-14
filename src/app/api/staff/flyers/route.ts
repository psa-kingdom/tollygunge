import { editableEvent } from "@/lib/event-operations";
import { speakersInput } from "@/domain/event-flow";
import { getDatabase } from "@/lib/database";
import { record, uuid, version } from "@/domain/operations";
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
        "SELECT e.id,e.title,e.location,e.starts_at,e.fee_paise,e.visibility,e.status,e.booking_closed,e.completed_at,e.archived_at,e.registration_starts_at,e.registration_ends_at,e.speakers,e.version AS template_version FROM tpa.events e WHERE e.status IN ('draft','published') AND ($1::uuid IS NULL OR e.id=$1) ORDER BY e.starts_at DESC LIMIT 200",
        [id],
      )
    ).rows;
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "events:manage", true),
      input = record(await jsonBody(request, 12000)),
      id = uuid(input.eventId),
      expected = version(input.version);
    const speakers = (() => { try { return speakersInput(input.speakers); } catch(error) { throw new OperationError(error instanceof Error ? error.message : "Check speaker details."); } })();
    if (!speakers.length) throw new OperationError("Provide at least one speaker.");
    return transaction(async (client) => {
      const event = (
        await client.query(
          "SELECT * FROM tpa.events WHERE id=$1 AND status IN ('draft','published') FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!event) throw new OperationError("Choose a draft or published event.", 409);
      editableEvent(event);
      if (event.version !== expected) throw new OperationError("Event changed. Reload before saving speakers.", 409);
      const row = (await client.query(
        "UPDATE tpa.events SET speakers=$2,version=version+1,updated_by=$3 WHERE id=$1 RETURNING *",
        [id, JSON.stringify(speakers), actor.id],
      )).rows[0];
      await audit(client, actor.id, "flyer.template_saved", id);
      return row;
    });
  });
}
