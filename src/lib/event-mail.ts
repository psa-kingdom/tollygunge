import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { sealMail } from "./onboarding-mail";
import { eventEmail, type MailEvent } from "../domain/event-email";
export async function queueEventUpdate(c: PoolClient, event: MailEvent & { version: number; status: string }) {
  const registrations = (await c.query(`SELECT r.*,u.email FROM tpa.event_registrations r JOIN public."user" u ON u.id=r.user_id WHERE r.event_id=$1 AND r.status='registered'`, [event.id])).rows;
  for (const r of registrations) await c.query(
    `INSERT INTO tpa.onboarding_mail(id,dedupe,user_id,recipient,kind,payload,event_id,registration_id) VALUES($1,$2,$3,$4,'event_update',$5,$6,$7) ON CONFLICT(dedupe) DO NOTHING`,
    [randomUUID(), `event-update-${event.version}-${r.id}`, r.user_id, r.email, sealMail(eventEmail(event, event.status === "cancelled" ? "event_cancelled" : "event_update", process.env.BETTER_AUTH_URL!, r)), event.id, r.id],
  );
}
export async function queueEventMail(c: PoolClient, userId: string, title: string, state: string, dedupe: string) {
  // Dedupe starts with the registration UUID, followed by its optimistic version.
  const registrationId = dedupe.slice(0,36);
  const r = (await c.query(`SELECT r.*,u.email FROM tpa.event_registrations r JOIN public."user" u ON u.id=r.user_id WHERE r.id=$1 AND r.user_id=$2`, [registrationId,userId])).rows[0];
  if (!r) throw Error("Registration not found for event mail.");
  const event = (await c.query("SELECT * FROM tpa.events WHERE id=$1", [r.event_id])).rows[0];
  await c.query(`INSERT INTO tpa.onboarding_mail(id,dedupe,user_id,recipient,kind,payload,event_id,registration_id) VALUES($1,$2,$3,$4,'event_status',$5,$6,$7) ON CONFLICT(dedupe) DO NOTHING`,
    [randomUUID(), "event-"+dedupe, userId, r.email, sealMail(eventEmail({...event,title},state,process.env.BETTER_AUTH_URL!,r)), event.id,r.id]);
}
