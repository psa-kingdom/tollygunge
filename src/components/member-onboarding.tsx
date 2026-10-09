"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "./operations-client";
import { VerifyEmail } from "./onboarding-auth";
type Status = {
  email: string;
  emailVerified: boolean;
  verified: boolean;
  updateRequested: boolean;
  missing: string[];
  reviews: { status: string; reason: string }[];
};
export function MemberOnboarding() {
  const [s, setStatus] = useState<Status | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api<Status>("/api/member/verification")
      .then(setStatus)
      .catch(() =>
        setError("Unable to load verification status. Refresh to try again."),
      );
  }, []);
  return (
    <section className="notice">
      <h2>Your profile verification</h2>
      {s ? (
        <>
          <VerifyEmail email={s.email} verified={s.emailVerified} />
          <p>
            <strong>{s.verified ? "Verified" : "Not verified"}</strong>
            {s.updateRequested
              ? " · Update requested — your badge remains active."
              : ""}
          </p>
          <p>
            {s.missing.length
              ? `${s.missing.length} required items remain.`
              : "Required details complete."}
          </p>
          {s.reviews[0] && (
            <p>
              Review: {s.reviews[0].status}. {s.reviews[0].reason}
            </p>
          )}
          <Link className="button" href="/member/application">
            {s.updateRequested
              ? "Update verification details"
              : "Continue your details"}
          </Link>
        </>
      ) : (
        <p role="status">{error || "Loading your status…"}</p>
      )}
    </section>
  );
}
