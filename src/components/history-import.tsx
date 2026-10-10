"use client";
import { useState } from "react";
import { api } from "./operations-client";
import type { HistoryRow } from "@/domain/history-import";
type Preview = {
  filename: string;
  rows: HistoryRow[];
  total: number;
  valid: number;
  mapping: string;
  notice: string;
};
export function HistoryImport() {
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <p>
        Validate a proposed attendance CSV against existing identities, events
        and attendance. Ambiguous people and duplicates are flagged; no records
        are committed.
      </p>
      <a
        className="button secondary"
        download="tpa-attendance-template.csv"
        href="data:text/csv;charset=utf-8,email%2Cevent_id%2Cattended_at%0A"
      >
        Download CSV template
      </a>
      <p>
        Headers: email, event_id, attended_at. Timestamps need a timezone, for
        example 2025-01-01T10:00:00+05:30. Maximum 500 rows and 1 MB.
      </p>
      <form
        className="member-settings"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!file) return;
          setBusy(true);
          setPreview(null);
          try {
            if (file.size > 1000000)
              throw new Error("Choose a CSV no larger than 1 MB.");
            setPreview(
              await api<Preview>("/api/staff/imports", {
                action: "preview",
                filename: file.name,
                csv: await file.text(),
              }),
            );
            setMessage("Preview complete. Nothing was imported.");
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "Preview failed.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Historical CSV
          <input
            type="file"
            accept=".csv,text/csv"
            required
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
            }}
          />
        </label>
        <button className="button" disabled={busy || !file}>
          Preview & validate
        </button>
      </form>
      <p role="status">{message}</p>
      {preview && (
        <>
          <div className="notice">{preview.notice}</div>
          <p>
            {preview.filename} · {preview.valid} valid of {preview.total} rows
          </p>
          <p>{preview.mapping}</p>
          <div className="table-scroll">
            <table className="operations-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Email</th>
                  <th>Event</th>
                  <th>Attendance</th>
                  <th>Validation</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.line}>
                    <td>{row.line}</td>
                    <td>{row.email}</td>
                    <td>{row.eventId}</td>
                    <td>{row.attendedAt}</td>
                    <td>
                      {row.errors.length
                        ? row.errors.join(" ")
                        : "Valid for proposed mapping"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
