"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "./operations-client";
import type { EventJourney } from "./member-event-journey";
import { PortalIcon } from "./portal-icon";
export function MemberOverviewActivity() {
  const [journey, setJourney] = useState<EventJourney>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<EventJourney>("/api/member/event-journey")
      .then((data) => {
        if (active) setJourney(data);
      })
      .catch(() => {
        if (active)
          setError(
            "Your activity could not be loaded. Open Events to try again.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section
      className="member-card member-overview-activity"
      aria-labelledby="overview-activity-title"
    >
      <div className="member-card-heading">
        <h2 id="overview-activity-title">Your association activity</h2>
        <PortalIcon name="calendar" />
      </div>
      {journey ? (
        <>
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
          <p>
            {journey.attendanceCount
              ? "Your attendance, resources and registrations are available in Events."
              : "Your attended events and learning resources will appear here as you take part."}
          </p>
          {!!journey.badges.length && (
            <p>
              Latest badge: <strong>{journey.badges[0].name}</strong>
            </p>
          )}
          <Link className="button secondary" href="/member/events">
            {journey.attendanceCount
              ? "View your event history"
              : "Browse upcoming events"}{" "}
            →
          </Link>
        </>
      ) : (
        <div>
          <p role="status">{error || "Loading your activity…"}</p>
          {error && (
            <Link className="button secondary" href="/member/events">
              Open Events →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
