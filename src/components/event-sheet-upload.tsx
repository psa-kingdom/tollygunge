"use client";

import { useState } from "react";
import { api } from "./operations-client";
import type { RosterRow } from "@/domain/event-roster";
import styles from "./event-sheet-upload.module.css";

type Preview = {
  id: string;
  rows: { row: number; record: RosterRow; error?: string; action: string }[];
};

export function EventSheetUpload({
  eventKey,
  mode,
  saved,
}: {
  eventKey: string;
  mode: "registrations" | "attendance";
  saved: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<Preview>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const url =
    "/api/staff/event-sheets?" + new URLSearchParams({ eventKey, mode });
  return (
    <section className={styles.panel} aria-label={`Upload ${mode} sheet`}>
      <div className={styles.heading}>
        <div>
          <h3>Update {mode}</h3>
          <p>
            Download the current records, edit the sheet, then upload it to
            review changes.
          </p>
        </div>
        <a
          className="button secondary"
          href={url}
          download={`event-${mode}.xlsx`}
        >
          Download Excel sheet
        </a>
      </div>
      <form
        className={styles.upload}
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          setMessage("");
          setPreview(undefined);
          try {
            const response = await fetch(url, {
              method: "POST",
              body: new FormData(event.currentTarget),
            });
            const data = await response.json();
            if (!response.ok) throw Error(data.error ?? "Upload failed.");
            setPreview(data);
          } catch (failure) {
            setError((failure as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Excel or CSV file
          <input
            name="file"
            type="file"
            accept=".xlsx,.csv"
            required
            disabled={busy}
          />
        </label>
        <button className="button" disabled={busy}>
          {busy ? "Processing…" : "Preview changes"}
        </button>
      </form>
      {preview && (
        <div>
          <p>
            {preview.rows.length} rows ·{" "}
            {preview.rows.filter((row) => row.error).length} invalid
          </p>
          <div className={styles.table}>
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Name</th>
                  <th>Membership</th>
                  <th>
                    {mode === "attendance" ? "Attendance" : "Registration"}
                  </th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.row}>
                    <td>{row.row}</td>
                    <td>{row.record.name}</td>
                    <td>{row.record.plan || "Not recorded"}</td>
                    <td>
                      {mode === "attendance"
                        ? row.record.attendance
                        : row.record.registrationStatus}
                    </td>
                    <td>{row.error ?? row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.actions}>
            <button
              className="button"
              disabled={busy || preview.rows.some((row) => row.error)}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const result = await api<{
                    count?: number;
                    alreadyImported?: boolean;
                  }>("/api/staff/event-sheets", {
                    action: "confirm",
                    id: preview.id,
                  });
                  setMessage(
                    result.alreadyImported
                      ? "This sheet has already been imported."
                      : `${result.count} records updated.`,
                  );
                  setPreview(undefined);
                  await saved();
                } catch (failure) {
                  setError((failure as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirm updates
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setPreview(undefined)}
            >
              Cancel preview
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
