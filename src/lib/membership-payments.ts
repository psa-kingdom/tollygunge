import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { membershipPaymentEmail, membershipPaymentInput } from '../domain/membership-payment';
import { OperationError } from './operation-error';
import { audit } from './operation-audit';
import { sealMail } from './onboarding-mail';

/** Caller must authorize payments:manage and wrap this in a database transaction. */
export async function confirmMembershipPayment(c: PoolClient, actorId: string, value: unknown) {
  let input;
  try { input = membershipPaymentInput(value); } catch (error) { throw new OperationError((error as Error).message); }
  // Serialize both duplicate retries and membership edits against the same member.
  const member = (await c.query(`SELECT m.*,p.user_id,p.accepted->>'name' AS name,coalesce(u.email,p.contact_email) AS email
    FROM tpa.memberships m JOIN tpa.people p ON p.id=m.person_id LEFT JOIN public."user" u ON u.id=p.user_id
    WHERE p.id=$1 AND p.archived_at IS NULL FOR UPDATE OF m,p`, [input.personId])).rows[0];
  if (!member) throw new OperationError('Member not found.', 404);
  const existing = (await c.query('SELECT *,paid_on::text AS payment_date FROM tpa.membership_payments WHERE id=$1', [input.id])).rows[0];
  if (existing) {
    if (existing.membership_id !== member.id || existing.amount_paise !== input.amountPaise || existing.method !== input.method || existing.reference !== input.reference || existing.payment_date !== input.paidOn)
      throw new OperationError('This confirmation was already used for different payment details. Reload the payment history.', 409);
    return { saved: true, id: existing.id, alreadyConfirmed: true };
  }
  if (member.version !== input.membershipVersion) throw new OperationError('Membership changed. Look up the member again.', 409);
  if (!member.type) throw new OperationError('Record the membership type before confirming payment.', 409);
  const recipient = String(member.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new OperationError('Record a valid member email before confirming payment.', 409);
  const mailId = randomUUID();
  await c.query(`INSERT INTO tpa.onboarding_mail(id,dedupe,user_id,recipient,kind,payload) VALUES($1,$2,$3,$4,'membership_payment',$5)`,
    [mailId, 'membership-payment-' + input.id, member.user_id, recipient, sealMail(membershipPaymentEmail({ ...input, name: member.name || 'Member', membershipNumber: member.membership_number, membershipType: member.type }))]);
  await c.query(`INSERT INTO tpa.membership_payments(id,membership_id,amount_paise,paid_on,method,reference,membership_number,membership_type,recipient,confirmed_by,mail_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [input.id, member.id, input.amountPaise, input.paidOn, input.method, input.reference, member.membership_number, member.type, recipient, actorId, mailId]);
  await audit(c, actorId, 'membership.payment_confirmed', input.id);
  return { saved: true, id: input.id, alreadyConfirmed: false };
}
