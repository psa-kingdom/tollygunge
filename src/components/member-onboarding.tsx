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
export function MemberOnboarding({
  attentionCount = 0,
}: {
  attentionCount?: number;
}) {
  const [s, setStatus] = useState<Status | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api<Status>("/api/member/verification")
      .then(setStatus)
      .catch(() =>
        setError("Unable to load verification status. Refresh to try again."),
      );
  }, []);
  const review = s?.reviews[0];
  const pending =
    review?.status === "submitted" || review?.status === "pending";
  const label = s?.verified
    ? s.updateRequested
      ? "Verified · Update requested"
      : "Verified"
    : pending
      ? "Under review"
      : review?.status === "corrections"
        ? "Corrections requested"
        : review?.status === "rejected"
          ? "Review feedback"
          : "Not verified";
  return (
    <section
      className="member-card member-verification"
      aria-labelledby="verification-title"
    >
      <div className="member-card-heading">
        <div>
          <span className="eyebrow">YOUR NEXT STEP</span>
          <h2 id="verification-title">Your profile verification</h2>
        </div>
        {s && (
          <span className={"member-badge " + (s.verified ? "is-verified" : "")}>
            {label}
          </span>
        )}
      </div>
      {attentionCount > 0 && (
        <p className="member-attention-count">
          {attentionCount} account {attentionCount === 1 ? "action" : "actions"}{" "}
          need your attention.
        </p>
      )}
      {s ? (
        <>
          <div className="member-verification-grid">
            <div className="member-verification-progress">
              <p className="member-progress-number">
                {s.missing.length}
                <span>required items remaining</span>
              </p>
              <p>
                {s.verified
                  ? s.updateRequested
                    ? "Complete the requested updates. Your verified badge stays active."
                    : "Your reviewed profile is verified. You can update your details whenever needed."
                  : pending
                    ? "Your details are with the review team. We’ll let you know if anything needs attention."
                    : "Complete your details and evidence, then submit your profile for review."}
              </p>
              <Link className="button" href="/member/application">
                {s.updateRequested
                  ? "Update verification details"
                  : s.verified || pending
                    ? "View your details"
                    : "Continue your details"}
                <span aria-hidden="true"> →</span>
              </Link>
            </div>
            <VerifyEmail email={s.email} verified={s.emailVerified} />
          </div>
          {review?.reason && (
            <div className="member-review-feedback">
              <strong>Review feedback</strong>
              <p>{review.reason}</p>
            </div>
          )}
        </>
      ) : (
        <p role="status">{error || "Loading your status…"}</p>
      )}
    </section>
  );
}
