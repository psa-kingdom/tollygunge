import Link from "next/link";
import { PortalIcon } from "./portal-icon";
import { CopyValue } from "./portal-values";
import styles from "./portal-review.module.css";

export function MemberReviewHeading({ name, email }: { name: string; email: string }) {
  const displayName = name.trim() || "member";
  const initials = displayName.split(/\s+/).slice(0, 2).map(part => part[0]).join("");
  return (
    <>
      <header className={`${styles.heading} ${styles.memberHeading}`}>
        <span className={styles.avatar} aria-hidden="true">{initials}</span>
        <div>
          <h1>Hello, {displayName}.</h1>
          <p><CopyValue value={email} /></p>
        </div>
        <Link className={styles.profileLink} href="/account/profile">Your profile <PortalIcon name="arrow" /></Link>
      </header>

    </>
  );
}
