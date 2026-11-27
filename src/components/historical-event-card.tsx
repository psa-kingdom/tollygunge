import type { PublicHistoricalEvent } from "@/lib/public-historical-events";

export function HistoricalEventCard({ event, detail = false }: { event: PublicHistoricalEvent; detail?: boolean }) {
  const Heading = detail ? "h1" : "h3";
  const speakers = event.speakers.split(/[;\n]+/).map(name => name.trim()).filter(Boolean);
  const overview = event.description
    .replace(/\s+(?=Topics:|Held on \d|This is a past event)/g, "\n\n")
    .split(/\n\s*\n/).map(paragraph => paragraph.trim()).filter(Boolean);
  return (
    <article className="event-row historical-event-card" id={`event-${event.date}`} aria-labelledby={`event-title-${event.date}`}>
      <header className="historical-event-card-header">
        <p className="historical-event-date"><time dateTime={event.date}>{new Intl.DateTimeFormat("en-IN", {day:"numeric",month:"long",year:"numeric",timeZone:"Asia/Kolkata"}).format(new Date(`${event.date}T12:00:00+05:30`))}</time></p>
        <Heading id={`event-title-${event.date}`}>{event.title}</Heading>
      </header>
      {(event.location || speakers.length > 0 || event.description) && <div className="historical-event-card-body">
        {(event.location || speakers.length > 0) && <div className="historical-event-copy">
          <dl className="historical-event-facts">
            {event.location && <div className="historical-event-venue"><dt>Venue</dt><dd>{event.location}</dd></div>}
            {speakers.length > 0 && <div><dt>{speakers.length > 1 ? "Speakers" : "Speaker"}</dt><dd><ul>{speakers.map((speaker,index) => <li key={`${speaker}-${index}`}>{speaker}</li>)}</ul></dd></div>}
          </dl>
        </div>}
        {overview.length > 0 && <section className="historical-event-overview" aria-label="Event overview"><h4>Overview</h4>{overview.map((paragraph,index) => <p key={index}>{paragraph}</p>)}</section>}
      </div>}
    </article>
  );
}
