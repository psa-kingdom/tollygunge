"use client";
import { useState, useEffect } from "react";
import { api } from "./operations-client";
import { useSearchParams } from "next/navigation";
type Event = {
  id: string;
  title: string;
  location: string;
  starts_at: string;
  status: string;
  registration_status: string | null;
  checked_in_at: string | null;
};
export function MemberEvents() {
  const requestedEvent = useSearchParams().get("eventId");
  const [events, setEvents] = useState<Event[]>([]),
    [message, setMessage] = useState("Loading events…"),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Event[]>("/api/member/events")
      .then(setEvents)
      .then(() => setMessage(""))
      .catch((e) => setMessage(e.message));
  }, []);
  return (
    <>
      <p>
        Register for published free events and view your attendance history.
        Registration and attendance are separate. TPA learning-hour rules have
        not yet been configured.
      </p>
      {events.length === 0 && (
        <p>No published events or registration history yet.</p>
      )}
      {[...events]
        .sort(
          (a, b) =>
            Number(b.id === requestedEvent) - Number(a.id === requestedEvent),
        )
        .map((event) => (
          <article className="content-section" key={event.id}>
            <h2>{event.title}</h2>
            <p>
              {new Date(event.starts_at).toLocaleString("en-IN")} ·{" "}
              {event.location}
            </p>
            <p>
              {event.status === "cancelled"
                ? "Event cancelled"
                : event.registration_status === "registered"
                  ? "You are registered"
                  : event.registration_status === "cancelled"
                    ? "Your registration is cancelled"
                    : "Free registration"}
              {event.checked_in_at ? " · Attendance recorded" : ""}
            </p>
            {event.status === "published" &&
              new Date(event.starts_at) > new Date() && (
                <button
                  className="button secondary"
                  disabled={busy}
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
                    : "Register for free"}
                </button>
              )}
          </article>
        ))}
      <p role="status">{message}</p>
    </>
  );
}
