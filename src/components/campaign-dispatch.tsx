"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "./operations-client";
import type { EmailReadiness } from "./email-deliveries";
type Review = {
  campaign: { version: number; name: string; subject: string; body: string; audience?: { source?: string } };
  eligible: number;
  sample: { name: string; email: string }[];
  reviewToken: string;
  readiness: EmailReadiness;
};
type Dispatch = {
  id: string;
  version: number;
  created_at: string;
  cancelled_at: string | null;
  total: number;
  queued: number;
  accepted: number;
};
export function CampaignDispatch({
  id,
  version,
  dirty,
  archived,
}: {
  id?: string;
  version: number;
  dirty: boolean;
  archived: boolean;
}) {
  const [review, setReview] = useState<Review>(),
    [dispatches, setDispatches] = useState<Dispatch[]>([]),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const load = useCallback(async () => {
    if (!id) {
      setDispatches([]);
      return;
    }
    try {
      const data = await api<{ dispatches: Dispatch[] }>(
        `/api/staff/campaigns?id=${id}`,
      );
      setDispatches(data.dispatches);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);
  const valid = review && review.campaign.version === version && !dirty;
  return (
    <section className="campaign-panel campaign-send" aria-label="Review and send campaign">
      <h3>3. Review and send</h3>
      <p>
        Review the saved message and recipient list before confirming delivery. Reviewing does not send the campaign.
      </p>
      <p className="campaign-next-step">{archived ? "Restore this archived draft before reviewing it." : !id ? "Save your first draft above to unlock the review step." : dirty ? "You have unsaved changes. Save the draft above before reviewing it." : "Your draft is saved. Review it to check recipients and email readiness."}</p>
      <details className="campaign-rules"><summary>How recipient checks work</summary><p>The recipient list is fixed when you review the campaign. New subscribers are not added to that send. Consent and email preferences are checked again before each delivery, so the final recipient count may decrease.</p></details>
      <button
        className="button secondary"
        disabled={busy || !id || dirty || archived}
        onClick={async () => {
          setBusy(true);
          setConfirm(false);
          try {
            setReview(
              await api("/api/staff/campaigns", {
                action: "review",
                id,
                version,
              }),
            );
            setMessage("Saved campaign and audience reviewed.");
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Review saved campaign
      </button>
      {valid && (
        <section
          className="email-confirm"
          aria-label="Campaign send confirmation"
        >
          <h4>{review.campaign.name}</h4>
          <strong>{review.campaign.subject}</strong>
          <div className="email-message-body">{review.campaign.body}</div>
          <p>
            {review.eligible} eligible recipients · From
            updates@updates.tpassociation.org · Replies to
            contact@updates.tpassociation.org
          </p>
          <p>
            Campaigns reserve 20 daily sends for recovery/replies. Larger
            audiences wait across quota resets. Consent changes can reduce the
            final sent count.
          </p>
          {review.readiness.quota && (
            <p>
              Current daily usage {review.readiness.quota.daily.used}/
              {review.readiness.quota.daily.limit ?? "unlimited"}; monthly{" "}
              {review.readiness.quota.monthly.used}/
              {review.readiness.quota.monthly.limit ?? "unlimited"}.
            </p>
          )}
          <details>
            <summary>Recipient sample ({review.sample.length})</summary>
            <p>Audience: {review.campaign.audience?.source === "public" ? "Public newsletter subscribers" : "Eligible website accounts"}</p>
            {review.sample.map((x) => (
              <p key={x.email}>
                {x.name} · {x.email}
              </p>
            ))}
          </details>
          {!review.readiness.enabled && (
            <p className="notice">
              The email worker is not ready. This draft is retained.
            </p>
          )}
          <label className="checkbox">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            I reviewed this saved message and its audience.
          </label>
          <button
            className="button"
            disabled={
              busy || !confirm || !review.eligible || !review.readiness.enabled
            }
            onClick={async () => {
              setBusy(true);
              try {
                const result = await api<{
                  id: string;
                  queued?: number;
                  duplicate?: boolean;
                }>("/api/staff/campaigns", {
                  action: "dispatch",
                  id,
                  version,
                  reviewToken: review.reviewToken,
                  confirm: true,
                });
                setReview(undefined);
                setConfirm(false);
                await load();
                setMessage(
                  result.duplicate
                    ? "This saved version was already dispatched. No duplicate was created."
                    : `${result.queued} recipients queued. Follow delivery logs for outcomes.`,
                );
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirm and queue campaign
          </button>
        </section>
      )}
      <p role="status">{message}</p>
      <details className="campaign-history"><summary>Sending history ({dispatches.length})</summary>
      {dispatches.length ? (
        dispatches.map((d) => (
          <article className="email-message" key={d.id}>
            <strong>{new Date(d.created_at).toLocaleString("en-IN")}</strong>
            <p>
              {d.total} recipients · {d.queued} queued · {d.accepted}{" "}
              provider-accepted{d.cancelled_at ? " · cancelled" : ""}
            </p>
            <small>{d.id}</small>
            {!d.cancelled_at && d.queued > 0 && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api("/api/staff/campaigns", {
                      action: "cancel",
                      dispatchId: d.id,
                      version: d.version,
                    });
                    await load();
                    setMessage(
                      "Pending recipients cancelled. Accepted messages remain in history.",
                    );
                  } catch (e) {
                    setMessage((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Cancel pending recipients
              </button>
            )}
          </article>
        ))
      ) : (
        <p>No sends yet. After you confirm a campaign, its progress will appear here.</p>
      )}
      </details>
    </section>
  );
}
