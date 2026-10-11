import { roles, type StaffRole } from "@/domain/access";
import { record, text } from "@/domain/operations";
import { getDatabase } from "@/lib/database";
import {
  authorized,
  audit,
  jsonBody,
  operation,
  OperationError,
  transaction,
} from "@/lib/operation-api";

function roleList(value: unknown): StaffRole[] {
  if (
    !Array.isArray(value) ||
    value.length > roles.length ||
    value.some((r) => !roles.includes(r)) ||
    new Set(value).size !== value.length
  )
    throw new OperationError("Choose valid, distinct staff roles.");
  return [...value].sort();
}
export async function GET(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "staff:manage");
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (query.length > 120) throw new OperationError("Search is too long.");
    const result = await getDatabase().query(
      `SELECT u.id,u.name,u.email,(u."emailVerified" OR EXISTS(SELECT 1 FROM tpa.operator_approved_identities o WHERE o.user_id=u.id)) AS eligible,
      ARRAY(SELECT role FROM tpa.staff_roles r WHERE r.user_id=u.id ORDER BY role) AS roles
      FROM public."user" u WHERE ($1='' AND EXISTS(SELECT 1 FROM tpa.staff_roles r WHERE r.user_id=u.id))
      OR ($1<>'' AND (position(lower($1) in lower(u.email))>0 OR position(lower($1) in lower(u.name))>0)) ORDER BY lower(u.name),u.id LIMIT 50`,
      [query],
    );
    return {
      people: result.rows,
      actorId: actor.id,
      roles,
      limited: result.rows.length === 50,
    };
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "staff:manage", true);
    const body = record(await jsonBody(request, 8000));
    const id = text(body.id, "Account", 128, 1);
    const next = roleList(body.roles),
      expected = roleList(body.expectedRoles);
    if (id === actor.id)
      throw new OperationError(
        "Another administrator must change your access.",
        409,
      );
    return transaction(async (client) => {
      // All role replacements serialize, including concurrent administrator removals.
      await client.query("SELECT pg_advisory_xact_lock(741902, 1)");
      const stillAdmin = await client.query(
        "SELECT 1 FROM tpa.staff_roles WHERE user_id=$1 AND role='administrator'",
        [actor.id],
      );
      if (!stillAdmin.rowCount)
        throw new OperationError(
          "Administrator access has changed. Sign in again.",
          403,
        );
      const user = await client.query(
        `SELECT "emailVerified" OR EXISTS(SELECT 1 FROM tpa.operator_approved_identities WHERE user_id=$1) AS eligible FROM public."user" WHERE id=$1 FOR UPDATE`,
        [id],
      );
      if (!user.rowCount) throw new OperationError("Account not found.", 404);
      if (next.length && !user.rows[0].eligible)
        throw new OperationError(
          "Verify this account before granting staff access.",
          409,
        );
      const current = (
        await client.query(
          "SELECT role FROM tpa.staff_roles WHERE user_id=$1 ORDER BY role",
          [id],
        )
      ).rows.map((r) => r.role);
      if (JSON.stringify(current) !== JSON.stringify(expected))
        throw new OperationError("Access changed. Reload before saving.", 409);
      if (JSON.stringify(current) === JSON.stringify(next))
        return { changed: false };
      if (
        current.includes("administrator") &&
        !next.includes("administrator")
      ) {
        const other = await client.query(
          "SELECT 1 FROM tpa.staff_roles WHERE role='administrator' AND user_id<>$1 LIMIT 1",
          [id],
        );
        if (!other.rowCount)
          throw new OperationError("Keep at least one administrator.", 409);
      }
      await client.query("DELETE FROM tpa.staff_roles WHERE user_id=$1", [id]);
      for (const role of next)
        await client.query(
          "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,$2)",
          [id, role],
        );
      for (const role of current.filter((r) => !next.includes(r)))
        await audit(client, actor.id, `staff.role_removed:${role}`, id);
      for (const role of next.filter((r) => !current.includes(r)))
        await audit(client, actor.id, `staff.role_granted:${role}`, id);
      await client.query('DELETE FROM public."session" WHERE "userId"=$1', [
        id,
      ]);
      return { changed: true, sessionsRevoked: true };
    });
  });
}
