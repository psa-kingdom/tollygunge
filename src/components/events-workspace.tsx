"use client";
import { useRouter } from "next/navigation";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cpeHoursInput, formatCpeHours } from "@/domain/cpe-hours";
import { EventSheetUpload } from "./event-sheet-upload";
import type { RosterRow } from "@/domain/event-roster";
import type { MembershipPlanDetails } from "@/domain/membership-plans";
import { EventSpeakers } from "./event-speakers";
import type { OrganiserUpi } from "@/domain/organiser-upi";
import { rupees } from "@/domain/finance";
import type { Speaker } from "@/domain/event-flow";
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
  speakers?: Speaker[];
  registration_note?: string;
  cpe_hours?: string;
  has_banner?: boolean;
  organiser?: "CA CP Study Circle" | "TPA" | null;
  location: string;
  starts_at: string;
  ends_at: string;
  status: string;
  registrations: number;
  has_registrations?: boolean;
  capacity: number;
  fee_paise: number;
  visibility: string;
  delivery_mode: string;
  registration_starts_at: string | null;
  registration_ends_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
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
  action,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  action?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    closeRef.current?.focus();
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
        <div className={styles.modalHeaderActions}>
          {action}
          <button ref={closeRef} className={styles.closePopup} type="button" onClick={close} aria-label="Close popup">
            ✕
          </button>
        </div>
      </header>
      {children}
    </dialog>
  );
}

