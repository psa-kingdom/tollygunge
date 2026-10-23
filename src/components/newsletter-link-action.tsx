"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { api } from "./operations-client";

export function NewsletterLinkAction({ action }: { action: "confirm" | "unsubscribe" }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [token, setToken] = useState<string | null>(null), [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => { setToken(new URLSearchParams(location.hash.slice(1)).get("token") ?? ""); history.replaceState(null, "", location.pathname); }, 0);
    return () => clearTimeout(timer);
  }, []);
  return <main id="main" className="newsletter-link-page"><span className="eyebrow">TPA NEWSLETTERS & EVENTS</span><h1 ref={heading} tabIndex={-1}>{done ? (action === "confirm" ? "You’re subscribed." : "You’re unsubscribed.") : action === "confirm" ? "One last step." : "Your inbox, your choice."}</h1>
    <p>{done ? (action === "confirm" ? "You’ll receive TPA newsletters and public event announcements. Every email includes an unsubscribe link." : "You will no longer receive the public TPA newsletter or event announcements through this subscription.") : action === "confirm" ? "Confirm that you want to receive TPA newsletters and public event announcements. No account or membership is created." : "Unsubscribe from TPA’s public newsletter and event announcements. Your website account and member preferences are unchanged."}</p>
    {token === null ? <p role="status">Checking link…</p> : !token ? <p role="alert">This link is missing. Use the complete link from your email, or request a new subscription below.</p> : !done && <button className="button" disabled={busy} onClick={async () => {
      setBusy(true); setError(""); try { await api(`/api/newsletter/${action}`, { token }); setDone(true); requestAnimationFrame(() => heading.current?.focus()); } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
    }}>{busy ? "Saving…" : action === "confirm" ? "Confirm subscription" : "Unsubscribe"}</button>}
    <p role="status">{error}</p><Link className="text-link" href="/#subscribe">Back to TPA updates →</Link>
  </main>;
}
