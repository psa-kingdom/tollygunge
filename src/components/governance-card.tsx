"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { GovernancePortrait } from "./governance-portrait";
import type { PublicGovernanceEntry } from "./public-governance";
import styles from "./governance-card.module.css";

export function GovernanceCard({ entry, children }: { entry: PublicGovernanceEntry; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const p = entry.published;
  useEffect(() => {
    if (!open) return;
    const surface = dialog.current;
    const originalTrigger = trigger.current;
    surface?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      surface?.close();
      document.body.style.overflow = previous;
      originalTrigger?.focus();
    };
  }, [open]);
  return (
    <>
      <article className={`person-card ${styles.card}`} data-cms-record={`people:${entry.id}`}>
        <button type="button" ref={trigger} className={styles.open} aria-label={`View ${p.name} details`}
          aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <span className={`person-card-identity ${styles.identity}`}>
            <GovernancePortrait name={p.name} alt={entry.portrait_alt ?? p.name}
              src={p.portraitId && entry.portrait_available ? p.portraitKind === "profile" ? `/api/profile-portraits/${p.portraitId}` : `/media/${p.portraitId}` : undefined} />
            <span className={styles.summary}>
              <span className="eyebrow">{[p.parentName, p.groupName].filter(Boolean).join(" / ")}</span>
              <span className={styles.name}>{p.name}</span>
              <span className="person-role">{p.role}</span>
            </span>
          </span>
        </button>
        <GovernanceContacts name={p.name} mobile={p.mobile || p.phone} email={p.email} />
      </article>
      {open && (
        <dialog ref={dialog} className={styles.dialog} aria-label={`${p.name} details`}
          onCancel={event => { event.preventDefault(); setOpen(false); }}
          onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div className={styles.bar}>
            <span>Profile details</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close profile details" autoFocus>Close ×</button>
          </div>
          {children}
        </dialog>
      )}
    </>
  );
}

export function GovernanceContacts({ name, mobile, email }: {
  name: string;
  mobile?: string;
  email?: string;
}) {
  return (
    <div className={styles.contacts} data-governance-contacts>
      {mobile ? <a className={styles.phone} href={`tel:${mobile.replace(/[ ()-]/g, "")}`} aria-label={`Call ${name}: ${mobile}`} title={mobile}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4c0 2-3 3-5 2A22 22 0 0 1 3 8C2 6 3 3 5 3Z"/></svg>
        <span>{mobile}</span>
      </a> : <span className={styles.unavailable} aria-label="Mobile not provided">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4c0 2-3 3-5 2A22 22 0 0 1 3 8C2 6 3 3 5 3Z"/></svg>
        <span>Not provided</span>
      </span>}
      {email ? <a className={styles.email} href={`mailto:${email}`} aria-label={`Email ${name}: ${email}`} title={email}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 5h18v14H3ZM3 5l9 8 9-8"/></svg>
        <span>{email}</span>
      </a> : <span className={styles.unavailable} aria-label="Email not provided">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 5h18v14H3ZM3 5l9 8 9-8"/></svg>
        <span>Not provided</span>
      </span>}
    </div>
  );
}
