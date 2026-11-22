"use client";
import { useSearchParams } from "next/navigation";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "./operations-client";
import { StatusBadge } from "./portal-values";
import { disabledReminders, istInput, istInstant } from "@/domain/event-flow";
import type { WorkbookEvent } from "@/lib/workbook-attendance";
import { historicalAttendanceAvailable } from "@/domain/historical-event-details";
import styles from "./events-workspace.module.css";

type Event = {
  id: string;
  version: number;
  title: string;
  description: string;
  has_banner?: boolean;
  location: string;
  starts_at: string;
  ends_at: string;
  status: string;
  registrations: number;
  capacity: number;
  fee_paise: number;
  visibility: string;
  delivery_mode: string;
  registration_starts_at: string | null;
  registration_ends_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
};
type Participant = {
  id: string;
  name: string;
  email: string;
  membership_number: string;
  status: string;
  payment_status: string;
  checked_in_at: string | null;
  outcome?: string;
  mobile?: string;
  fee_paise: number;
  registered_at: string;
  payment_method?: string | null;
  payment_reference?: string | null;
  receipt_source?: string | null;
  receipt_status?: string | null;
};
type Entry = {
  key: string;
  title: string;
  date: string;
  location: string;
  status: string;
  count: number;
  live?: Event;
  historical?: WorkbookEvent;
};
const dateLabel = (value: string, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  }).format(new Date(value));
const status = (event: Event) =>
  event.archived_at
    ? "Archived"
    : event.completed_at
      ? "Completed"
      : event.status === "cancelled"
        ? "Cancelled"
        : event.status === "draft"
          ? "Draft"
          : new Date(event.ends_at) < new Date()
            ? "Past"
            : "Upcoming";

function Popup({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="event-popup-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const bounds = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < bounds.left ||
            e.clientX > bounds.right ||
            e.clientY < bounds.top ||
            e.clientY > bounds.bottom
          )
            close();
        }
      }}
    >
      <header className={styles.modalHeader}>
        <h2 id="event-popup-title">{title}</h2>
        <button type="button" onClick={close} aria-label="Close popup">
          ✕
        </button>
      </header>
      {children}
    </dialog>
  );
}

