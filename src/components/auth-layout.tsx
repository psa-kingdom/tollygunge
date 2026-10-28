import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./auth-layout.module.css";

export function AuthLayout({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main id="main" className={`page-content ${styles.layout}`}>
      <section className={styles.formPanel} aria-labelledby="auth-title">
        <div className={styles.formContent}>
          <span className={styles.eyebrow}>Your TPA account</span>
          <h1 id="auth-title">{title}</h1>
          <p className={styles.description}>{description}</p>
          {children}
        </div>
      </section>
      <aside className={styles.community} aria-labelledby="community-title">
        <span className={styles.communityLabel}>Tollygunge Professional Association</span>
        <h2 id="community-title">A shared place.<br />A stronger community.</h2>
        <p>Connect with the association, keep your profile up to date, and find your next TPA event.</p>
        <Image className={styles.art} src="/design/kolkata-watercolor.webp" width={780} height={600} alt="" />
        <div className={styles.communityFooter}>
          <span>Rooted in Kolkata. Connected through TPA.</span>
          <Link href="/membership">Explore membership <span aria-hidden="true">↗</span></Link>
        </div>
      </aside>
    </main>
  );
}
