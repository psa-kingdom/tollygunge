import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./auth-layout.module.css";
import review from "./auth-review.module.css";
import { PortalIcon } from "./portal-icon";

export function AuthLayout({ title, description, children, portalReview = false }: {
  title: string;
  description: string;
  children: ReactNode;
  portalReview?: boolean;
}) {
  return (
    <main id="main" className={`page-content ${styles.layout} ${portalReview ? review.login : ""}`}>
      <section className={`${styles.formPanel} ${portalReview ? review.form : ""}`} aria-labelledby="auth-title">
        <div className={styles.formContent}>
          <span className={styles.eyebrow}>{portalReview ? "Member & staff access" : "Your TPA account"}</span>
          <h1 id="auth-title">{title}</h1>
          <p className={styles.description}>{description}</p>
          {children}
        </div>
      </section>
      <aside className={`${styles.community} ${portalReview ? review.identity : ""}`} aria-labelledby="community-title">
        <span className={portalReview ? review.label : styles.communityLabel}>{portalReview && <PortalIcon name="shield" />}Tollygunge Professional Association</span>
        <h2 id="community-title">A shared place.<br />A stronger community.</h2>
        <p>Connect with the association, keep your profile up to date, and find your next TPA event.</p>
        {portalReview ? <ul className={review.features}><li>Your professional profile</li><li>Association events</li><li>Member support</li></ul> : <Image className={styles.art} src="/design/kolkata-watercolor.webp" width={780} height={600} alt="" />}
        <div className={`${styles.communityFooter} ${portalReview ? review.footer : ""}`}>
          <span>Rooted in Kolkata. Connected through TPA.</span>
          <Link href="/membership">Explore membership <span aria-hidden="true">↗</span></Link>
        </div>
      </aside>
    </main>
  );
}
