"use client";
import { useState, useEffect } from "react";
import { api } from "./operations-client";
export function EmailUnsubscribe() {
  const [token, setToken] = useState(""),
    [message, setMessage] = useState("Checking unsubscribe link…"),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      const value =
        new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
      setToken(value);
      setMessage(
        value
          ? "Withdraw your consent to TPA newsletters. Account access and service messages are unaffected."
          : "This unsubscribe link is missing or invalid.",
      );
      window.history.replaceState(null, "", "/unsubscribe");
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  return (
    <>
      <p role="status">{message}</p>
      {token && !done && (
        <button
          className="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api("/api/email/unsubscribe", { token });
              setDone(true);
              setMessage("You have unsubscribed from TPA newsletters.");
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Unsubscribing…" : "Unsubscribe"}
        </button>
      )}
    </>
  );
}
