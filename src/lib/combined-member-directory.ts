import "server-only";
import { getDatabase } from "./database";
import { OperationError } from "./operation-api";
import type { directoryFilters } from "@/domain/reports";

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
    kind = params.get("kind") ?? "all";
  if (
    !["all", "active", "expired", "suspended", "resigned", "unknown"].includes(
      status,
    ) ||
    !["all", "held"].includes(invitation) ||
    !["all", "member", "account"].includes(kind)
  )
    throw new OperationError("Choose valid directory filters.");
  const records = `WITH records AS (
 SELECT p.id AS person_id,p.user_id,p.version AS person_version,p.accepted AS person,
 p.contact_email AS email,p.mobile_normalized AS mobile,p.accepted_verified AS professional_verified,u."emailVerified" AS email_verified,
 coalesce(p.status,'unverified') AS profile_review,m.id AS membership_id,m.version AS membership_version,m.membership_number,m.type,m.status,'member'::text AS record_kind
 FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id LEFT JOIN public."user" u ON u.id=p.user_id
 UNION ALL
 SELECT p.id,u.id,coalesce(p.version,0),coalesce(p.accepted,'{}'::jsonb)||jsonb_build_object('name',coalesce(p.accepted->>'name',u.name),'organization',coalesce(p.accepted->>'organization',mp.organization,''),'jobTitle',coalesce(p.accepted->>'jobTitle',mp.job_title,'')),
 u.email,coalesce(nullif(p.mobile_normalized,''),mp.phone,''),coalesce(p.accepted_verified,false),u."emailVerified",coalesce(p.status,'unverified'),NULL::uuid,0,NULL::text,NULL::text,NULL::text,'account'::text
 FROM public."user" u LEFT JOIN tpa.people p ON p.user_id=u.id LEFT JOIN tpa.member_profiles mp ON mp.user_id=u.id
 WHERE NOT EXISTS(SELECT 1 FROM tpa.people member_person JOIN tpa.memberships membership ON membership.person_id=member_person.id WHERE member_person.user_id=u.id)
 ), filtered AS (SELECT r.* FROM records r WHERE
 concat_ws(' ',r.person->>'name',r.person->>'organization',r.person->>'jobTitle',r.email,r.mobile,r.membership_number) ILIKE $1
 AND ($2='all' OR r.status=$2 OR ($2='unknown' AND r.record_kind='member' AND r.status IS NULL))
 AND ($3='all' OR EXISTS(SELECT 1 FROM tpa.account_invitation_holds h WHERE h.user_id=r.user_id AND h.released_at IS NULL))
 AND ($4='all' OR r.record_kind=$4)
 AND ($5='all' OR r.email_verified=($5='verified'))
 AND ($6='all' OR ($6='phone' AND coalesce(r.mobile,'')<>'') OR ($6='no-phone' AND coalesce(r.mobile,'')=''))
 AND ($7='all' OR r.profile_review=$7)
 AND ($8::text IS NULL OR r.person_id::text=$8))`;
  const values = [
    `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`,
    status,
    invitation,
    kind,
    filters.verification,
    filters.contact,
    filters.review,
    id,
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
   CASE WHEN EXISTS(SELECT 1 FROM tpa.account_invitation_holds h WHERE h.user_id=r.user_id AND h.released_at IS NULL) THEN 'invitation held' WHEN EXISTS(SELECT 1 FROM tpa.onboarding_invitations i WHERE i.user_id=r.user_id AND i.redeemed_at IS NOT NULL) THEN 'accepted' WHEN EXISTS(SELECT 1 FROM public."account" a WHERE a."userId"=r.user_id AND a."providerId"='credential') THEN 'active account' ELSE coalesce((SELECT CASE WHEN i.expires_at<now() THEN 'expired' ELSE 'pending' END FROM tpa.onboarding_invitations i WHERE i.user_id=r.user_id ORDER BY expires_at DESC LIMIT 1),'not invited') END AS invitation_status,
   EXISTS(SELECT 1 FROM tpa.account_invitation_holds h WHERE h.user_id=r.user_id AND h.address_completion_required) AS address_completion_required,
   (SELECT status FROM tpa.onboarding_mail mail WHERE mail.user_id=r.user_id AND kind='invitation' ORDER BY created_at DESC LIMIT 1) AS delivery_status,
   (SELECT count(*)::int FROM tpa.event_registrations registration WHERE registration.user_id=r.user_id AND payment_status='pending') AS pending_payments
   FROM filtered r ORDER BY lower(r.person->>'name'),r.person_id NULLS LAST,r.user_id LIMIT 25 OFFSET $9`,
        [...values, offset],
      )
    ).rows;
    await client.query("COMMIT");
    if (id && !rows.length) throw new OperationError("Member not found.", 404);
    return { view: "register", rows, total, offset, pageSize: 25 };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
