"use client";
import { useState, useEffect } from "react";
import { api } from "./operations-client";
import Link from "next/link";
type EventRow = {
  id: string;
  version: number;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  status: string;
  registrations: number;
};
type Attendee = {
  id: string;
  name: string;
  email: string;
  status: string;
  checked_in_at: string | null;
};
const empty = {
  title: "",
  description: "",
  location: "",
  startsAt: "",
  endsAt: "",
  capacity: 50,
};
export function EventManager() {
  const [events, setEvents] = useState<EventRow[]>([]),
    [selected, setSelected] = useState<EventRow | null>(null),
    [form, setForm] = useState(empty),
    [attendees, setAttendees] = useState<Attendee[]>([]),
    [message, setMessage] = useState("Loading events…"),
    [busy, setBusy] = useState(false);
  async function load() {
    setEvents(await api<EventRow[]>("/api/staff/events"));
  }
  useEffect(() => {
    api<EventRow[]>("/api/staff/events" + (location.search || ""))
      .then((rows) => {
        setEvents(rows);
        const id = new URLSearchParams(location.search).get("id");
        const row = rows.find((r) => r.id === id);
        if (row) void select(row);
      })
      .then(() => setMessage(""))
      .catch((e) => setMessage(e.message));
  }, []);
  async function select(row: EventRow | null) {
    setSelected(row);
    setForm(
      row
        ? {
            title: row.title,
            description: row.description,
            location: row.location,
            startsAt: localDate(row.starts_at),
            endsAt: localDate(row.ends_at),
            capacity: row.capacity,
          }
        : empty,
    );
    setAttendees([]);
    setMessage("");
    if (row)
      try {
        setAttendees(
          await api<Attendee[]>(`/api/staff/attendance?eventId=${row.id}`),
        );
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Load failed.");
      }
  }
  async function action(action: string) {
    setBusy(true);
    try {
      const row = await api<EventRow>("/api/staff/events", {
        action,
        ...form,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        id: selected?.id,
        version: selected?.version ?? 0,
      });
      await select(row);
      await load();
      setMessage(
        action === "publish"
          ? "Published. Account holders can register without payment."
          : action === "cancel"
            ? "Event cancelled. Existing registrations remain in the history."
            : "Event draft saved.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  const unsaved =
    selected &&
    JSON.stringify(form) !==
      JSON.stringify({
        title: selected.title,
        description: selected.description,
        location: selected.location,
        startsAt: localDate(selected.starts_at),
        endsAt: localDate(selected.ends_at),
        capacity: selected.capacity,
      });
  return (
    <div className="operations-layout">
      <aside className="record-list">
        <button className="button secondary" onClick={() => void select(null)}>
          New event
        </button>
        {events.length === 0 && <p>No events yet.</p>}
        {events.map((row) => (
          <button
            key={row.id}
            className={row.id === selected?.id ? "selected" : ""}
            onClick={() => void select(row)}
          >
            <strong>{row.title}</strong>
            <small>
              {row.status} · {new Date(row.starts_at).toLocaleString("en-IN")}
            </small>
          </button>
        ))}
      </aside>
      <section>
        <h2>{selected ? selected.title : "Create event"}</h2>
        {selected?.status === "published" && (
          <p>
            <Link className="text-link" href={`/events/${selected.id}`}>
              View published event →
            </Link>{" "}
            ·{" "}
            <Link className="text-link" href="/admin/workspaces/flyers">
              Create event flyer →
            </Link>
          </p>
        )}
        <p>
          Free registration is available. Paid events and learning-hour awards
          await approved configuration.
        </p>
        <form
          className="member-settings"
          onSubmit={(e) => {
            e.preventDefault();
            void action("save");
          }}
        >
          <fieldset disabled={selected?.status !== "draft" && !!selected}>
            <legend>Event details</legend>
            <label>
              Title
              <input
                required
                minLength={3}
                maxLength={160}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                maxLength={6000}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <label>
              Venue / joining instructions
              <input
                required
                maxLength={200}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                Starts (your local time)
                <input
                  type="datetime-local"
                  required
                  value={form.startsAt}
                  onChange={(e) =>
                    setForm({ ...form, startsAt: e.target.value })
                  }
                />
              </label>
              <label>
                Ends (your local time)
                <input
                  type="datetime-local"
                  required
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                />
              </label>
            </div>
            <label>
              Capacity
              <input
                type="number"
                min={1}
                max={10000}
                required
                value={form.capacity}
                onChange={(e) =>
                  setForm({ ...form, capacity: Number(e.target.value) })
                }
              />
            </label>
          </fieldset>
          <div className="action-row">
            {(!selected || selected.status === "draft") && (
              <button className="button" disabled={busy}>
                Save draft
              </button>
            )}
            {selected?.status === "draft" && (
              <button
                type="button"
                className="button secondary"
                disabled={busy || !!unsaved}
                onClick={() => void action("publish")}
              >
                Publish saved event
              </button>
            )}
            {selected && selected.status !== "cancelled" && (
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Cancel this event? Existing registrations and attendance will remain in history.",
                    )
                  )
                    void action("cancel");
                }}
              >
                Cancel event
              </button>
            )}
          </div>
        </form>
        {selected && (
          <>
            <h2>Registrations & attendance</h2>
            <p>
              {attendees.filter((a) => a.status === "registered").length} active
              registrations · {attendees.filter((a) => a.checked_in_at).length}{" "}
              checked in. Check-in opens at the event start time.
            </p>
            {attendees.length === 0 ? (
              <p>No registrations yet.</p>
            ) : (
              <div className="table-scroll">
                <table className="operations-table">
                  <thead>
                    <tr>
                      <th>Registrant</th>
                      <th>Registration</th>
                      <th>Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendees.map((a) => (
                      <tr key={a.id}>
                        <td>
                          {a.name}
                          <small>{a.email}</small>
                        </td>
                        <td>{a.status}</td>
                        <td>
                          {a.checked_in_at ? (
                            "Checked in"
                          ) : (
                            <button
                              disabled={
                                busy ||
                                a.status !== "registered" ||
                                selected.status !== "published" ||
                                new Date(selected.starts_at) > new Date()
                              }
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await api("/api/staff/attendance", {
                                    registrationId: a.id,
                                  });
                                  await select(selected);
                                  setMessage(
                                    "Attendance recorded once. No learning hours awarded.",
                                  );
                                } catch (e) {
                                  setMessage(
                                    e instanceof Error
                                      ? e.message
                                      : "Check-in failed.",
                                  );
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              Check in
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        <p role="status">{message}</p>
      </section>
    </div>
  );
}
function localDate(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
