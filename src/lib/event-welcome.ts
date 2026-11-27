import "server-only";
import type { PoolClient } from "pg";
import { randomBytes, randomUUID } from "node:crypto";
import { invitationDefaults, renderInvitation } from "@/domain/invitation-template";
import { hashToken, sealMail } from "./onboarding-mail";

export async function queueEventWelcome(client: PoolClient, userId: string, email: string, name: string) {
  const token = randomBytes(32).toString("base64url");
  await client.query("INSERT INTO tpa.onboarding_invitations(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '48 hours')", [hashToken(token),userId]);
  const { rows: [template] } = await client.query(
    "SELECT t.subject,t.body FROM tpa.invitation_template_state s JOIN tpa.invitation_templates t ON t.id=s.approved_id WHERE s.singleton",
  );
  const { rows: [plan] } = await client.query(
    "SELECT coalesce(c.name,m.type,'Free') AS name FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id LEFT JOIN tpa.membership_plans c ON c.code=m.type WHERE p.user_id=$1",
    [userId],
  );
  const url = new URL("/invitation", process.env.BETTER_AUTH_URL!).href + "#token=" + token;
  const welcome = `Welcome to TPA! You are now part of the TPA community on our ${plan?.name ?? "Free"} membership plan.\n\nSet your password using the invitation below, then sign in and complete your profile.\n\n`;
  const content = renderInvitation({ subject: "Welcome to TPA · your membership and account invitation", body: welcome + (template ?? invitationDefaults).body }, name, url);
  await client.query(
    "INSERT INTO tpa.onboarding_mail(id,dedupe,user_id,recipient,kind,payload) VALUES($1,$2,$3,$4,'invitation',$5) ON CONFLICT(dedupe) DO NOTHING",
    [randomUUID(),"event-welcome-"+userId,userId,email,sealMail(content)],
  );
}
