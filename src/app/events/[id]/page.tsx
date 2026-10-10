import { notFound } from "next/navigation";
import Link from "next/link";
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
      "SELECT id,title,description,location,starts_at,ends_at FROM tpa.events WHERE id=$1 AND status='published'",
      [id],
    )
  ).rows[0];
  if (!event) notFound();
  return (
    <SiteShell>
      <main id="main" className="page-content">
        <Link href="/events">← Events</Link>
        <h1>{event.title}</h1>
        <p>
          {new Date(event.starts_at).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })}{" "}
          IST
        </p>
        <p>{event.location}</p>
        <p className="prose-text">{event.description}</p>
        {new Date(event.starts_at) > new Date() ? (
          <Link className="button" href={`/member/events?eventId=${id}`}>
            Sign in to register for free →
          </Link>
        ) : (
          <p>Registration has closed for this event.</p>
        )}
        <p>
          Attendance is recorded separately. TPA learning hours are not
          externally accredited.
        </p>
      </main>
    </SiteShell>
  );
}
