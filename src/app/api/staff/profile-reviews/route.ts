import {
  authorized,
  operation,
  jsonBody,
  transaction,
  OperationError,
} from "@/lib/operation-api";
import { admin, changePerson, enriched } from "@/lib/people-service";
import { getDatabase } from "@/lib/database";
import { uuid } from "@/domain/operations";

export async function GET(request: Request) {
  return operation(async () => {
    const actor = await authorized(request);
    if (!admin(actor))
      throw new OperationError("Administrator review required.", 403);
    const params = new URL(request.url).searchParams;
    const id = params.get("id");
    const page = Number(params.get("page") ?? 1);
    if (!Number.isSafeInteger(page) || page < 1)
      throw new OperationError("Choose a valid page.");
    const client = await getDatabase().connect();
    try {
      if (id) {
        const row = (
          await client.query("SELECT * FROM tpa.people WHERE id=$1", [uuid(id)])
        ).rows[0];
        if (!row) throw new OperationError("Profile no longer available.", 404);
        return { record: await enriched(client, row, actor) };
      }
      const rows = (
        await client.query(
          `SELECT r.id, r.person_id, r.created_at, r.body->>'name' AS name
        FROM tpa.profile_reviews r WHERE r.status='pending'
        ORDER BY r.created_at, r.id LIMIT 26 OFFSET $1`,
          [(page - 1) * 25],
        )
      ).rows;
      return { records: rows.slice(0, 25), hasMore: rows.length > 25 };
    } finally {
      client.release();
    }
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, undefined, true);
    if (!admin(actor))
      throw new OperationError("Administrator review required.", 403);
    const input = await jsonBody(request);
    if (!["approve", "approve_editorial", "reject"].includes(input.action))
      throw new OperationError("Choose approve, editorial approval or reject.");
    return transaction((client) => changePerson(client, actor, input));
  });
}
