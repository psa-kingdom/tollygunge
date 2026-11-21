"use client";
import { useEffect, useState } from 'react';
import { api } from './operations-client';
import { WorkspacePanel } from './workspace-ui';
import styles from './membership-payments.module.css';

type Payment = { id: string; amount_paise: number; paid_on: string; method: string; reference: string; membership_type: string; recipient?: string; email_status?: string };
type Lookup = { member: { person_id: string; name: string; email: string; membership_number: string; type: string; version: number }; payments: Payment[] };
function PaymentHistory({ payments }: { payments: Payment[] }) {
  return payments.length ? <ul className="event-journey-list">{payments.map(p => <li key={p.id}>
    <strong>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(p.amount_paise / 100)} · {p.membership_type} membership</strong>
    <p>{p.paid_on} · {p.method} · Payment confirmed</p><p>Reference: {p.reference}</p>
    {p.email_status && <small>Confirmation email: {p.email_status} · {p.recipient}</small>}
  </li>)}</ul> : <p>No membership payments recorded.</p>;
}
export function MemberMembershipPayments() {
  const [payments, setPayments] = useState<Payment[]>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    api<{ payments: Payment[] }>('/api/member/membership-payments').then(data => { if (active) { setPayments(data.payments); setError(''); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [retry]);
  return <section aria-label="Membership transactions"><h2>Membership transactions</h2>{error ? <p role="alert">{error} <button onClick={() => setRetry(n => n + 1)}>Retry payments</button></p> : payments ? <PaymentHistory payments={payments} /> : <p role="status">Loading membership payments…</p>}</section>;
}

export function MembershipPaymentConfirmation() {
  const [number, setNumber] = useState('');
  const [lookup, setLookup] = useState<Lookup>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [requestId, setRequestId] = useState('');
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState('');
  const [method, setMethod] = useState('UPI');
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  return <WorkspacePanel title="Membership payments">
    <p>Look up a member to record a verified payment and send their confirmation email.</p>
    <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setMessage(''); setLookup(undefined);
      try { setLookup(await api<Lookup>('/api/staff/membership-payments?number=' + encodeURIComponent(number))); setRequestId(crypto.randomUUID()); setAmount(''); setPaidOn(''); setReference(''); setConfirmed(false); }
      catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
    }} className={styles.lookup}>
      <label>Membership number<input required maxLength={80} value={number} onChange={e => { setNumber(e.target.value); setLookup(undefined); }} disabled={busy} /></label>
      <button className="button secondary" disabled={busy}>Find member</button>
    </form>
    {lookup && <>
      <h3>{lookup.member.name} · {lookup.member.membership_number}</h3>
      <p>{lookup.member.type || 'Membership type missing'} · Confirmation email: {lookup.member.email || 'Email missing'}</p>
      <PaymentHistory payments={lookup.payments} />
      <form onSubmit={async e => {
        e.preventDefault(); setBusy(true); setMessage('');
        try {
          await api('/api/staff/membership-payments', { id: requestId, personId: lookup.member.person_id, membershipVersion: lookup.member.version, amount, paidOn, method, reference, confirmed });
          setMessage('Payment confirmed. Confirmation email queued for delivery.');
          setLookup(undefined); setConfirmed(false);
        } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
      }}>
        <fieldset className={styles.fields} disabled={busy}><legend>Confirm membership payment</legend>
          <label>Amount received (₹)<input required type="number" min="0.01" max="9999999.99" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></label>
          <label>Payment date<input required type="date" value={paidOn} max={new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())} onChange={e => setPaidOn(e.target.value)} /></label>
          <label>Payment method<select value={method} onChange={e => setMethod(e.target.value)}>{['UPI', 'Bank transfer', 'Cash', 'Cheque'].map(m => <option key={m}>{m}</option>)}</select></label>
          <label>Transaction / receipt reference<input required maxLength={100} value={reference} onChange={e => setReference(e.target.value)} /></label>
          <p>For cash, enter the receipt number. For cheques, confirm only after the funds have cleared.</p>
          <label className={styles.confirmation}><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I have verified receipt of this payment. Send confirmation to {lookup.member.email}.</label>
          <button className="button" disabled={!confirmed || !lookup.member.email || !lookup.member.type}>Confirm payment and send email</button>
        </fieldset>
      </form>
    </>}
    {message && <p role="status">{message}</p>}
  </WorkspacePanel>;
}
