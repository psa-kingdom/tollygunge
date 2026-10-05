"use client";
import { createAuthClient } from "better-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
const client = createAuthClient();
export function GoogleSignIn({ enabled }: { enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <button
        className="button"
        disabled={!enabled || busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const result = await client.signIn.social({
              provider: "google",
              callbackURL: "/account",
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
        {busy ? "Connecting…" : "Continue with Google"}
      </button>
      <p role="status">{error}</p>
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
