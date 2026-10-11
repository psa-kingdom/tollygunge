"use client";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
type Payment = {
  id: string;
  version: number;
  name: string;
  email: string;
  title: string;
  fee_paise: number;
  payment_status: string;
  payment_reference: string;
  payment_note: string;
  membership_number?: string;
};
export function RegistrationPayments() {
  const [rows, setRows] = useState<Payment[]>([]),
    [filter, setFilter] = useState("pending"),
    [selected, setSelected] = useState<Payment>(),
    [status, setStatus] = useState("paid"),
    [reference, setReference] = useState(""),
    [note, setNote] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load(state: string) {
    setRows(
      await api<Payment[]>("/api/staff/registration-payments?status=" + state),
    );
  }
  useEffect(() => {
    let active = true;
    void api<Payment[]>("/api/staff/registration-payments?status=" + filter)
      .then((rows) => {
        if (active) setRows(rows);
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [filter]);
  return (
    <section>
      <h2>Registration payments</h2>
      <p>
        Payments are manually verified. Confirm only after checking the bank or
        payment record. A refund status records a refund already performed.
      </p>
      <label>
        Payment status{" "}
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setSelected(undefined);
          }}
        >
          {["pending", "paid", "failed", "refunded", "cancelled", "all"].map(
            (v) => (
              <option key={v}>{v}</option>
            ),
          )}
        </select>
      </label>
      <p>{rows.length} records shown (up to 250)</p>
      <div className="table-scroll">
        <table className="operations-table" tabIndex={0} aria-label="Registration payments">
          <thead>
            <tr>
              <th>Member</th>
              <th>Event</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.name}
                  <small>
                    {r.email} · {r.membership_number}
                  </small>
                </td>
                <td>{r.title}</td>
                <td>₹{(r.fee_paise / 100).toFixed(2)}</td>
                <td>{r.payment_status}</td>
                <td>
                  <button
                    onClick={() => {
                      setSelected(r);
                      setStatus(
                        r.payment_status === "paid" ? "refunded" : "paid",
                      );
                      setReference(r.payment_reference);
                      setNote("");
                    }}
                  >
                    Review payment
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p>No payments match this status.</p>}
      {selected && (
        <form
          className="member-settings"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              !window.confirm(
                `Record ${status} for ${selected.name}, ₹${(selected.fee_paise / 100).toFixed(2)}?`,
              )
            )
              return;
            setBusy(true);
            try {
              await api("/api/staff/registration-payments", {
                id: selected.id,
                version: selected.version,
                status,
                reference,
                note,
              });
              await load(filter);
              setSelected(undefined);
              setMessage("Payment status saved. Member notification queued.");
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>
            Verify {selected.name} · {selected.title}
          </h3>
          <p>
            Current state: {selected.payment_status}. {selected.payment_note}
          </p>
          <label>
            New status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {["paid", "failed", "pending", "refunded", "cancelled"].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Bank / payment reference
            <input
              required={status === "paid"}
              minLength={status === "paid" ? 3 : 0}
              maxLength={200}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <label>
            Verification note
            <textarea
              required
              minLength={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button className="button" disabled={busy}>
            Confirm status change
          </button>
        </form>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
