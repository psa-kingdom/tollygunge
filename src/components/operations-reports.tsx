"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "./operations-client";
type Row = Record<string, string | number | null>;
export function OperationsReports() {
  const [reports, setReports] = useState<Record<string, Row[] | Row>>({}),
    [message, setMessage] = useState("Loading reports…");
  const [busy, setBusy] = useState(true);
  const [applied, setApplied] = useState({ from: "", to: "" });
  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const range = {
      from: String(data.get("from") || ""),
      to: String(data.get("to") || ""),
    };
    setBusy(true);
    setMessage("Loading reports…");
    setReports({});
    try {
      const result = await api<typeof reports>(
        `/api/staff/reports?${new URLSearchParams(range)}`,
      );
      setReports(result);
      setApplied(range);
      setMessage("");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    api<typeof reports>("/api/staff/reports")
      .then((result) => {
        if (active) {
          setReports(result);
          setMessage("");
        }
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <p>
        Reports include only the domains permitted by your role. Attendance
        counts are recorded check-ins, not registration counts or accredited
        learning hours.
      </p>
      <form className="member-settings" onSubmit={apply}>
        <fieldset className="plain-fieldset" disabled={busy}>
          <legend>Reporting period</legend>
          <label>
            From
            <input type="date" name="from" />
          </label>
          <label>
            Through
            <input type="date" name="to" />
          </label>
          <button className="button" type="submit">
            Apply period
          </button>
        </fieldset>
      </form>
      <p>
        Applied period: {applied.from || "All dates"} through{" "}
        {applied.to || "no end date"}. Dates use India time. Events use their
        start date (latest 200); inquiries use their received date. Content and
        newsletter totals show the current state.
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
                onClick={() => download(name, rows, applied)}
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
function download(
  name: string,
  rows: Row[],
  range: { from: string; to: string },
) {
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
  a.download = `tpa-${name}-${range.from || "all"}-${range.to || "all"}-report.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
