"use client";
import { useId, useState } from "react";
import { api } from "./operations-client";
import { newsletterConsent, subscriptionRequested } from "@/domain/newsletter";
import { homeDefaults } from "@/domain/website-home";

export function NewsletterSignup({
  readOnly = false,
  copy = homeDefaults.newsletterContent,
}: {
  readOnly?: boolean;
  copy?: typeof homeDefaults.newsletterContent;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <aside
      className="newsletter-panel"
      id="subscribe"
      aria-labelledby={`${id}-title`}
    >
      <div className="newsletter-copy">
        <span className="eyebrow">{copy.eyebrow}</span>
        <h3 id={`${id}-title`}>
          <span>{copy.titleLine1}</span>
          <br />
          <em>{copy.titleLine2}</em>
        </h3>
        <p>{copy.description}</p>
      </div>
      <form
        className="newsletter-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setMessage("");
          const data = new FormData(event.currentTarget);
          try {
            await api("/api/newsletter/subscribe", {
              email: data.get("email"),
              consent: data.get("consent") === "on",
              website: data.get("website"),
            });
            setMessage(subscriptionRequested);
          } catch (error) {
            setMessage((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="newsletter-email-label" htmlFor={`${id}-email`}>
          {copy.emailLabel}
        </label>
        <div className="newsletter-input-row">
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            placeholder={copy.placeholder}
            spellCheck={false}
            maxLength={254}
            required
            aria-describedby={`${id}-status`}
          />
          <button className="button" disabled={busy || readOnly}>
            {busy ? "Requesting…" : copy.buttonLabel}
          </button>
        </div>
        <label className="newsletter-consent">
          <input type="checkbox" name="consent" required disabled={readOnly} />
          {newsletterConsent}
        </label>
        <div className="form-trap" aria-hidden="true">
          <label>
            Leave this empty
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <div className="newsletter-topics" aria-label="Newsletter topics">
          {copy.topics.map((topic, index) => (
            <span key={index}>{topic}</span>
          ))}
        </div>
        <p id={`${id}-status`} className="newsletter-status" role="status">
          {message}
        </p>
      </form>
      <span className="newsletter-watermark" aria-hidden="true">
        tpa.
      </span>
    </aside>
  );
}
