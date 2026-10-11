import { getDatabase } from "@/lib/database";
import { authorized, operation, OperationError } from "@/lib/operation-api";
export async function GET(request: Request) {
  return operation(async () => {
    await authorized(request, "staff:manage");
    const before = new URL(request.url).searchParams.get("before");
    if (
      before &&
      (!/^[1-9][0-9]{0,18}$/.test(before) ||
        BigInt(before) > BigInt("9223372036854775807"))
    )
      throw new OperationError("Invalid page cursor.");
    const result = await getDatabase().query(
      `SELECT a.id::text,a.action,a.entity_id,a.created_at,u.name AS actor_name
      FROM tpa.audit_events a LEFT JOIN public."user" u ON u.id=a.actor_user_id
      WHERE ($1::bigint IS NULL OR a.id<$1::bigint) ORDER BY a.id DESC LIMIT 51`,
      [before],
    );
    const entries = result.rows.slice(0, 50);
    return {
      entries,
      next: result.rows.length > 50 ? entries.at(-1)!.id : null,
    };
  });
}
