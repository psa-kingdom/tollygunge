import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/database";
import { record, text } from "@/domain/operations";
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
    const actor = await authorized(request);
    return (
      await getDatabase().query(
        "SELECT id,subject,message,status,created_at FROM tpa.inquiries WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
        [actor.id],
      )
    ).rows;
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, undefined, true),
      input = record(await jsonBody(request, 8000));
    const subject = text(input.subject, "Subject", 160, 3),
      message = text(input.message, "Message", 4000, 10);
    return transaction(async (client) => {
      await client.query(
        'SELECT id FROM public."user" WHERE id=$1 FOR UPDATE',
        [actor.id],
      );
      const count = (
        await client.query(
          "SELECT count(*)::int AS n FROM tpa.inquiries WHERE user_id=$1 AND created_at>now()-interval '1 day'",
          [actor.id],
        )
      ).rows[0].n;
      if (count >= 3)
        throw new OperationError(
          "Please wait before sending another inquiry.",
          429,
        );
      const row = (
        await client.query(
          "INSERT INTO tpa.inquiries(id,user_id,subject,message) VALUES($1,$2,$3,$4) RETURNING id,subject,message,status,created_at",
          [randomUUID(), actor.id, subject, message],
        )
      ).rows[0];
      await audit(client, actor.id, "inquiry.created", row.id);
      return row;
    });
  });
}
