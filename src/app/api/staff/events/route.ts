import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/database";
import { eventInput, record, uuid, version } from "@/domain/operations";
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
        "SELECT e.*, (SELECT count(*)::int FROM tpa.event_registrations r WHERE r.event_id=e.id AND r.status='registered') AS registrations FROM tpa.events e WHERE ($1::uuid IS NULL OR e.id=$1) ORDER BY starts_at DESC LIMIT 200",
        [id],
      )
    ).rows;
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "events:manage", true),
      raw = record(await jsonBody(request, 16000));
    return transaction(async (client) => {
      let row;
      if (raw.action === "publish" || raw.action === "cancel") {
        const id = uuid(raw.id),
          expected = version(raw.version);
        const result = await client.query(
          "UPDATE tpa.events SET status=$3,version=version+1,updated_by=$4 WHERE id=$1 AND version=$2 AND status<> 'cancelled' AND ($3='cancelled' OR starts_at>now()) RETURNING *",
          [
            id,
            expected,
            raw.action === "publish" ? "published" : "cancelled",
            actor.id,
          ],
        );
        if (!result.rowCount)
          throw new OperationError(
            "Event changed, cancelled or already started. Reload before continuing.",
            409,
          );
        row = result.rows[0];
      } else if (raw.action === "save") {
        const input = eventInput(raw),
          id = input.id ?? randomUUID();
        const values = [
          id,
          input.title,
          input.description,
          input.location,
          input.startsAt,
          input.endsAt,
          input.capacity,
          actor.id,
        ];
        // Published event details are immutable to avoid silently changing registrations.
        const result = input.id
          ? await client.query(
              "UPDATE tpa.events SET title=$2,description=$3,location=$4,starts_at=$5,ends_at=$6,capacity=$7,updated_by=$8,version=version+1 WHERE id=$1 AND version=$9 AND status='draft' RETURNING *",
              [...values, input.version],
            )
          : await client.query(
              "INSERT INTO tpa.events(id,title,description,location,starts_at,ends_at,capacity,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
              values,
            );
        if (!result.rowCount)
          throw new OperationError("Only the latest draft can be edited.", 409);
        row = result.rows[0];
      } else throw new OperationError("Invalid event action.");
      await audit(client, actor.id, `event.${String(raw.action)}`, row.id);
      return row;
    });
  });
}
