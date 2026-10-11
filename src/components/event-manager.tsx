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
  registration_starts_at: string | null;
  registration_ends_at: string | null;
  fee_paise: number;
  visibility: string;
  delivery_mode: string;
};
type Attendee = {
  id: string;
  name: string;
  email: string;
  status: string;
  checked_in_at: string | null;
  version: number;
  payment_status: string;
  fee_paise: number;
  mobile: string;
  membership_number: string;
};
const empty = {
  title: "",
  description: "",
  location: "",
  startsAt: "",
  endsAt: "",
  capacity: 50,
  registrationStartsAt: "",
  registrationEndsAt: "",
  feePaise: 0,
  visibility: "public",
  deliveryMode: "location",
};
export function EventManager({
  canVerifyPayments = false,
}: {
  canVerifyPayments?: boolean;
}) {
  const [events, setEvents] = useState<EventRow[]>([]),
    [selected, setSelected] = useState<EventRow | null>(null),
    [form, setForm] = useState(empty),
    [attendees, setAttendees] = useState<Attendee[]>([]),
    [message, setMessage] = useState("Loading events…"),
    [busy, setBusy] = useState(false),
    [attendeeFilter, setAttendeeFilter] = useState("all"),
    [attendeeSearch, setAttendeeSearch] = useState("");
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
            registrationStartsAt: row.registration_starts_at
              ? localDate(row.registration_starts_at)
              : "",
            registrationEndsAt: row.registration_ends_at
              ? localDate(row.registration_ends_at)
              : "",
            feePaise: row.fee_paise,
            visibility: row.visibility,
            deliveryMode: row.delivery_mode,
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
        registrationStartsAt: form.registrationStartsAt
          ? new Date(form.registrationStartsAt).toISOString()
          : null,
        registrationEndsAt: form.registrationEndsAt
          ? new Date(form.registrationEndsAt).toISOString()
          : null,
        id: selected?.id,
        version: selected?.version ?? 0,
      });
      await select(row);
      await load();
      setMessage(
        action === "publish"
          ? "Published. Eligible members can register within the booking window."
          : action === "cancel"
            ? "Event cancelled. Existing registrations remain in the history."
            : row.status === "published"
              ? "Event changes saved; registrant updates queued."
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
        registrationStartsAt: selected.registration_starts_at
          ? localDate(selected.registration_starts_at)
          : "",
        registrationEndsAt: selected.registration_ends_at
          ? localDate(selected.registration_ends_at)
          : "",
        feePaise: selected.fee_paise,
        visibility: selected.visibility,
        deliveryMode: selected.delivery_mode,
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
            {selected.visibility==='public' && <><Link className="text-link" href={`/events/${selected.id}`}>
              View published event →
            </Link>{" "}
            ·{" "}</>}
            <Link className="text-link" href="/admin/workspaces/flyers">
              Create event flyer →
            </Link>
          </p>
        )}
        <p>
          Save a draft, review the details, then publish. Paid registrations
          require manual payment verification.
        </p>
        <form
          className="member-settings"
          onSubmit={(e) => {
            e.preventDefault();
            void action("save");
          }}
        >
          <fieldset disabled={busy || selected?.status === "cancelled"}>
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
            <div className="form-grid">
              <label>
                Registration opens
                <input
                  type="datetime-local"
                  value={form.registrationStartsAt}
                  onChange={(e) =>
                    setForm({ ...form, registrationStartsAt: e.target.value })
                  }
                />
              </label>
              <label>
                Registration closes
                <input
                  type="datetime-local"
                  value={form.registrationEndsAt}
                  onChange={(e) =>
                    setForm({ ...form, registrationEndsAt: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              Location type
              <select
                value={form.deliveryMode}
                onChange={(e) =>
                  setForm({ ...form, deliveryMode: e.target.value })
                }
              >
                <option value="location">In person</option>
                <option value="online">Online</option>
              </select>
            </label>
            <label>
              Visibility
              <select
                value={form.visibility}
                onChange={(e) =>
                  setForm({ ...form, visibility: e.target.value })
                }
              >
                <option value="public">
                  Public · account required to register
                </option>
                <option value="members">Active members only</option>
              </select>
            </label>
            <label>
              Registration fee (₹; zero for free)
              <input
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                required
                value={form.feePaise / 100}
                onChange={(e) =>
                  setForm({
                    ...form,
                    feePaise: Math.round(Number(e.target.value) * 100),
                  })
                }
              />
            </label>
          </fieldset>
          <div className="action-row">
            {(!selected || selected.status !== "cancelled") && (
              <button className="button" disabled={busy}>
                {selected?.status === "published"
                  ? "Save changes & notify registrants"
                  : "Save draft"}
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
            <p>
              {attendees.length} total ·{" "}
              {
                attendees.filter(
                  (a) =>
                    a.status === "registered" &&
                    ["paid", "not_required"].includes(a.payment_status),
                ).length
              }{" "}
              confirmed ·{" "}
              {
                attendees.filter(
                  (a) =>
                    a.status === "registered" && a.payment_status === "pending",
                ).length
              }{" "}
              pending payment ·{" "}
              {attendees.filter((a) => a.status === "cancelled").length}{" "}
              cancelled
            </p>
            <div className="action-row">
              <label>
                Find attendee
                <input
                  value={attendeeSearch}
                  onChange={(e) => setAttendeeSearch(e.target.value)}
                  placeholder="Name, email, mobile or membership number"
                />
              </label>
              <label>
                Registration status
                <select
                  value={attendeeFilter}
                  onChange={(e) => setAttendeeFilter(e.target.value)}
                >
                  {["all", "confirmed", "pending", "cancelled"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              {canVerifyPayments && (
                <Link href="/admin/workspaces/payments">Verify payments →</Link>
              )}
            </div>
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
                    {attendees
                      .filter(
                        (a) =>
                          [a.name, a.email, a.mobile, a.membership_number]
                            .join(" ")
                            .toLowerCase()
                            .includes(attendeeSearch.toLowerCase()) &&
                          (attendeeFilter === "all" ||
                            (attendeeFilter === "cancelled" &&
                              a.status === "cancelled") ||
                            (attendeeFilter === "pending" &&
                              a.status === "registered" &&
                              a.payment_status === "pending") ||
                            (attendeeFilter === "confirmed" &&
                              a.status === "registered" &&
                              ["paid", "not_required"].includes(
                                a.payment_status,
                              ))),
                      )
                      .map((a) => (
                        <tr key={a.id}>
                          <td>
                            {a.name}
                            <small>
                              {a.email} · {a.mobile} · {a.membership_number}
                            </small>
                          </td>
                          <td>
                            {a.status === "cancelled"
                              ? "cancelled"
                              : ["paid", "not_required"].includes(
                                    a.payment_status,
                                  )
                                ? "confirmed"
                                : "pending payment"}
                            <small>
                              Payment: {a.payment_status} · ₹
                              {(a.fee_paise / 100).toFixed(2)}
                            </small>
                          </td>
                          <td>
                            {a.status === "registered" && (
                              <button
                                disabled={busy}
                                onClick={async () => {
                                  if (
                                    !window.confirm(
                                      `Cancel ${a.name}'s registration? Paid amounts remain recorded for refund review.`,
                                    )
                                  )
                                    return;
                                  setBusy(true);
                                  try {
                                    await api("/api/staff/registrations", {
                                      action: "cancel",
                                      id: a.id,
                                      version: a.version,
                                    });
                                    await select(selected);
                                    setMessage(
                                      "Registration cancelled; member notification queued.",
                                    );
                                  } catch (e) {
                                    setMessage((e as Error).message);
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                              >
                                Cancel registration
                              </button>
                            )}
                            {a.checked_in_at ? (
                              "Checked in"
                            ) : (
                              <button
                                disabled={
                                  busy ||
                                  a.status !== "registered" ||
                                  !["paid", "not_required"].includes(
                                    a.payment_status,
                                  ) ||
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
