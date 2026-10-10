"use client";
import { useEffect, useState, useRef } from "react";
import { verificationSteps } from "@/domain/verification";
import type { Review, VerificationData } from "./verification-workspace";
export function VerificationReviews({
  data,
  busy,
  action,
}: {
  data: VerificationData | null;
  busy: boolean;
  action: (body: unknown) => Promise<boolean>;
  load: (page?: number) => Promise<void>;
}) {
  const [records, setRecords] = useState<VerificationData | null>(null),
    [view, setView] = useState("reviews"),
    [status, setStatus] = useState("pending"),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [verifiedPage, setVerifiedPage] = useState(1),
    [selected, setSelected] = useState(""),
    [decision, setDecision] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [deepId, setDeepId] = useState<string | null>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null),
    lastRecord = useRef<HTMLButtonElement>(null),
    reasonInput = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (selected) detailHeading.current?.focus();
    else lastRecord.current?.focus();
  }, [selected]);
  useEffect(() => {
    if (decision) reasonInput.current?.focus();
  }, [decision]);
  useEffect(() => {
    queueMicrotask(() => {
      const id = new URLSearchParams(location.search).get("id");
      setDeepId(id);
      if (id) setStatus("all");
    });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const id = deepId;
        const response = await fetch(
          "/api/staff/verification?" +
            new URLSearchParams({
              status: id ? "all" : status,
              q: query,
              page: String(page),
              verifiedPage: String(verifiedPage),
              ...(id ? { id } : {}),
            }),
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) throw Error();
        const d = await response.json();
        if (controller.signal.aborted) return;
        setRecords(d);
        setError("");
        if (id) setSelected(id);
      } catch {
        if (!controller.signal.aborted)
          setError("Unable to load reviews. Try changing the filter.");
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [status, query, page, verifiedPage, data, deepId]);
  function choose(id: string) {
    setSelected(id);
    setReason("");
    setDecision("");
  }
  const review = records?.reviews.find((x) => x.id === selected),
    person = records?.verified.find((x) => x.id === selected);
  async function submit() {
    if (!decision) return;
    if (
      decision === "revoke" &&
      !window.confirm(
        "Revoke this profile badge and withdraw its public profile?",
      )
    )
      return;
    const success = await action(
      decision === "revoke"
        ? {
            action: decision,
            personId: person?.id,
            version: person?.version,
            reason,
          }
        : {
            action: decision,
            id: review?.id,
            version: review?.version,
            reason,
          },
    );
    if (success) {
      setSelected("");
      setReason("");
      setDecision("");
    }
  }
  return (
    <section className="verification-browser">
      <div className="review-toolbar">
        <div className="segmented">
          <button
            aria-pressed={view === "reviews"}
            onClick={() => {
              setView("reviews");
              choose("");
            }}
          >
            Review queue
          </button>
          <button
            aria-pressed={view === "verified"}
            onClick={() => {
              setDeepId(null);
              setView("verified");
              choose("");
            }}
          >
            Verified accounts
          </button>
        </div>
        <label>
          Search names or email
          <input
            value={query}
            onChange={(e) => {
              setDeepId(null);
              setQuery(e.target.value);
              setPage(1);
              setVerifiedPage(1);
              choose("");
            }}
          />
        </label>
        {view === "reviews" && (
          <label>
            Status
            <select
              value={status}
              onChange={(e) => {
                setDeepId(null);
                setStatus(e.target.value);
                setPage(1);
                choose("");
              }}
            >
              {[
                "pending",
                "all",
                "approved",
                "corrections",
                "rejected",
                "superseded",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <div className={"review-layout" + (selected ? " has-selection" : "")}>
        <div className="review-list" aria-label="Verification records">
          {(view === "reviews" ? records?.reviews : records?.verified)?.map(
            (r) => (
              <button
                key={r.id}
                className={selected === r.id ? "selected" : ""}
                onClick={(e) => {
                  lastRecord.current = e.currentTarget;
                  choose(r.id);
                }}
              >
                <strong>{r.name}</strong>
                <small>{r.email}</small>
                <span>
                  {"status" in r
                    ? r.status
                    : r.verification_update_requested
                      ? "Verified · Update requested"
                      : "Verified"}
                </span>
              </button>
            ),
          )}
          {records &&
            (view === "reviews" ? records.reviews : records.verified).length ===
              0 && <p>No records match this filter.</p>}
          <div className="action-row">
            <button
              disabled={(view === "reviews" ? page : verifiedPage) <= 1}
              onClick={() => {
                choose("");
                if (view === "reviews") setPage(page - 1);
                else setVerifiedPage(verifiedPage - 1);
              }}
            >
              Previous
            </button>
            <span>Page {view === "reviews" ? page : verifiedPage}</span>
            <button
              disabled={
                !(view === "reviews"
                  ? records?.reviewsMore
                  : records?.verifiedMore)
              }
              onClick={() => {
                choose("");
                if (view === "reviews") setPage(page + 1);
                else setVerifiedPage(verifiedPage + 1);
              }}
            >
              Next
            </button>
          </div>
        </div>
        <article className="review-detail">
          {selected && (
            <button className="review-back" onClick={() => choose("")}>
              ← Back to records
            </button>
          )}
          {review && view === "reviews" ? (
            <>
              <h2 tabIndex={-1} ref={detailHeading}>
                {review.name}
              </h2>
              <p>
                {review.email} · {review.status} · Requirements v
                {review.requirement_version}
              </p>
              {review.accepted_verified && (
                <p>Existing verified badge remains active.</p>
              )}
              <SubmittedDetails review={review} />
              {review.reason && (
                <p className="review-feedback">
                  Review feedback: {review.reason}
                </p>
              )}
              {review.status === "pending" && (
                <div className="action-row">
                  {(data?.admin
                    ? ["approve", "corrections", "reject"]
                    : ["corrections"]
                  ).map((a) => (
                    <button
                      className="button secondary"
                      key={a}
                      onClick={() => {
                        setDecision(a);
                        setReason("");
                      }}
                    >
                      {a === "approve"
                        ? "Approve verification"
                        : a === "corrections"
                          ? "Request corrections"
                          : "Reject submission"}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : person && view === "verified" ? (
            <>
              <h2 tabIndex={-1} ref={detailHeading}>
                {person.name}
              </h2>
              <p>{person.email}</p>
              <p>
                {person.verification_version
                  ? `Approved requirements v${person.verification_version}`
                  : "Legacy approval"}
              </p>
              {person.verification_update_requested && (
                <p>Update requested. Verified badge retained.</p>
              )}
              {data?.admin && (
                <button
                  className="button secondary"
                  onClick={() => {
                    setDecision("revoke");
                    setReason("");
                  }}
                >
                  Revoke verification
                </button>
              )}
            </>
          ) : (
            <div className="review-empty">
              <h2>Select a record</h2>
              <p>
                Review submitted details and evidence before making a decision.
              </p>
            </div>
          )}
          {decision && (
            <section className="decision-panel">
              <h3>
                {decision === "approve"
                  ? "Approve this profile"
                  : decision === "corrections"
                    ? "Request updated details"
                    : decision === "reject"
                      ? "Reject this submission"
                      : "Revoke this verified profile"}
              </h3>
              <p>
                {decision === "approve"
                  ? "Confirm that the submitted evidence meets its published requirements."
                  : decision === "revoke"
                    ? "This removes the badge and withdraws its public profile. Record the reason."
                    : "Explain the decision and the details the member needs to address. Existing accepted details and badges remain preserved."}
              </p>
              <label>
                Reason {decision === "approve" ? "(optional)" : "(required)"}
                <textarea
                  ref={reasonInput}
                  rows={4}
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <small>{reason.length}/2,000 characters</small>
              <div className="action-row">
                <button
                  className="button"
                  disabled={busy || (decision !== "approve" && !reason.trim())}
                  onClick={() => void submit()}
                >
                  Confirm decision
                </button>
                <button
                  className="button secondary"
                  onClick={() => {
                    setDecision("");
                    setReason("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </section>
          )}
        </article>
      </div>
    </section>
  );
}
function SubmittedDetails({ review }: { review: Review }) {
  return (
    <div className="submitted-sections">
      {verificationSteps.map((step, i) => {
        const entries = Object.entries(review.snapshot.details).filter(
          ([id]) =>
            review.requirement_fields.find((f) => f.id === id)?.step === i,
        );
        return entries.length ? (
          <details key={step} open={i === 0}>
            <summary>
              {i + 1}. {step}
            </summary>
            <dl>
              {entries.map(([id, value]) => (
                <div key={id}>
                  <dt>
                    {review.requirement_fields.find((f) => f.id === id)
                      ?.label || id}
                  </dt>
                  <dd>
                    {review.requirement_fields.find((f) => f.id === id)
                      ?.type === "document" ? (
                      <a
                        href={"/api/documents/" + encodeURIComponent(value)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View private evidence ↗
                      </a>
                    ) : (
                      value || "Not supplied"
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null;
      })}
      {Object.entries(review.snapshot.details)
        .filter(([id]) => !review.requirement_fields.some((f) => f.id === id))
        .map(([id, value]) => (
          <p key={id}>
            {id}: {value}
          </p>
        ))}
    </div>
  );
}
