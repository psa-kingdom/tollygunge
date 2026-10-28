"use client";
import { WorkspaceEmptyState } from "./workspace-ui";
import { EventOperations } from "./event-operations";
import { defaultReminders, disabledReminders, istInput, istInstant, eventTime, type Speaker, type ReminderSettings } from "@/domain/event-flow";
import { EventSpeakers } from "./event-speakers";
import { useState, useEffect, useCallback } from "react";
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
  payment_account_ids: string[] | null;
  booking_closed: boolean;
  archived_at: string | null;
  completed_at: string | null;
  visibility: string;
  delivery_mode: string;
  speakers: Speaker[];
  reminders: ReminderSettings;
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
  outcome?: string;
  attendance_version?: number;
  registered_at:string;
  payment_updated_at:string|null;
  attendance_note:string;
};
const empty = {
  paymentAccountIds: [] as string[],
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
  speakers: [] as Speaker[],
  reminders: defaultReminders,
};
export function EventManager({
  canVerifyPayments = false,
  canPromote = false,
}: {
  canVerifyPayments?: boolean;
  canPromote?: boolean;
}) {
  const [events, setEvents] = useState<EventRow[]>([]),
    [selected, setSelected] = useState<EventRow | null>(null),
    [form, setForm] = useState(empty),
    [attendees, setAttendees] = useState<Attendee[]>([]),
    [message, setMessage] = useState("Loading events…"),
    [busy, setBusy] = useState(false),
    [attendeeFilter, setAttendeeFilter] = useState("all"),
    [attendeeSearch, setAttendeeSearch] = useState("");
  const [editing, setEditing] = useState(false), [loaded, setLoaded] = useState(false);
  const [attendeePage,setAttendeePage]=useState(1),[outcomeFilter,setOutcomeFilter]=useState("all"),[paymentFilter,setPaymentFilter]=useState("all");
  const [accounts,setAccounts]=useState<{id:string;details:{label:string;payee:string}}[]>([]);
  useEffect(()=>{void api<{records: typeof accounts}>("/api/member/payment-details").then(d=>setAccounts(d.records));},[]);
  const [delivery, setDelivery] = useState<{ mail: DeliveryRow[]; reminders: DeliveryRow[] }>({mail:[],reminders:[]});
  const loadDelivery = useCallback(async (id: string) => { setDelivery(await api(`/api/staff/events/delivery?eventId=${id}`)); }, []);
  async function load() {
    setEvents(await api<EventRow[]>("/api/staff/events"));
  }
  const select = useCallback(async (row: EventRow | null) => {
    if(row) row=(await api<EventRow[]>(`/api/staff/events?id=${row.id}`))[0];
    setEditing(true);
    setSelected(row);
    setForm(
      row
        ? {
            paymentAccountIds: row.payment_account_ids ?? [],
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
            speakers: row.speakers ?? [],
            reminders: row.reminders ?? disabledReminders,
          }
        : empty,
    );
    setAttendees([]);setAttendeePage(1);setOutcomeFilter("all");setPaymentFilter("all");
    setDelivery({mail:[],reminders:[]});
    setMessage("");
    if (row)
      try {
        await loadDelivery(row.id);
        setAttendees(
          await api<Attendee[]>(`/api/staff/attendance?eventId=${row.id}`),
        );
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Load failed.");
      }
  }, [loadDelivery]);
  useEffect(() => {
    api<EventRow[]>("/api/staff/events" + (location.search || ""))
      .then((rows) => {
        setEvents(rows);
        const id = new URLSearchParams(location.search).get("id");
        const row = rows.find((r) => r.id === id);
        if (row) void select(row);
      })
      .then(() => setMessage(""))
      .catch((e) => setMessage(e.message))
      .finally(() => setLoaded(true));
  }, [select]);
  async function action(action: string) {
    setBusy(true);
    try {
      const row = await api<EventRow>("/api/staff/events", {
        action,
        ...form,
        startsAt: istInstant(form.startsAt),
        endsAt: istInstant(form.endsAt),
        registrationStartsAt: form.registrationStartsAt
          ? istInstant(form.registrationStartsAt)
          : null,
        registrationEndsAt: form.registrationEndsAt
          ? istInstant(form.registrationEndsAt)
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
  const filteredAttendees=attendees.filter(
                        (a) =>
                          [a.name, a.email, a.mobile, a.membership_number]
                            .join(" ")
                            .toLowerCase()
                            .includes(attendeeSearch.toLowerCase()) &&
                          (outcomeFilter === "all" || (a.outcome??"unmarked")===outcomeFilter) && (paymentFilter === "all" || a.payment_status===paymentFilter) && (attendeeFilter === "all" ||
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
                      );
  const unsaved =
    selected &&
    JSON.stringify(form) !==
      JSON.stringify({
        paymentAccountIds: selected.payment_account_ids ?? [],
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
        speakers: selected.speakers ?? [],
        reminders: selected.reminders ?? disabledReminders,
      });
  if (!loaded) return <p role="status">Loading events…</p>;
  if (!editing && !events.length) return <WorkspaceEmptyState icon="calendar" title={message ? "Events could not be loaded" : "Your events start here"} description={message || "Create your first event, save its details as a draft, then review it before publishing."} actionLabel={message ? "Retry loading events" : "New event"} onAction={() => { if (message) void load().then(() => setMessage("")).catch(e => setMessage(e.message)); else void select(null); }} />;
  return (
    <div className={`operations-layout event-workspace ${!events.length ? "is-creating-first" : ""}`}>
      <aside className="record-list workspace-records" aria-label="Event library">
        <div className="workspace-list-heading"><h2>Event library</h2><span>{events.length}</span></div>
        <button className="button" onClick={() => void select(null)}>
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
              {row.status} · {eventTime(row.starts_at)}
            </small>
          </button>
        ))}
      </aside>
      <section className="workspace-editor" aria-label="Event editor">
        {editing ? <>
        <h2>{selected ? selected.title : "Create event"}</h2>
        {selected && <EventOperations event={selected} attendees={attendees} canFinance={canVerifyPayments} canPromote={canPromote} refresh={async()=>{const rows=await api<EventRow[]>(`/api/staff/events?id=${selected.id}`);await select(rows[0]);await load();}}/>}
        {selected?.status === "published" && (
          <p>
            {selected.visibility==='public' && <><Link className="text-link" href={`/events/${selected.id}`}>
              View published event →
            </Link>{" "}
            ·{" "}</>}
            <Link className="text-link" href={`/admin/workspaces/flyers?id=${selected.id}`}>
              Create event flyer →
            </Link>
          </p>
        )}
        <p>
          Save a draft, review the details, then publish. Paid registrations
          require manual payment verification.
        </p>
        <nav className="workspace-section-nav" aria-label="Event form sections"><a href="#event-basics">Event details</a><a href="#event-booking">Booking & payment</a><a href="#event-speakers">Speakers</a><a href="#event-reminders">Reminders</a></nav>
        <form id="event-details"
          className="member-settings"
          onSubmit={(e) => {
            e.preventDefault();
            void action("save");
          }}
        >
          <fieldset disabled={busy || (selected?.status === "cancelled" || !!selected?.completed_at || !!selected?.archived_at)} id="event-basics">
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
                Starts (IST)
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
                Ends (IST)
                <input
                  type="datetime-local"
                  required
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                />
              </label>
            </div>
            </fieldset>
            <fieldset disabled={busy || (selected?.status === "cancelled" || !!selected?.completed_at || !!selected?.archived_at)} id="event-booking"><legend>Booking</legend>
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
                Registration opens (IST)
                <input
                  type="datetime-local"
                  value={form.registrationStartsAt}
                  onChange={(e) =>
                    setForm({ ...form, registrationStartsAt: e.target.value })
                  }
                />
              </label>
              <label>
                Registration closes (IST)
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
            </fieldset>
            <fieldset disabled={busy || (selected?.status === "cancelled" || !!selected?.completed_at || !!selected?.archived_at)}><legend>Payment</legend>
            <p>Fees are collected using association payment instructions and confirmed by staff.</p>
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
                    <label>Event payment accounts<select multiple value={form.paymentAccountIds} disabled={busy||!!selected?.completed_at||selected?.status==='published'} onChange={e=>setForm({...form,paymentAccountIds:Array.from(e.target.selectedOptions).map(o=>o.value)})}>{accounts.map(a=><option key={a.id} value={a.id}>{a.details.label} · {a.details.payee}</option>)}</select></label>
          </fieldset>
          <fieldset disabled={busy || (selected?.status === "cancelled" || !!selected?.completed_at || !!selected?.archived_at)} id="event-speakers"><legend>Speakers</legend>
            <EventSpeakers speakers={form.speakers} onChange={(speakers) => setForm({...form,speakers})} />
          </fieldset>

          <fieldset disabled={busy || (selected?.status === "cancelled" || !!selected?.completed_at || !!selected?.archived_at)} id="event-reminders"><legend>Pre-event reminders</legend>
            <label><input type="checkbox" checked={form.reminders.enabled} onChange={(e) => setForm({...form,reminders:{...form.reminders,enabled:e.target.checked}})} /> Send automatic reminders</label>
            <p>Times are minutes before the event starts. Choose up to three different times from 15 to 10,080 minutes.</p>
            {form.reminders.offsets.map((offset,i) => <div className="action-row" key={i}>
              <label>Reminder {i+1} (minutes)<input type="number" required min={15} max={10080} value={offset} onChange={(e) => setForm({...form,reminders:{...form.reminders,offsets:form.reminders.offsets.map((n,j) => j===i ? Number(e.target.value) : n)}})} /></label>
              <button type="button" className="button secondary" disabled={form.reminders.offsets.length===1} onClick={() => setForm({...form,reminders:{...form.reminders,offsets:form.reminders.offsets.filter((_,j) => j!==i)}})}>Remove reminder {i+1}</button>
            </div>)}
            <button type="button" className="button secondary" disabled={form.reminders.offsets.length>=3} onClick={() => setForm({...form,reminders:{...form.reminders,offsets:[...form.reminders.offsets,[60,1440,10080].find((n) => !form.reminders.offsets.includes(n))!]}})}>Add reminder</button>
            <label><input type="checkbox" checked={form.reminders.includePending} onChange={(e) => setForm({...form,reminders:{...form.reminders,includePending:e.target.checked}})} /> Send a separate payment-pending message to reserved attendees</label>
          </fieldset>
          <div className="action-row workspace-savebar">
            {(!selected || selected.status !== "cancelled") && (
              <button className="button" disabled={busy || !!selected?.completed_at || !!selected?.archived_at}>
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
                className="button danger"
                disabled={busy || !!selected?.completed_at || !!selected?.archived_at}
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
            <h2 id="event-attendees">Registrations & attendance</h2>
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
                  onChange={(e) => {setAttendeeSearch(e.target.value);setAttendeePage(1);}}
                  placeholder="Name, email, mobile or membership number"
                />
              </label>
              <label>
                Registration status
                <select
                  value={attendeeFilter}
                  onChange={(e) => {setAttendeeFilter(e.target.value);setAttendeePage(1);}}
                >
                  {["all", "confirmed", "pending", "cancelled"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>Attendance status<select value={outcomeFilter} onChange={e=>{setOutcomeFilter(e.target.value);setAttendeePage(1);}}>{['all','attended','absent','unmarked'].map(s=><option key={s}>{s}</option>)}</select></label>
              <label>Payment status<select value={paymentFilter} onChange={e=>{setPaymentFilter(e.target.value);setAttendeePage(1);}}>{['all','paid','pending','failed','refunded','cancelled','not_required'].map(s=><option key={s}>{s}</option>)}</select></label>
              {canVerifyPayments && (
                <Link href="/admin/workspaces/payments">Verify payments →</Link>
              )}
            </div>
            <div className="action-row"><button type="button" disabled={attendeePage===1} onClick={()=>setAttendeePage(attendeePage-1)}>Previous attendees</button><span>Page {attendeePage} · {filteredAttendees.length} matching attendees · 50 rows per page</span><button type="button" disabled={attendeePage*50>=filteredAttendees.length} onClick={()=>setAttendeePage(attendeePage+1)}>Next attendees</button></div>
            {attendees.length === 0 ? (
              <p>No registrations yet.</p>
            ) : (
              <div className="table-scroll" tabIndex={0} role="region" aria-label="Event registrations and attendance">
                <table className="operations-table" tabIndex={0} aria-label="Event attendee records">
                  <thead>
                    <tr>
                      <th>Registrant</th>
                      <th>Registration</th>
                      <th>Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendees
                      .slice((attendeePage-1)*50,attendeePage*50)
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
                              Registered: {eventTime(a.registered_at)}{a.payment_updated_at&&<> · Payment updated: {eventTime(a.payment_updated_at)}</>}<br/>
                              Payment: {a.payment_status} · ₹
                              {(a.fee_paise / 100).toFixed(2)}
                            </small>
                          </td>
                          <td>
                            {a.attendance_note&&<small>{a.attendance_note}</small>}
                            {a.status === "registered" && (
                              <button
                                disabled={busy || !!selected?.completed_at || !!selected?.archived_at}
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
                            {a.outcome==='absent'&&<span>Absent · </span>}
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
                                  selected.status !== "published" || !!selected.completed_at || !!selected.archived_at ||
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
        {selected && <section className="content-section"><h3>Email and reminder delivery</h3>
          <p>Provider acceptance and delivery are separate states. Showing the latest 100 messages and reminders.</p>
          <button type="button" className="button secondary" disabled={busy || !!selected?.completed_at || !!selected?.archived_at} onClick={async () => {try {await loadDelivery(selected.id);} catch(e) {setMessage(e instanceof Error ? e.message : "Refresh failed.");}}}>Refresh delivery</button>
          {[{label:"Emails",rows:delivery.mail},{label:"Reminders",rows:delivery.reminders}].map(({label,rows}) => <details key={label}><summary>{label} ({rows.length})</summary>
            {!rows.length ? <p>No {label.toLowerCase()} yet.</p> : <div className="table-scroll" role="region" aria-label={label} tabIndex={0}><table><thead><tr><th>Registration</th><th>Type</th><th>Time (IST)</th><th>Status / reason</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{r.registration_id}</td><td>{r.audience ?? r.kind}</td><td>{eventTime(r.due_at ?? r.created_at!)}</td><td>{r.status}{r.reason ? " · "+r.reason.replaceAll("_"," ") : ""}</td></tr>)}</tbody></table></div>}
          </details>)}
        </section>}
        <p role="status">{message}</p>
        </> : <WorkspaceEmptyState icon="calendar" title="Select an event" description="Choose an event to manage its details, registrations and attendance, or create a new event." actionLabel="New event" onAction={() => void select(null)} />}
      </section>
    </div>
  );
}
function localDate(value: string) { return istInput(value); }
type DeliveryRow = { id: string; registration_id: string; kind?: string; audience?: string; created_at?: string; due_at?: string; status: string; reason: string | null };
