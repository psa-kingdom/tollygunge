"use client";
import { eventInDateRange } from "@/domain/event-date-range";
import { selectPublicEvents } from "@/domain/public-event-selection";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
import Link from "./navigation-link";
import { PortalIcon } from "./portal-icon";

export type EventJourney = {
  attendanceCount: number;
  historicalAttendance?: { date: string; title: string; source: "workbook" }[];
  attendedEvents?: { id: string; title: string; starts_at: string }[];
  badges: { id: string; name: string; description: string; icon: string }[];
  resources: {
    id: string;
    event_id: string;
    title: string;
    description: string;
    type: string;
  }[];
};

export function MemberEventJourney({ from, to, onFromChange, onToChange }: { from: string; to: string; onFromChange: (value: string) => void; onToChange: (value: string) => void }) {
  const rangeError = !!(from && to && from > to);
  const [journey, setJourney] = useState<EventJourney | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<EventJourney>("/api/member/event-journey")
      .then((value) => {
        if (active) setJourney(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);

  const selected = selectPublicEvents(journey?.attendedEvents ?? [], journey?.historicalAttendance ?? [], "", null);
  const history = [
    ...selected.events.map(event => ({ key: event.id, title: event.title, date: event.starts_at, href: `/member/events?eventId=${event.id}` })),
    ...selected.historical.map(event => ({ key: event.date, title: event.title, date: `${event.date}T12:00:00+05:30`, href: `/events/history/${event.date}` })),
  ].filter(event => eventInDateRange(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(event.date)), from, to)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return (
    <section
      className="content-section member-event-journey"
      aria-labelledby="event-journey-title"
    >
      <h2 id="event-journey-title">Your attendance</h2>
      {journey ? (
        <div className="event-journey-grid">
          <div className="event-attendance-stat">
            <div className="attendance-range-filter" role="group" aria-label="Filter events by date range">
              <label>From date<input type="date" value={from} onChange={event => onFromChange(event.target.value)} aria-invalid={rangeError} aria-describedby={rangeError ? "attendance-range-error" : undefined} /></label>
              <label>To date<input type="date" value={to} onChange={event => onToChange(event.target.value)} aria-invalid={rangeError} aria-describedby={rangeError ? "attendance-range-error" : undefined} /></label>
              <button type="button" className="button secondary" onClick={() => { onFromChange(""); onToChange(""); }}>Clear dates</button>
              {rangeError && <p id="attendance-range-error" role="alert">From date must be on or before To date.</p>}
            </div>
            <div className="attendance-total">
              <strong>{journey.attendanceCount + (journey.historicalAttendance?.length ?? 0)}</strong>
              <span>Total events attended</span>
            </div>
          </div>
          <section className="event-journey-detail">
            <div className="attendance-list-heading">
              <h3>{from || to ? "Attendance in selected range" : "Attendance history"}</h3>
              <p role="status">{from || to ? `${history.length} ${history.length === 1 ? "event" : "events"} in this range` : `${history.length} attended ${history.length === 1 ? "event" : "events"}`}</p>
            </div>
            {history.length ? <ul className="event-journey-list attendance-history-list">
              {history.map(event => <li key={event.key}>
                <div>
                  <h4>{event.href ? <Link href={event.href}>{event.title}</Link> : event.title}</h4>
                  <time dateTime={event.date}>{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(event.date))}</time>
                </div>
                <span className="attendance-outcome">Attended</span>
              </li>)}
            </ul> : <p>{from || to ? "No attended events are recorded in this date range. Adjust or clear the dates." : "No attended events are recorded for your membership yet. Contact the association if an event is missing."}</p>}
          </section>
          {journey.badges.length > 0 && <section className="event-journey-detail attendance-earned-badges">
            <h3>
              <PortalIcon name="shield" /> Attendance badges
            </h3>
            {journey.badges.length ? (
              <ul className="event-journey-list">
                {journey.badges.map((b) => (
                  <li key={b.id}>
                    <strong>{b.name}</strong>
                    <p>{b.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <strong>No milestone badges yet</strong>
                <p>
                  Individual attendance badges appear with each event in your
                  history.
                </p>
              </>
            )}
          </section>}
        </div>
      ) : (
        <p role={error ? "alert" : "status"}>
          {error || "Loading your event journey…"}
        </p>
      )}
    </section>
  );
}
