"use client";
import { eventReturnPath } from "@/domain/event-flow";
import { clearRecovery } from "./draft-recovery";
import { createAuthClient } from "better-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
const client = createAuthClient();
export function GoogleSignIn({ enabled, returnTo }: { enabled: boolean; returnTo?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="auth-provider">
      <button
        className="button"
        disabled={!enabled || busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const result = await client.signIn.social({
              provider: "google",
              callbackURL: eventReturnPath(returnTo) ?? "/account",
            });
            if (result.error) {
              setError("Sign-in could not start. Please try again later.");
              setBusy(false);
            }
          } catch {
            setError("Unable to connect. Please try again.");
            setBusy(false);
          }
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36ZM12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.77-5.61-4.15H3.05v2.59A10 10 0 0 0 12 22ZM6.39 13.89a6 6 0 0 1 0-3.78V7.52H3.05a10 10 0 0 0 0 8.96l3.34-2.59ZM12 5.96c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.52l3.34 2.59A5.99 5.99 0 0 1 12 5.96Z" /></svg>
        {busy ? "Connecting…" : "Continue with Google"}
      </button>
      <p className="auth-message" role="status">{error}</p>
    </div>
  );
}
export function SignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <button
        className="button secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const result = await client.signOut();
            if (result.error) throw new Error();
            await clearRecovery().catch(()=>{});
            router.replace("/login");
            router.refresh();
          } catch {
            setError("Sign-out failed. Please try again.");
            setBusy(false);
          }
        }}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      <p role="status">{error}</p>
    </div>
  );
}
