"use client";

import { useEffect, useState } from "react";
import { api } from "./operations-client";
import { rupees } from "@/domain/finance";
import styles from "./membership-payment-list.module.css";

type Payment = {
  id: string; name: string; email: string; mobile: string;
  membership_plan: string; amount_paise: number; source: string;
};
type PreviewRow = {
  row: number; name: string; email: string; mobile: string; plan: string;
  amountPaise: number; error?: string; duplicate?: boolean;
};
type Preview = { id: string; rows: PreviewRow[] };

export function MembershipPaymentList() {
  const [rows, setRows] = useState<Payment[]>();
  const [preview, setPreview] = useState<Preview>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    api<{ rows: Payment[] }>("/api/staff/membership-payment-imports")
      .then(data => { if (active) { setRows(data.rows); setError(""); } })
      .catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [revision]);
  const invalid = preview?.rows.filter(row => row.error).length ?? 0;
  const duplicates = preview?.rows.filter(row => row.duplicate).length ?? 0;
  const visible = rows?.filter(row => [row.name, row.email, row.mobile, row.membership_plan].join(" ").toLowerCase().includes(query.toLowerCase()));

  return (
    <section className={styles.workspace} aria-label="Membership payments">
      <div className={styles.importPanel}>
        <div className={styles.template}>
          <h2>Import membership payments</h2>
          <p>Start with the template, then upload your completed file.</p>
          <a className="button secondary" download="membership-payments-template.xlsx" href="/api/staff/membership-payment-imports?template=1">Download Excel template</a>
        </div>
        <form className={styles.upload} onSubmit={async event => {
          event.preventDefault();
          setBusy(true); setError(""); setMessage(""); setPreview(undefined);
          try {
            const response = await fetch("/api/staff/membership-payment-imports", {
              method: "POST", body: new FormData(event.currentTarget),
            });
            const data = await response.json();
            if (!response.ok) throw Error(data.error ?? "Unable to preview this file.");
            setPreview(data);
          } catch (failure) { setError((failure as Error).message); }
          finally { setBusy(false); }
        }}>
          <label>Payment file<input name="file" type="file" accept=".csv,.xlsx" required disabled={busy} /></label>
          <button className="button" disabled={busy}>{busy ? "Processing…" : "Preview upload"}</button>
        </form>
      <p className={styles.help}>CSV or Excel (.xlsx), up to 1,000 rows and 5 MB. Use Name, Email, Mobile, Membership plan, and Amount paid in rupees.</p>
      </div>
      {error && <p role="alert">{error} {!rows && <button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button>}</p>}
      {message && <p role="status">{message}</p>}
      {preview && <section className={styles.preview} aria-label="Import preview">
        <h2>Review payment import</h2>
        <p>{preview.rows.length} rows · {invalid} invalid · {duplicates} duplicates</p>
        <div className={styles.table}>
          <table><thead><tr><th>Row</th><th>Name</th><th>Email</th><th>Mobile</th><th>Membership plan</th><th>Amount paid</th><th>Status</th></tr></thead>
            <tbody>{preview.rows.map(row => <tr key={row.row}>
              <td>{row.row}</td><td>{row.name}</td><td>{row.email}</td><td>{row.mobile}</td><td>{row.plan}</td>
              <td>{rupees(row.amountPaise)}</td><td>{row.error ?? (row.duplicate ? "Duplicate · will be skipped" : "Ready to import")}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className={styles.actions}>
          <button className="button" disabled={busy || invalid > 0 || preview.rows.length === duplicates}
            onClick={async () => {
              setBusy(true); setError("");
              try {
                const result = await api<{ imported: number; skipped?: number; alreadyImported?: boolean }>("/api/staff/membership-payment-imports", { action: "confirm", id: preview.id });
                setMessage(result.alreadyImported ? "This file has already been imported." : `${result.imported} payments imported. ${result.skipped ?? 0} duplicates skipped.`);
                setPreview(undefined); setRevision(value => value + 1);
              } catch (failure) { setError((failure as Error).message); }
              finally { setBusy(false); }
            }}>Import payments</button>
          <button className="button secondary" disabled={busy} onClick={() => setPreview(undefined)}>Cancel preview</button>
        </div>
      </section>}
      {!rows && !error && <p role="status">Loading membership payments…</p>}
      {rows?.length === 0 && <div className={styles.empty}>
        <h2>No membership payments yet</h2>
        <p>Upload a completed template to add membership payment records.</p>
      </div>}
      {rows && rows.length > 0 && <>
        <div className={styles.actions}>
          <label>Search membership payments<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, email, mobile or plan" /></label>
          <p>{rows.length} payments · {rupees(rows.reduce((sum, row) => sum + row.amount_paise, 0))} total</p>
        </div>
        <div className={styles.table}>
          <table><thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Membership plan</th><th>Amount paid</th></tr></thead>
            <tbody>{visible?.map(row => <tr key={row.id}>
              <td>{row.name}</td><td>{row.email}</td><td>{row.mobile || "Not recorded"}</td><td>{row.membership_plan}</td><td>{rupees(row.amount_paise)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {!visible?.length && <p>No matching payments.</p>}
      </>}
    </section>
  );
}
