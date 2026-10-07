import {
  authorized,
  operation,
  jsonBody,
  transaction,
  audit,
  OperationError,
} from "@/lib/operation-api";
import { ownPerson, enriched, changePerson } from "@/lib/people-service";
import { validateProfile } from "@/domain/profile";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return operation(async () => {
    const actor = await authorized(request);
    return transaction(async (client) => {
      const row = await ownPerson(client, actor);
      const consent = (
        await client.query(
          "SELECT coalesce(n.subscribed,false) AS newsletter,p.preferences FROM tpa.member_profiles p LEFT JOIN tpa.newsletter_consents n ON n.user_id=p.user_id WHERE p.user_id=$1",
          [actor.id],
        )
      ).rows[0];
      return {
        ...row.accepted,
        preferences: consent?.preferences ?? { contact: "email" },
        newsletter: consent?.newsletter ?? false,
        person: await enriched(client, row, actor),
      };
    });
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, undefined, true),
      input = await jsonBody(request, 1048576);
    return transaction(async (client) => {
      if (input.action === "preferences") {
        const pref = validateProfile({
          phone: "",
          organization: "",
          newsletter: input.newsletter,
          contactPreference: input.contactPreference,
        });
        await client.query(
          "INSERT INTO tpa.member_profiles(user_id,phone,organization,preferences) VALUES($1,'','',$2) ON CONFLICT(user_id) DO UPDATE SET preferences=$2,updated_at=now()",
          [actor.id, pref.preferences],
        );
        await client.query(
          "INSERT INTO tpa.newsletter_consents(user_id,subscribed,source) VALUES($1,$2,'member_profile') ON CONFLICT(user_id) DO UPDATE SET subscribed=$2,changed_at=now(),source='member_profile'",
          [actor.id, pref.newsletter],
        );
        await audit(
          client,
          actor.id,
          pref.newsletter ? "newsletter.opted_in" : "newsletter.opted_out",
          actor.id,
        );
        return { saved: true };
      }
      if (!["save", "submit"].includes(input.action))
        throw new OperationError("Save a draft or submit it for review.");
      return changePerson(client, actor, input, true);
    });
  });
}
