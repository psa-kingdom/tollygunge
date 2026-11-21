"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { api } from "./operations-client";
import { SubmittedDetails } from "./verification-submitted-details";
import styles from "./member-review.module.css";
import type { Review, VerificationData } from "./verification-workspace";
export function MemberVerificationReview({
  personId,
  userId,
  name,
  verified,
  disabled = false,
  onApproved,
  autoOpen = false,
  onBusyChange,
}: {
  personId: string | null;
  userId: string | null;
  name: string;
  verified: boolean;
  disabled?: boolean;
  onApproved: () => Promise<void>;
  autoOpen?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(autoOpen);
  const [decision, setDecision] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<Review>();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [canApprove, setCanApprove] = useState(false);
  const inspect = useCallback(async () => {
    setOpen(true);
    setBusy(true);
    setReview(undefined);
    setMessage("");
    try {
      if (!personId && !userId) {
        setMessage(
          "No submitted verification details. The member must complete and submit their verification form first.",
        );
        return;
      }
      const params = new URLSearchParams({
        status: "pending",
        ...(personId ? { personId } : { userId: userId! }),
      });
      const result = await api<VerificationData>(
        "/api/staff/verification?" + params,
      );
      setCanApprove(result.admin);
      const pending = result.reviews.find(
        (item) =>
          item.status === "pending" &&
          (!personId || item.person_id === personId),
      );
      setReview(pending);
      if (!pending)
        setMessage(
          "No pending verification submission. The member must complete and submit their verification form first.",
        );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load verification details.",
      );
    } finally {
      setBusy(false);
      requestAnimationFrame(() => heading.current?.focus());
    }
  }, [personId, userId]);
  useEffect(() => {
    let active = true;
    if (autoOpen)
      void Promise.resolve().then(() => {
        if (active) return inspect();
      });
    return () => {
      active = false;
    };
  }, [autoOpen, inspect]);
  return (
    <div className="member-verification-review">
      {!autoOpen && (
        <button
          ref={trigger}
          type="button"
          className="button secondary"
          disabled={busy || disabled}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => void inspect()}
        >
          {verified
            ? "Review verification update"
            : "Approve profile verification"}
        </button>
      )}
      {open && (
        <section
          id={id}
          className={styles.section}
          aria-labelledby={`${id}-heading`}
          aria-busy={busy}
        >
          <h4 id={`${id}-heading`} ref={heading} tabIndex={-1}>
            Profile verification · {name}
          </h4>
          {busy && <p role="status">Loading verification details…</p>}
          {message && <p role="status">{message}</p>}
          {review && (
            <>
              <p>
                Review the submitted details and private evidence against
                requirements v{review.requirement_version} before approving.
              </p>
              <SubmittedDetails review={review} />
              <div className={styles.decision}>
                <h4>Review decision</h4>
                <p>
                  Approval verifies the submitted profile. Membership status and
                  payment verification are managed separately.
                </p>
                {!decision ? (
                  <div className="action-row">
                    {[
                      ...(canApprove
                        ? [{ action: "approve", label: "Approve verification" }]
                        : []),
                      { action: "corrections", label: "Request corrections" },
                      ...(canApprove
                        ? [{ action: "reject", label: "Reject submission" }]
                        : []),
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.action}
                        className={
                          item.action === "approve"
                            ? "button"
                            : "button secondary"
                        }
                        disabled={busy || disabled}
                        onClick={() => {
                          setDecision(item.action);
                          setReason("");
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <p>
                      {decision === "approve"
                        ? "Confirm that the submitted details and evidence meet the requirements."
                        : "Explain what the member needs to change. Your feedback will be recorded with this decision."}
                    </p>
                    <label>
                      {decision === "approve"
                        ? "Approval note (optional)"
                        : "Reason (required)"}
                      <textarea
                        rows={3}
                        maxLength={2000}
                        value={reason}
                        disabled={busy || disabled}
                        onChange={(event) => setReason(event.target.value)}
                      />
                    </label>
                    <div className="action-row">
                      <button
                        type="button"
                        className="button"
                        disabled={
                          busy ||
                          disabled ||
                          (decision !== "approve" && !reason.trim())
                        }
                        onClick={async () => {
                          setBusy(true);
                          onBusyChange?.(true);
                          setMessage("");
                          try {
                            await api("/api/staff/verification", {
                              action: decision,
                              id: review.id,
                              version: review.version,
                              reason,
                            });
                            setReview(undefined);
                            setDecision("");
                            setMessage(
                              decision === "approve"
                                ? "Profile verification approved."
                                : decision === "corrections"
                                  ? "Corrections requested."
                                  : "Submission rejected.",
                            );
                            await onApproved();
                          } catch (error) {
                            setMessage(
                              error instanceof Error
                                ? error.message
                                : "Unable to save the decision.",
                            );
                          } finally {
                            setBusy(false);
                            onBusyChange?.(false);
                          }
                        }}
                      >
                        {busy
                          ? "Saving decision…"
                          : decision === "approve"
                            ? "Confirm profile verification"
                            : decision === "corrections"
                              ? "Confirm corrections request"
                              : "Confirm rejection"}
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        disabled={busy || disabled}
                        onClick={() => setDecision("")}
                      >
                        Cancel decision
                      </button>
                    </div>
                  </>
                )}
                {!canApprove && (
                  <p>
                    Only an administrator can approve or reject an application.
                  </p>
                )}
              </div>
            </>
          )}
          {!autoOpen && (
            <button
              type="button"
              className="button secondary"
              disabled={busy || disabled}
              onClick={() => {
                setOpen(false);
                requestAnimationFrame(() => trigger.current?.focus());
              }}
            >
              Close verification review
            </button>
          )}
        </section>
      )}
    </div>
  );
}
