import 'server-only';
import type { PoolClient } from 'pg';
import { OperationError, audit } from './operation-api';
export async function lockOperationalEvent(c: PoolClient, id: string, expected?: number) {
  const e = (await c.query('SELECT * FROM tpa.events WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if (!e) throw new OperationError('Event not found.',404);
  if (expected !== undefined && e.version !== expected) throw new OperationError('Event changed. Reload before continuing.',409);
  return e;
}
export function editableEvent(e: {completed_at: unknown; archived_at: unknown}) {
  if (e.completed_at || e.archived_at) throw new OperationError('Reopen the event with a reason before making corrections.',409);
}
export async function eventHistory(c: PoolClient, eventId: string, actor: string, action: string, details: unknown = {}) {
  await c.query('INSERT INTO tpa.event_operation_history(event_id,actor_id,action,details) VALUES($1,$2,$3,$4)',[eventId,actor,action,JSON.stringify(details)]);
  await audit(c,actor,action,eventId);
}
export async function snapshotAccounts(c: PoolClient, ids: string[]) {
  if (!ids.length) return [];
  const rows=(await c.query("SELECT id,version,active_snapshot AS details FROM tpa.payment_details WHERE id=ANY($1::uuid[]) AND status='active' AND active_snapshot IS NOT NULL ORDER BY id FOR SHARE",[ids])).rows;
  if (rows.length !== ids.length) throw new OperationError('Choose active payment accounts.',409);
  return rows;
}
export async function freezeEventPayment(c: PoolClient, e: {id:string; payment_account_ids:string[] | null; payment_revision:number | null}, actor:string, reason:string) {
  if (e.payment_account_ids === null) return;
  const accounts=await snapshotAccounts(c,e.payment_account_ids), revision=(e.payment_revision ?? 0)+1;
  await c.query('INSERT INTO tpa.event_payment_configurations(event_id,revision,accounts,actor_id,reason) VALUES($1,$2,$3,$4,$5)',[e.id,revision,JSON.stringify(accounts),actor,reason]);
  await c.query('UPDATE tpa.events SET payment_revision=$2 WHERE id=$1',[e.id,revision]);
}
export async function eventFinancials(c: {query: PoolClient['query']}, id:string) {
  const r=(await c.query(`SELECT coalesce(sum(fee_paise) FILTER(WHERE status='registered'),0)::text AS booked,
    coalesce(sum(fee_paise) FILTER(WHERE status='registered' AND payment_status IN ('pending','failed')),0)::text AS pending,
    coalesce(sum(fee_paise) FILTER(WHERE status='cancelled' AND payment_status='paid'),0)::text AS refund_review
    FROM tpa.event_registrations WHERE event_id=$1`,[id])).rows[0];
  const h=(await c.query(`SELECT coalesce(sum(h.fee_paise) FILTER(WHERE h.to_status='paid' AND (h.from_status IS NULL OR h.from_status IN ('pending','failed'))),0)::text AS received,
    coalesce(sum(h.fee_paise) FILTER(WHERE h.from_status='paid' AND h.to_status='refunded' OR h.from_status IS NULL AND h.to_status='refunded'),0)::text AS refunded
    FROM tpa.event_payment_history h JOIN tpa.event_registrations r ON r.id=h.registration_id WHERE r.event_id=$1`,[id])).rows[0];
  // Legacy refunded baselines establish both a receipt and full refund; provenance stays explicit.
  const legacy=(await c.query("SELECT coalesce(sum(h.fee_paise),0)::text AS amount FROM tpa.event_payment_history h JOIN tpa.event_registrations r ON r.id=h.registration_id WHERE r.event_id=$1 AND h.from_status IS NULL AND h.to_status='refunded'",[id])).rows[0];
  const expenses=(await c.query('SELECT coalesce(sum(amount_paise),0)::text AS amount FROM tpa.event_expenses WHERE event_id=$1 AND voided_at IS NULL',[id])).rows[0];
  const received=Number(h.received)+Number(legacy.amount), refunded=Number(h.refunded), expense=Number(expenses.amount);
  return {booked:Number(r.booked),pending:Number(r.pending),received,refunded,netCollected:received-refunded,expenses:expense,netResult:received-refunded-expense,legacyRefundBaseline:Number(legacy.amount),refundReview:Number(r.refund_review)};
}
