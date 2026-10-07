import { getDatabase } from "@/lib/database";
import { authorized, operation, OperationError } from "@/lib/operation-api";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return operation(async () => {
    await authorized(request, "members:review");
    const params = new URL(request.url).searchParams;
    const q = (params.get("q") || "").trim();
    const verification = params.get("verification") || "all";
    const contact = params.get("contact") || "all";
    const review = params.get("review") || "all";
    const offset = Number(params.get("offset") || 0);
    const id = params.get("id");
    if (
      q.length > 120 ||
      !["all", "unverified", "pending", "verified", "rejected"].includes(
        review,
      ) ||
      !["all", "verified", "unverified"].includes(verification) ||
      !["all", "phone", "no-phone"].includes(contact) ||
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset > 100000 ||
      (id !== null && (!id || id.length > 200))
    )
      throw new OperationError("Check the directory filters.");
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const where = `WHERE ($1='' OR concat_ws(' ',u.name,person.accepted->>'name',u.email,p.phone,p.organization,p.profession,p.job_title,p.city) ILIKE $2) AND ($3='all' OR u."emailVerified"=($3='verified')) AND ($4='all' OR ($4='phone' AND coalesce(p.phone,'')<>'') OR ($4='no-phone' AND coalesce(p.phone,'')='')) AND ($5::text IS NULL OR u.id=$5) AND ($6='all' OR coalesce(person.status,'unverified')=$6)`;
    const values = [q, pattern, verification, contact, id, review];
    const client = await getDatabase().connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const total = (
        await client.query(
          `SELECT count(*)::int AS total FROM public."user" u LEFT JOIN tpa.member_profiles p ON p.user_id=u.id LEFT JOIN tpa.people person ON person.user_id=u.id ${where}`,
          values,
        )
      ).rows[0].total;
      const rows = (
        await client.query(
          `SELECT u.id,person.id AS person_id,coalesce(person.status,'unverified') AS profile_review,coalesce(person.accepted->>'name',u.name) AS name,u.email,u."emailVerified" AS email_verified,u."createdAt" AS created_at,coalesce(p.phone,'') AS phone,coalesce(p.organization,'') AS organization,coalesce(p.profession,'') AS profession,coalesce(p.job_title,'') AS job_title,coalesce(p.city,'') AS city,EXISTS(SELECT 1 FROM tpa.staff_roles s WHERE s.user_id=u.id) AS staff_account FROM public."user" u LEFT JOIN tpa.member_profiles p ON p.user_id=u.id LEFT JOIN tpa.people person ON person.user_id=u.id ${where} ORDER BY u."createdAt" DESC,u.id LIMIT 25 OFFSET $7`,
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
