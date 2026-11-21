import type { PublicHistoricalEvent } from "@/lib/public-historical-events";
import { selectPublicEvents } from "@/domain/public-event-selection";
import Link from "next/link";
import { NewsletterSignup } from "./newsletter-signup";
import { homeDefaults } from "@/domain/website-home";
export type HomeEvent = {
  id: string;
  title: string;
  starts_at: Date | string;
  location: string;
};
export function HomepageEventsView({
  events,
  pastEvents = [],
  readOnly = false,
  heading = "Make room for what comes next.",
  copy = homeDefaults.eventContent,
  newsletter = homeDefaults.newsletterContent,
}: {
  events: HomeEvent[];
  pastEvents?: PublicHistoricalEvent[];
  readOnly?: boolean;
  heading?: string;
  copy?: typeof homeDefaults.eventContent;
  newsletter?: typeof homeDefaults.newsletterContent;
}) {
  const selected = selectPublicEvents(events, pastEvents);
  const recent = [
    ...selected.events.map((event) => ({
      key: event.id,
      title: event.title,
      location: event.location,
      date: new Date(event.starts_at),
      href: `/events/${event.id}`,
    })),
    ...selected.historical.map((event) => ({
      key: event.date,
      title: event.title,
      location: event.location,
      date: new Date(`${event.date}T12:00:00+05:30`),
      href: `/events/history/${event.date}`,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());
  const date = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
  return (
    <section className="v3-events" aria-labelledby="home-events-title">
      <div className="v3-section-inner">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{copy.eyebrow}</span>
            <h2
              id="home-events-title"
              data-cms-field={readOnly ? "copy.sectionHeading37" : undefined}
            >
              {heading === "Make room for what comes next." ? (
                <>
                  Make room for
                  <br />
                  <em>what comes next.</em>
                </>
              ) : (
                heading
              )}
            </h2>
          </div>
          <Link className="text-link" href="/events">
            {copy.browseLabel} <span aria-hidden="true">↗</span>
          </Link>
        </div>
        {recent.length ? (
          <ul className="v3-event-list">
            {recent.map((event) => (
              <li key={event.key}>
                <time dateTime={event.date.toISOString()}>
                  {date.format(event.date)}
                </time>
                <div>
                  <h3>
                    <Link href={event.href}>{event.title}</Link>
                  </h3>
                  <p>
                    {event.date.toLocaleDateString("en-IN", {
                      year: "numeric",
                      timeZone: "Asia/Kolkata",
                    })}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
                <Link
                  className="button secondary"
                  href={event.href}
                  aria-label={`View ${event.title}`}
                >
                  {copy.viewLabel} <span aria-hidden="true">↗</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="v3-events-empty">
            <p>{copy.emptyText}</p>
            <Link className="button gold" href="/events">
              {copy.emptyLinkLabel} <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
        <NewsletterSignup readOnly={readOnly} copy={newsletter} />
      </div>
    </section>
  );
}
