import Link from "next/link";
import { PortalIcon } from "./portal-icon";
import styles from "./portal-review.module.css";

/** Presentation shared by the first client-review screens; no business state. */
export function PortalReviewHeading() {
  return (
    <header className={styles.heading}>
      <div>
        <span className={styles.kicker}>Community / Membership</span>
        <h1>Members</h1>
        <p>Membership records, account details, and the next step for every member.</p>
      </div>
      <span className={styles.headingMark} aria-hidden="true"><PortalIcon name="people" /></span>
    </header>
  );
}

export function MemberReviewHeading({ name, email }: { name: string; email: string }) {
  const displayName = name.trim() || "member";
  const initials = displayName.split(/\s+/).slice(0, 2).map(part => part[0]).join("");
  return (
    <>
      <header className={`${styles.heading} ${styles.memberHeading}`}>
        <span className={styles.avatar} aria-hidden="true">{initials}</span>
        <div>
          <span className={styles.kicker}>Your member space</span>
          <h1>Hello, {displayName}.</h1>
          <p>{email}</p>
        </div>
        <Link className={styles.profileLink} href="/account/profile">Your profile <PortalIcon name="arrow" /></Link>
      </header>
      <nav className={styles.sectionLinks} aria-label="Member shortcuts">
        <Link href="/member" aria-current="page">Overview</Link>
        <Link href="/account/profile">My profile</Link>
        <Link href="/member/events">Events &amp; attendance</Link>
      </nav>
    </>
  );
}
