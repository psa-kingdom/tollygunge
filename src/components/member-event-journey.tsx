"use client";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
import { PortalIcon } from "./portal-icon";

export type EventJourney = {
  attendanceCount: number;
  badges: { id: string; name: string; description: string; icon: string }[];
  resources: {
    id: string;
    event_id: string;
    title: string;
    description: string;
    type: string;
  }[];
};

export function MemberEventJourney() {
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

  return (
    <section
      className="content-section member-event-journey"
      aria-labelledby="event-journey-title"
    >
      <h2 id="event-journey-title">Your event journey</h2>
      {journey ? (
        <div className="event-journey-grid">
          <div className="event-attendance-stat">
            <PortalIcon name="calendar" />
            <strong>{journey.attendanceCount}</strong>
            <span>Events attended</span>
            <p>Your recorded attendance, all in one place.</p>
          </div>
          <section className="event-journey-detail">
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
          </section>
          <section className="event-journey-detail">
            <h3>
              <PortalIcon name="file" /> Unlocked resources
            </h3>
            {journey.resources.length ? (
              <ul className="event-journey-list">
                {journey.resources.map((r) => (
                  <li key={r.id}>
                    <a href={`/api/event-assets/${r.id}`}>{r.title}</a>
                    <p>
                      {r.type.replaceAll("_", " ")}
                      {r.description ? ` · ${r.description}` : ""}
                    </p>
                    <a href={`/member/events?eventId=${r.event_id}`}>
                      View event →
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <strong>Resources will appear here</strong>
                <p>There are no published resources available to you yet.</p>
              </>
            )}
          </section>
        </div>
      ) : (
        <p role={error ? "alert" : "status"}>
          {error || "Loading your event journey…"}
        </p>
      )}
    </section>
  );
}
