"use client";
import { PortalIcon } from "./portal-icon";
import { StatusBadge } from "./portal-values";
import { emailLabel } from "@/domain/communications-ui";
import styles from "./communications.module.css";
import { useState, useEffect, useCallback } from "react";
import { api } from "./operations-client";
export type EmailReadiness = {
  enabled: boolean;
  configured: boolean;
  healthy: boolean;
  worker: string;
  heartbeat: string | null;
  quota: null | {
    daily: { used: number; limit: number | null; resets_at: string };
    monthly: { used: number; limit: number | null; resets_at: string };
  };
};
type Entry = {
  id: string;
  kind: string;
  status: string;
  reason: string | null;
  recipient: string | null;
  outcome: string;
  available_at: string;
  events: { type: string; at: string }[];
  conversation_id: string | null;
};
export function EmailDeliveries() {
  const [data, setData] = useState<{
      entries: Entry[];
      hasMore: boolean;
      counts: {
        queued: number;
        failed: number;
        review: number;
        quota_wait: number;
      };
      readiness: EmailReadiness;
      recovery: { provider_id: string; created_at: string; outcome: string }[];
    }>(),
    [page, setPage] = useState(1),
    [status, setStatus] = useState("all"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("Loading delivery records…");
  const load = useCallback(async () => {
    setBusy(true);
    try {
      setData(await api(`/api/staff/deliveries?page=${page}&status=${status}`));
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [page, status]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);
  return (
    <section>
      <header className={styles.sectionHeading}>
        <div>
          <h2>Delivery activity</h2>
          <p>Track outgoing messages and anything that needs attention.</p>
        </div>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          Refresh
        </button>
      </header>
      {data && (
        <>
          <dl className={styles.metrics}>
            <div>
              <dt>In queue</dt>
              <dd>{data.counts.queued}</dd>
            </div>
            <div>
              <dt>Failed</dt>
              <dd>{data.counts.failed}</dd>
            </div>
            <div>
              <dt>Needs review</dt>
              <dd>{data.counts.review}</dd>
            </div>
          </dl>
          {!data.readiness.enabled && (
            <p className={styles.notice}>
              Sending is paused. You can still prepare and save emails.
            </p>
          )}
          {data.counts.quota_wait > 0 && (
            <p className={styles.notice}>
              {data.counts.quota_wait} emails are waiting for the sending
              allowance to reset.
            </p>
          )}
        </>
      )}
      <div className={styles.toolbar}>
        <label className={styles.filterSelect}>
          Status
          <select
            value={status}
            disabled={busy}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {[
              "all",
              "queued",
              "leased",
              "accepted",
              "skipped",
              "failed",
              "review",
              "cancelled",
            ].map((x) => (
              <option key={x} value={x}>
                {x === "all" ? "All statuses" : emailLabel(x)}
              </option>
            ))}
          </select>
        </label>
        <p className={styles.helper}>
          Provider accepted does not confirm delivery to the recipient.
        </p>
      </div>
      {message && (
        <p role="status" className={styles.notice}>
          {message}
        </p>
      )}
      {data?.entries.length ? (
        <div
          className={styles.tableWrap}
          role="region"
          aria-label="Email delivery records"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Recipient / email</th>
                <th>Status</th>
                <th>Outcome</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((x) => (
                <tr key={x.id}>
                  <td>
                    {x.recipient ?? "Incoming message"}
                    <small>{emailLabel(x.kind)}</small>
                  </td>
                  <td>
                    <StatusBadge
                      tone={
                        x.status === "failed"
                          ? "error"
                          : x.status === "review"
                            ? "pending"
                            : "neutral"
                      }
                    >
                      {emailLabel(x.status)}
                    </StatusBadge>
                    {x.reason && <small>{emailLabel(x.reason)}</small>}
                  </td>
                  <td>
                    {emailLabel(x.outcome || "Awaiting update")}
                    {x.status === "review" && (
                      <small>
                        Check provider records before resending. Automatic
                        retries are stopped.
                      </small>
                    )}
                  </td>
                  <td>
                    <details className={styles.details}>
                      <summary>View details</summary>
                      <p>
                        Record: <code>{x.id}</code>
                      </p>
                      {x.status === "queued" && (
                        <p>
                          Next attempt:{" "}
                          {new Date(x.available_at).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                          })}
                        </p>
                      )}
                      {x.events.length ? (
                        x.events.map((e, i) => (
                          <p key={i}>
                            {emailLabel(e.type)} ·{" "}
                            {new Date(e.at).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                            })}
                          </p>
                        ))
                      ) : (
                        <p>No provider events recorded yet.</p>
                      )}
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : data && !busy ? (
        <div className={styles.empty}>
          <PortalIcon name="chart" />
          <h3>
            {status === "all"
              ? "No delivery activity yet"
              : "No matching delivery records"}
          </h3>
          <p>
            {status === "all"
              ? "Queued emails and their delivery updates will appear here."
              : "Choose another status to see more records."}
          </p>
        </div>
      ) : null}
      {data && (data.hasMore || page > 1) && (
        <div className={styles.pagination}>
          <button
            className="text-button"
            disabled={busy || page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            className="text-button"
            disabled={busy || !data.hasMore}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
      {data && (
        <details className={styles.history}>
          <summary>
            Sending configuration &amp; account recovery receipts
          </summary>
          <p>
            Worker: {data.readiness.worker} ·{" "}
            {data.readiness.healthy ? "Available" : "Unavailable"} · Provider{" "}
            {data.readiness.configured ? "configured" : "not configured"}
          </p>
          {data.readiness.quota && (
            <p>
              Daily usage: {data.readiness.quota.daily.used} /{" "}
              {data.readiness.quota.daily.limit ?? "unlimited"} · Monthly usage:{" "}
              {data.readiness.quota.monthly.used} /{" "}
              {data.readiness.quota.monthly.limit ?? "unlimited"}. Campaigns
              reserve 20 daily sends for recovery and replies.
            </p>
          )}
          <h3>Account recovery receipts</h3>
          {data.recovery?.length ? (
            data.recovery.map((x) => (
              <p key={x.provider_id}>
                {new Date(x.created_at).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}{" "}
                · {emailLabel(x.outcome)} <code>{x.provider_id}</code>
              </p>
            ))
          ) : (
            <p>No receipts recorded yet.</p>
          )}
        </details>
      )}
    </section>
  );
}
