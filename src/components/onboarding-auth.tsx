"use client";
import { CopyValue, StatusBadge } from "./portal-values";
import { useState } from "react";
import { createAuthClient } from "better-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { eventReturnPath } from "@/domain/event-flow";
import { NewPasswordField } from "./new-password-field";
const client = createAuthClient();
export function Signup({ returnTo }: { returnTo?: string }) {
  const destination = eventReturnPath(returnTo) ?? "/member";
  const router = useRouter();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="member-settings"
      aria-busy={busy}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setMessage("");
        const f = new FormData(e.currentTarget);
        try {
          const result = await client.signUp.email({
            name: String(f.get("name")),
            email: String(f.get("email")).trim().toLowerCase(),
            password: String(f.get("password")),
            callbackURL: destination,
          });
          if (result.error)
            throw Error(
              result.error.message ||
                "Unable to create account. Try signing in if you already have an account.",
            );
          router.push(destination);
          router.refresh();
        } catch (e) {
          setMessage(
            e instanceof Error ? `${e.message} Try again, or sign in if you already have an account.` : "Unable to create account. Please try again.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Full name
        <input name="name" required maxLength={120} autoComplete="name" />
      </label>
      <label>
        Email
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <NewPasswordField label="Password" />
      <p className="auth-policy">
        Creating an account does not approve your membership. Profile verification,
        membership approval, and payment are separate steps.
      </p>
      <button className="button" disabled={busy}>
        {busy ? "Creating…" : "Create account"}
      </button>
      <p className="auth-message" role="alert">{message}</p>
      <p className="auth-switch">Already have an account?{" "}<Link href={returnTo ? "/login?returnTo="+encodeURIComponent(destination) : "/login"}>Sign in</Link></p>
    </form>
  );
}
export function VerifyEmail({
  email,
  verified,
}: {
  email: string;
  verified: boolean;
}) {
  const [message, setMessage] = useState("");
  return (
    <section className="member-email-card">
      <StatusBadge tone={verified ? "success" : "pending"}>Email: {verified ? "Verified" : "Not verified"}</StatusBadge>
      {!verified && <p><CopyValue value={email} /></p>}
      {!verified && (
        <button
          id="verification-email-action"
          className="button secondary"
          onClick={async () => {
            try {
              const result = await client.sendVerificationEmail({
                email,
                callbackURL: "/member",
              });
              setMessage(
                result.error
                  ? "Unable to send verification email. Try again later."
                  : "Verification email requested. Check your inbox.",
              );
            } catch {
              setMessage("Unable to send verification email.");
            }
          }}
        >
          Send verification email
        </button>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
export function OnboardingSignIn({
  initialEmail = "",
  returnTo,
}: {
  initialEmail?: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="member-settings"
      aria-busy={busy}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setMessage("");
        try {
          const r = await fetch("/api/onboarding/sign-in", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: f.get("email"),
              password: f.get("password"),
              keepSignedIn: f.get("keepSignedIn") === "on",
            }),
          });
          if (!r.ok) throw Error("Check your email and password.");
          router.push(eventReturnPath(returnTo) ?? "/account");
          router.refresh();
        } catch (e) {
          setMessage(e instanceof Error ? `${e.message} Try again or reset your password.` : "Sign-in failed. Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={initialEmail}
          required
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <Link className="auth-recovery" href="/forgot-password">Forgot password?</Link>
      <label className="consent">
        <input name="keepSignedIn" type="checkbox" />
        Keep me signed in for 30 days on this device
      </label>
      <p className="session-help">
        Otherwise you stay signed in for 7 days. Staff sessions last 7 days.
      </p>
      <button className="button" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="auth-message" role="alert">{message}</p>
    </form>
  );
}
