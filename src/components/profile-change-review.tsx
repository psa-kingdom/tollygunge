"use client";
import { useEffect, useRef, useState } from "react";
import type { PersonEntry } from "@/domain/people";
import { api } from "./operations-client";
import styles from "./member-review.module.css";

type Queue = {
  records: {
    id: string;
    person_id: string;
    name: string;
    created_at: string;
  }[];
  hasMore: boolean;
};
const labels: Record<string, string> = {
  name: "Name",
  firstName: "First name",
  lastName: "Last name",
  prefix: "Title",
  email: "Email",
  mobile: "Mobile",
  phone: "Phone",
  organization: "Organization",
  profession: "Profession",
  jobTitle: "Designation",
  city: "City",
  biography: "Biography",
  biographyRich: "Formatted biography",
  biographyTitle: "Biography heading",
  portraitId: "Portrait",
  portraitKind: "Portrait type",
  links: "Links",
  assignments: "Committee assignments",
  addresses: "Addresses",
  nameSize: "Name size",
};
function readable(value: unknown): string {
  if (value == null || value === "") return "Not supplied";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value))
    return value.length ? value.map(readable).join("\n") : "None";
  const record = value as Record<string, unknown>;
  if (typeof record.text === "string") return record.text;
  if (Array.isArray(record.content))
    return record.content.map(readable).join("\n");
  return Object.entries(record)
    .map(([key, item]) => `${labels[key] ?? key}: ${readable(item)}`)
    .join("\n");
}

export function ProfileChangeReview({
  onChanged,
  onBusyChange,
}: {
  onChanged: () => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [queue, setQueue] = useState<Queue>();
  const [page, setPage] = useState(1);
  const [record, setRecord] = useState<PersonEntry>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [decision, setDecision] = useState("");
  const [reason, setReason] = useState("");
  const [reload, setReload] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const serial = useRef(0);
  const review = record?.reviews?.find((item) => item.status === "pending");
  useEffect(() => {
    let active = true;
    const request = ++serial.current;
    api<Queue>(`/api/staff/profile-reviews?page=${page}`)
      .then((value) => {
        if (active) setQueue(value);
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
      serial.current = request + 1;
    };
  }, [page, reload]);
  useEffect(() => {
    if (record) heading.current?.focus();
  }, [record]);
  async function inspect(personId: string) {
    const request = ++serial.current;
    setBusy(true);
    setMessage("");
    setDecision("");
    setReason("");
    try {
      const value = await api<{ record: PersonEntry }>(
        `/api/staff/profile-reviews?id=${personId}`,
      );
      if (request === serial.current) setRecord(value.record);
    } catch (error) {
      if (request === serial.current) setMessage((error as Error).message);
    } finally {
      if (request === serial.current) setBusy(false);
    }
  }
  return (
    <section
      className={styles.section}
      aria-label="Personal profile changes"
      aria-busy={busy}
    >
      <h2>Personal profile changes</h2>
      <p>
        Compare the requested changes with the current accepted profile, then
        approve or return feedback.
      </p>
      {message && <p role="status">{message}</p>}
      {!record ? (
        <>
          {!queue && !message && <p role="status">Loading pending changes…</p>}
          {queue && !queue.records.length && (
            <p>No personal profile changes are waiting for review.</p>
          )}
          <div className={styles.queue}>
            {queue?.records.map((item) => (
              <button
                type="button"
                disabled={busy}
                key={item.id}
                onClick={() => void inspect(item.person_id)}
              >
                <strong>{item.name}</strong>
                <span>Review changes </span>
              </button>
            ))}
          </div>
          {queue && (page > 1 || queue.hasMore) && (
            <div className="action-row">
              <button
                className="button secondary"
                disabled={busy || page === 1}
                onClick={() => {
                  setQueue(undefined);
                  setPage(page - 1);
                }}
              >
                Previous reviews
              </button>
              <span>Page {page}</span>
              <button
                className="button secondary"
                disabled={busy || !queue.hasMore}
                onClick={() => {
                  setQueue(undefined);
                  setPage(page + 1);
                }}
              >
                Next reviews
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => {
              setRecord(undefined);
              setDecision("");
            }}
          >
             All pending changes
          </button>
          <h3 ref={heading} tabIndex={-1}>
            {record.draft.name}
          </h3>
          {review ? (
            <>
              <p className={styles.status}>
                Submitted{" "}
                {new Date(review.created_at).toLocaleDateString("en-IN")}{" "}
                {review.proposer_name ? `by ${review.proposer_name}` : ""}.
                Approval updates accepted details; publishing remains a separate
                action.
              </p>
              <table className={styles.comparison}>
                <caption className="sr-only">
                  Current and proposed profile values
                </caption>
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Current</th>
                    <th>Proposed</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(
                    new Set([
                      ...Object.keys(review.baseline),
                      ...Object.keys(review.body),
                    ]),
                  )
                    .filter(
                      (key) =>
                        JSON.stringify(
                          review.baseline[key as keyof typeof review.baseline],
                        ) !==
                        JSON.stringify(
                          review.body[key as keyof typeof review.body],
                        ),
                    )
                    .map((key) => (
                      <tr key={key}>
                        <th scope="row">{labels[key] ?? key}</th>
                        <td>
                          {readable(
                            review.baseline[
                              key as keyof typeof review.baseline
                            ],
                          )}
                        </td>
                        <td>
                          {readable(
                            review.body[key as keyof typeof review.body],
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <div className={styles.decision}>
                <h4>
                  {decision === "reject"
                    ? "Reject these changes"
                    : decision === "approve"
                      ? "Approve these changes"
                      : "Review decision"}
                </h4>
                {!decision ? (
                  <div className="action-row">
                    <button
                      type="button"
                      className="button"
                      onClick={() => setDecision("approve")}
                    >
                      Approve changes
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setDecision("reject")}
                    >
                      Reject changes
                    </button>
                  </div>
                ) : (
                  <>
                    <label>
                      {decision === "reject"
                        ? "Reason (required)"
                        : "Approval note (optional)"}
                      <textarea
                        rows={3}
                        maxLength={2000}
                        disabled={busy}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                      />
                    </label>
                    <div className="action-row">
                      <button
                        type="button"
                        className="button"
                        disabled={
                          busy || (decision === "reject" && !reason.trim())
                        }
                        onClick={async () => {
                          setBusy(true);
                          onBusyChange?.(true);
                          setMessage("");
                          try {
                            await api("/api/staff/profile-reviews", {
                              action: decision,
                              id: record.id,
                              version: record.version,
                              reviewId: review.id,
                              reason,
                            });
                            setRecord(undefined);
                            setDecision("");
                            setQueue(undefined);
                            setReload((value) => value + 1);
                            setMessage(
                              decision === "approve"
                                ? "Profile changes approved."
                                : "Profile changes rejected. Previous accepted details retained.",
                            );
                            await onChanged();
                          } catch (error) {
                            setMessage((error as Error).message);
                          } finally {
                            setBusy(false);
                            onBusyChange?.(false);
                          }
                        }}
                      >
                        {busy ? "Saving decision…" : "Confirm decision"}
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        disabled={busy}
                        onClick={() => setDecision("")}
                      >
                        Cancel decision
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <p>
              This profile no longer has a pending review. Return to the queue
              for the latest requests.
            </p>
          )}
        </>
      )}
    </section>
  );
}
