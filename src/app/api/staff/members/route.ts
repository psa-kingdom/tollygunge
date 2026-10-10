import { getDatabase } from "@/lib/database";
import { authorized, operation, OperationError } from "@/lib/operation-api";
import { directoryFilters } from "@/domain/reports";
import {
  directoryFrom,
  directoryWhere,
  directoryValues,
} from "@/lib/report-query";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return operation(async () => {
    await authorized(request, "members:review");
    const params = new URL(request.url).searchParams;
    const filters = directoryFilters(params),
      offset = Number(params.get("offset") || 0),
      id = params.get("id");
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset > 100000 ||
      (id !== null && (!id || id.length > 200))
    )
      throw new OperationError("Check the directory filters.");
    const where = directoryWhere,
      values = directoryValues(filters, id);
    const client = await getDatabase().connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const total = (
        await client.query(
          `SELECT count(*)::int AS total ${directoryFrom} ${where}`,
          values,
        )
      ).rows[0].total;
      const rows = (
        await client.query(
          `SELECT u.id,person.id AS person_id,coalesce(person.status,'unverified') AS profile_review,coalesce(person.accepted->>'name',u.name) AS name,u.email,u."emailVerified" AS email_verified,u."createdAt" AS created_at,coalesce(p.phone,'') AS phone,coalesce(p.organization,'') AS organization,coalesce(p.profession,'') AS profession,coalesce(p.job_title,'') AS job_title,coalesce(p.city,'') AS city,EXISTS(SELECT 1 FROM tpa.staff_roles s WHERE s.user_id=u.id) AS staff_account ${directoryFrom} ${where} ORDER BY u."createdAt" DESC,u.id LIMIT 25 OFFSET $7`,
          [...values, offset],
        )
      ).rows;
      await client.query("COMMIT");
      if (id && !rows.length)
        throw new OperationError("Account not found.", 404);
      return { rows, total, offset, pageSize: 25 };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}
