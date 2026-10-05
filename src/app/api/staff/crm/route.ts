import { randomUUID } from "node:crypto";
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
    await authorized(request, "communications:manage");
    const records = (
      await getDatabase().query(
        "SELECT i.*,u.name,u.email,(SELECT coalesce(json_agg(n ORDER BY n.created_at),'[]') FROM tpa.inquiry_notes n WHERE n.inquiry_id=i.id) AS notes FROM tpa.inquiries i JOIN public.\"user\" u ON u.id=i.user_id ORDER BY i.status='resolved',i.follow_up_at NULLS LAST,i.created_at DESC LIMIT 200",
      )
    ).rows;
    const assignees = (
      await getDatabase().query(
        "SELECT DISTINCT u.id,u.name FROM public.\"user\" u JOIN tpa.staff_roles r ON r.user_id=u.id WHERE r.role IN ('administrator','communications_operator') ORDER BY u.name",
      )
    ).rows;
    return { records, assignees };
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "communications:manage", true),
      input = record(await jsonBody(request, 6000)),
      id = uuid(input.id),
      expected = version(input.version);
    const status = String(input.status);
    if (!["open", "in_progress", "resolved"].includes(status))
      throw new OperationError("Choose an inquiry status.");
    const assigned = input.assignedTo
      ? text(input.assignedTo, "Assignee", 100, 1)
      : null;
    const due = input.followUpAt ? new Date(String(input.followUpAt)) : null;
    if (due && !Number.isFinite(due.getTime()))
      throw new OperationError("Invalid follow-up date.");
    const note = text(input.note ?? "", "Note", 2000);
    return transaction(async (client) => {
      if (
        assigned &&
        !(
          await client.query(
            "SELECT 1 FROM tpa.staff_roles WHERE user_id=$1 AND role IN ('administrator','communications_operator')",
            [assigned],
          )
        ).rowCount
      )
        throw new OperationError(
          "Assign a communications operator or administrator.",
        );
      const row = (
        await client.query(
          "UPDATE tpa.inquiries SET status=$3,assigned_to=$4,follow_up_at=$5,version=version+1,updated_at=now() WHERE id=$1 AND version=$2 RETURNING id,version",
          [id, expected, status, assigned, due],
        )
      ).rows[0];
      if (!row)
        throw new OperationError("Inquiry changed. Reload before saving.", 409);
      if (note)
        await client.query(
          "INSERT INTO tpa.inquiry_notes(id,inquiry_id,actor_id,body) VALUES($1,$2,$3,$4)",
          [randomUUID(), id, actor.id, note],
        );
      await audit(client, actor.id, "inquiry.updated", id);
      return row;
    });
  });
}
