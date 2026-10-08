import "server-only";
import { getDatabase } from "./database";
import {
  type ReportName,
  type ReportFilters,
  resolvePeriod,
} from "@/domain/reports";
export const directoryFrom =
  'FROM public."user" u LEFT JOIN tpa.member_profiles p ON p.user_id=u.id LEFT JOIN tpa.people person ON person.user_id=u.id';
export const directoryWhere = `WHERE ($1='' OR concat_ws(' ',u.name,person.accepted->>'name',u.email,p.phone,p.organization,p.profession,p.job_title,p.city) ILIKE $2) AND ($3='all' OR u."emailVerified"=($3='verified')) AND ($4='all' OR ($4='phone' AND coalesce(p.phone,'')<>'') OR ($4='no-phone' AND coalesce(p.phone,'')='')) AND ($5::text IS NULL OR u.id=$5) AND ($6='all' OR coalesce(person.status,'unverified')=$6)`;
export function directoryValues(
  filters: Pick<ReportFilters, "q" | "verification" | "contact" | "review">,
  id: string | null = null,
) {
  return [
    filters.q,
    `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`,
    filters.verification,
    filters.contact,
    id,
    filters.review,
  ];
}
export const columns: Record<ReportName, string[]> = {
  accounts: [
    "name",
    "email",
    "email_verified",
    "profile_review",
    "created_at",
    "phone",
    "organization",
    "profession",
    "job_title",
    "city",
    "staff_account",
  ],
  events: ["title", "starts_at", "status", "registrations", "attendance"],
  inquiries: ["status", "total", "overdue"],
  content: ["kind", "total", "published"],
  newsletter: ["opted_in"],
};
export async function reportQuery(
  name: ReportName,
  filters: ReportFilters,
  limit: number,
) {
  const range = resolvePeriod(filters),
    dates = [range.from, range.to];
  const bounds = (field: string, first = 1) =>
    `($${first}::date IS NULL OR ${field} >= ($${first}::date::timestamp AT TIME ZONE 'Asia/Kolkata')) AND ($${first + 1}::date IS NULL OR ${field} < (($${first + 1}::date+1)::timestamp AT TIME ZONE 'Asia/Kolkata'))`;
  let sql: string, values: unknown[];
  if (name === "accounts") {
    sql = `SELECT coalesce(person.accepted->>'name',u.name) AS name,u.email,u."emailVerified" AS email_verified,coalesce(person.status,'unverified') AS profile_review,u."createdAt" AS created_at,coalesce(p.phone,'') AS phone,coalesce(p.organization,'') AS organization,coalesce(p.profession,'') AS profession,coalesce(p.job_title,'') AS job_title,coalesce(p.city,'') AS city,EXISTS(SELECT 1 FROM tpa.staff_roles s WHERE s.user_id=u.id) AS staff_account ${directoryFrom} ${directoryWhere} AND ${bounds('u."createdAt"', 7)} ORDER BY u."createdAt" DESC,u.id LIMIT $9`;
    values = [...directoryValues(filters), ...dates, limit];
  } else if (name === "events") {
    sql = `SELECT e.title,e.starts_at,e.status,count(r.id) FILTER(WHERE r.status='registered')::int AS registrations,count(a.registration_id)::int AS attendance FROM tpa.events e LEFT JOIN tpa.event_registrations r ON r.event_id=e.id LEFT JOIN tpa.event_attendance a ON a.registration_id=r.id WHERE ${bounds("e.starts_at")} GROUP BY e.id ORDER BY e.starts_at DESC,e.id LIMIT $3`;
    values = [...dates, limit];
  } else if (name === "inquiries") {
    sql = `SELECT status,count(*)::int AS total,count(*) FILTER(WHERE status<>'closed' AND follow_up_at<now())::int AS overdue FROM tpa.inquiries WHERE ${bounds("created_at")} GROUP BY status ORDER BY status`;
    values = dates;
  } else if (name === "content") {
    sql =
      "SELECT kind,count(*)::int AS total,count(published)::int AS published FROM tpa.content_entries GROUP BY kind ORDER BY kind";
    values = [];
  } else {
    sql =
      "SELECT count(*)::int AS opted_in FROM tpa.newsletter_consents WHERE subscribed=true";
    values = [];
  }
  return {
    rows: (await getDatabase().query(sql, values)).rows as Record<
      string,
      unknown
    >[],
    columns: columns[name],
    range,
  };
}
