import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { HistoricalEventCard } from "@/components/historical-event-card";
import { PublicBreadcrumbs } from "@/components/public-breadcrumbs";
import { publicHistoricalEvents } from "@/lib/public-historical-events";
import { publicMetadata } from "@/domain/public-metadata";
export const dynamic = "force-dynamic";
const findEvent = cache(async (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) return null;
  return (await publicHistoricalEvents(date.slice(0, 7))).find(event => event.date === date) ?? null;
});
export async function generateMetadata({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const event = await findEvent(date);
  return event ? publicMetadata(`/events/history/${date}`, event.title, event.description) : { title: "Event not found", robots: { index: false, follow: false } };
}
export default async function Page({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const event = await findEvent(date);
  if (!event) notFound();
  return <SiteShell><main id="main" className="public-information public-page-events historical-event-detail">
    <PublicBreadcrumbs section="Events" href="/events" title={event.title} />
    <HistoricalEventCard event={event} detail />
    <Link className="text-link" href="/member/events">Back to my events </Link>
  </main></SiteShell>;
}
