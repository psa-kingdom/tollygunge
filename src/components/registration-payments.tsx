"use client";
import { WorkspacePanel, WorkspaceEmptyState } from "./workspace-ui";
import { useEffect, useState } from "react";
import { eventTime } from "@/domain/event-flow";
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
  history: {from_status:string;to_status:string;reference:string;note:string;created_at:string}[];
};
export function RegistrationPayments({eventId,onSaved}:{eventId?:string;onSaved?:()=>Promise<void>}={}) {
  const [rows, setRows] = useState<Payment[]>([]),
    [filter, setFilter] = useState("pending"),
    [selected, setSelected] = useState<Payment>(),
    [status, setStatus] = useState("paid"),
    [reference, setReference] = useState(""),
    [note, setNote] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  async function load(state: string) {
    setRows(
      await api<Payment[]>("/api/staff/registration-payments?status=" + state+(eventId?"&eventId="+eventId:"")),
    );
  }
  useEffect(() => {
    let active = true;
    void api<Payment[]>("/api/staff/registration-payments?status=" + filter+(eventId?"&eventId="+eventId:""))
      .then((rows) => {
        if (active) setRows(rows);
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      }).finally(() => { if (active) setLoaded(true); });
    return () => {
      active = false;
    };
  }, [filter,eventId]);
  return (
    <WorkspacePanel title="Registration payments" className="registration-payments">
      <p>
        Payments are manually verified. Confirm only after checking the bank or
        payment record. A refund status records a refund already performed.
      </p>
      <div className="payment-results-toolbar">
      <label>
        Payment status{" "}
        <select
          value={filter}
          onChange={(e) => {
            setLoaded(false);
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
      <p>{loaded ? `${rows.length} records shown (up to 250)` : "Loading paymentsâ€¦"}</p>
      </div>
      {loaded && !rows.length && !message && <WorkspaceEmptyState icon="wallet" title="No payments match this status" description="Payment references submitted for event registrations will appear here for review." actionLabel={filter === "all" ? "Refresh payments" : "View all statuses"} onAction={() => {if (filter === "all") void load(filter).catch(e => setMessage(e.message)); else setFilter("all");}} />}
      {!!rows.length && <div className="table-scroll" role="region" tabIndex={0} aria-label="Registration payments">
        <table className="operations-table registration-payments-table" aria-label="Registration payments">
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
                    {r.email} Â· {r.membership_number}
                  </small>
                </td>
                <td>{r.title}</td>
                <td>â‚¹{(r.fee_paise / 100).toFixed(2)}</td>
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
      </div>}

      {selected && (
        <form
          className="member-settings"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              !window.confirm(
                `Record ${status} for ${selected.name}, â‚¹${(selected.fee_paise / 100).toFixed(2)}?`,
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
              await onSaved?.();
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
            Verify {selected.name} Â· {selected.title}
          </h3>
          <p>Registration identifier: <strong>{selected.id}</strong> Â· â‚¹{(selected.fee_paise/100).toFixed(2)}</p>
          <p>
            Current state: {selected.payment_status}. {selected.payment_note}
          </p>
          <label>
            New status
            <select disabled={busy || ["cancelled","refunded"].includes(selected.payment_status)} value={status} onChange={(e) => setStatus(e.target.value)}>
              {(selected.payment_status === "paid" ? ["refunded"] : selected.payment_status === "failed" ? ["pending","paid","cancelled"] : selected.payment_status === "pending" ? ["paid","failed","cancelled"] : [selected.payment_status]).map(
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
          <details><summary>Payment history ({selected.history?.length ?? 0})</summary>{selected.history?.map((h,i) => <p key={i}>{eventTime(h.created_at)} Â· {h.from_status ? h.from_status+" â†’ " : ""}{h.to_status} Â· {h.reference} Â· {h.note}</p>)}</details>
          <button className="button" disabled={busy || ["cancelled","refunded"].includes(selected.payment_status)}>
            Confirm status change
          </button>
        </form>
      )}
      <p role={eventId?"alert":"status"}>{message}</p>
    </WorkspacePanel>
  );
}
