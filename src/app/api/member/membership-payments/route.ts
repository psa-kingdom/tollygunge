import { authorized, operation } from '@/lib/operation-api';
import { getDatabase } from '@/lib/database';
export async function GET(request: Request) {
  return operation(async () => {
    const actor = await authorized(request);
    return { payments: (await getDatabase().query(`SELECT pay.id,pay.amount_paise,pay.paid_on::text,pay.method,pay.reference,pay.membership_type
      FROM tpa.membership_payments pay JOIN tpa.memberships m ON m.id=pay.membership_id JOIN tpa.people p ON p.id=m.person_id
      WHERE p.user_id=$1 AND p.archived_at IS NULL ORDER BY pay.confirmed_at DESC`, [actor.id])).rows };
  });
}
