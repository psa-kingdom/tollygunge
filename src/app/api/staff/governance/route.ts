import { getDatabase } from "@/lib/database";
import { personBody, redactPerson } from "@/domain/people";
import { uuid } from "@/domain/operations";
import {
  authorized,
  operation,
  jsonBody,
  transaction,
  OperationError,
} from "@/lib/operation-api";
import {
  staffPeople,
  privatePeople,
  admin,
  enriched,
  changePerson,
} from "@/lib/people-service";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return operation(async () => {
    const actor = await authorized(request);
    if (!staffPeople(actor)) throw new OperationError("Access denied.", 403);
    const client = await getDatabase().connect();
    try {
      const value = new URL(request.url).searchParams.get("id");
      const id = value ? uuid(value) : null;
      const rows = (
        await client.query(
          "SELECT * FROM tpa.people WHERE ($1::uuid IS NULL OR id=$1) ORDER BY updated_at DESC LIMIT 200",
          [id],
        )
      ).rows;
      const records = [];
      for (const row of rows)
        records.push(
          id
            ? await enriched(client, row, actor)
            : {
                ...row,
                draft: privatePeople(actor)
                  ? personBody(row.draft)
                  : redactPerson(personBody(row.draft)),
                accepted: privatePeople(actor)
                  ? personBody(row.accepted)
                  : redactPerson(personBody(row.accepted)),
              },
        );
      return {
        records,
        groups: (
          await client.query(
            "SELECT * FROM tpa.profile_groups ORDER BY (draft->>'order')::int,id",
          )
        ).rows,
        portraits: (
          await client.query(
            "SELECT id,published->>'title' AS title FROM tpa.public_media WHERE published IS NOT NULL ORDER BY created_at DESC LIMIT 200",
          )
        ).rows,
        canReview: admin(actor),
        canEditPrivate: privatePeople(actor),
        canPublish:
          actor.roles.includes("administrator") ||
          actor.roles.includes("content_editor"),
      };
    } finally {
      client.release();
    }
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, undefined, true);
    if (!staffPeople(actor)) throw new OperationError("Access denied.", 403);
    const input = await jsonBody(request, 1048576);
    if (["approve", "reject"].includes(input.action))
      throw new OperationError("Use the administrator review endpoint.");
    return transaction((client) => changePerson(client, actor, input));
  });
}
