"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatCpeHours } from "@/domain/cpe-hours";
import { bookingLabel, eventTime, type Speaker } from "@/domain/event-flow";
import { api } from "./operations-client";
import styles from "./public-event-popup.module.css";

type EventDetails = {
  id: string; title: string; description: string; location: string;
  starts_at: string; ends_at: string; organiser: string | null; cpe_hours: string;
  speakers: Speaker[]; fee_paise: number; has_banner: boolean; status: string;
  booking_closed: boolean; completed_at: string | null; archived_at: string | null;
  registration_starts_at: string | null; registration_ends_at: string | null;
};

export function PublicEventPopup() {
  const [eventId, setEventId] = useState<string>();
  const [event, setEvent] = useState<EventDetails>();
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download") || link.closest("dialog")) return;
      const url = new URL(link.href);
      const match = url.pathname.match(/^\/events\/([a-f0-9-]{36})$/i);
      if (!match || url.origin !== location.origin) return;
      e.preventDefault();
      e.stopPropagation();
      trigger.current = link;
      setEvent(undefined);
      setError("");
      setEventId(match[1]);
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, []);

  useEffect(() => {
    if (!eventId) return;
    const surface = dialog.current;
    surface?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let active = true;
    api<EventDetails>("/api/public/events/" + eventId)
      .then(data => { if (active) setEvent(data); })
      .catch(failure => { if (active) setError(failure.message); });
    return () => {
      active = false;
      surface?.close();
      document.body.style.overflow = overflow;
      trigger.current?.focus();
    };
  }, [eventId]);

  if (!eventId) return null;
  return (
    <dialog ref={dialog} className={styles.dialog} aria-label={event?.title ?? "Event details"}
      onCancel={e => { e.preventDefault(); setEventId(undefined); }}
      onClick={e => { if (e.target === e.currentTarget) setEventId(undefined); }}>
      <div className={styles.bar}><span>Event details</span>
        <button autoFocus type="button" onClick={() => setEventId(undefined)} aria-label="Close event details">Close ×</button>
      </div>
      <div className={styles.body}>
        {!event && !error && <p role="status">Loading event details…</p>}
        {error && <p role="alert">{error}</p>}
        {event && <>
          {event.has_banner && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.banner} src={"/api/event-banners/" + event.id} alt="" />
          )}
          <h2>{event.title}</h2>
          <dl className={styles.facts}>
            <div><dt>Date &amp; time</dt><dd>{eventTime(event.starts_at)} – {eventTime(event.ends_at)}</dd></div>
            <div><dt>Venue</dt><dd>{event.location}</dd></div>
            {event.organiser && <div><dt>Organiser</dt><dd>{event.organiser}</dd></div>}
            {event.cpe_hours && <div><dt>CPE hours</dt><dd>{formatCpeHours(event.cpe_hours)}</dd></div>}
            <div><dt>Registration fee</dt><dd>{event.fee_paise ? "₹" + (event.fee_paise / 100).toFixed(2) : "Free"}</dd></div>
          </dl>
          {event.description && <p className="prose-text">{event.description}</p>}
          {event.speakers.length > 0 && <section><h3>Speakers</h3>
            {event.speakers.map((speaker, i) => <p key={i}><strong>{speaker.name}</strong>
              <br />{[speaker.credentials, speaker.designation, speaker.organization].filter(Boolean).join(" · ")}
              {speaker.description && <><br />{speaker.description}</>}
            </p>)}
          </section>}
          {bookingLabel(event) === "Registration open" ? (
            <Link className="button" href={"/events/" + event.id} onClick={() => setEventId(undefined)}>Register now</Link>
          ) : <p>{bookingLabel(event)}</p>}
        </>}
      </div>
    </dialog>
  );
}
