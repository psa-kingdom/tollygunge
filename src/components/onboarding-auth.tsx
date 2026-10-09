"use client";
import { useState } from "react";
import { createAuthClient } from "better-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
const client = createAuthClient();
export function Signup() {
  const router = useRouter();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="member-settings"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData(e.currentTarget);
        try {
          const result = await client.signUp.email({
            name: String(f.get("name")),
            email: String(f.get("email")).trim().toLowerCase(),
            password: String(f.get("password")),
            callbackURL: "/member",
          });
          if (result.error)
            throw Error(
              result.error.message ||
                "Unable to create account. Try signing in if you already have an account.",
            );
          router.push("/member");
          router.refresh();
        } catch (e) {
          setMessage(
            e instanceof Error ? e.message : "Unable to create account.",
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
      <label>
        Password (12–128 characters)
        <input
          name="password"
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
        />
      </label>
      <p>
        Your account lets you save details. A Verified profile requires separate
        review; membership and payment remain separate.
      </p>
      <button className="button" disabled={busy}>
        {busy ? "Creating…" : "Create account"}
      </button>
      <p role="alert">{message}</p>
      <Link href="/login">Already have an account? Sign in</Link>
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
    <section className="notice">
      <strong>Email: {verified ? "Verified" : "Not verified"}</strong>
      <p>{email}</p>
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
}: {
  initialEmail?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="member-settings"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
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
          router.push("/account");
          router.refresh();
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Sign-in failed.");
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
      <label className="consent">
        <input name="keepSignedIn" type="checkbox" />
        Keep me signed in for 30 days on this device
      </label>
      <p>
        Otherwise you stay signed in for 7 days. Staff sessions last 7 days.
      </p>
      <button className="button" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p role="alert">{message}</p>
      <Link href="/forgot-password">Forgot password?</Link>
    </form>
  );
}
