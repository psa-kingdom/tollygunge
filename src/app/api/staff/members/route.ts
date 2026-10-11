import { getDatabase } from "@/lib/database";
import { authorized, operation, OperationError, jsonBody, transaction } from "@/lib/operation-api";
import { mapMembers, memberHeaders } from "@/domain/member-import";
import { saveMember } from "@/lib/member-register";
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
    if (params.get("view") === "register") {
      const q=(params.get("q") || "").slice(0,120), values=[id,`%${q.replace(/[\\%_]/g,"\\$&")}%`];
      return transaction(async (c)=>{
        const from="FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id LEFT JOIN public.\"user\" u ON u.id=p.user_id WHERE ($1::text IS NULL OR p.id::text=$1) AND concat_ws(' ',p.accepted->>'name',p.contact_email,p.mobile_normalized,m.membership_number) ILIKE $2";
        const total=(await c.query(`SELECT count(*)::int AS total ${from}`,values)).rows[0].total;
        const rows=(await c.query(`SELECT p.id AS person_id,p.user_id,p.version AS person_version,p.accepted AS person,p.contact_email AS email,p.mobile_normalized AS mobile,p.accepted_verified AS professional_verified,u.\"emailVerified\" AS email_verified,m.id AS membership_id,m.version AS membership_version,m.membership_number,m.type,m.status,m.valid_from,m.valid_until,m.source ${from} ORDER BY p.accepted->>'name',p.id LIMIT 25 OFFSET $3`,[...values,offset])).rows;
        if(id && !rows.length) throw new OperationError("Member not found.",404);
        return {view:"register",rows,total,offset,pageSize:25};
      });
    }
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
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "staff:manage", true), input = await jsonBody(request);
    if (!["create","update"].includes(input.action)) throw new OperationError("Choose create or update.");
    const source = input.source as Record<string,string>;
    if(source) {
      if(Array.isArray(source) || typeof source!=="object" || Object.keys(source).some(k=>!memberHeaders.includes(k)) || Object.values(source).some(v=>typeof v!=="string")) throw new OperationError("Use text in the member template fields.");
      const row=mapMembers([memberHeaders,memberHeaders.map(h=>source[h]??"")])[0];
      if(!row.member || Object.keys(row.fieldErrors).length) throw new OperationError("Check member details.",400,"member_validation",row.fieldErrors);
      input.member=row.member;
    }
    if(input.action==="create" && input.personId || input.action==="update" && !input.personId) throw new OperationError("Choose the member to update, or create without an existing ID.");
    return transaction(async c=>({result:await saveMember(c,actor.id,input)}));
  });
}
