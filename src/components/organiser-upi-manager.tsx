"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
import { CopyValue } from "./portal-values";
import { eventOrganisers, type OrganiserUpi } from "@/domain/organiser-upi";
import styles from "./organiser-upi-manager.module.css";

type Record = OrganiserUpi & { organiser: string; status: string };
const payeeNames: { [key: string]: string } = {
  TPA: "Tollygunge Professional Association",
  "CA CP Study Circle": "Tollygunge CA CPE Study Circle of EIRC of ICAI",
};
export function OrganiserUpiManager() {
  const [records, setRecords] = useState<Record[]>();
  const [editing, setEditing] = useState<Record | "new">();
  const [organiser, setOrganiser] = useState("TPA"),
    [payee, setPayee] = useState(payeeNames.TPA),
    [upi, setUpi] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [qrId, setQrId] = useState<string | null>(null);
  const [qrFile, setQrFile] = useState<File>();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    api<{ records: Record[] }>("/api/staff/organiser-upi")
      .then((data) => {
        if (active) {
          setRecords(data.records);
          setError("");
        }
      })
      .catch((failure) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  function edit(record?: Record) {
    setEditing(record ?? "new");
    setOrganiser(record?.organiser ?? "TPA");
    setPayee(record?.details.payee ?? payeeNames.TPA);
    setUpi(record?.details.upiId ?? "");
    setQrId(record?.details.qrId ?? null);
    setQrFile(undefined);
    setMessage("");
    setError("");
  }
  return (
    <section className={styles.section} aria-label="UPI IDs">
      <div className={styles.heading}>
        <div>
          <h2>UPI IDs</h2>
          <p>Link payment IDs to the organiser shown on each event.</p>
        </div>
        {!editing && (
          <button className="button gold" onClick={() => edit()}>
            ＋ Add UPI ID
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {editing ? (
        <form
          className={styles.form}
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              let savedQr = qrId;
              if (qrFile) {
                const upload = new FormData();
                upload.set("file", qrFile);
                const response = await fetch("/api/staff/payment-qr", { method: "POST", body: upload });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error ?? "QR upload failed.");
                savedQr = result.id;
                setQrId(savedQr);
                setQrFile(undefined);
              }
              await api("/api/staff/organiser-upi", {
                id: editing === "new" ? undefined : editing.id,
                version: editing === "new" ? undefined : editing.version,
                organiser,
                payee,
                upiId: upi,
                qrId: savedQr,
              });
              setEditing(undefined);
              setRevision((value) => value + 1);
              setMessage(
                "UPI ID saved. It will be used for this organiser’s event registrations.",
              );
            } catch (failure) {
              setError((failure as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Organiser
            <select
              value={organiser}
              onChange={(event) => {
                setOrganiser(event.target.value);
                setPayee(payeeNames[event.target.value]);
              }}
              required
              disabled={busy}
            >
              {eventOrganisers.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            UPI ID
            <input
              value={upi}
              onChange={(event) => {
                const next = event.target.value;
                if (next.trim().toLowerCase() !== upi.trim().toLowerCase()) setQrId(null);
                setUpi(next);
              }}
              required
              maxLength={120}
              placeholder="name@bank"
              autoCapitalize="none"
              autoComplete="off"
              disabled={busy}
            />
          </label>
          <label className={styles.wide}>
            Payee name
            <input
              value={payee}
              onChange={(event) => setPayee(event.target.value)}
              required
              minLength={3}
              maxLength={120}
              disabled={busy}
            />
          </label>
          <div className={styles.wide}>
            <label>
              UPI QR image (optional)
              <input type="file" accept="image/jpeg,image/png" disabled={busy}
                onChange={(event) => setQrFile(event.target.files?.[0])} />
            </label>
            <p className={styles.qrHelp}>Use a JPEG or PNG up to 5 MB for this UPI ID, with no fixed amount.</p>
            {qrId && (
              <div className={styles.actions}>
                <Image unoptimized src={`/api/payment-qr/${qrId}`} alt="Saved UPI payment QR" width={104} height={104} className={styles.qr} />
                <button type="button" className="button secondary" disabled={busy} onClick={() => setQrId(null)}>Remove saved QR</button>
              </div>
            )}
          </div>
          <div className={styles.actions}>
            <button className="button" disabled={busy}>
              {busy ? "Saving…" : "Save UPI ID"}
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => setEditing(undefined)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : records ? (
        records.length ? (
          <div className={styles.records}>
            {records.map((record) => (
              <article key={record.id} className={styles.record}>
                <div>
                  <span className={styles.label}>{record.organiser}</span>
                  <strong>
                    <CopyValue value={record.details.upiId} label="UPI ID" />
                  </strong>
                  <p>{record.details.payee}</p>
                  {record.details.qrId && <p>Payment QR attached</p>}
                </div>
                <div className={styles.actions}>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => edit(record)}
                  >
                    Edit UPI ID
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        await api("/api/staff/organiser-upi", {
                          action: "archive",
                          id: record.id,
                          version: record.version,
                        });
                        setRevision((value) => value + 1);
                        setMessage("UPI ID disabled for new registrations.");
                      } catch (failure) {
                        setError((failure as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Disable
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>No organiser UPI IDs added yet.</p>
        )
      ) : (
        <p role="status">Loading UPI IDs…</p>
      )}
    </section>
  );
}
