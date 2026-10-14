"use client";
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
  booking_closed:boolean;
  completed_at:string|null;
  archived_at:string|null;
  attendance_status:string;
  registration_fee_paise:number|null;
  registration_version:number;
  payment_reference:string;
  badge_awarded_at:string|null;
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
  ends_at:string;
  status: string;
  registration_status: string | null;
  checked_in_at: string | null;
};
export function MemberEvents() {
  const requestedEvent = useSearchParams().get("eventId");
  const [events, setEvents] = useState<Event[]>([]),
    [message, setMessage] = useState("Loading events…"),
    [busy, setBusy] = useState(false);
  const [period,setPeriod]=useState("all");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const loadEvents = () => {
    setLoadState("loading");
    return api<Event[]>("/api/member/events").then(rows => {
      setEvents(rows); setMessage(""); setLoadState("ready");
    }).catch((e) => { setMessage(e.message); setLoadState("error"); });
  };
  useEffect(() => {
    api<Event[]>("/api/member/events")
      .then(setEvents)
      .then(() => { setMessage(""); setLoadState("ready"); })
      .catch((e) => { setMessage(e.message); setLoadState("error"); });
  }, []);
  return (
    <>
      <MemberEventJourney/>
      <p>
        Register for events and view your payment and attendance status. Paid
        registrations are confirmed after manual verification. Registration and
        attendance are separate. TPA learning-hour rules have not yet been
        configured.
      </p>
      {loadState === "loading" && <LoadingScreen />}
      {loadState === "error" && <FallbackPanel kind="unavailable" retry={() => { void loadEvents(); }} />}
      {loadState === "ready" && events.length === 0 && <FallbackPanel kind="emptyEvents" />}
      <label>Event period<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="all">All events and history</option><option value="upcoming">Upcoming and live events</option><option value="past">Past events and attendance history</option></select></label>
      {[...events].filter(e=>e.id===requestedEvent || period==="all" || (period==="past"?new Date(e.ends_at)<=new Date():new Date(e.ends_at)>new Date()))
        .sort(
          (a, b) =>
            Number(b.id === requestedEvent) - Number(a.id === requestedEvent),
        )
        .map((event) => (
          <article className="content-section" key={event.id}>
            <h2>{event.title}</h2>
            <p>{new Date(event.ends_at)<=new Date()?"Past event":"Upcoming / live event"}{new Date(event.ends_at)<=new Date()&&event.registration_id&&event.attendance_status==='unmarked'?" · Attendance has not been finalized":""}</p>
            <p>
              {eventTime(event.starts_at)} ·{" "}
              {event.location}
            </p>
            <p>{event.description}</p>
            {event.checked_in_at&&<p>Attendance date: {eventTime(event.checked_in_at)}</p>}
            {event.attendance_status==='absent'&&<p>Attendance: absent (finalized or recorded by staff)</p>}
            {event.completed_at&&<p>Event completed</p>}
            {event.badge_awarded_at&&<p>Attendance badge awarded {eventTime(event.badge_awarded_at)}</p>}
            <MemberEventResources eventId={event.id}/>
            {event.speakers?.length>0 && <details className="event-speaker-summary"><summary>Speakers ({event.speakers.length})</summary>{event.speakers.map((speaker,i) => <p key={i}><strong>{speaker.name}</strong>{speaker.credentials && <span>{speaker.credentials}</span>}{speaker.designation&&<span>{speaker.designation}</span>}{speaker.organization&&<span>{speaker.organization}</span>}{speaker.description&&<span>{speaker.description}</span>}</p>)}</details>}
            {event.registration_id && <p>Registration identifier: <strong>{event.registration_id}</strong></p>}
            {event.registration_status === "registered" &&
              ["pending","failed"].includes(event.payment_status) && (
                <section className="notice">
                  <p>Payment pending · ₹{((event.registration_fee_paise??event.fee_paise)/100).toFixed(2)}.{" "}
                  <Link href={`/member/events?eventId=${event.id}`}>
                    View event payment instructions →
                  </Link>{" "}
                  Include your event and member details when contacting the
                  association. Include the registration identifier above.
                </p><MemberPaymentDetails eventPayment eventId={event.id}/>
                  <form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);try{await api('/api/member/events',{action:'payment_reference',eventId:event.id,reference:f.get('reference'),version:event.registration_version});setEvents(await api<Event[]>('/api/member/events'));setMessage('Payment reference submitted for staff verification.');}catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}}><label>Payment reference<input name="reference" required minLength={3} maxLength={200} defaultValue={event.payment_reference}/></label><button disabled={busy||!!event.completed_at||!!event.archived_at}>Submit payment reference</button></form></section>
              )}
            {event.registration_starts_at && (
              <p>
                Registration opens{" "}
                {eventTime(event.registration_starts_at)}
              </p>
            )}
            {event.registration_ends_at && (
              <p>
                Registration closes{" "}
                {eventTime(event.registration_ends_at)}
              </p>
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
            {event.status === "published" && !event.completed_at && !event.archived_at && !event.booking_closed &&
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
