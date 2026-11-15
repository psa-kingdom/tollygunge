import { authorized, operation, jsonBody, transaction, OperationError } from '@/lib/operation-api';
import { getDatabase } from '@/lib/database';
import { confirmMembershipPayment } from '@/lib/membership-payments';

export async function GET(request: Request) {
  return operation(async () => {
    await authorized(request, 'payments:manage');
    const number = new URL(request.url).searchParams.get('number')?.trim();
    if (!number || number.length > 80) throw new OperationError('Enter the membership number.');
    const member = (await getDatabase().query(`SELECT p.id AS person_id,p.accepted->>'name' AS name,coalesce(u.email,p.contact_email) AS email,
      m.id,m.membership_number,m.type,m.version FROM tpa.memberships m JOIN tpa.people p ON p.id=m.person_id
      LEFT JOIN public."user" u ON u.id=p.user_id WHERE lower(m.membership_number)=lower($1) AND p.archived_at IS NULL`, [number])).rows[0];
    if (!member) throw new OperationError('No member found with that membership number.', 404);
    const payments = (await getDatabase().query(`SELECT p.id,p.amount_paise,p.paid_on::text,p.method,p.reference,p.membership_type,p.recipient,m.status AS email_status
      FROM tpa.membership_payments p JOIN tpa.onboarding_mail m ON m.id=p.mail_id WHERE p.membership_id=$1 ORDER BY p.confirmed_at DESC`, [member.id])).rows;
    return { member, payments };
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, 'payments:manage', true);
    const input = await jsonBody(request, 5000);
    return transaction(c => confirmMembershipPayment(c, actor.id, input));
  });
}
