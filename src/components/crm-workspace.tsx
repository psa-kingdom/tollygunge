"use client";
import { useState, useEffect } from "react";
import { api } from "./operations-client";
type Inquiry = {
  id: string;
  version: number;
  subject: string;
  message: string;
  name: string;
  email: string;
  status: string;
  assigned_to: string | null;
  follow_up_at: string | null;
  notes: { id: string; body: string; created_at: string }[];
};
type Data = { records: Inquiry[]; assignees: { id: string; name: string }[] };
export function CrmWorkspace() {
  const [data, setData] = useState<Data>({ records: [], assignees: [] }),
    [selected, setSelected] = useState<Inquiry | null>(null),
    [status, setStatus] = useState("open"),
    [assigned, setAssigned] = useState(""),
    [due, setDue] = useState(""),
    [note, setNote] = useState(""),
    [filter, setFilter] = useState("active"),
    [message, setMessage] = useState("Loading inquiries…"),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Data>("/api/staff/crm")
      .then(setData)
      .then(() => setMessage(""))
      .catch((e) => setMessage(e.message));
  }, []);
  function select(row: Inquiry) {
    setSelected(row);
    setStatus(row.status);
    setAssigned(row.assigned_to ?? "");
    setDue(
      row.follow_up_at
        ? new Date(row.follow_up_at).toISOString().slice(0, 10)
        : "",
    );
    setNote("");
    setMessage("");
  }
  return (
    <>
      <div className="action-row">
        <label>
          Show{" "}
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="active">Active inquiries</option>
            <option value="overdue">Overdue follow-ups</option>
            <option value="all">All inquiries</option>
          </select>
        </label>
      </div>
      <div className="operations-layout">
        <aside className="record-list">
          {data.records
            .filter(
              (row) =>
                filter === "all" ||
                (row.status !== "resolved" &&
                  (filter !== "overdue" ||
                    (row.follow_up_at &&
                      new Date(row.follow_up_at) < new Date()))),
            )
            .map((row) => (
              <button
                key={row.id}
                className={row.id === selected?.id ? "selected" : ""}
                onClick={() => select(row)}
              >
                <strong>{row.subject}</strong>
                <small>
                  {row.name} · {row.status.replaceAll("_", " ")}
                  {row.follow_up_at &&
                  row.status !== "resolved" &&
                  new Date(row.follow_up_at) < new Date()
                    ? " · Follow-up overdue"
                    : ""}
                </small>
              </button>
            ))}
          {data.records.length === 0 && <p>No inquiries yet.</p>}
        </aside>
        <section>
          {selected ? (
            <>
              <h2>{selected.subject}</h2>
              <p>
                {selected.name} · {selected.email}
              </p>
              <p className="prose-text">{selected.message}</p>
              <form
                className="member-settings"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    await api("/api/staff/crm", {
                      id: selected.id,
                      version: selected.version,
                      status,
                      assignedTo: assigned,
                      followUpAt: due ? `${due}T09:00:00+05:30` : null,
                      note,
                    });
                    const refreshed = await api<Data>("/api/staff/crm");
                    setData(refreshed);
                    const row = refreshed.records.find(
                      (r) => r.id === selected.id,
                    );
                    if (row) select(row);
                    setMessage("Assignment, follow-up and note saved.");
                  } catch (error) {
                    setMessage(
                      error instanceof Error ? error.message : "Save failed.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Status
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </label>
                <label>
                  Assigned to
                  <select
                    value={assigned}
                    onChange={(e) => setAssigned(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {data.assignees.map((a) => (
                      <option value={a.id} key={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Follow-up date (09:00 India time)
                  <input
                    type="date"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </label>
                <label>
                  Add staff note
                  <textarea
                    maxLength={2000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <button className="button" disabled={busy}>
                  Save follow-up
                </button>
              </form>
              <h3>Staff notes</h3>
              {selected.notes.length === 0 && <p>No staff notes.</p>}
              {selected.notes.map((n) => (
                <article className="content-section" key={n.id}>
                  <p className="prose-text">{n.body}</p>
                  <small>
                    {new Date(n.created_at).toLocaleString("en-IN")}
                  </small>
                </article>
              ))}
            </>
          ) : (
            <p>
              Select an inquiry to assign it, record a note or schedule a
              follow-up. Notes are private to authorized staff.
            </p>
          )}
          <p role="status">{message}</p>
        </section>
      </div>
    </>
  );
}
