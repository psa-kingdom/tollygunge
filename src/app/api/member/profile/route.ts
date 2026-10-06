import { currentActor } from "@/lib/actor";
import { getDatabase } from "@/lib/database";
import { isSameOrigin } from "@/lib/request-policy";
import { validateProfile } from "@/domain/profile";
import { boundedBody } from "@/domain/request-body";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const actor = await currentActor(request.headers);
  if (!actor)
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const { rows } = await getDatabase().query(
    'SELECT p.phone,p.organization,p.profession,p.job_title AS "jobTitle",p.city,p.preferences,coalesce(n.subscribed,false) AS newsletter FROM tpa.member_profiles p LEFT JOIN tpa.newsletter_consents n ON n.user_id=p.user_id WHERE p.user_id=$1',
    [actor.id],
  );
  return Response.json(
    rows[0] ?? {
      phone: "",
      organization: "",
      profession: "",
      jobTitle: "",
      city: "",
      preferences: { contact: "email" },
      newsletter: false,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function POST(request: Request) {
  const actor = await currentActor(request.headers);
  if (!actor)
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (!isSameOrigin(request))
    return Response.json(
      { error: "Request origin is not allowed." },
      { status: 403 },
    );
  let profile;
  try {
    const text = new TextDecoder().decode(await boundedBody(request, 4096));
    profile = validateProfile(JSON.parse(text));
  } catch {
    return Response.json(
      { error: "Check your profile details." },
      { status: 400 },
    );
  }
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO tpa.member_profiles(user_id,phone,organization,preferences,profession,job_title,city) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id) DO UPDATE SET phone=$2,organization=$3,preferences=$4,profession=$5,job_title=$6,city=$7,updated_at=now()",
      [
        actor.id,
        profile.phone,
        profile.organization,
        JSON.stringify(profile.preferences),
        profile.profession,
        profile.jobTitle,
        profile.city,
      ],
    );
    await client.query(
      "INSERT INTO tpa.newsletter_consents(user_id,subscribed,source) VALUES($1,$2,'member_profile') ON CONFLICT(user_id) DO UPDATE SET subscribed=$2,changed_at=now(),source='member_profile'",
      [actor.id, profile.newsletter],
    );
    await client.query(
      "INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,'profile.updated',$1)",
      [actor.id],
    );
    await client.query(
      "INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,$2,$1)",
      [
        actor.id,
        profile.newsletter ? "newsletter.opted_in" : "newsletter.opted_out",
      ],
    );
    await client.query("COMMIT");
    return Response.json({ saved: true });
  } catch {
    await client.query("ROLLBACK");
    return Response.json(
      { error: "Unable to save. Please try again." },
      { status: 503 },
    );
  } finally {
    client.release();
  }
}
