import { randomUUID } from "node:crypto";
import { record, text, uuid, version } from "@/domain/operations";
import { getDatabase } from "@/lib/database";
import { authorized, OperationError } from "@/lib/operation-api";
import { jsonBody } from "@/lib/operation-api";
import { emailOperation } from "@/lib/email-operation";
import { emailTransaction, emailAudit, queueReply } from "@/lib/email-service";
export const runtime = "nodejs";
function page(value: string | null) {
  const n = Number(value ?? "1");
  if (!Number.isInteger(n) || n < 1 || n > 10000)
    throw new OperationError("Choose a valid page.");
  return n;
}
export async function GET(request: Request) {
  return emailOperation(async () => {
    await authorized(request, "communications:manage");
    const params = new URL(request.url).searchParams,
      p = page(params.get("page"));
    const db = getDatabase();
    if (params.has("id")) {
      const id = uuid(params.get("id"));
      const entry = (
        await db.query("SELECT * FROM tpa.email_conversations WHERE id=$1", [
          id,
        ])
      ).rows[0];
      if (!entry) throw new OperationError("Conversation not found.", 404);
      const messages = (
        await db.query(
          "SELECT * FROM tpa.email_messages WHERE conversation_id=$1 ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET $2",
          [id, (p - 1) * 50],
        )
      ).rows;
      return {
        entry,
        messages: messages.slice(0, 50).reverse(),
        hasMore: messages.length > 50,
        page: p,
        notes: (
          await db.query(
            'SELECT n.id,n.body,n.created_at,u.name AS actor_name FROM tpa.email_notes n JOIN public."user" u ON u.id=n.actor_id WHERE conversation_id=$1 ORDER BY n.created_at DESC LIMIT 100',
            [id],
          )
        ).rows,
      };
    }
    const q = text(params.get("q") ?? "", "Search", 160),
      status = params.get("status") ?? "all",
      archived = params.get("archived") === "true";
    if (!["all", "new", "in_progress", "closed"].includes(status))
      throw new OperationError("Choose a valid status.");
    const entries = (
      await db.query(
        "SELECT c.*,u.name AS assigned_name FROM tpa.email_conversations c LEFT JOIN public.\"user\" u ON u.id=c.assigned_to WHERE c.archived=$1 AND ($2='all' OR c.status=$2) AND ($3='' OR c.subject ILIKE $4 OR c.correspondent ILIKE $4) ORDER BY c.updated_at DESC,c.id LIMIT 51 OFFSET $5",
        [
          archived,
          status,
          q,
          "%" + q.replace(/[\\%_]/g, "\\$&") + "%",
          (p - 1) * 50,
        ],
      )
    ).rows;
    const staff = (
      await db.query(
        "SELECT DISTINCT u.id,u.name FROM public.\"user\" u JOIN tpa.staff_roles r ON r.user_id=u.id WHERE r.role IN ('administrator','communications_operator') ORDER BY u.name",
      )
    ).rows;
    return {
      entries: entries.slice(0, 50),
      hasMore: entries.length > 50,
      page: p,
      staff,
    };
  });
}
export async function POST(request: Request) {
  return emailOperation(async () => {
    const actor = await authorized(request, "communications:manage", true),
      input = record(await jsonBody(request, 24000)),
      id = uuid(input.id),
      expected = version(input.version);
    if (input.action === "send") {
      if (input.confirm !== true)
        throw new OperationError("Confirm this reply before sending.");
      return queueReply(
        getDatabase(),
        actor.id,
        id,
        expected,
        version(input.draftVersion),
      );
    }
    if (!["update", "draft", "note"].includes(String(input.action)))
      throw new OperationError("Choose a valid inbox action.");
    return emailTransaction(getDatabase(), async (c) => {
      const row = (
        await c.query(
          "SELECT * FROM tpa.email_conversations WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!row) throw new OperationError("Conversation not found.", 404);
      if (row.version !== expected)
        throw new OperationError("Conversation changed. Reload first.", 409);
      if (input.action === "draft") {
        const draft = text(input.body, "Reply", 6000);
        await c.query(
          "UPDATE tpa.email_conversations SET draft=$2,draft_version=draft_version+1 WHERE id=$1",
          [id, draft],
        );
      }
      if (input.action === "note")
        await c.query(
          "INSERT INTO tpa.email_notes(id,conversation_id,actor_id,body) VALUES($1,$2,$3,$4)",
          [randomUUID(), id, actor.id, text(input.body, "Note", 2000, 1)],
        );
      if (input.action === "update") {
        if (
          !["new", "in_progress", "closed"].includes(String(input.status)) ||
          typeof input.unread !== "boolean" ||
          typeof input.archived !== "boolean"
        )
          throw new OperationError("Check inbox details.");
        const assigned = input.assignedTo
            ? text(input.assignedTo, "Operator", 128, 1)
            : null,
          inquiry = input.inquiryId ? uuid(input.inquiryId) : null;
        if (
          assigned &&
          !(
            await c.query(
              "SELECT 1 FROM tpa.staff_roles WHERE user_id=$1 AND role IN ('administrator','communications_operator')",
              [assigned],
            )
          ).rowCount
        )
          throw new OperationError(
            "Assign a communications operator or administrator.",
          );
        if (
          inquiry &&
          !(await c.query("SELECT 1 FROM tpa.inquiries WHERE id=$1", [inquiry]))
            .rowCount
        )
          throw new OperationError("Inquiry not found.");
        await c.query(
          "UPDATE tpa.email_conversations SET status=$2,unread=$3,archived=$4,assigned_to=$5,inquiry_id=$6 WHERE id=$1",
          [id, input.status, input.unread, input.archived, assigned, inquiry],
        );
      }
      const saved = (
        await c.query(
          "UPDATE tpa.email_conversations SET version=version+1,updated_at=now() WHERE id=$1 RETURNING *",
          [id],
        )
      ).rows[0];
      await emailAudit(c, actor.id, `email.inbox_${input.action}`, id);
      return { entry: saved };
    });
  });
}
