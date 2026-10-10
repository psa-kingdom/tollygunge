import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/database";
import { record, text, uuid, version } from "@/domain/operations";
import { inquiryStatuses, inquiryTags } from "@/domain/inquiries";
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
    const query = new URL(request.url).searchParams;
    const status = query.get("status") ?? "all",
      focus = query.get("focus") ?? "all";
    if (
      !["all", ...inquiryStatuses].includes(status) ||
      !["all", "active", "overdue", "unassigned"].includes(focus)
    )
      throw new OperationError("Choose a valid inquiry filter.");
    const q = text(query.get("q") ?? "", "Search", 160).toLowerCase(),
      tag = text(query.get("tag") ?? "", "Tag", 30),
      id = query.get("id") ? uuid(query.get("id")) : null;
    const page = Number(query.get("page") ?? 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
      throw new OperationError("Invalid page.");
    const where = `WHERE ($1='all' OR i.status=$1) AND ($2='all' OR ($2='active' AND i.status<>'closed') OR ($2='overdue' AND i.status<>'closed' AND i.follow_up_at<now()) OR ($2='unassigned' AND i.status<>'closed' AND i.assigned_to IS NULL)) AND ($3='' OR strpos(lower(concat_ws(' ',i.subject,i.message,coalesce(i.contact_name,u.name),coalesce(i.contact_email,u.email),i.organization,i.phone,i.job_title,i.location)), $3)>0) AND ($4='' OR $4=ANY(i.tags)) AND ($5::uuid IS NULL OR i.id=$5)`;
    const values = [status, focus, q, tag, id];
    const database = getDatabase();
    const [records, count, assignees, tagRows] = await Promise.all([
      database.query(
        `SELECT i.*,coalesce(i.contact_name,u.name) AS name,coalesce(i.contact_email,u.email) AS email,(SELECT coalesce(json_agg(n ORDER BY n.created_at),'[]') FROM tpa.inquiry_notes n WHERE n.inquiry_id=i.id) AS notes,(SELECT coalesce(json_agg(h ORDER BY h.version DESC),'[]') FROM tpa.inquiry_updates h WHERE h.inquiry_id=i.id) AS history FROM tpa.inquiries i LEFT JOIN public."user" u ON u.id=i.user_id ${where} ORDER BY i.created_at DESC,i.id LIMIT 50 OFFSET $6`,
        [...values, (page - 1) * 50],
      ),
      database.query(
        `SELECT count(*)::int AS n FROM tpa.inquiries i LEFT JOIN public."user" u ON u.id=i.user_id ${where}`,
        values,
      ),
      database.query(
        "SELECT DISTINCT u.id,u.name FROM public.\"user\" u JOIN tpa.staff_roles r ON r.user_id=u.id WHERE r.role IN ('administrator','communications_operator') ORDER BY u.name",
      ),
      database.query(
        "SELECT DISTINCT unnest(tags) AS tag FROM tpa.inquiries ORDER BY tag",
      ),
    ]);
    return {
      records: records.rows,
      assignees: assignees.rows,
      tags: tagRows.rows.map((row) => row.tag),
      total: count.rows[0].n,
      page,
      pageSize: 50,
    };
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "communications:manage", true),
      input = record(await jsonBody(request, 6000)),
      id = uuid(input.id),
      expected = version(input.version);
    const status = String(input.status);
    if (!(inquiryStatuses as readonly string[]).includes(status))
      throw new OperationError("Choose an inquiry status.");
    const tags = input.tags === undefined ? null : inquiryTags(input.tags);
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
          "UPDATE tpa.inquiries SET status=$3,assigned_to=$4,follow_up_at=$5,tags=coalesce($6,tags),version=version+1,updated_at=now() WHERE id=$1 AND version=$2 RETURNING id,version",
          [id, expected, status, assigned, due, tags],
        )
      ).rows[0];
      if (!row)
        throw new OperationError("Inquiry changed. Reload before saving.", 409);
      if (note)
        await client.query(
          "INSERT INTO tpa.inquiry_notes(id,inquiry_id,actor_id,body) VALUES($1,$2,$3,$4)",
          [randomUUID(), id, actor.id, note],
        );
      await client.query(
        "INSERT INTO tpa.inquiry_updates(inquiry_id,version,actor_id,status,assigned_to,follow_up_at,tags) SELECT id,version,$2,status,assigned_to,follow_up_at,tags FROM tpa.inquiries WHERE id=$1",
        [id, actor.id],
      );
      await audit(client, actor.id, "inquiry.updated", id);
      return row;
    });
  });
}
