"use client";
import { CopyValue, StatusBadge } from "./portal-values";
import { useState } from "react";
import { createAuthClient } from "better-auth/react";
import { api } from "./operations-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { eventReturnPath } from "@/domain/event-flow";
import { NewPasswordField } from "./new-password-field";
import { PortalIcon } from "./portal-icon";
const client = createAuthClient();
export function Signup({
  returnTo,
  otpRequired = true,
}: {
  returnTo?: string;
  otpRequired?: boolean;
}) {
  const destination = eventReturnPath(returnTo) ?? "/member/application";
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [registration, setRegistration] = useState<{
    name: string;
    email: string;
    password: string;
    requestedMembershipPlan: string;
  }>();
  async function finish(
    details: { name: string; email: string; password: string },
    registrationCode?: string,
  ) {
    const result = await client.signUp.email({
      ...details,
      callbackURL: destination,
      ...(registrationCode ? { registrationCode } : {}),
    });
    if (result.error)
      throw Error(result.error.message || "Unable to create account.");
    router.push(destination);
    router.refresh();
  }
  async function sendCode(email: string) {
    await api("/api/onboarding/registration-code", { email });
    setMessage("Check your inbox for the code. It expires in 10 minutes.");
  }

  if (registration)
    return (
      <form
        className="member-settings"
        aria-busy={busy}
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          const otp = String(new FormData(event.currentTarget).get("otp"));
          try {
            await finish(registration, otp);
          } catch (error) {
            setMessage((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>Enter the registration code sent to {registration.email}.</p>
        <label>
          Registration code
          <input
            name="otp"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
          />
        </label>
        <div className="action-row">
          <button type="submit" className="button" disabled={busy}>
            Confirm code and create account
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await sendCode(registration.email);
              } catch (error) {
                setMessage((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Resend code
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => {
              setRegistration(undefined);
              setMessage("");
            }}
          >
            Back to registration
          </button>
        </div>
        <p role="status">{message}</p>
      </form>
    );

  return (
    <form
      className="member-settings"
      aria-busy={busy}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setMessage("");
        const form = new FormData(event.currentTarget);
        const details = {
          name: String(form.get("name")),
          email: String(form.get("email")).trim().toLowerCase(),
          password: String(form.get("password")),
          requestedMembershipPlan: String(form.get("plan") ?? ""),
        };
        try {
          if (otpRequired) {
            await sendCode(details.email);
            setRegistration(details);
          } else {
            const { name, email, password } = details;
            await finish({ name, email, password });
          }
        } catch (error) {
          setMessage((error as Error).message);
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
      {otpRequired && (
        <label>
          Membership type
          <select name="plan" required defaultValue="">
            <option value="" disabled>
              Choose a membership
            </option>
            <option value="Life">Life member</option>
            <option value="Patron">Patron member</option>
          </select>
        </label>
      )}
      <p className="auth-policy">
        After registering, complete your application for administrator approval.
      </p>
      <button className="button" disabled={busy}>
        {busy
          ? "Working…"
          : otpRequired
            ? "Send registration code"
            : "Create account"}
      </button>
      <p className="auth-message" role="alert">
        {message}
      </p>
      <p className="auth-switch">
        Already have an account?{" "}
        <Link
          href={
            returnTo
              ? "/login?returnTo=" + encodeURIComponent(destination)
              : "/login"
          }
        >
          Sign in
        </Link>
      </p>
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
      <StatusBadge tone={verified ? "success" : "pending"}>
        Email: {verified ? "Verified" : "Not verified"}
      </StatusBadge>
      {!verified && (
        <p>
          <CopyValue value={email} />
        </p>
      )}
      {!verified && (
        <button
          id="verification-email-action"
          className="button secondary"
          onClick={async () => {
            try {
              const result = await client.sendVerificationEmail({
                email,
                callbackURL: "/member/events",
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
    [message, setMessage] = useState(""),
    [showPassword, setShowPassword] = useState(false);
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
          setMessage(
            e instanceof Error
              ? `${e.message} Try again or reset your password.`
              : "Sign-in failed. Please try again.",
          );
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
        <div className="auth-password-wrapper">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className="auth-password-toggle"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((prev) => !prev)}
          >
            <PortalIcon name={showPassword ? "eyeOff" : "eye"} />
          </button>
        </div>
      </label>
      <Link className="auth-recovery" href="/forgot-password">
        Forgot password?
      </Link>
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
      <p className="auth-message" role="alert">
        {message}
      </p>
    </form>
  );
}
