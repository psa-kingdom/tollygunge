"use client";
import { MemberReceipts } from "./member-receipts";
import { upcomingMemberEvents } from "@/domain/member-upcoming-events";
import { CopyValue } from "./portal-values";
import { eventTime, type Speaker } from "@/domain/event-flow";
import { MemberEventResources } from "./event-operations";
import { MemberEventJourney } from "./member-event-journey";
import { MemberPaymentDetails } from "./payment-details";
import Link from "next/link";
import { useState, useEffect } from "react";
import { api } from "./operations-client";
import { useSearchParams } from "next/navigation";
import { FallbackPanel } from "./fallback-screen";
import { LoadingScreen } from "./loading-screen";
type Event = {
  id: string;
  booking_closed: boolean;
  completed_at: string | null;
  archived_at: string | null;
  attendance_status: string;
  registration_fee_paise: number | null;
  registration_version: number;
  payment_reference: string;
  badge_awarded_at: string | null;
  title: string;
  speakers: Speaker[];
  description: string;
  registration_id: string | null;
  payment_status: string;
  fee_paise: number;
  registration_starts_at: string | null;
  registration_ends_at: string | null;
  location: string;
  starts_at: string;
  ends_at: string;
  status: string;
  registration_status: string | null;
  checked_in_at: string | null;
};
export function MemberEvents() {
  const requestedEvent = useSearchParams().get("eventId");
  const [events, setEvents] = useState<Event[]>([]),
    [message, setMessage] = useState("Loading events…"),
    [busy, setBusy] = useState(false);
  const [month, setMonth] = useState("");
  const [view, setView] = useState<"attendance" | "upcoming">(requestedEvent ? "upcoming" : "attendance");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const loadEvents = () => {
    setLoadState("loading");
    return api<Event[]>("/api/member/events")
      .then((rows) => {
        setEvents(rows);
        setMessage("");
        setLoadState("ready");
      })
      .catch((e) => {
        setMessage(e.message);
        setLoadState("error");
      });
  };
  useEffect(() => {
    api<Event[]>("/api/member/events")
      .then(setEvents)
      .then(() => {
        setMessage("");
        setLoadState("ready");
      })
      .catch((e) => {
        setMessage(e.message);
        setLoadState("error");
      });
  }, []);
  const upcoming = upcomingMemberEvents(events);
  const visibleEvents = view === "upcoming"
    ? requestedEvent ? events.filter(event => event.id === requestedEvent || upcoming.some(item => item.id === event.id)) : upcoming
    : [];
  return (
    <>
      <nav className="member-event-views segmented" aria-label="Event views">
        <button type="button" aria-pressed={view === "attendance"} onClick={() => setView("attendance")}>Attendance history</button>
        <button type="button" aria-pressed={view === "upcoming"} onClick={() => setView("upcoming")}>Upcoming registrations{upcoming.length ? ` (${upcoming.length})` : ""}</button>
      </nav>
      {view === "attendance" && <MemberEventJourney month={month} onMonthChange={setMonth} />}
      {view === "upcoming" && <section className="member-upcoming-intro">
        <h2>Your upcoming registrations</h2>
        {loadState === "ready" && !visibleEvents.length && <p>You have no upcoming registrations. <Link href="/events">Browse events</Link></p>}
      </section>}
      {loadState === "loading" && <LoadingScreen />}
      {loadState === "error" && (
        <FallbackPanel
          compact
          kind="unavailable"
          retry={() => {
            void loadEvents();
          }}
        />
      )}
      {[...visibleEvents]
        .sort(
          (a, b) =>
            Number(b.id === requestedEvent) - Number(a.id === requestedEvent),
        )
        .map((event) => (
          <article className="content-section member-event-card" key={event.id}>
            <h2>{event.title}</h2>
            <p>
              {new Date(event.ends_at) <= new Date()
                ? "Past event"
                : "Upcoming / live event"}
              {new Date(event.ends_at) <= new Date() &&
              event.registration_id &&
              event.attendance_status === "unmarked"
                ? " · Attendance has not been finalized"
                : ""}
            </p>
            <p>
              {eventTime(event.starts_at)} · {event.location}
            </p>
            <p>{event.description}</p>
            {event.checked_in_at && (
              <p>Attendance date: {eventTime(event.checked_in_at)}</p>
            )}
            {event.attendance_status === "absent" && (
              <p>Attendance: absent (finalized or recorded by staff)</p>
            )}
            {event.completed_at && <p>Event completed</p>}
            {event.badge_awarded_at && (
              <p>
                Attendance badge awarded {eventTime(event.badge_awarded_at)}
              </p>
            )}
            <MemberEventResources eventId={event.id} />
            {event.registration_id && <MemberReceipts eventId={event.id} registrationId={event.registration_id} amountPaise={event.registration_fee_paise??event.fee_paise} eligible={event.registration_status==='registered'&&['pending','failed'].includes(event.payment_status)&&!event.completed_at&&!event.archived_at&&event.status==='published'&&(event.registration_fee_paise??event.fee_paise)>0} onSaved={async()=>setEvents(await api<Event[]>("/api/member/events"))} />}
            {event.speakers?.length > 0 && (
              <details className="event-speaker-summary">
                <summary>Speakers ({event.speakers.length})</summary>
                {event.speakers.map((speaker, i) => (
                  <p key={i}>
                    <strong>{speaker.name}</strong>
                    {speaker.credentials && <span>{speaker.credentials}</span>}
                    {speaker.designation && <span>{speaker.designation}</span>}
                    {speaker.organization && (
                      <span>{speaker.organization}</span>
                    )}
                    {speaker.description && <span>{speaker.description}</span>}
                  </p>
                ))}
              </details>
            )}
            {event.registration_id && (
              <p>
                Registration identifier:{" "}
                <CopyValue value={event.registration_id} label="registration identifier" />
              </p>
            )}
            {event.registration_status === "registered" &&
              ["pending", "failed"].includes(event.payment_status) && (
                <section className="notice">
                  <p>
                    Receipt pending · ₹
                    {(
                      (event.registration_fee_paise ?? event.fee_paise) / 100
                    ).toFixed(2)}
                    .{" "}
                    <Link href={`/member/events?eventId=${event.id}`}>
                      View event payment instructions →
                    </Link>{" "}
                    Include your event and member details when contacting the
                    association. Include the registration identifier above.
                  </p>
                  <MemberPaymentDetails eventPayment eventId={event.id} />

                </section>
              )}
            {event.registration_starts_at && (
              <p>
                Registration opens {eventTime(event.registration_starts_at)}
              </p>
            )}
            {event.registration_ends_at && (
              <p>Registration closes {eventTime(event.registration_ends_at)}</p>
            )}
            <p>
              {event.status === "cancelled"
                ? "Event cancelled"
                : event.registration_status === "registered"
                  ? ["paid", "not_required"].includes(event.payment_status)
                    ? "Registration confirmed"
                    : "Place reserved · payment " + event.payment_status
                  : event.registration_status === "cancelled"
                    ? "Your registration is cancelled"
                    : event.fee_paise
                      ? `Fee ₹${(event.fee_paise / 100).toFixed(2)} · manual verification`
                      : "Free registration"}
              {event.checked_in_at ? " · Attendance recorded" : ""}
            </p>
            {event.status === "published" &&
              !event.completed_at &&
              !event.archived_at &&
              !event.booking_closed &&
              new Date(event.starts_at) > new Date() && (
                <button
                  className="button secondary"
                  disabled={
                    busy ||
                    (event.registration_status !== "registered" &&
                      ((!!event.registration_starts_at &&
                        new Date(event.registration_starts_at) > new Date()) ||
                        (!!event.registration_ends_at &&
                          new Date(event.registration_ends_at) <= new Date())))
                  }
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api("/api/member/events", {
                        eventId: event.id,
                        action:
                          event.registration_status === "registered"
                            ? "cancel"
                            : "register",
                      });
                      setEvents(await api<Event[]>("/api/member/events"));
                      setMessage(
                        event.registration_status === "registered"
                          ? "Registration cancelled."
                          : event.fee_paise
                            ? "Place reserved pending manual payment verification."
                            : "Registration confirmed.",
                      );
                    } catch (e) {
                      setMessage(
                        e instanceof Error ? e.message : "Request failed.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {event.registration_status === "registered"
                    ? "Cancel my registration"
                    : event.fee_paise
                      ? "Reserve place · payment required"
                      : "Register for free"}
                </button>
              )}
          </article>
        ))}
      <p role="status">{message}</p>
    </>
  );
}