export function EventsWorkspace({
  historicalEvents,
}: {
  historicalEvents: WorkbookEvent[];
}) {
  const params = useSearchParams();
  const linkedId = params.get("id") || params.get("eventId") || params.get("eventDate");
  const openedLink = useRef<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  const [view, setView] = useState<"cards" | "list">("cards");
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All events");
  const [selected, setSelected] = useState<Entry | null>(null),
    [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      setEvents(await api<Event[]>("/api/staff/events"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);
  const entries: Entry[] = [
    ...events.map((live) => ({
      key: live.id,
      title: live.title,
      date: live.starts_at,
      location: live.location,
      status: status(live),
      count: live.registrations,
      live,
    })),
    ...historicalEvents.map((historical) => ({
      key: historical.date,
      title: historical.title || "Association event",
      date: `${historical.date}T12:00:00+05:30`,
      location: historical.location || "",
      status: "Past",
      count: historical.rows.length,
      historical,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const visible = entries.filter(
    (e) =>
      (filter === "All events" || e.status === filter) &&
      `${e.title} ${e.location} ${dateLabel(e.date)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  // Keep existing links to an individual event or historical register useful.
  useEffect(() => {
    if (!loaded || openedLink.current === linkedId) return;
    openedLink.current = linkedId;
    const id = linkedId;
    if (id) {
      const live = events.find((e) => e.id === id),
        historical = historicalEvents.find((e) => e.date === id);
      if (live)
        queueMicrotask(() =>
          setSelected({
            key: live.id,
            title: live.title,
            date: live.starts_at,
            location: live.location,
            status: status(live),
            count: live.registrations,
            live,
          }),
        );
      else if (historical)
        queueMicrotask(() =>
          setSelected({
            key: historical.date,
            title: historical.title || "Association event",
            date: `${historical.date}T12:00:00+05:30`,
            location: historical.location || "",
            status: "Past",
            count: historical.rows.length,
            historical,
          }),
        );
    }
  }, [loaded, linkedId, events, historicalEvents]);
  return (
    <section className={styles.workspace}>
      <header className={styles.heading}>
        <div>
          <h1>Events</h1>
          <p>Create an event. Keep participants and attendance in one place.</p>
        </div>
        <button
          className="button gold"
          onClick={() => {
            setNotice("");
            setCreating(true);
          }}
        >
          <span aria-hidden="true">＋</span> Create new event
        </button>
      </header>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <span className={styles.srOnly}>Search events</span>
          <input
            type="search"
            placeholder="Search events…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          <span className={styles.srOnly}>Filter events</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {[
              "All events",
              "Upcoming",
              "Draft",
              "Past",
              "Completed",
              "Cancelled",
              "Archived",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <div className={styles.viewToggle} role="group" aria-label="Event view">
          <button
            aria-pressed={view === "cards"}
            onClick={() => setView("cards")}
          >
            <span aria-hidden="true">▦</span> Cards
          </button>
          <button
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <span aria-hidden="true">☰</span> List
          </button>
        </div>
      </div>
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <button onClick={() => void load()}>Retry loading events</button>
        </p>
      )}
      <div className={styles.collectionHeading}>
        <h2>{filter}</h2>
        <span role="status">
          {visible.length} {visible.length === 1 ? "event" : "events"}
        </span>
      </div>
      {!loaded && <p role="status">Loading events…</p>}
      {loaded && !visible.length && (
        <div className={styles.empty}>
          <h3>
            {entries.length
              ? "No matching events"
              : "Your next event starts here"}
          </h3>
          <p>
            {entries.length
              ? "Try another search or choose All events."
              : "Create an event with a title, date and venue. You can add more details later."}
          </p>
          {entries.length ? (
            <button
              className="button secondary"
              onClick={() => {
                setSearch("");
                setFilter("All events");
              }}
            >
              Clear filters
            </button>
          ) : (
            <button className="button gold" onClick={() => setCreating(true)}>
              Create new event
            </button>
          )}
        </div>
      )}
      <div className={view === "cards" ? styles.cards : styles.list}>
        {visible.map((entry) => (
          <button
            className={styles.event}
            key={entry.key}
            onClick={() => setSelected(entry)}
            aria-label={`View ${entry.title}`}
          >
            <span className={styles.dateTile}>
              <span>
                {dateLabel(entry.date, {
                  month: "short",
                  day: undefined,
                  year: undefined,
                })}
              </span>
              <strong>
                {dateLabel(entry.date, {
                  day: "2-digit",
                  month: undefined,
                  year: undefined,
                })}
              </strong>
            </span>
            <span className={styles.eventContent}>
              <StatusBadge
                tone={
                  entry.status === "Upcoming"
                    ? "success"
                    : entry.status === "Draft"
                      ? "pending"
                      : "neutral"
                }
              >
                {entry.status}
              </StatusBadge>
              <strong className={styles.eventTitle}>{entry.title}</strong>
              <span className={styles.meta}>
                {dateLabel(entry.date)}
                {entry.live &&
                  ` · ${new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }).format(new Date(entry.date))} IST`}
              </span>
              <span className={styles.venue}>
                {entry.location || "Venue not recorded"}
              </span>
            </span>
            <span className={styles.cardFooter}>
              <span>
                {entry.historical &&
                !historicalAttendanceAvailable(entry.historical)
                  ? "Attendance unavailable"
                  : `${entry.count} ${entry.count === 1 ? "participant" : "participants"}`}
              </span>
              <span className={styles.open}>
                View details <span aria-hidden="true">↗</span>
              </span>
            </span>
          </button>
        ))}
      </div>
      {creating && (
        <Popup title="Create new event" close={() => setCreating(false)}>
          <EventForm
            close={() => setCreating(false)}
            saved={async () => {
              setCreating(false);
              setNotice("Event draft created. Open it to review and publish.");
              await load();
            }}
          />
        </Popup>
      )}
      {selected && (
        <EventDetails
          key={selected.key}
          entry={selected}
          close={() => setSelected(null)}
          refresh={load}
        />
      )}
    </section>
  );
}

function EventForm({
  event,
  saved,
  close,
}: {
  event?: Event;
  saved: () => Promise<void>;
  close: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className={styles.form}
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          const payload = {
            action: "save",
            id: event?.id,
            version: event?.version ?? 0,
            title: data.get("title"),
            description: data.get("description"),
            location: data.get("location"),
            startsAt: istInstant(String(data.get("startsAt"))),
            endsAt: istInstant(String(data.get("endsAt"))),
            capacity: Number(data.get("capacity")),
            visibility: data.get("visibility"),
            deliveryMode: data.get("deliveryMode"),
            feePaise: event?.fee_paise ?? 0,
            registrationStartsAt: event?.registration_starts_at ?? null,
            registrationEndsAt: event?.registration_ends_at ?? null,
            removeBanner: data.get("removeBanner") === "on",
            ...(!event
              ? {
                  reminders: disabledReminders,
                  speakers: [],
                  paymentAccountIds: [],
                }
              : {}),
          };
          const banner = data.get("banner");
          if (banner instanceof File && banner.size) {
            if (banner.size > 2097152)
              throw new Error("Choose a banner up to 2 MB.");
            const upload = new FormData();
            upload.set("details", JSON.stringify(payload));
            upload.set("banner", banner);
            const response = await fetch("/api/staff/events", { method: "POST", body: upload });
            if (!response.ok) {
              const result = await response.json().catch(() => null);
              throw new Error(result?.error || "Could not save the event banner.");
            }
          } else {
            await api("/api/staff/events", payload);
          }
          await saved();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        {event
          ? "Update the event details below."
          : "Start with the essentials. Your event will be saved as a draft."}
      </p>
      <fieldset disabled={busy} className={styles.fields}>
        <label>
          Event title
          <input
            autoFocus
            name="title"
            required
            minLength={3}
            maxLength={160}
            defaultValue={event?.title}
            placeholder="e.g. Annual members’ meet"
          />
        </label>
        <div className={styles.twoColumns}>
          <label>
            Starts · IST
            <input
              name="startsAt"
              type="datetime-local"
              required
              defaultValue={event ? istInput(event.starts_at) : ""}
            />
          </label>
          <label>
            Ends · IST
            <input
              name="endsAt"
              type="datetime-local"
              required
              defaultValue={event ? istInput(event.ends_at) : ""}
            />
          </label>
        </div>
        <label>
          Venue or meeting link
          <input
            name="location"
            required
            maxLength={200}
            defaultValue={event?.location}
            placeholder="Where will the event take place?"
          />
        </label>
        <label>
          <span>Display image or banner <span className={styles.optional}>(optional)</span></span>
          <input name="banner" type="file" accept="image/jpeg,image/png" />
          <small>JPEG or PNG, up to 2 MB. A wide image works best.</small>
        </label>
        {event?.has_banner && (
          <label>
            <span><input type="checkbox" name="removeBanner" /> Remove current banner</span>
          </label>
        )}
        <label>
          <span>
            Description <span className={styles.optional}>(optional)</span>
          </span>
          <textarea
            name="description"
            maxLength={6000}
            defaultValue={event?.description}
            rows={3}
            placeholder="What should participants know?"
          />
        </label>
        <details className={styles.options}>
          <summary>Booking settings</summary>
          <p>
            New events are free, open to everyone with an account, and allow 50
            participants.
          </p>
          <div className={styles.twoColumns}>
            <label>
              Participant limit
              <input
                name="capacity"
                type="number"
                required
                min={1}
                max={10000}
                defaultValue={event?.capacity ?? 50}
              />
            </label>
            <label>
              Event type
              <select
                name="deliveryMode"
                defaultValue={event?.delivery_mode ?? "location"}
              >
                <option value="location">In person</option>
                <option value="online">Online</option>
              </select>
            </label>
          </div>
          <label>
            Who can register?
            <select
              name="visibility"
              defaultValue={event?.visibility ?? "public"}
            >
              <option value="public">Anyone with an account</option>
              <option value="members">Active members only</option>
            </select>
          </label>
        </details>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <footer className={styles.actions}>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={close}
        >
          Cancel
        </button>
        <button className="button gold" disabled={busy}>
          {busy ? "Saving…" : event ? "Save changes" : "Create event"}
        </button>
      </footer>
    </form>
  );
}

function EventDetails({
  entry,
  close,
  refresh,
}: {
  entry: Entry;
  close: () => void;
  refresh: () => Promise<void>;
}) {
  const [event, setEvent] = useState(entry.live),
    [tab, setTab] = useState("Details"),
    [editing, setEditing] = useState(false);
  const [attendees, setAttendees] = useState<Participant[]>([]),
    [loaded, setLoaded] = useState(!entry.live);
  const [query, setQuery] = useState(""),
    [attendance, setAttendance] = useState("All participants");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!entry.live) return;
    setError("");
    try {
      const [events, participants] = await Promise.all([
        api<Event[]>(`/api/staff/events?id=${entry.live.id}`),
        api<Participant[]>(`/api/staff/attendance?eventId=${entry.live.id}`),
      ]);
      setEvent(events[0]);
      setAttendees(participants);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, [entry.live]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);
  const attendanceUnavailable =
    entry.historical && !historicalAttendanceAvailable(entry.historical);
  const rows = entry.historical
    ? entry.historical.rows.map((r, i) => ({
        id: String(i),
        name: r.name,
        email: r.email,
        number: r.number,
        phone: r.mobile,
        organisation: r.organisation,
        attendance: r.status,
      }))
    : attendees.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        number: r.membership_number,
        phone: r.mobile || "",
        organisation: "",
        attendance:
          r.checked_in_at || r.outcome === "attended"
            ? "Attended"
            : r.outcome === "absent"
              ? "Not attended"
              : "Not recorded",
        live: r,
      }));
  const filtered = rows.filter(
    (r) =>
      `${r.name} ${r.email} ${r.number} ${r.phone} ${r.organisation}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (attendance === "All participants" || r.attendance === attendance),
  );
  const frozen =
    event &&
    (event.status === "cancelled" || event.completed_at || event.archived_at);
  return (
    <Popup
      title={editing ? "Edit event" : event?.title || entry.title}
      close={close}
    >
      {editing && event ? (
        <EventForm
          event={event}
          close={() => setEditing(false)}
          saved={async () => {
            await load();
            await refresh();
            setEditing(false);
          }}
        />
      ) : (
        <>
          <div className={styles.modalMeta}>
            <StatusBadge>{event ? status(event) : entry.status}</StatusBadge>
            <span>{dateLabel(event?.starts_at || entry.date)}</span>
            <span>
              {attendanceUnavailable
                ? "Attendance unavailable"
                : `${rows.length} participants`}
            </span>
          </div>
          <div
            className={styles.tabs}
            role="group"
            aria-label="Event details sections"
          >
            {["Details", "Participants & attendance"].map((t) => (
              <button
                key={t}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className={styles.modalBody}>
            {error && (
              <p role="alert">
                {error} <button onClick={() => void load()}>Retry</button>
              </p>
            )}
            {tab === "Details" ? (
              <>
                {event?.has_banner && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={styles.banner} src={`/api/event-banners/${event.id}?v=${event.version}`} alt="" />
                )}
                <dl className={styles.details}>
                  <div>
                    <dt>Date & time</dt>
                    <dd>
                      {dateLabel(event?.starts_at || entry.date)}
                      {event && (
                        <>
                          <br />
                          {new Intl.DateTimeFormat("en-IN", {
                            timeZone: "Asia/Kolkata",
                            hour: "numeric",
                            minute: "2-digit",
                          }).format(new Date(event.starts_at))}{" "}
                          –{" "}
                          {dateLabel(event.ends_at, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}{" "}
                          IST
                        </>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Venue</dt>
                    <dd>
                      {event?.location || entry.location || "Not recorded"}
                    </dd>
                  </div>
                  {event && (
                    <>
                      <div>
                        <dt>Capacity</dt>
                        <dd>
                          {event.registrations ?? entry.count} /{" "}
                          {event.capacity} registered
                        </dd>
                      </div>
                      <div>
                        <dt>Registration fee</dt>
                        <dd>
                          {event.fee_paise
                            ? `₹${(event.fee_paise / 100).toLocaleString("en-IN")}`
                            : "Free"}
                        </dd>
                      </div>
                    </>
                  )}
                  {entry.historical?.speakers && (
                    <div>
                      <dt>Speakers</dt>
                      <dd>{entry.historical.speakers}</dd>
                    </div>
                  )}
                </dl>
                {event && (
                  <p className={styles.note}>
                    Event format:{" "}
                    {event.delivery_mode === "online" ? "Online" : "In person"}.
                    Individual participation mode is not recorded separately.
                  </p>
                )}
                {(event?.description || entry.historical?.description) && (
                  <section className={styles.description}>
                    <h3>About this event</h3>
                    <p>{event?.description || entry.historical?.description}</p>
                  </section>
                )}
                {event && !frozen && (
                  <footer className={styles.actions}>
                    <button
                      className="button secondary"
                      disabled={!loaded || busy}
                      onClick={() => setEditing(true)}
                    >
                      Edit event
                    </button>
                    {event.status === "draft" && (
                      <button
                        className="button gold"
                        disabled={!loaded || busy}
                        onClick={async () => {
                          setBusy(true);
                          setError("");
                          try {
                            await api("/api/staff/events", {
                              action: "publish",
                              id: event.id,
                              version: event.version,
                            });
                            await load();
                            await refresh();
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {busy ? "Publishing…" : "Publish event"}
                      </button>
                    )}
                  </footer>
                )}
              </>
            ) : attendanceUnavailable ? (
              <div className={styles.empty} role="status">
                <h3>Attendance records unavailable</h3>
                <p>
                  The attendance register for this event is not connected.
                  Participant details and attendance totals cannot be shown
                  until the register is restored.
                </p>
              </div>
            ) : (
              <>
                <div className={styles.attendanceSummary}>
                  <strong>
                    {rows.filter((r) => r.attendance === "Attended").length}
                    <span>Attended</span>
                  </strong>
                  <strong>
                    {rows.filter((r) => r.attendance === "Not attended").length}
                    <span>Not attended</span>
                  </strong>
                  <strong>
                    {rows.filter((r) => r.attendance === "Not recorded").length}
                    <span>Not recorded</span>
                  </strong>
                </div>
                <div className={styles.participantFilters}>
                  <label>
                    <span className={styles.srOnly}>Search participants</span>
                    <input
                      type="search"
                      placeholder="Search name, email or member number…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <label>
                    <span className={styles.srOnly}>Attendance status</span>
                    <select
                      value={attendance}
                      onChange={(e) => setAttendance(e.target.value)}
                    >
                      {[
                        "All participants",
                        "Attended",
                        "Not attended",
                        "Not recorded",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {!loaded ? (
                  <p role="status">Loading participants…</p>
                ) : !filtered.length ? (
                  <div className={styles.empty}>
                    <h3>
                      {rows.length
                        ? "No matching participants"
                        : "No participants yet"}
                    </h3>
                    <p>
                      {rows.length
                        ? "Try another search or attendance status."
                        : entry.historical
                          ? "Participant records have not been added for this event."
                          : "Registrations will appear here once people sign up."}
                    </p>
                  </div>
                ) : (
                  <div
                    className={styles.tableWrap}
                    role="region"
                    aria-label="Event participants"
                    tabIndex={0}
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Participant</th>
                          <th>Registration</th>
                          <th>Attendance</th>
                          <th>Payment</th>
                          {event && <th>Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <strong>{r.name}</strong>
                              <small>{r.email}</small>
                              {r.phone && <small>{r.phone}</small>}
                              {r.organisation && (
                                <small>{r.organisation}</small>
                              )}
                              <small>
                                Member no. {r.number || "Not recorded"}
                              </small>
                            </td>
                            <td>
                              {"live" in r && r.live ? (
                                <>
                                  {r.live.status}
                                  <small>
                                    {dateLabel(r.live.registered_at)}
                                  </small>
                                </>
                              ) : (
                                <>
                                  Historical register
                                  <small>Registration mode: not recorded</small>
                                </>
                              )}
                            </td>
                            <td>{r.attendance}</td>
                            <td>
                              {"live" in r && r.live ? (
                                <>
                                  {r.live.payment_status === "not_required"
                                    ? "Free"
                                    : r.live.payment_status.replaceAll(
                                        "_",
                                        " ",
                                      )}
                                  <small>
                                    Fee: ₹
                                    {(r.live.fee_paise / 100).toLocaleString(
                                      "en-IN",
                                    )}
                                  </small>
                                  {r.live.payment_method && (
                                    <small>
                                      Method: {r.live.payment_method}
                                    </small>
                                  )}
                                  {r.live.payment_reference && (
                                    <small>
                                      Reference: {r.live.payment_reference}
                                    </small>
                                  )}
                                  {r.live.receipt_source && (
                                    <small>
                                      {r.live.receipt_source === "member"
                                        ? "Receipt uploaded by participant"
                                        : r.live.receipt_source === "admin"
                                          ? "Receipt entered by staff"
                                          : "Legacy receipt"}
                                    </small>
                                  )}
                                </>
                              ) : (
                                "Not recorded"
                              )}
                            </td>
                            {event && (
                              <td>
                                {"live" in r && r.live && (
                                  <button
                                    disabled={
                                      busy ||
                                      !!frozen ||
                                      event.status !== "published" ||
                                      new Date(event.starts_at) > new Date() ||
                                      r.live.status !== "registered" ||
                                      !["paid", "not_required"].includes(
                                        r.live.payment_status,
                                      ) ||
                                      r.attendance === "Attended"
                                    }
                                    onClick={async () => {
                                      setBusy(true);
                                      setError("");
                                      try {
                                        await api("/api/staff/attendance", {
                                          registrationId: r.id,
                                        });
                                        await load();
                                      } catch (e) {
                                        setError((e as Error).message);
                                      } finally {
                                        setBusy(false);
                                      }
                                    }}
                                  >
                                    {r.attendance === "Attended"
                                      ? "Checked in"
                                      : "Check in"}
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {event && (
                  <p className={styles.note}>
                    Check-in is available from the event start time for
                    confirmed registrations.
                  </p>
                )}
                {entry.historical && (
                  <p className={styles.note}>
                    This register records participant identities and attendance.
                    Registration mode, payment amounts and payment methods were
                    not included in the historical source.
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </Popup>
  );
}
