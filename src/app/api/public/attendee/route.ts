import { operation, jsonBody, OperationError } from "@/lib/operation-api";
import { isSameOrigin } from "@/lib/request-policy";
import { getDatabase } from "@/lib/database";
import { email } from "@/domain/member-foundation";
import { registrationFields } from "@/domain/event-registration-fields";

export async function POST(request: Request) {
  return operation(async () => {
    if (!isSameOrigin(request)) throw new OperationError("Request origin is not allowed.", 403);
    const input = await jsonBody(request, 1024);
    const address = email(input.email, true);
    const { rows: [person] } = await getDatabase().query(
      `SELECT coalesce(u.name,p.accepted->>'name') AS name,p.accepted,p.mobile_normalized,mp.phone,
       mp.organization,mp.job_title,mp.city,app.details AS application,
       (SELECT r.registration_details FROM tpa.event_registrations r
        WHERE r.user_id=u.id AND r.registration_details IS NOT NULL
        ORDER BY r.registered_at DESC,r.id DESC LIMIT 1) AS registration
       FROM tpa.people p FULL JOIN public."user" u ON u.id=p.user_id
       LEFT JOIN tpa.member_profiles mp ON mp.user_id=u.id
       LEFT JOIN tpa.application_drafts app ON app.user_id=u.id
       WHERE (lower(btrim(u.email))=$1 OR lower(btrim(p.contact_email))=$1)
         AND p.archived_at IS NULL ORDER BY (u.id IS NOT NULL) DESC LIMIT 1`, [address],
    );
    if (!person) return { found: false, details: {} };
    const body = person.accepted ?? {};
    const application = person.application ?? {};
    const [first = "", ...last] = String(person.name ?? "").trim().split(/\s+/);
    let structured: Record<string,string> = {};
    try {
      structured = JSON.parse(application.residenceAddressStructured || application.officeAddressStructured || "{}");
    } catch { /* Keep usable legacy address text. */ }
    const addresses = body.addresses?.correspondence || body.addresses?.residence || body.addresses?.office || structured;
    const fallback = {
      prefix: body.prefix ?? "", firstName: body.firstName || first, lastName: body.lastName || last.join(" "),
      mobile: person.mobile_normalized || body.mobile || body.phone || person.phone || "",
      organization: body.organization || person.organization || "", jobTitle: body.jobTitle || person.job_title || "",
      address: body.address || [addresses.line1,addresses.line2].filter(Boolean).join(", ") || application.residenceAddress || application.officeAddress || "",
      city: body.city || addresses.city || person.city || "", state: body.state || addresses.state || "",
      country: body.country || (addresses.country === "IN" ? "India" : addresses.country) || "India", pin: body.pin || addresses.postalCode || "",
    } as Record<string,string>;
    const latest = person.registration ?? {};
    return { found: true, details: Object.fromEntries(registrationFields.map(field => [field.name, String(latest[field.name] ?? fallback[field.name] ?? "")])) };
  });
}
