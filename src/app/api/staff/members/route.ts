import { getDatabase } from "@/lib/database";
import { combinedMemberDirectory } from "@/lib/combined-member-directory";
import {
  authorized,
  operation,
  OperationError,
  jsonBody,
  transaction,
} from "@/lib/operation-api";
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
      if (params.get("records") === "all")
        return combinedMemberDirectory(params, filters, offset, id);
      const state = params.get("status") || "all";
      if (
        ![
          "all",
          "active",
          "expired",
          "suspended",
          "resigned",
          "unknown",
        ].includes(state)
      )
        throw new OperationError("Choose a membership status.");
      const invitation = params.get("invitation") ?? "all";
      if (!["all", "held"].includes(invitation))
        throw new OperationError("Choose an invitation filter.");
      const q = (params.get("q") || "").slice(0, 120),
        values = [id, `%${q.replace(/[\\%_]/g, "\\$&")}%`];
      return transaction(async (c) => {
        const from =
          "FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id LEFT JOIN public.\"user\" u ON u.id=p.user_id WHERE $3::int>=0 AND ($4='all' OR m.status=$4 OR ($4='unknown' AND m.status IS NULL)) AND ($1::text IS NULL OR p.id::text=$1) AND concat_ws(' ',p.accepted->>'name',p.contact_email,p.mobile_normalized,m.membership_number) ILIKE $2" +
          (invitation === "held"
            ? " AND EXISTS(SELECT 1 FROM tpa.account_invitation_holds h WHERE h.user_id=p.user_id AND h.released_at IS NULL)"
            : "");
        const total = (
          await c.query(`SELECT count(*)::int AS total ${from}`, [
            ...values,
            offset,
            state,
          ])
        ).rows[0].total;
        const rows = (
          await c.query(
            `SELECT p.id AS person_id,p.user_id,p.version AS person_version,p.accepted AS person,p.contact_email AS email,p.mobile_normalized AS mobile,p.accepted_verified AS professional_verified,u.\"emailVerified\" AS email_verified,m.id AS membership_id,m.version AS membership_version,m.membership_number,m.type,m.status,m.valid_from,m.valid_until,m.source,
          CASE WHEN EXISTS(SELECT 1 FROM tpa.account_invitation_holds h WHERE h.user_id=p.user_id AND h.released_at IS NULL) THEN 'invitation held' WHEN EXISTS(SELECT 1 FROM tpa.onboarding_invitations i WHERE i.user_id=p.user_id AND i.redeemed_at IS NOT NULL) THEN 'accepted' WHEN EXISTS(SELECT 1 FROM public."account" a WHERE a."userId"=p.user_id AND a."providerId"='credential') THEN 'active account' ELSE coalesce((SELECT CASE WHEN i.expires_at<now() THEN 'expired' ELSE 'pending' END FROM tpa.onboarding_invitations i WHERE i.user_id=p.user_id ORDER BY expires_at DESC LIMIT 1),'not invited') END AS invitation_status,
          EXISTS(SELECT 1 FROM tpa.account_invitation_holds h WHERE h.user_id=p.user_id AND h.address_completion_required) AS address_completion_required,
          (SELECT status FROM tpa.onboarding_mail mail WHERE mail.user_id=p.user_id AND kind='invitation' ORDER BY created_at DESC LIMIT 1) AS delivery_status,
          (SELECT count(*)::int FROM tpa.event_registrations r WHERE r.user_id=p.user_id AND payment_status='pending') AS pending_payments ${from} ORDER BY p.accepted->>'name',p.id LIMIT 25 OFFSET $3`,
            [...values, offset, state],
          )
        ).rows;
        if (id && !rows.length)
          throw new OperationError("Member not found.", 404);
        return { view: "register", rows, total, offset, pageSize: 25 };
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
    const actor = await authorized(request, "staff:manage", true),
      input = await jsonBody(request);
    if (!["create", "update"].includes(input.action))
      throw new OperationError("Choose create or update.");
    const source = input.source as Record<string, string>;
    if (source) {
      if (
        Array.isArray(source) ||
        typeof source !== "object" ||
        Object.keys(source).some((k) => !memberHeaders.includes(k)) ||
        Object.values(source).some((v) => typeof v !== "string")
      )
        throw new OperationError("Use text in the member template fields.");
      const row = mapMembers([
        memberHeaders,
        memberHeaders.map((h) => source[h] ?? ""),
      ])[0];
      if (!row.member || Object.keys(row.fieldErrors).length)
        throw new OperationError(
          "Check member details.",
          400,
          "member_validation",
          row.fieldErrors,
        );
      input.member = row.member;
    }
    if (
      (input.action === "create" && input.personId) ||
      (input.action === "update" && !input.personId)
    )
      throw new OperationError(
        "Choose the member to update, or create without an existing ID.",
      );
    return transaction(async (c) => ({
      result: await saveMember(c, actor.id, input),
    }));
  });
}
