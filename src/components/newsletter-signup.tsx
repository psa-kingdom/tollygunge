"use client";
import { useId, useState } from "react";
import { api } from "./operations-client";
import { newsletterConsent, subscriptionRequested } from "@/domain/newsletter";

export function NewsletterSignup({ readOnly = false }: { readOnly?: boolean }) {
  const id = useId();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  return <aside className="newsletter-panel" id="subscribe" aria-labelledby={`${id}-title`}>
    <div className="newsletter-copy"><span className="eyebrow">STAY IN THE KNOW</span><h3 id={`${id}-title`}>Good things,<br /><em>worth knowing.</em></h3><p>TPA newsletters, professional insights, and public event announcements. Unsubscribe any time.</p></div>
    <form className="newsletter-form" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setMessage("");
      const data = new FormData(event.currentTarget);
      try { await api("/api/newsletter/subscribe", { email: data.get("email"), consent: data.get("consent") === "on", website: data.get("website") }); setMessage(subscriptionRequested); }
      catch(error) { setMessage((error as Error).message); } finally { setBusy(false); }
    }}>
      <label className="newsletter-email-label" htmlFor={`${id}-email`}>Email address</label>
      <div className="newsletter-input-row"><input id={`${id}-email`} name="email" type="email" autoComplete="email" placeholder="your.name@firm.in" spellCheck={false} maxLength={254} required aria-describedby={`${id}-status`} /><button className="button" disabled={busy || readOnly}>{busy ? "Requesting…" : "Subscribe"}</button></div>
      <label className="newsletter-consent"><input type="checkbox" name="consent" required disabled={readOnly} />{newsletterConsent}</label>
      <div className="form-trap" aria-hidden="true"><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="newsletter-topics" aria-label="Newsletter topics"><span>Professional insights</span><span>TPA news</span><span>Events</span></div>
      <p id={`${id}-status`} className="newsletter-status" role="status">{message}</p>
    </form>
    <span className="newsletter-watermark" aria-hidden="true">tpa.</span>
  </aside>;
}
