"use client";
import { useEffect, useState } from "react";
import Link from "./navigation-link";
import { verificationSteps } from "@/domain/verification";
import { api } from "./operations-client";
import { VerifyEmail } from "./onboarding-auth";
import { PortalIcon } from "./portal-icon";
import { StatusBadge } from "./portal-values";
type Status = {
  email: string;
  emailVerified: boolean;
  verified: boolean;
  updateRequested: boolean;
  missing: string[];
  progress: { total: number; completed: number; percent: number; remaining: { id: string; label: string; step: number; href: string }[] };
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
  const next = s?.progress.remaining[0];
  const pending =
    review?.status === "submitted" || review?.status === "pending";
  const ready = s?.progress.percent === 100 && !pending && !s?.verified && !next;
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
          <StatusBadge tone={s.verified ? "success" : review?.status === "rejected" ? "error" : "pending"}>
            {label}
          </StatusBadge>
        )}
      </div>
      {attentionCount > 0 && (
        <p className="member-attention-count">
          {attentionCount} account {attentionCount === 1 ? "action" : "actions"}{" "}
          {attentionCount === 1 ? "needs" : "need"} your attention.
        </p>
      )}
      {s ? (
        <>
          <div className="member-verification-grid">
            <div className="member-verification-progress">
              <div className="profile-completion">
                <div className="profile-completion-heading"><strong>{s.progress.percent}% complete</strong><span>{s.progress.completed} of {s.progress.total} required items</span></div>
                <progress value={s.progress.completed} max={s.progress.total} aria-label="Profile completion" />
                {ready ? <p className="profile-completion-ready"><PortalIcon name="shield" /><strong>Required details complete—ready to submit</strong></p> : <p>{pending ? "Your submitted profile is awaiting administrator review." : next ? <>Next: <strong>{next.label}</strong>{next.step >= 0 && <> in {verificationSteps[next.step]}</>}.</> : "All required items are complete. Completion does not automatically approve your profile."}</p>}
                {!!s.progress.remaining.length && <details><summary>{s.progress.remaining.length} required items remaining</summary><ul>{s.progress.remaining.map(item => <li key={item.id}><Link href={item.href}>{item.label}</Link></li>)}</ul></details>}
              </div>
              <div className="member-verification-action">
              <p>
                {s.verified
                  ? s.updateRequested
                    ? "Complete the requested updates. Your verified badge stays active."
                    : "Your reviewed profile is verified. You can update your details whenever needed."
                  : pending
                    ? "Your details are with the review team. We’ll let you know if anything needs attention."
                    : "Complete your details and evidence, then submit your profile for review."}
              </p>
              <Link className="button" href={pending || s.verified && !s.updateRequested ? "/member/application" : next?.href ?? "/member/application?step=4"}>
                {s.updateRequested
                  ? "Update verification details"
                  : s.verified || pending
                    ? "View your details"
                    : next ? next.step < 0 ? "Verify your email" : `Go to ${verificationSteps[next.step]}` : "Review and submit"}
                <span aria-hidden="true"> →</span>
              </Link>
              </div>
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
