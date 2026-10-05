"use client";
import { createAuthClient } from "better-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
const client = createAuthClient();

export function PasswordResetLanding() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value =
        new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
      setToken(value);
      window.history.replaceState(null, "", "/reset-password");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  if (token === null) return <p role="status">Checking reset link…</p>;
  return token ? (
    <PasswordUpdate token={token} />
  ) : (
    <p>
      This link is missing or expired.{" "}
      <Link href="/forgot-password">Request a new reset link.</Link>
    </p>
  );
}

export function PasswordSignIn({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="member-settings"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        const data = new FormData(event.currentTarget);
        try {
          const result = await client.signIn.email({
            email: String(data.get("email")),
            password: String(data.get("password")),
          });
          if (result.error) {
            setMessage(
              "Email or password is incorrect, or sign-in is unavailable.",
            );
            return;
          }
          router.replace("/member");
          router.refresh();
        } catch {
          setMessage("Unable to connect. Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Email
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          required
        />
      </label>
      <button className="button" disabled={!enabled || busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p role="status">{message}</p>
      <Link href="/forgot-password" className="text-link">
        Forgot password?
      </Link>
    </form>
  );
}

export function RecoveryRequest({ enabled }: { enabled: boolean }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="member-settings"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        const email = String(new FormData(event.currentTarget).get("email"));
        try {
          const result = await client.requestPasswordReset({
            email,
            redirectTo: "/reset-password",
          });
          setMessage(
            result.error
              ? "Recovery is unavailable. Please try again later."
              : "If an account exists for this email, a reset link will arrive shortly.",
          );
        } catch {
          setMessage("Unable to connect. Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Email
        <input type="email" name="email" autoComplete="email" required />
      </label>
      <button className="button" disabled={!enabled || busy}>
        {busy ? "Requesting…" : "Send reset link"}
      </button>
      {!enabled && (
        <p className="notice">
          Email recovery is awaiting sender configuration. You can change your
          password while signed in.
        </p>
      )}
      <p role="status">{message}</p>
    </form>
  );
}

export function PasswordUpdate({
  token,
  signedIn = false,
}: {
  token?: string;
  signedIn?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      className="member-settings"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget,
          data = new FormData(form);
        const password = String(data.get("password"));
        if (password !== data.get("confirm")) {
          setMessage("Passwords must match.");
          return;
        }
        setBusy(true);
        setMessage("");
        try {
          const result = signedIn
            ? await client.changePassword({
                currentPassword: String(data.get("current")),
                newPassword: password,
                revokeOtherSessions: true,
              })
            : await client.resetPassword({
                newPassword: password,
                token: token!,
              });
          if (result.error) {
            setMessage(
              signedIn
                ? "Password could not be changed. Check your current password."
                : "This reset link is invalid or expired. Request a new link.",
            );
            return;
          }
          form.reset();
          if (signedIn)
            setMessage(
              "Password changed. Other sessions have been signed out.",
            );
          else {
            router.replace("/login?reset=complete");
            router.refresh();
          }
        } catch {
          setMessage("Unable to connect. Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {signedIn && (
        <label>
          Current password
          <input
            type="password"
            name="current"
            autoComplete="current-password"
            required
            maxLength={128}
          />
        </label>
      )}
      <label>
        New password
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
        />
      </label>
      <label>
        Confirm new password
        <input
          type="password"
          name="confirm"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
        />
      </label>
      <p>Use at least 12 characters.</p>
      <button className="button" disabled={busy || (!signedIn && !token)}>
        {busy ? "Saving…" : signedIn ? "Change password" : "Reset password"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
