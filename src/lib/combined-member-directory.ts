import "server-only";
import { getDatabase } from "./database";
import { OperationError } from "./operation-api";
import type { directoryFilters } from "@/domain/reports";
import { uuid } from "@/domain/operations";

/** Membership rows plus accounts without a membership, without duplicating linked accounts.
 * Called only after the existing members:review authorization. No draft application data.
 */
export async function combinedMemberDirectory(
  params: URLSearchParams,
  filters: ReturnType<typeof directoryFilters>,
  offset: number,
  id: string | null,
) {
  const status = params.get("status") ?? "all",
    invitation = params.get("invitation") ?? "all",
    kind = params.get("kind") ?? "all",
    accountSetup = params.get("accountSetup") ?? "all",
    plan = params.get("plan") ?? "all",
    archive = params.get("archive") ?? (invitation === "held" ? "all" : "current");
  const tagId = params.has("tag") ? uuid(params.get("tag")) : null;
  if (
    !["all", "active", "expired", "suspended", "resigned", "unknown"].includes(
      status,
    ) ||
    !["all", "held"].includes(invitation) ||
    !["all", "member", "account"].includes(kind) ||
    !["all", "active", "inactive"].includes(accountSetup) ||
    plan.length > 80 ||
    !["current", "archived", "all"].includes(archive)
  )
    throw new OperationError("Choose valid directory filters.");
  const protectedAccount = (userId: string) => `(EXISTS(SELECT FROM tpa.staff_roles WHERE user_id=${userId})
    OR EXISTS(SELECT FROM tpa.operator_approved_identities WHERE user_id=${userId}))`;
  const visibleRecord = `(p.directory_deleted_at IS NULL OR ${protectedAccount("p.user_id")})`;
  const records = `WITH records AS (
 SELECT p.id AS person_id,p.user_id,p.version AS person_version,p.accepted AS person,
 p.contact_email AS email,p.mobile_normalized AS mobile,p.accepted_verified AS professional_verified,u."emailVerified" AS email_verified,
 coalesce(p.status,'unverified') AS profile_review,m.id AS membership_id,m.version AS membership_version,m.membership_number,coalesce(m.type,u."requestedMembershipPlan") AS type,m.status,'member'::text AS record_kind,p.archived_at,m.pending_plan
 FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id LEFT JOIN public."user" u ON u.id=p.user_id
 WHERE ${visibleRecord}
 UNION ALL
 SELECT p.id,u.id,coalesce(p.version,0),coalesce(p.accepted,'{}'::jsonb)||jsonb_build_object('name',coalesce(p.accepted->>'name',u.name),'organization',coalesce(p.accepted->>'organization',mp.organization,''),'jobTitle',coalesce(p.accepted->>'jobTitle',mp.job_title,'')),
 u.email,coalesce(nullif(p.mobile_normalized,''),mp.phone,''),coalesce(p.accepted_verified,false),u."emailVerified",coalesce(p.status,'unverified'),NULL::uuid,0,NULL::text,u."requestedMembershipPlan",NULL::text,'account'::text,p.archived_at,NULL::text
 FROM public."user" u LEFT JOIN tpa.people p ON p.user_id=u.id LEFT JOIN tpa.member_profiles mp ON mp.user_id=u.id
 WHERE ${visibleRecord}
 AND NOT EXISTS(SELECT 1 FROM tpa.people member_person JOIN tpa.memberships membership ON membership.person_id=member_person.id WHERE member_person.user_id=u.id)
 ), directory AS (
 SELECT r.*,
 EXISTS(SELECT 1 FROM public."account" a WHERE a."userId"=r.user_id AND a."providerId"='credential' AND nullif(a.password,'') IS NOT NULL) AS login_ready
 FROM records r
 ), filtered AS (SELECT r.* FROM directory r WHERE
 concat_ws(' ',r.person->>'name',r.person->>'organization',r.person->>'jobTitle',r.email,r.mobile,r.membership_number) ILIKE $1
 AND ($2='all' OR r.status=$2 OR ($2='unknown' AND r.record_kind='member' AND r.status IS NULL))
 AND ($3='all' OR EXISTS(SELECT 1 FROM tpa.account_invitation_holds h WHERE h.user_id=r.user_id AND h.released_at IS NULL))
 AND ($4='all' OR r.record_kind=$4)
 AND ($5='all' OR r.email_verified=($5='verified'))
 AND ($6='all' OR ($6='phone' AND coalesce(r.mobile,'')<>'') OR ($6='no-phone' AND coalesce(r.mobile,'')=''))
 AND ($7='all' OR r.profile_review=$7)
 AND ($8::text IS NULL OR r.person_id::text=$8)
 AND ($9='all' OR r.type=$9 OR ($9='pending' AND r.pending_plan IS NOT NULL))
 AND ($10='all' OR (r.archived_at IS NOT NULL)=($10='archived'))
 AND ($11::uuid IS NULL OR EXISTS (
   SELECT 1 FROM tpa.member_profile_tag_assignments a WHERE a.tag_id=$11 AND (a.person_id=r.person_id OR a.user_id=r.user_id)
 ))
 AND ($12='all' OR r.login_ready=($12='active')))`;
  const values = [
    `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`,
    status,
    invitation,
    kind,
    filters.verification,
    filters.contact,
    filters.review,
    id,
    plan,
    archive,
    tagId,
    accountSetup,
  ];
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const total = (
      await client.query(
        records + " SELECT count(*)::int AS total FROM filtered",
        values,
      )
    ).rows[0].total;
    const rows = (
      await client.query(
        records +
          ` SELECT r.*,
   ${protectedAccount("r.user_id")} AS protected_account,
   (SELECT u."createdAt" FROM public."user" u WHERE u.id=r.user_id) AS account_created_at,
   CASE WHEN EXISTS(SELECT 1 FROM tpa.account_invitation_holds h WHERE h.user_id=r.user_id AND h.released_at IS NULL) THEN 'invitation held' WHEN EXISTS(SELECT 1 FROM tpa.onboarding_invitations i WHERE i.user_id=r.user_id AND i.redeemed_at IS NOT NULL) THEN 'accepted' WHEN EXISTS(SELECT 1 FROM public."account" a WHERE a."userId"=r.user_id AND a."providerId"='credential') THEN 'active account' ELSE coalesce((SELECT CASE WHEN i.expires_at<now() THEN 'expired' ELSE 'pending' END FROM tpa.onboarding_invitations i WHERE i.user_id=r.user_id ORDER BY expires_at DESC LIMIT 1),'not invited') END AS invitation_status,
   EXISTS(SELECT 1 FROM tpa.account_invitation_holds h WHERE h.user_id=r.user_id AND h.address_completion_required) AS address_completion_required,
   (SELECT status FROM tpa.onboarding_mail mail WHERE mail.user_id=r.user_id AND kind='invitation' ORDER BY created_at DESC LIMIT 1) AS delivery_status,
   (SELECT count(*)::int FROM tpa.event_registrations registration WHERE registration.user_id=r.user_id AND payment_status='pending') AS pending_payments,
   (SELECT coalesce(jsonb_agg(t ORDER BY lower(t.name),t.id),'[]'::jsonb)
    FROM tpa.member_profile_tags t JOIN (
      SELECT tag_id FROM tpa.member_profile_tag_assignments WHERE person_id=r.person_id
      UNION SELECT tag_id FROM tpa.member_profile_tag_assignments WHERE user_id=r.user_id
    ) a ON a.tag_id=t.id) AS profile_tags
   FROM filtered r ORDER BY lower(r.person->>'name'),r.person_id NULLS LAST,r.user_id LIMIT 25 OFFSET $13`,
        [...values, offset],
      )
    ).rows;
    const { rows: tags } = await client.query("SELECT id,name FROM tpa.member_profile_tags ORDER BY lower(name),id");
    if (id && !rows.length) throw new OperationError("Member not found.", 404);
    await client.query("COMMIT");
    return { view: "register", rows, total, offset, pageSize: 25, tags };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
