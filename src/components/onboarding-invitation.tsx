"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export function Invitation() {
  const [token, setToken] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [complete, setComplete] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setToken(new URLSearchParams(location.hash.slice(1)).get("token") ?? "");
      history.replaceState(null, "", "/invitation");
    }, 0);
    return () => clearTimeout(t);
  }, []);
  if (complete)
    return (
      <div>
        <h2>Account activated.</h2>
        <p role="status">{message}</p>
        <p>
          Use the email address that received your invitation. If another
          account is signed in, the sign-in page lets you switch accounts
          explicitly.
        </p>
        <Link className="button" href="/login?switch=1">
          Sign in to your account
        </Link>
      </div>
    );
  return (
    <form
      className="member-settings"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const form = e.currentTarget,
          f = new FormData(form);
        try {
          const r = await fetch("/api/onboarding/invitation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, password: f.get("password") }),
          });
          const data = await r.json();
          if (!r.ok) throw Error(data.error);
          form.reset();
          setToken("");
          setMessage(
            "Password saved and email verified. Sign in to complete your profile.",
          );
          setComplete(true);
        } catch (e) {
          setMessage(
            e instanceof Error ? e.message : "Unable to complete setup.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        New password
        <input
          name="password"
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
        />
      </label>
      <button className="button" disabled={!token || busy}>
        Set password
      </button>
      <p role="status">{message}</p>
      <Link href="/login?switch=1">Sign in</Link>
    </form>
  );
}
