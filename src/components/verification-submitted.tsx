"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  applicable,
  verificationSteps,
  type VerificationField,
} from "@/domain/verification";
import { PortalIcon } from "./portal-icon";

export type SubmittedApplication = {
  fields?: VerificationField[];
  plan: string;
  category: string;
  details: Record<string, string>;
  submittedAt?: string;
};

export function verificationAnswer(field: VerificationField, value: string) {
  if (field.type === "checkbox")
    return value === "true" ? "Confirmed" : "Not confirmed";
  if (field.type === "document") return "Document submitted";
  if (field.type === "multiselect") {
    try {
      const values = JSON.parse(value);
      if (Array.isArray(values)) return values.join(", ");
    } catch {
      /* Older drafts may store plain text. */
    }
  }
  return value;
}

export function VerificationSubmitted({
  submission,
  fields,
  reviewStatus,
  successOpen,
  onDismiss,
  onEdit,
}: {
  submission: SubmittedApplication;
  fields: VerificationField[];
  reviewStatus: string;
  successOpen: boolean;
  onDismiss: () => void;
  onEdit: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (successOpen && !dialog.current?.open) dialog.current?.showModal();
  }, [successOpen]);
  function dismiss() {
    dialog.current?.close();
    onDismiss();
    heading.current?.focus();
  }
  return (
    <div className="member-submitted-view">
      <section
        className="verification-receipt"
        aria-labelledby="verification-receipt-title"
      >
        <span className="verification-receipt-icon">
          <PortalIcon name="shield" />
        </span>
        <div>
          <span className="verification-status">
            {reviewStatus === "approved"
              ? "Profile verified"
              : "Submitted · Awaiting review"}
          </span>
          <h2 ref={heading} tabIndex={-1} id="verification-receipt-title">
            Your submitted profile
          </h2>
          <p>
            {reviewStatus === "approved"
              ? "Your profile details have been reviewed and verified."
              : "Your details have been sent to the TPA team. You can review your submission below while we check your profile."}
          </p>
          {submission.submittedAt && (
            <p>
              Submitted{" "}
              {new Date(submission.submittedAt).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          )}
        </div>
      </section>
      <div className="verification-summary-heading">
        <div>
          <h2>Details you submitted</h2>
          <p>
            This is the copy sent for review. Membership approval and payments
            are separate.
          </p>
        </div>
        <button className="button secondary" onClick={onEdit}>
          Edit saved details
        </button>
      </div>
      {verificationSteps.map((title, step) => {
        const answered = fields.filter(
          (field) =>
            field.step === step &&
            applicable(field, submission.category) &&
            submission.details[field.id],
        );
        if (!answered.length) return null;
        return (
          <section className="verification-summary-section" key={title}>
            <h3>{title}</h3>
            <dl>
              {answered.map((field) => (
                <div key={field.id}>
                  <dt>{field.label}</dt>
                  <dd>
                    {verificationAnswer(field, submission.details[field.id])}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
      <Link className="button secondary" href="/member">
        Return to dashboard
      </Link>
      <dialog
        className="verification-success-dialog"
        ref={dialog}
        aria-labelledby="verification-success-title"
        aria-describedby="verification-success-description"
        onClose={() => {
          onDismiss();
          heading.current?.focus();
        }}
      >
        <span className="verification-receipt-icon">
          <PortalIcon name="shield" />
        </span>
        <h2 id="verification-success-title">Profile submitted successfully</h2>
        <p id="verification-success-description">
          Your details are with the TPA team for verification. You can now view
          the information you submitted.
        </p>
        <button className="button" autoFocus onClick={dismiss}>
          View submitted details
        </button>
      </dialog>
    </div>
  );
}
