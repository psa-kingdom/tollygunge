import { eventOrganiserUpis } from "@/lib/organiser-upi";
import { formatCpeHours } from "@/domain/cpe-hours";
import { membershipPlans } from "@/lib/membership-plans";
import { Header } from "@/components/site-shell";
import styles from "./registration.module.css";
import { currentActor } from "@/lib/actor";
import { EventRegistrationForm } from "./registration-form";
import { bookingLabel, speakerDesignation, type Speaker } from "@/domain/event-flow";
import { notFound } from "next/navigation";
import Link from "next/link";


import { getDatabase } from "@/lib/database";
import { uuid } from "@/domain/operations";
import { publicMetadata } from "@/domain/public-metadata";

export const dynamic = "force-dynamic";
export async function generateMetadata({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  try { uuid(id); } catch { return { title: "Event not found", robots: {index:false,follow:false} }; }
  const row=(await getDatabase().query("SELECT title,description FROM tpa.events WHERE id=$1 AND status='published' AND visibility='public'",[id])).rows[0];
  return row ? publicMetadata(`/events/${id}`,row.title,row.description) : {title:"Event not found",robots:{index:false,follow:false}};
}
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
      "SELECT status,booking_closed,completed_at,archived_at,id,title,description,speakers,location,organiser,registration_note,cpe_hours,starts_at,ends_at,fee_paise,payment_account_ids,payment_revision,registration_starts_at,registration_ends_at,(starts_at>now() AND completed_at IS NULL AND archived_at IS NULL AND EXISTS(SELECT 1 FROM tpa.event_banners b WHERE b.event_id=events.id)) AS has_banner FROM tpa.events WHERE id=$1 AND status='published' AND visibility='public'",
      [id],
    )
  ).rows[0];
  if (!event) notFound();
  const plans = await membershipPlans();
  const freePlanName = plans.find(plan => plan.code === "Free")?.name ?? "Free";
  const open = bookingLabel(event) === "Registration open";
  const actor = open ? await currentActor() : null;
  const { rows: [attendee] } = actor ? await getDatabase().query(
    `SELECT p.accepted,p.mobile_normalized,mp.phone,r.status AS booking_status
      FROM public."user" u LEFT JOIN tpa.people p ON p.user_id=u.id AND p.archived_at IS NULL
      LEFT JOIN tpa.member_profiles mp ON mp.user_id=u.id
      LEFT JOIN tpa.event_registrations r ON r.user_id=u.id AND r.event_id=$2 WHERE u.id=$1`,
    [actor.id, id],
  ) : { rows: [] };
  const saved = attendee?.accepted ?? {};
  const [given = "", ...family] = (actor?.name ?? "").trim().split(/\s+/);
  const profile = {
    prefix: saved.prefix ?? "",
    firstName: saved.firstName ?? given,
    lastName: saved.lastName ?? family.join(" "),
    mobile: attendee?.mobile_normalized ?? (saved.phone || attendee?.phone || ""),
    organization: saved.organization ?? "",
    jobTitle: saved.jobTitle ?? "",
    city: saved.city ?? "",
    country: "India",
  };
  const studyCircle = event.organiser === "CA CP Study Circle";
  const organiser = studyCircle ? "Tollygunge CA CPE Study Circle" : "Tollygunge Professional Association";
  const dateParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).formatToParts(event.starts_at);
  const datePart = (name: string) => dateParts.find(part => part.type === name)?.value ?? "";
  const day = Number(datePart("day"));
  const ordinal = day >= 11 && day <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th");
  const date = `${datePart("weekday")}, ${day}${ordinal} ${datePart("month")} ${datePart("year")}`;
  const clock = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true,
  });
  const time = (value: Date) => clock.format(value).replace(":", ".").toUpperCase();
  return (
    <>
      <div className="public-shell"><Header /></div>
      <main id="main" className={styles.reference}>
      <div className={styles.wrap}>
        <header className={styles.letterhead}>
          <div className={styles["header-row"]}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.seal} src={studyCircle ? "/design/event-registration-icai.jpg" : "/design/tpa-logo.png"} alt={studyCircle ? "ICAI Logo" : "TPA Logo"} width={108} height={108} />
            <div className={styles["header-center"]}>
              <h1 className={styles.title}>{organiser}</h1>
              {studyCircle && <h2 className={styles["sub-title"]}>of EIRC of ICAI</h2>}
              <p className={styles.motto} lang="sa">तमसो मा ज्योतिर्गमय</p>
              <p className={styles["motto-sub"]}>Knowledge &nbsp;·&nbsp; Integrity &nbsp;·&nbsp; Service</p>
            </div>
            {studyCircle && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.seal} src="/design/event-registration-ca.jpg" alt="CA Logo" width={108} height={108} />
            )}
          </div>
          <div className={styles.rule} />
        </header>

        <section className={styles["event-card"]} aria-label="Event details">
          <div className={styles["event-topic"]}>
            <p className={styles["event-topic-label"]}>{studyCircle ? "Seminar On" : "Event"}</p>
            <p className={styles["event-topic-value"]}>{studyCircle && event.description ? event.description : event.title}</p>
          </div>
          <div className={styles["event-divider"]} />
          <div className={`${styles["event-facts"]} ${!event.cpe_hours ? styles["without-cpe"] : ""}`}>
            <div className={`${styles["event-item"]} ${styles["fact-date"]}`}>
              <span className={styles["event-label"]}>Date &amp; Time</span>
              <span className={styles["event-value"]}>{date}<br />{time(event.starts_at)} - {time(event.ends_at)}</span>
            </div>
            {event.cpe_hours && (
              <div className={`${styles["event-item"]} ${styles["fact-cpe"]}`}>
                <span className={styles["event-label"]}>CPE Hours</span>
                <span className={styles["event-value"]}>{formatCpeHours(event.cpe_hours)}</span>
              </div>
            )}
            <div className={`${styles["event-item"]} ${styles["fact-venue"]}`}>
              <span className={styles["event-label"]}>Venue</span>
              <span className={styles["event-value"]}>{event.location}</span>
            </div>
            {event.speakers.length > 0 && (
              <div className={`${styles["event-item"]} ${styles["fact-speakers"]}`}>
                <span className={styles["event-label"]}>{event.speakers.length === 1 ? "Eminent Speaker" : "Eminent Speakers"}</span>
                <ul className={styles["speaker-list"]}>{event.speakers.map((speaker: Speaker, index: number) => (
                  <li key={index}>
                    {speaker.name}
                    {speakerDesignation(speaker) && (
                      <span className={styles["speaker-role"]}>{speakerDesignation(speaker)}</span>
                    )}
                  </li>
                ))}</ul>
              </div>
            )}
            <div className={`${styles["event-item"]} ${styles["fact-organiser"]}`}>
              <span className={styles["event-label"]}>Organiser name</span>
              <span className={styles["event-value"]}>{event.organiser || "Not recorded"}</span>
            </div>
          </div>
        </section>

        {open && event.registration_note && <p className={styles.note}>{event.registration_note}</p>}
        {open && attendee?.booking_status !== "registered" ? (
          <EventRegistrationForm id={id} email={actor?.email} verified={actor?.emailVerified ?? false}
            profile={profile} upiAccounts={await eventOrganiserUpis(event)} fee={event.fee_paise} studyCircle={studyCircle} freePlanName={freePlanName} />
        ) : (
          <section className={styles.card}><div className={styles["card-inner"]}>
            {open ? <Link href={`/member/events?eventId=${id}`}>View your booking</Link> : <p>{bookingLabel(event)}</p>}
          </div></section>
        )}
        <p className={styles["footer-note"]}>{organiser}{studyCircle && " · EIRC OF ICAI"} · KOLKATA</p>
      </div>
      </main>
    </>
  );
}