export function EventsWorkspace({
  historicalEvents,
  canDelete,
}: {
  historicalEvents: WorkbookEvent[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  const [view, setView] = useState<"cards" | "list">("cards");
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All events");
  const [selected, setSelected] = useState<Entry | null>(null),
    [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [deletedDates, setDeletedDates] = useState<string[]>([]);
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
    ...historicalEvents.filter((event) => !deletedDates.includes(event.date)).map((historical) => ({
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
    if (!loaded) return;
    const params = new URLSearchParams(window.location.search);
    const id =
      params.get("id") || params.get("eventId") || params.get("eventDate");
    if (id) {
      const live = events.find((e) => e.id === id),
        historical = historicalEvents.find((e) => e.date === id && !deletedDates.includes(e.date));
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
  }, [loaded, events, historicalEvents, deletedDates]);
  return (
    <section className={styles.workspace}>
      <h1 className="sr-only">Events</h1>
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
        <div className={styles.toolbarActions}>
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
          <button type="button" className="button gold" onClick={() => {
            setNotice("");
            setCreating(true);
          }}>
            <span aria-hidden="true">＋</span> Create new event
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
                View details
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
          canDelete={canDelete}
          onDeleted={() => {
            if (selected.historical) {
              setDeletedDates((dates) => [...dates, selected.key]);
              router.refresh();
            } else {
              setEvents((events) => events.filter((event) => event.id !== selected.key));
            }
            setSelected(null);
            setNotice("Event deleted.");
          }}
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
  const [speakers, setSpeakers] = useState<Speaker[]>(event?.speakers ?? []);
  const [organiser,setOrganiser]=useState(event?.organiser??"TPA");
  const [fee, setFee] = useState(((event?.fee_paise ?? 0) / 100).toFixed(2));
  const [organiserUpis,setOrganiserUpis]=useState<(OrganiserUpi & {organiser:string})[]>();
  useEffect(()=>{
    let active=true;
    api<{records:(OrganiserUpi & {organiser:string})[]}>("/api/staff/organiser-upi")
      .then(data=>{if(active)setOrganiserUpis(data.records);})
      .catch(()=>{if(active)setOrganiserUpis([]);});
    return()=>{active=false;};
  },[]);

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
            organiser: data.get("organiser") || undefined,
            description: data.get("description"),
            registrationNote: event?.registration_note ?? "",
            cpeHours: data.get("cpeHours"),
            speakers,
            location: data.get("location"),
            startsAt: istInstant(String(data.get("startsAt"))),
            endsAt: istInstant(String(data.get("endsAt"))),
            capacity: event?.capacity ?? 10000,
            visibility: event?.visibility ?? "public",
            deliveryMode: data.get("deliveryMode"),
            feePaise: Math.round(Number(data.get("fee")) * 100),
            registrationStartsAt: event?.registration_starts_at ?? null,
            registrationEndsAt: event?.registration_ends_at ?? null,
            removeBanner: data.get("removeBanner") === "on",
            ...(!event
              ? {
                  reminders: disabledReminders,
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
          Organiser
          <select name="organiser" aria-label="Organiser" required={!event} value={organiser} onChange={event=>setOrganiser(event.target.value as "TPA"|"CA CP Study Circle")}>
            <option value="" disabled>Choose an organiser</option>
            <option value="CA CP Study Circle">CA CP Study Circle</option>
            <option value="TPA">TPA</option>
          </select>
        </label>
        <label>
          Registration fee (₹)
          <input name="fee" aria-label="Registration fee (₹)" type="number" inputMode="decimal" min={0} max={1000000} step="0.01" required
            readOnly={event?.has_registrations || Boolean(event?.registrations)} value={fee} onChange={event=>setFee(event.target.value)} aria-describedby="event-fee-help" />
          <small id="event-fee-help">{event?.has_registrations || event?.registrations ? "The fee is locked because registrations exist." : "Enter 0 for a free event."}</small>
        </label>
        </div>
        <section className={styles.paymentSummary} aria-label="Participant payment summary" aria-live="polite">
          <strong>Participant payment</strong>
          {Number(fee) > 0 ? <>
            <p>{`Participants will be asked to pay ${rupees(Math.round(Number(fee) * 100))}${organiserUpis?.some(account=>account.organiser===organiser) ? " to the following UPI ID" + (organiserUpis.filter(account=>account.organiser===organiser).length > 1 ? "s" : "") + ":" : "."}`}</p>
            {organiserUpis ? organiserUpis.filter(account=>account.organiser===organiser).length ? <ul>{organiserUpis.filter(account=>account.organiser===organiser).map(account=><li key={account.id}><span>{account.details.upiId}</span> <small>{account.details.payee}</small></li>)}</ul> : <p>No UPI ID linked to {organiser}. Add one in Settings  Collection accounts  UPI IDs.</p> : <p>Loading linked UPI IDs…</p>}
          </> : <p>This is a free event. No payment will be requested.</p>}
        </section>
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
        <div className={styles.twoColumns}>
        <label>
          CPE hours (optional)
          <input
            name="cpeHours"
            type={cpeHoursInput(event?.cpe_hours) === null ? "text" : "number"}
            min="0"
            step="any"
            inputMode="decimal"
            maxLength={80}
            placeholder="e.g. 3 or 1.5"
            defaultValue={cpeHoursInput(event?.cpe_hours) ?? event?.cpe_hours}
          />
        </label>
        <label>
          Event type
          <select name="deliveryMode" defaultValue={event?.delivery_mode ?? "location"}>
            <option value="location">In person</option>
            <option value="online">Online</option>
          </select>
        </label>
        </div>
        <fieldset className={styles.options}>
          <legend>Speakers</legend>
          <EventSpeakers speakers={speakers} onChange={setSpeakers} />
        </fieldset>
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

function registrationPaymentStatus(status: string) {
  switch (status) {
    case "paid": return "Paid";
    case "pending":
    case "failed": return "Unpaid";
    case "not_required": return "Free";
    case "refunded": return "Refunded";
    case "cancelled": return "Cancelled";
    default: return "Not recorded";
  }
}

function EventDetails({
  entry,
  close,
  refresh,
  canDelete,
  onDeleted,
}: {
  entry: Entry;
  close: () => void;
  refresh: () => Promise<void>;
  canDelete: boolean;
  onDeleted: () => void;
}) {
  const [event, setEvent] = useState(entry.live),
    [tab, setTab] = useState("Details"),
    [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [canRecordPayment, setCanRecordPayment] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [recordingPayment, setRecordingPayment] = useState<string | null>(null);
  const [plans,setPlans] = useState<MembershipPlanDetails[]>([]);
  const [membership,setMembership] = useState("all");
  const [loaded,setLoaded] = useState(false);
  const eventKey = entry.live?.id ?? entry.historical?.date ?? "";
  const [query, setQuery] = useState(""),
    [attendance, setAttendance] = useState("All participants");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const roster = await api<{rows:RosterRow[];plans:MembershipPlanDetails[];canRecordPayment:boolean}>("/api/staff/event-participants?eventKey=" + encodeURIComponent(eventKey));
      setRows(roster.rows);setPlans(roster.plans);
      setCanRecordPayment(roster.canRecordPayment);
      if(entry.live){
        const events=await api<Event[]>(`/api/staff/events?id=${entry.live.id}`);
        setEvent(events[0]);
      }
    } catch(failure){setError((failure as Error).message);}
    finally{setLoaded(true);}
  },[entry.live,eventKey]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);
  const recordsUnknown = Boolean(entry.historical && !historicalAttendanceAvailable(entry.historical) && !rows.length);
  const filtered = rows.filter(row=>
    [row.name,row.email,row.number,row.phone,row.organisation].join(" ").toLowerCase().includes(query.toLowerCase()) &&
    (membership==="all" || (membership==="unknown" ? !row.plan : row.plan===membership)) &&
    (tab!=="Attendance" || attendance==="All participants" || row.attendance===attendance) &&
    (tab!=="Registrations" || paymentFilter==="all" ||
      (row.live && registrationPaymentStatus(row.live.payment_status) === paymentFilter))
  );
  const planName=(code:string)=>plans.find(plan=>plan.code===code)?.name || code || "Not recorded";
  const frozen =
    event &&
    (event.status === "cancelled" || event.completed_at || event.archived_at);
  async function deleteEvent() {
    if (!window.confirm(`Delete “${event?.title || entry.title}”? It will be removed from event listings. Existing attendance and payment records will be kept.`)) return;
    setDeleting(true);
    setDeleteError("");
    try {
      if (entry.historical) {
        await api("/api/staff/historical-events", {
          action: "delete",
          date: entry.historical.date,
          version: entry.historical.version ?? 0,
        });
      } else if (event) {
        await api("/api/staff/events", {
          action: "delete",
          id: event.id,
          version: event.version,
        });
      }
      onDeleted();
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }
  return (
    <Popup
      title={editing ? "Edit event" : event?.title || entry.title}
      close={() => { if (!deleting) close(); }}
      action={!editing && (
        <>
          {event && !frozen && (
            <button
              type="button"
              className="button secondary"
              disabled={!loaded || busy || deleting}
              onClick={() => {
                setPublishError("");
                setEditing(true);
              }}
            >
              Edit event
            </button>
          )}
          {canDelete && (event || entry.historical) && (
            <button type="button" className="button danger" disabled={(!!entry.live && !loaded) || busy || deleting} onClick={() => void deleteEvent()}>
              {deleting ? "Deleting…" : "Delete event"}
            </button>
          )}
        </>
      )}
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
            <span>{rows.length} participant records</span>
          </div>
          <div
            className={styles.tabs}
            role="group"
            aria-label="Event details sections"
          >
            {["Details", "Registrations", "Attendance"].map((t) => (
              <button
                key={t}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {t}{t==="Registrations" ? ` (${rows.filter(row=>row.registrationStatus!=="cancelled").length})` : t==="Attendance" ? ` (${recordsUnknown ? "—" : rows.filter(row=>row.attendance==="Attended").length})` : ""}
              </button>
            ))}
          </div>
          <div className={styles.modalBody}>
            {deleteError && <p role="alert">{deleteError}</p>}
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
                  {event?.organiser && <div><dt>Organiser</dt><dd>{event.organiser}</dd></div>}
                  {event?.cpe_hours && <div><dt>CPE hours</dt><dd>{formatCpeHours(event.cpe_hours)}</dd></div>}
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
                {publishError && <p role="alert">{publishError}</p>}
                {event?.status === "draft" && !frozen && (
                  <footer className={styles.actions}>
                    <button
                      className="button gold"
                      disabled={!loaded || busy || deleting}
                      onClick={async () => {
                        setBusy(true);
                        setPublishError("");
                        try {
                          await api("/api/staff/events", {
                            action: "publish",
                            id: event.id,
                            version: event.version,
                          });
                          await load();
                          await refresh();
                        } catch (e) {
                          setPublishError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {busy ? "Publishing…" : "Publish event"}
                    </button>
                  </footer>
                )}
              </>
            ) : (
              <>
                <EventSheetUpload key={tab} eventKey={eventKey} mode={tab==="Registrations"?"registrations":"attendance"}
                  saved={async()=>{await load();await refresh();}} />
                {tab==="Registrations" ? (
                  <div className={styles.attendanceSummary}>
                    <strong>{recordsUnknown || rows.some(row=>row.registrationStatus==="historical") && !rows.some(row=>row.registrationStatus==="registered") ? "—" : rows.filter(row=>row.registrationStatus==="registered").length}<span>Registered</span></strong>
                    <strong>{rows.filter(row=>row.registrationStatus==="cancelled").length}<span>Cancelled</span></strong>
                    <strong>{rows.filter(row=>row.registrationStatus==="historical").length}<span>Historical register · status unknown</span></strong>
                  </div>
                ) : <div className={styles.attendanceSummary}>
                  <strong>
                    {recordsUnknown ? "—" : rows.filter((r) => r.attendance === "Attended").length}
                    <span>Attended</span>
                  </strong>
                  <strong>
                    {recordsUnknown ? "—" : rows.filter((r) => r.attendance === "Not attended").length}
                    <span>Not attended</span>
                  </strong>
                  <strong>
                    {recordsUnknown ? "—" : rows.filter((r) => r.attendance === "Not recorded").length}
                    <span>Not recorded</span>
                  </strong>
                </div>}
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
                    <span className={styles.srOnly}>Membership type</span>
                    <select aria-label="Membership type" value={membership} onChange={event=>setMembership(event.target.value)}>
                      <option value="all">All membership types</option>
                      {plans.map(plan=><option key={plan.code} value={plan.code}>{plan.name}</option>)}
                      <option value="unknown">Not recorded</option>
                    </select>
                  </label>
                  {event && tab==="Registrations" && <label>
                    <span className={styles.srOnly}>Payment status</span>
                    <select value={paymentFilter} onChange={event => setPaymentFilter(event.target.value)}>
                      <option value="all">All payment statuses</option>
                      <option value="Paid">Paid</option>
                      <option value="Unpaid">Unpaid</option>
                    </select>
                  </label>}
                  {tab==="Attendance" && <label>
                    <span className={styles.srOnly}>Attendance status</span>
                    <select
                      aria-label="Attendance status"
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
                  </label>}
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
                        ? "Try another search or filter."
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
                          <th>Membership</th>
                          {tab==="Attendance" && <th>Attendance</th>}
                          <th>Payment</th>
                          {event && tab==="Attendance" && <th>Action</th>}
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
                              {"live" in r && r.live?.registration_details && (
                                <details>
                                  <summary>Registration details</summary>
                                  <small>{[r.live.registration_details.prefix, r.live.registration_details.jobTitle].filter(Boolean).join(" · ")}</small>
                                  <small>{["address","city","state","country","pin"].map(key => r.live?.registration_details?.[key]).filter(Boolean).join(", ")}</small>
                                </details>
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
                                  {r.registrationStatus==="historical"?"Historical register":r.registrationStatus}
                                  <small>{r.source==="imported"?"Imported record":"Registration mode: not recorded"}</small>
                                </>
                              )}
                            </td>
                            <td>{planName(r.plan)}</td>
                            {tab==="Attendance" && <td>{r.attendance}</td>}
                            <td>
                              {"live" in r && r.live ? (
                                <>
                                  {registrationPaymentStatus(r.live.payment_status)}
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
                                  {r.live.payment_note && <small>Remark: {r.live.payment_note}</small>}
                                  {r.live.payment_proof_id && (
                                    <small><a href={`/api/finance/proofs/${r.live.payment_proof_id}?download`}>Download payment proof</a></small>
                                  )}
                                  {tab === "Registrations" && event?.status === "published" && !frozen &&
                                    canRecordPayment && r.live.status === "registered" &&
                                    registrationPaymentStatus(r.live.payment_status) === "Unpaid" && (
                                    recordingPayment === r.id ? (
                                      <form className={styles.paymentForm} aria-label={`Record payment for ${r.name}`} onSubmit={async submit => {
                                        submit.preventDefault();
                                        if (busy || !r.live) return;
                                        const form = new FormData(submit.currentTarget);
                                        form.set("details", JSON.stringify({
                                          eventId: event.id, registrationId: r.id, version: r.live.version, note: form.get("note"),
                                        }));
                                        form.delete("note");
                                        setBusy(true);
                                        setError("");
                                        try {
                                          await api("/api/staff/event-participants", form);
                                          setRecordingPayment(null);
                                          await load();
                                        } catch (failure) {
                                          setError((failure as Error).message);
                                        } finally {
                                          setBusy(false);
                                        }
                                      }}>
                                        <label>Remark<textarea name="note" maxLength={1000} rows={2} /></label>
                                        <label>Payment proof (JPEG, PNG or PDF, up to 5 MB)
                                          <input name="file" type="file" accept="image/jpeg,image/png,application/pdf" />
                                        </label>
                                        <small>Add a remark or attach proof.</small>
                                        <div>
                                          <button disabled={busy}>Save payment</button>
                                          <button type="button" disabled={busy} onClick={() => setRecordingPayment(null)}>Cancel</button>
                                        </div>
                                      </form>
                                    ) : <button type="button" disabled={busy} onClick={() => setRecordingPayment(r.id)}>Mark as paid</button>
                                  )}
                                </>
                              ) : (
                                "Not recorded"
                              )}
                            </td>
                            {event && tab==="Attendance" && (
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
                {event && tab==="Attendance" && (
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
