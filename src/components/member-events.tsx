"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { api } from "./operations-client";
import { useSearchParams } from "next/navigation";
type Event = {
  id: string;
  title: string;
  payment_status: string;
  fee_paise: number;
  registration_starts_at: string | null;
  registration_ends_at: string | null;
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
        Register for events and view your payment and attendance status. Paid
        registrations are confirmed after manual verification. Registration and
        attendance are separate. TPA learning-hour rules have not yet been
        configured.
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
            {event.registration_status === "registered" &&
              event.payment_status === "pending" && (
                <p>
                  Payment pending.{" "}
                  <Link href="/member/payments">
                    View association payment instructions →
                  </Link>{" "}
                  Include your event and member details when contacting the
                  association.
                </p>
              )}
            {event.registration_starts_at && (
              <p>
                Registration opens{" "}
                {new Date(event.registration_starts_at).toLocaleString("en-IN")}
              </p>
            )}
            {event.registration_ends_at && (
              <p>
                Registration closes{" "}
                {new Date(event.registration_ends_at).toLocaleString("en-IN")}
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
            {event.status === "published" &&
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
