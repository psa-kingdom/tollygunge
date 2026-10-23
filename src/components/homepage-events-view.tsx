import Link from "next/link";
import { NewsletterSignup } from "./newsletter-signup";
export type HomeEvent = { id: string; title: string; starts_at: Date | string; location: string };
export function HomepageEventsView({ events, readOnly = false, heading = "Make room for what comes next." }: { events: HomeEvent[]; readOnly?: boolean; heading?: string }) {
  const date = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  return <section className="v3-events" aria-labelledby="home-events-title">
    <div className="v3-section-inner">
      <div className="section-heading"><div><span className="eyebrow">EVENTS & LEARNING</span><h2 id="home-events-title">{heading === "Make room for what comes next." ? <>Make room for<br /><em>what comes next.</em></> : heading}</h2></div><Link className="text-link" href="/events">View all events <span aria-hidden="true">↗</span></Link></div>
      {events.length ? <ul className="v3-event-list">{events.map(event => <li key={event.id}>
        <time dateTime={new Date(event.starts_at).toISOString()}>{date.format(new Date(event.starts_at))}</time>
        <div><h3><Link href={`/events/${event.id}`}>{event.title}</Link></h3><p>{time.format(new Date(event.starts_at))} IST{event.location ? ` · ${event.location}` : ""}</p></div>
        <Link className="button secondary" href={`/events/${event.id}`} aria-label={`View ${event.title}`}>View event <span aria-hidden="true">↗</span></Link>
      </li>)}</ul> : <div className="v3-events-empty"><p>New events will appear here when they are published.</p><Link className="button gold" href="/events">Explore the event calendar <span aria-hidden="true">→</span></Link></div>}
      <NewsletterSignup readOnly={readOnly} />
    </div>
  </section>;
}
