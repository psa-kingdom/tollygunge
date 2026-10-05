"use client";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
type Row = Record<string, string | number | null>;
export function OperationsReports() {
  const [reports, setReports] = useState<Record<string, Row[] | Row>>({}),
    [message, setMessage] = useState("Loading reports…");
  useEffect(() => {
    api<typeof reports>("/api/staff/reports")
      .then(setReports)
      .then(() => setMessage(""))
      .catch((e) => setMessage(e.message));
  }, []);
  return (
    <>
      <p>
        Reports include only the domains permitted by your role. Attendance
        counts are recorded check-ins, not registration counts or accredited
        learning hours.
      </p>
      {Object.entries(reports).map(([name, value]) => {
        const rows = Array.isArray(value) ? value : [value],
          columns = Object.keys(rows[0] ?? {});
        return (
          <section className="content-section" key={name}>
            <div className="action-row">
              <h2>{name[0].toUpperCase() + name.slice(1)}</h2>
              <button
                className="button secondary"
                disabled={!rows.length}
                onClick={() => download(name, rows)}
              >
                Export CSV
              </button>
            </div>
            {rows.length === 0 ? (
              <p>No records yet.</p>
            ) : (
              <div className="table-scroll">
                <table className="operations-table">
                  <thead>
                    <tr>
                      {columns.map((c) => (
                        <th key={c}>{c.replaceAll("_", " ")}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i}>
                        {columns.map((c) => (
                          <td key={c}>{String(row[c] ?? "—")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
      <p role="status">{message}</p>
    </>
  );
}
function download(name: string, rows: Row[]) {
  const columns = Object.keys(rows[0]);
  const cell = (value: unknown) => {
    let s = String(value ?? "");
    if (/^\s*[=+\-@]|^[\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const csv = [
    columns.map(cell).join(","),
    ...rows.map((row) => columns.map((c) => cell(row[c])).join(",")),
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `tpa-${name}-report.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
