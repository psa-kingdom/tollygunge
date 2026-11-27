"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
import { CopyValue } from "./portal-values";

type Review = {
  id: string;
  idempotency_key: string;
  confirmed_at: string | null;
  expires_at: string;
  recipients: { person_id: string; user_id: string; name: string; email: string; held: boolean }[];
  exclusions: { person_id: string; name?: string; email?: string; reason: string }[];
  rendered: { subject: string; html: string };
  results: { email: string; status: string }[] | null;
  delivery: { user_id: string; status: string; reason: string | null }[];
};

const deliveryLabels: Record<string, string> = {
  queued: "Queued",
  leased: "Sending",
  accepted: "Sent",
  delivered: "Delivered",
  bounced: "Bounced",
  failed: "Failed",
};

type CommonProps = { canManage: boolean; onComplete: () => void; pendingRecipients?: { name: string; email: string; status: string }[] };
type ReviewProps = CommonProps & (
  | { personIds: string[]; batchId?: never; savedReviewId?: never }
  | { personIds?: never; batchId: string; savedReviewId?: string }
);

export function InvitationReleaseReview({
  personIds,
  batchId,
  savedReviewId,
  canManage,
  onComplete,
  pendingRecipients,
}: ReviewProps) {
  const [review, setReview] = useState<Review>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    const id = batchId ? savedReviewId : new URLSearchParams(location.search).get("invitationReview");
    if (!id) return;
    let active = true;
    api<Review>("/api/staff/invitation-releases?id=" + encodeURIComponent(id))
      .then((result) => { if (active) setReview(result); })
      .catch((error) => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [batchId, savedReviewId]);

  const confirmedId = review?.confirmed_at ? review.id : null;
  useEffect(() => {
    if (!confirmedId) return;
    let active = true;
    const timer = setInterval(() => {
      api<Review>("/api/staff/invitation-releases?id=" + encodeURIComponent(confirmedId))
        .then((result) => { if (active) setReview(result); })
        .catch((error) => { if (active) setMessage(error.message); });
    }, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [confirmedId]);

  async function create() {
    setBusy(true);
    try {
      const result = await api<Review>("/api/staff/invitation-releases",
        batchId ? { action: "review-batch", batchId } : { action: "review", personIds },
      );
      setReview(result);
      setAcknowledged(false);
      if (!batchId) {
        const url = new URL(location.href);
        url.searchParams.set("invitationReview", result.id);
        history.replaceState(null, "", url);
      }
      setMessage("");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function send(id: string, idempotencyKey: string) {
    setBusy(true);
    try {
      setReview(await api<Review>("/api/staff/invitation-releases", {
        action: "confirm", id, idempotencyKey, batchId,
      }));
      setMessage("Invitations queued.");
      onComplete();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="invitation-release-review">
      <div className="action-row">
        {!review?.confirmed_at && (
          <button className="button secondary" disabled={!canManage || busy || (!batchId && !personIds?.length)} onClick={() => void create()}>
            {review ? "Refresh invitation review" : batchId ? "Review batch invitations" : `Review invitations for ${personIds?.length ?? 0} selected members`}
          </button>
        )}
        {!review?.confirmed_at && <Link href="/admin/workspaces/communications?invitationTemplate=1">Configure invitation template</Link>}
      </div>
      {message && <p role="status">{message}</p>}
      {!review && !!pendingRecipients?.length && (
        <div className="table-scroll" role="region" aria-label="Imported invitation recipients" tabIndex={0}>
          <table>
            <thead><tr><th scope="col">Member</th><th scope="col">Email</th><th scope="col">Status</th></tr></thead>
            <tbody>{pendingRecipients.map((row) => (
              <tr key={row.email}><th scope="row">{row.name}</th><td>{row.email}</td><td>{deliveryLabels[row.status] ?? "On hold"}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {review && (
        <>
          <h3>{review.confirmed_at ? "Invitation delivery" : "Invitation recipient review"}</h3>
          {review.confirmed_at && !batchId && <p>{review.results?.length ?? 0} invitations queued. Reopening this review does not send again.</p>}
          {!review.confirmed_at && <p>{review.recipients.length} eligible · {review.exclusions.length} excluded. Review expires {new Date(review.expires_at).toLocaleString()}.</p>}
          <div className="table-scroll" role="region" aria-label="Invitation recipients" tabIndex={0}>
            <table>
              <thead><tr><th scope="col">Member</th><th scope="col">Email</th><th scope="col">Status</th></tr></thead>
              <tbody>
                {review.recipients.map((recipient) => {
                  const delivery = review.delivery.find((row) => row.user_id === recipient.user_id);
                  const status = review.confirmed_at ? deliveryLabels[delivery?.status ?? "queued"] : recipient.held ? "On hold" : "Replacement invitation";
                  return (
                    <tr key={recipient.person_id}>
                      <th scope="row">{recipient.name}</th>
                      <td><CopyValue value={recipient.email} /></td>
                      <td>{status}{delivery?.reason && <div>{delivery.reason}</div>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {review.exclusions.length > 0 && (
            <details>
              <summary>Excluded recipients ({review.exclusions.length})</summary>
              <ul>{review.exclusions.map((row) => <li key={row.person_id}>{row.name || row.email || "Unavailable member"} · {row.reason}</li>)}</ul>
            </details>
          )}
          {!review.confirmed_at && (
            <div className="invitation-email-preview">
              <h4>{review.rendered.subject}</h4>
              <p>The email below uses {review.recipients[0].name} as the example recipient.</p>
              <iframe title="Reviewed invitation email" sandbox="" srcDoc={review.rendered.html} />
              <div className="action-row">
                <label><input type="checkbox" checked={acknowledged} disabled={busy} onChange={(event) => setAcknowledged(event.target.checked)} /> I verified the listed recipients and the approved email</label>
                <button className="button" disabled={!canManage || busy || !acknowledged} onClick={() => void send(review.id, review.idempotency_key)}>
                  {batchId ? `Send ${review.recipients.length} ${review.recipients.length === 1 ? "invitation" : "invitations"}` : "Confirm and send invitations"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
