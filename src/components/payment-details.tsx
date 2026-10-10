"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { api } from "./operations-client";
type Details = {
  label: string;
  payee: string;
  upiId: string;
  phone: string;
  qrId: string | null;
};
type PaymentRecord = {
  id: string;
  status: string;
  draft: Details;
  active_snapshot: Details | null;
  version: number;
};
type Revision = {
  detail_id: string;
  version: number;
  status: string;
  details: Details;
  created_at: string;
};
const empty: Details = {
  label: "",
  payee: "",
  upiId: "",
  phone: "",
  qrId: null,
};
export function PaymentDetailsManager() {
  const [records, setRecords] = useState<PaymentRecord[]>([]),
    [revisions, setRevisions] = useState<Revision[]>([]),
    [selected, setSelected] = useState<PaymentRecord>(),
    [form, setForm] = useState<Details>(empty),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("Loading payment details…"),
    [confirmed, setConfirmed] = useState(false),
    [file, setFile] = useState<File>();
  async function load(id?: string) {
    const data = await api<{ records: PaymentRecord[]; revisions: Revision[] }>(
      "/api/staff/payment-details",
    );
    setRecords(data.records);
    setRevisions(data.revisions);
    if (id) {
      const item = data.records.find((r) => r.id === id);
      setSelected(item);
      if (item) setForm(item.draft);
    }
  }
  useEffect(() => {
    api<{ records: PaymentRecord[]; revisions: Revision[] }>(
      "/api/staff/payment-details",
    )
      .then((data) => {
        setRecords(data.records);
        setRevisions(data.revisions);
        setMessage("");
      })
      .catch((e) => setMessage(e.message));
  }, []);
  async function status(action: string) {
    if (!selected) return;
    setBusy(true);
    try {
      await api("/api/staff/payment-details", {
        id: selected.id,
        version: selected.version,
        action,
        confirmPayee: confirmed,
      });
      await load(selected.id);
      setConfirmed(false);
      setMessage(
        `Payment details set to ${action}. No transaction or membership status changed.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="notice">
        Manage collection instructions here. Fees, transaction verification and
        membership approval remain separate. No payment is marked paid by
        scanning a QR or activating these details.
      </div>
      <div className="operations-layout">
        <aside className="record-list">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => {
              setSelected(undefined);
              setForm(empty);
              setConfirmed(false);
              setFile(undefined);
              setMessage("");
            }}
          >
            New payment details
          </button>
          {records.map((r) => (
            <button
              key={r.id}
              disabled={busy}
              onClick={() => {
                setSelected(r);
                setForm(r.draft);
                setConfirmed(false);
                setFile(undefined);
                setMessage("");
              }}
            >
              <strong>{r.draft.label}</strong>
              <small>
                {r.status} · {r.draft.upiId}
              </small>
            </button>
          ))}
          {!records.length && <p>No payment details saved.</p>}
        </aside>
        <section>
          <h2>{selected ? "Edit payment details" : "New payment details"}</h2>
          <form
            className="member-settings"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const result = await api<{ id: string }>(
                  "/api/staff/payment-details",
                  {
                    id: selected?.id,
                    version: selected?.version ?? 0,
                    action: "save",
                    details: form,
                  },
                );
                await load(result.id);
                setConfirmed(false);
                setMessage(
                  "Draft saved. Active details change only when you activate the saved revision.",
                );
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "Save failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Label
              <input
                required
                minLength={3}
                maxLength={100}
                value={form.label}
                onChange={(e) => {
                  setForm({ ...form, label: e.target.value });
                  setConfirmed(false);
                }}
              />
            </label>
            <label>
              Payee name
              <input
                required
                minLength={3}
                maxLength={120}
                value={form.payee}
                onChange={(e) => {
                  setForm({ ...form, payee: e.target.value });
                  setConfirmed(false);
                }}
              />
            </label>
            <label>
              UPI ID
              <input
                required
                maxLength={120}
                value={form.upiId}
                onChange={(e) => {
                  setForm({ ...form, upiId: e.target.value });
                  setConfirmed(false);
                }}
              />
            </label>
            <label>
              Payment contact number (optional)
              <input
                type="tel"
                maxLength={20}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <button className="button" disabled={busy}>
              Save draft details
            </button>
          </form>
          <form
            className="member-settings"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!file) return;
              setBusy(true);
              try {
                const body = new FormData();
                body.set("file", file);
                const response = await fetch("/api/staff/payment-qr", {
                  method: "POST",
                  body,
                });
                const data = await response.json();
                if (!response.ok)
                  throw new Error(data.error ?? "Upload failed.");
                setForm({ ...form, qrId: data.id });
                setConfirmed(false);
                setFile(undefined);
                setMessage(
                  "QR uploaded privately. Save draft details to attach it, then verify before activation.",
                );
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "Upload failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Upload or replace QR photo (JPEG/PNG, up to 5 MB)
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => setFile(e.target.files?.[0])}
              />
            </label>
            <button className="button secondary" disabled={busy || !file}>
              Upload QR photo
            </button>
            {form.qrId && (
              <>
                <Image
                  unoptimized
                  src={`/api/payment-qr/${form.qrId}`}
                  width={300}
                  height={300}
                  alt="Draft payment QR; verify payee before activating"
                  style={{
                    maxWidth: "100%",
                    height: "auto",
                    objectFit: "contain",
                  }}
                />
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setForm({ ...form, qrId: null });
                    setConfirmed(false);
                  }}
                >
                  Remove QR from draft
                </button>
              </>
            )}
          </form>
          {selected && (
            <>
              <p>
                Current status: <strong>{selected.status}</strong>. Active
                revisions are visible only to signed-in accounts. Draft and Past
                details are hidden from them.
              </p>
              {selected.active_snapshot && selected.status === "active" && (
                <p>
                  Currently active: {selected.active_snapshot.payee} ·{" "}
                  {selected.active_snapshot.upiId}. Saving edits keeps these
                  instructions until explicit activation.
                </p>
              )}
              <label className="payment-confirm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I verified that the saved UPI ID, payee and QR belong to TPA.
              </label>
              <div className="action-row">
                <button
                  className="button"
                  disabled={
                    busy ||
                    !confirmed ||
                    JSON.stringify(form) !== JSON.stringify(selected.draft)
                  }
                  onClick={() => status("active")}
                >
                  Activate saved revision
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => status("draft")}
                >
                  Set Draft
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => status("past")}
                >
                  Move to Past
                </button>
              </div>
              <h3>Revision history</h3>
              {revisions
                .filter((r) => r.detail_id === selected.id)
                .map((r) => (
                  <p key={r.version}>
                    Revision {r.version} · {r.status} · {r.details.payee} ·{" "}
                    {r.details.upiId} ·{" "}
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                ))}
            </>
          )}
          <p role="status">{message}</p>
        </section>
      </div>
    </>
  );
}
export function MemberPaymentDetails() {
  const [records, setRecords] = useState<{ id: string; details: Details }[]>(
      [],
    ),
    [message, setMessage] = useState("Loading payment details…");
  useEffect(() => {
    api<{ records: { id: string; details: Details }[] }>(
      "/api/member/payment-details",
    )
      .then((data) => {
        setRecords(data.records);
        setMessage("");
      })
      .catch((e) => setMessage(e.message));
  }, []);
  return (
    <>
      <div className="notice">
        These are association payment details, not a payment request. Fees and
        transaction verification are still being configured. Do not transfer
        funds until TPA confirms the purpose and amount. A scan does not confirm
        payment or approve membership.
      </div>
      {records.map((r) => (
        <section className="content-section" key={r.id}>
          <h2>{r.details.label}</h2>
          <p>Payee: {r.details.payee}</p>
          <p>
            UPI ID: <strong>{r.details.upiId}</strong>
          </p>
          {r.details.phone && <p>Payment contact: {r.details.phone}</p>}
          {r.details.qrId && (
            <Image
              unoptimized
              src={`/api/payment-qr/${r.details.qrId}`}
              width={300}
              height={300}
              alt={`Payment QR for ${r.details.payee}`}
              style={{ maxWidth: "100%", height: "auto", objectFit: "contain" }}
            />
          )}
        </section>
      ))}
      {!message && !records.length && (
        <p>No active payment details are available.</p>
      )}
      <p role="status">{message}</p>
    </>
  );
}
