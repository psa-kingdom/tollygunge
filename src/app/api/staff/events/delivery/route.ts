import { authorized, operation } from "@/lib/operation-api";
import { uuid } from "@/domain/operations";
import { getDatabase } from "@/lib/database";
export async function GET(request: Request) {
  return operation(async () => {
    await authorized(request,"events:manage");
    const id = uuid(new URL(request.url).searchParams.get("eventId"));
    const db = getDatabase();
    const [mail, reminders] = await Promise.all([
      db.query("SELECT id,registration_id,kind,status,reason,created_at FROM tpa.onboarding_mail WHERE event_id=$1 ORDER BY created_at DESC LIMIT 100", [id]),
      db.query("SELECT d.id,d.registration_id,d.audience,d.due_at,coalesce(d.reason,m.reason) AS reason,CASE WHEN d.status='skipped' THEN 'skipped' ELSE coalesce(m.status,d.status) END AS status FROM tpa.event_reminders d LEFT JOIN tpa.onboarding_mail m ON m.id=d.mail_id WHERE d.event_id=$1 ORDER BY d.due_at DESC LIMIT 100", [id]),
    ]);
    return { mail: mail.rows, reminders: reminders.rows };
  });
}
