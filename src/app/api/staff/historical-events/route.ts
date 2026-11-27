import { authorized, operation, transaction, jsonBody, audit, OperationError } from "@/lib/operation-api";
import { loadWorkbookAttendance } from "@/lib/workbook-attendance";
import { historicalEventInput } from "@/domain/historical-event-details";
import { validEventDate } from "@/domain/event-date-range";
import { record, version } from "@/domain/operations";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "events:manage", true);
    const body = record(await jsonBody(request, 32000));
    if (body.action === "delete") {
      await authorized(request, "events:delete", true);
      const date = validEventDate(body.date);
      if (!date) throw new OperationError("Choose a valid event date.");
      const expected = version(body.version);
      const events = await loadWorkbookAttendance();
      return transaction(async client => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`historical-event:${date}`]);
        const prior = (await client.query("SELECT version,deleted_at FROM tpa.historical_event_details WHERE source_date=$1 FOR UPDATE", [date])).rows[0];
        if (prior?.deleted_at) return { deleted: true };
        if (!prior && !events.some(event => event.date === date))
          throw new OperationError("Historical event not found.", 404);
        if ((prior?.version ?? 0) !== expected)
          throw new OperationError("Event changed. Reload before deleting.", 409);
        await client.query(
          `INSERT INTO tpa.historical_event_details(source_date,title,updated_by,deleted_at)
           VALUES($1,'Association event',$2,now())
           ON CONFLICT(source_date) DO UPDATE SET deleted_at=now(),version=tpa.historical_event_details.version+1,updated_by=$2,updated_at=now()`,
          [date, actor.id],
        );
        await audit(client, actor.id, "historical_event.delete", date);
        return { deleted: true };
      });
    }
    const input = historicalEventInput(body);
    const events = await loadWorkbookAttendance();
    if (!events.some(event => event.date === input.date)) throw new OperationError("Historical event not found.", 404);
    if (new Date(`${input.date}T00:00:00+05:30`) > new Date()) throw new OperationError("Choose a past event.");
    return transaction(async client => {
      if (!(await client.query("SELECT to_regclass('tpa.historical_event_details') AS relation")).rows[0].relation) throw new OperationError("Historical event editing requires the database update. Contact your administrator.", 503);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`historical-event:${input.date}`]);
      const before = (await client.query("SELECT * FROM tpa.historical_event_details WHERE source_date=$1 FOR UPDATE", [input.date])).rows[0];
      if (before?.deleted_at) throw new OperationError("Historical event not found.", 404);
      if ((before?.version ?? 0) !== input.version) throw new OperationError("This event was edited by someone else. Reload before saving.", 409);
      const after = (await client.query(`INSERT INTO tpa.historical_event_details(source_date,title,description,location,speakers,updated_by) VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(source_date) DO UPDATE SET title=$2,description=$3,location=$4,speakers=$5,updated_by=$6,version=tpa.historical_event_details.version+1,updated_at=now() RETURNING title,description,location,speakers,version`,
        [input.date,input.title,input.description,input.location,input.speakers,actor.id])).rows[0];
      await client.query("INSERT INTO tpa.historical_event_revisions(source_date,version,before_details,after_details,reason,actor_id) VALUES($1,$2,$3,$4,$5,$6)", [input.date,after.version,before ? JSON.stringify(before) : null,JSON.stringify(after),input.reason,actor.id]);
      await audit(client,actor.id,"historical_event.details_updated",input.date);
      return after;
    });
  });
}
