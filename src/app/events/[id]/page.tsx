import { bookingLabel, eventTime, type Speaker } from "@/domain/event-flow";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PublicEventResources } from "@/components/public-event-resources";
import { SiteShell } from "@/components/site-shell";
import { getDatabase } from "@/lib/database";
import { uuid } from "@/domain/operations";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    uuid(id);
  } catch {
    notFound();
  }
  const event = (
    await getDatabase().query(
      "SELECT status,booking_closed,completed_at,archived_at,id,title,description,speakers,location,starts_at,ends_at,fee_paise,registration_starts_at,registration_ends_at FROM tpa.events WHERE id=$1 AND status='published' AND visibility='public'",
      [id],
    )
  ).rows[0];
  if (!event) notFound();
  return (
    <SiteShell>
      <main id="main" className="page-content">
        <Link href="/events">← Events</Link>
        <h1>{event.title}</h1>
        {event.fee_paise > 0 && <p className="notice">Payment is manually verified. Your registration is confirmed after staff checks payment.</p>}
        <p>{eventTime(event.starts_at)} to {eventTime(event.ends_at)}</p>
        <p>{bookingLabel(event)}</p>
        <p>{event.location}</p>
        <p className="prose-text">{event.description}</p>
        {event.speakers.length > 0 && <section className="content-section"><h2>Speakers</h2>{event.speakers.map((speaker: Speaker, i: number) => <p key={i}><strong>{speaker.name}</strong>{speaker.credentials && <> · {speaker.credentials}</>}{speaker.designation&&<> · {speaker.designation}</>}{speaker.organization&&<> · {speaker.organization}</>}{speaker.description&&<> · {speaker.description}</>}</p>)}</section>}
        {bookingLabel(event) === "Registration open" ? (
          <Link className="button" href={`/member/events?eventId=${id}`}>
            {event.fee_paise
              ? `Sign in to register · ₹${(event.fee_paise / 100).toFixed(2)} →`
              : "Sign in to register for free →"}
          </Link>
        ) : (
          <p>{bookingLabel(event)}</p>
        )}
        <PublicEventResources eventId={id}/>
        <p>
          Attendance is recorded separately. TPA learning hours are not
          externally accredited.
        </p>
      </main>
    </SiteShell>
  );
}
