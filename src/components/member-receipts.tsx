"use client";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
import { rupees } from "@/domain/finance";
type Receipt = {
  id: string;
  entry_date: string;
  method: string;
  kind: string;
  status: string;
  amount_paise: number;
  reference: string;
  review_note: string;
  proof_id: string | null;
};
export function MemberReceipts({
  eventId,
  registrationId,
  amountPaise,
  eligible,
  onSaved,
}: {
  eventId: string;
  registrationId: string;
  amountPaise: number;
  eligible: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const [rows, setRows] = useState<Receipt[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const load = () =>
    api<Receipt[]>(`/api/member/receipts?eventId=${eventId}`).then((r) => {
      setRows(r);
      setLoaded(true);
    });
  useEffect(() => {
    let active = true;
    api<Receipt[]>(`/api/member/receipts?eventId=${eventId}`)
      .then((r) => {
        if (active) {
          setRows(r);
          setLoaded(true);
        }
      })
      .catch((e) => setMessage(e.message));
    return () => {
      active = false;
    };
  }, [eventId]);
  return (
    <section aria-label="Payment transactions">
      <h4>Payment transactions</h4>
      {rows.map((r) => (
        <p key={r.id}>
          {r.entry_date} · {r.kind} · {rupees(Number(r.amount_paise))} · {r.method || "Method not recorded"} · {r.status} · {r.reference || "No reference"}{" "}
          {r.proof_id && (
            <a
              href={`/api/finance/proofs/${r.proof_id}`}
              target="_blank"
              rel="noreferrer"
            >
              View proof
            </a>
          )}
          {r.review_note && <span> · Review: {r.review_note}</span>}
        </p>
      ))}
      {loaded && !rows.length && <p>No receipts or refunds have been recorded.</p>}
      {eligible && loaded && !rows.some((r) => r.status === "submitted") && (
        <form
          className="member-settings"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              data = new FormData(form);
            setBusy(true);
            try {
              data.set(
                "details",
                JSON.stringify({
                  id: crypto.randomUUID(),
                  eventId,
                  registrationId,
                  amountPaise,
                  date: data.get("date"),
                  method: data.get("method"),
                  reference: data.get("reference"),
                  note: data.get("note"),
                }),
              );
              const r = await fetch("/api/member/receipts", {
                method: "POST",
                body: data,
              });
              const result = await r.json();
              if (!r.ok)
                throw Error(result.error ?? "Receipt could not be submitted.");
              await load();
              await onSaved();
              form.reset();
              setMessage(
                "Receipt submitted. An admin will review your payment proof.",
              );
            } catch (error) {
              setMessage((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            Submit your full fee of {rupees(amountPaise)}. Upload the UPI
            screenshot or bank receipt showing your completed payment.
          </p>
          <fieldset disabled={busy}>
            <label>
              Transaction date
              <input name="date" type="date" required />
            </label>
            <label>
              Method
              <select name="method" required>
                <option>UPI</option>
                <option>Bank transfer</option>
                <option>Cash</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              Transaction reference
              <input name="reference" required minLength={3} maxLength={200} />
            </label>
            <label>
              Payment proof (JPEG, PNG or PDF, up to 5 MB)
              <input
                type="file"
                name="file"
                accept="image/jpeg,image/png,application/pdf"
                required
              />
            </label>
            <label>
              Note
              <textarea name="note" maxLength={1000} />
            </label>
            <button className="button">
              {busy ? "Submitting…" : "Submit receipt for admin review"}
            </button>
          </fieldset>
        </form>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
