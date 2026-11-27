import { randomUUID } from "node:crypto";
import { operation, OperationError } from "@/lib/operation-api";
import { isSameOrigin } from "@/lib/request-policy";
import { email as normalizeEmail } from "@/domain/member-foundation";
import { uuid } from "@/domain/operations";
import { registerEvent, registrationDetails, registrationRequest } from "@/lib/event-registration";
import { paymentProofTransaction } from "@/lib/finance-upload";
import { queueEventWelcome } from "@/lib/event-welcome";

export async function POST(request: Request) {
  return operation(async () => {
    if (!isSameOrigin(request)) throw new OperationError("Request origin is not allowed.", 403);
    const { input, file, payNow } = await registrationRequest(request);
    const email = normalizeEmail(input.email, true);
    const eventId = uuid(input.eventId);
    const details = registrationDetails(input.details);
    const name = [details.firstName, details.lastName].filter(Boolean).join(" ");
    return paymentProofTransaction(file, payNow, async (client, attach) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,7619))", [email]);
      let user = (await client.query('SELECT id,name FROM public."user" WHERE lower(btrim(email))=$1 FOR UPDATE', [email])).rows[0];
      const firstAccount = !user;
      if (!user) {
        const { rows: people } = await client.query("SELECT id,user_id,archived_at FROM tpa.people WHERE lower(btrim(contact_email))=$1 FOR UPDATE", [email]);
        if (people.length > 1 || people.some(person => person.user_id || person.archived_at))
          throw new OperationError("Contact TPA to complete registration for this email.", 409);
        const userId = randomUUID();
        if (people.length) {
          await client.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,false)', [userId,name,email]);
          await client.query("UPDATE tpa.people SET user_id=$2,version=version+1,updated_at=now() WHERE id=$1", [people[0].id,userId]);
        } else {
          await client.query('INSERT INTO public."user"(id,name,email,"emailVerified","freeSignup") VALUES($1,$2,$3,false,true)', [userId,name,email]);
        }
        user = { id: userId, name };
      }
      if ((await client.query("SELECT 1 FROM tpa.account_invitation_holds WHERE user_id=$1 AND released_at IS NULL", [user.id])).rowCount)
        throw new OperationError("Contact TPA to complete registration for this account.", 409);
      let person = (await client.query("SELECT * FROM tpa.people WHERE user_id=$1 FOR UPDATE", [user.id])).rows[0];
      if (person?.archived_at) throw new OperationError("Contact TPA to complete registration for this account.", 409);
      if (!person) person = (await client.query(
        "INSERT INTO tpa.people(id,user_id,accepted,draft,contact_email) VALUES($1,$2,$3,$3,$4) RETURNING *",
        [randomUUID(),user.id,{ name: user.name },email],
      )).rows[0];
      await client.query("INSERT INTO tpa.memberships(id,person_id,type,status,source) VALUES($1,$2,'Free','active','signup') ON CONFLICT(person_id) DO NOTHING", [randomUUID(),person.id]);
      if (firstAccount && !person.accepted_verified) {
        const body = { ...person.accepted, ...details, name, email, phone: details.mobile };
        await client.query("UPDATE tpa.people SET accepted=$2,draft=$2,mobile_normalized=$3,version=version+1,updated_at=now() WHERE id=$1", [person.id,body,details.mobile]);
      }
      const result = await registerEvent(client, user.id, eventId, details, true, payNow ? attach : undefined);
      if (firstAccount) await queueEventWelcome(client, user.id, email, name);
      return { saved: true, payment_status: result.registration.payment_status, firstRegistration: firstAccount, alreadyRegistered: !result.created };
    });
  });
}
