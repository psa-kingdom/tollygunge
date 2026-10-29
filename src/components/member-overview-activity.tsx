"use client";
import { useEffect, useState } from "react";
import Link from "./navigation-link";
import { api } from "./operations-client";
import type { EventJourney } from "./member-event-journey";
import { eventTime } from "@/domain/event-flow";
import {
  upcomingMemberEvents,
  overviewEventState,
  type OverviewEvent,
} from "@/domain/portal-presentation";
import { StatusBadge } from "./portal-values";
import { PortalIcon } from "./portal-icon";
export function MemberOverviewActivity() {
  const [journey, setJourney] = useState<EventJourney>();
  const [events, setEvents] = useState<OverviewEvent[]>();
  const [journeyError, setJourneyError] = useState(false);
  const [eventsError, setEventsError] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      api<EventJourney>("/api/member/event-journey"),
      api<OverviewEvent[]>("/api/member/events"),
    ]).then(([activity, upcoming]) => {
      if (!active) return;
      if (activity.status === "fulfilled") setJourney(activity.value);
      else setJourneyError(true);
      if (upcoming.status === "fulfilled")
        setEvents(upcomingMemberEvents(upcoming.value, Date.now()));
      else setEventsError(true);
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section
      className="member-card member-overview-activity"
      aria-labelledby="overview-activity-title"
      data-portal-primary
    >
      <div className="member-card-heading">
        <h2 id="overview-activity-title">Your association activity</h2>
        <PortalIcon name="calendar" />
      </div>
      {journey ? (
        <dl className="member-activity-counts">
          <div>
            <dt>Events attended</dt>
            <dd>{journey.attendanceCount}</dd>
          </div>
          <div>
            <dt>Attendance badges</dt>
            <dd>{journey.badges.length}</dd>
          </div>
          <div>
            <dt>Learning resources</dt>
            <dd>{journey.resources.length}</dd>
          </div>
        </dl>
      ) : (
        <p role="status">
          {journeyError
            ? "Activity totals are unavailable. Your records have not changed."
            : "Loading your activity…"}
        </p>
      )}
      <h3>Upcoming events &amp; registrations</h3>
      {events ? (
        events.length ? (
          <ul className="member-upcoming-events">
            {events.map((event) => {
              const state = overviewEventState(event);
              return (
                <li key={event.id}>
                  <div>
                    <strong>{event.title}</strong>
                    <time dateTime={event.starts_at}>
                      {eventTime(event.starts_at)}
                    </time>
                  </div>
                  <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
                  <Link
                    href={
                      "/member/events?eventId=" + encodeURIComponent(event.id)
                    }
                  >
                    {state.action} →
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p>No upcoming events are currently available to your account.</p>
        )
      ) : (
        <p role="status">
          {eventsError
            ? "Upcoming events could not be loaded. Open Events to try again."
            : "Loading upcoming events…"}
        </p>
      )}
      <Link className="button secondary" href="/member/events">
        Open events &amp; attendance →
      </Link>
    </section>
  );
}
