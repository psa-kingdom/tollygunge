/* eslint-disable @next/next/no-html-link-for-pages -- Recovery uses full document navigation so a broken client router is not reused. */
import { fallbacks, type FallbackKind } from "@/domain/fallbacks";
import styles from "./fallback-screen.module.css";

export function FallbackPanel({ kind, retry, reference }: { kind: FallbackKind; retry?: () => void; reference?: string }) {
  const content = fallbacks[kind];
  return <section className={styles.panel} aria-labelledby="fallback-title">
    <div className={styles.symbol} aria-hidden="true">{kind === "notFound" ? "404" : kind === "error" || kind === "unavailable" ? "↻" : "·"}</div>
    <p className={styles.eyebrow}>{content.label}</p>
    <h1 id="fallback-title" className={styles.title}>{content.title}</h1>
    <p className={styles.description}>{content.description}</p>
    <div className={styles.actions}>
      {retry && <button className={styles.primary} onClick={retry}>Try again <span aria-hidden="true">↻</span></button>}
      <a className={retry ? styles.secondary : styles.primary} href={content.action.href}>{content.action.label}<span aria-hidden="true">→</span></a>
    </div>
    {reference && /^[a-zA-Z0-9_-]{1,80}$/.test(reference) && <p className={styles.reference}>Support reference: {reference}</p>}
  </section>;
}

/** Safe during outages: no database, session, remote assets or normal site shell. */
export function FallbackScreen(props: Parameters<typeof FallbackPanel>[0]) {
  return <div className={styles.screen}>
    <header className={styles.header}><a href="/" className={styles.brand} aria-label="TPA homepage"><span className={styles.mark}>tpa<span>·</span></span><span>TOLLYGUNGE<br />PROFESSIONAL ASSOCIATION</span></a><a className={styles.help} href="/contact">Contact TPA <span aria-hidden="true">↗</span></a></header>
    <main id="main" className={styles.main}><FallbackPanel {...props} /><nav className={styles.links} aria-label="Helpful pages"><a href="/about">About the association <span aria-hidden="true">↗</span></a><a href="/events">Explore events <span aria-hidden="true">↗</span></a><a href="/login">Member sign-in <span aria-hidden="true">↗</span></a></nav></main>
    <footer className={styles.footer}><span>Connect. Learn. Collaborate.</span><span>Tollygunge Professional Association</span></footer>
  </div>;
}
