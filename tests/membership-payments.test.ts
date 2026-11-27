import test from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { membershipPaymentInput, membershipPaymentEmail } from '../src/domain/membership-payment';
import { confirmMembershipPayment } from '../src/lib/membership-payments';
import { openMail } from '../src/lib/onboarding-mail';

const input = { id: '11111111-1111-4111-8111-111111111111', personId: '22222222-2222-4222-8222-222222222222', membershipVersion: 3, amount: '1000.50', paidOn: '2026-01-02', method: 'UPI', reference: 'UTR-123', confirmed: true };
const member = { id: 'membership', user_id: 'user', name: 'Test Member', email: 'member@example.test', type: 'Life', membership_number: 'L-12', version: 3 };
test('membership payments validate exact paise, date and explicit receipt confirmation', () => {
  assert.equal(membershipPaymentInput(input).amountPaise, 100050);
  for (const change of [{ amount: '0' }, { amount: '-2' }, { amount: '1.001' }, { amount: '1e3' }, { paidOn: '2026-02-30' }, { paidOn: '2999-01-01' }, { method: 'unknown' }, { confirmed: false }, { reference: '  ' }]) {
    assert.throws(() => membershipPaymentInput({ ...input, ...change }));
  }
});
test('confirmation email contains receipt facts, escapes HTML and does not approve membership', () => {
  const email = membershipPaymentEmail({ ...membershipPaymentInput(input), name: '<script>alert(1)</script>', membershipNumber: 'L-12', membershipType: 'Life' });
  assert.match(email.text, /INR 1000.50/);
  assert.match(email.text, /UTR-123/);
  assert.match(email.text, /does not change the membership status/);
  assert.ok(!email.html.includes('<script>'));
});
function db(row: object | undefined = member, existing?: object) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const client = { query: async (sql: string, values: unknown[] = []) => {
    calls.push({ sql, values });
    return { rows: calls.length === 1 ? row ? [row] : [] : calls.length === 2 && existing ? [existing] : [], rowCount: 1 };
  } } as unknown as PoolClient;
  return { client, calls };
}
test('verified payment queues encrypted email with a stable dedupe key and an audit record', async () => {
  const old = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = 'synthetic-test-secret-only';
  try {
    const d = db(); await confirmMembershipPayment(d.client, 'staff', input);
    assert.match(d.calls[0].sql, /FOR UPDATE OF m,p/);
    const mail = d.calls.find(c => /INSERT INTO tpa.onboarding_mail/.test(c.sql))!;
    assert.equal(mail.values[1], 'membership-payment-' + input.id);
    assert.equal(mail.values[3], 'member@example.test');
    assert.match(openMail(mail.values[4] as Parameters<typeof openMail>[0]).text, /INR 1000.50/);
    assert.ok(d.calls.some(c => /INSERT INTO tpa.membership_payments/.test(c.sql)));
    assert.equal(d.calls.at(-1)?.values[1], 'membership.payment_confirmed');
    assert.ok(d.calls.every(c => !/UPDATE tpa.memberships/.test(c.sql)));
  } finally { if (old === undefined) delete process.env.BETTER_AUTH_SECRET; else process.env.BETTER_AUTH_SECRET = old; }
});
test('retry returns existing confirmation without inserting payment or email again', async () => {
  const d = db(member, { id: input.id, membership_id: member.id, amount_paise: 100050, method: input.method, reference: input.reference, payment_date: input.paidOn });
  assert.equal((await confirmMembershipPayment(d.client, 'staff', input)).alreadyConfirmed, true);
  assert.equal(d.calls.length, 2);
  await assert.rejects(confirmMembershipPayment(db(member, { id: input.id, membership_id: 'other' }).client, 'staff', input), /different payment details/);
});
test('missing, stale or undeliverable member cannot create a payment', async () => {
  for (const row of [null, { ...member, version: 4 }, { ...member, email: '' }, { ...member, type: null }]) {
    const d = db(row ?? undefined);
    if (!row) { d.client.query = (async () => ({ rows: [] })) as unknown as PoolClient['query']; }
    await assert.rejects(confirmMembershipPayment(d.client, 'staff', input));
    assert.ok(d.calls.every(c => !/INSERT/.test(c.sql)));
  }
});
