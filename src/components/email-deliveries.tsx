"use client";
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
    <section className="content-section">
      <h2>Email delivery</h2>
      <p>
        Provider acceptance and mailbox delivery are separate. Recovery tokens
        and message bodies never appear in these logs.
      </p>
      <div className="email-health">
        <strong>Worker: {data?.readiness.worker ?? "checking"}</strong>
        <span>
          {data?.readiness.healthy
            ? "Heartbeat healthy"
            : "Worker unavailable or not yet started"}
        </span>
        {data?.readiness.quota && (
          <span>
            Daily usage {data.readiness.quota.daily.used}/
            {data.readiness.quota.daily.limit ?? "unlimited"} · Monthly{" "}
            {data.readiness.quota.monthly.used}/
            {data.readiness.quota.monthly.limit ?? "unlimited"}. Campaigns
            reserve 20 daily sends for recovery/replies.
          </span>
        )}
      </div>
      {data && (
        <p>
          {data.counts.queued} queued · {data.counts.quota_wait} waiting for
          quota · {data.counts.failed} failed · {data.counts.review} need
          reconciliation
        </p>
      )}
      <div className="crm-filters">
        <label>
          Job status
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
            ].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          Refresh delivery
        </button>
      </div>
      <p role="status">{message}</p>
      {data && !data.entries.length && (
        <p>No email jobs match these filters.</p>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Type / recipient</th>
              <th>Processing</th>
              <th>Provider outcome</th>
              <th>Next attempt</th>
            </tr>
          </thead>
          <tbody>
            {data?.entries.map((x) => (
              <tr key={x.id}>
                <td>
                  {x.kind}
                  <br />
                  {x.recipient ?? "Shared inbox ingestion"}
                  <small>{x.id}</small>
                </td>
                <td>
                  {x.status}
                  <br />
                  {x.reason?.replaceAll("_", " ")}
                </td>
                <td>
                  {x.outcome.replaceAll("_", " ")}
                  <details>
                    <summary>Event history</summary>
                    {x.events.length ? (
                      x.events.map((e, i) => (
                        <p key={i}>
                          {e.type} · {new Date(e.at).toLocaleString("en-IN")}
                        </p>
                      ))
                    ) : (
                      <p>No provider event recorded yet.</p>
                    )}
                  </details>
                </td>
                <td>
                  {x.status === "queued"
                    ? new Date(x.available_at).toLocaleString("en-IN")
                    : "—"}
                  {x.status === "review" && (
                    <p>
                      Check provider records before any resend. Automatic retry
                      is stopped.
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="email-actions">
        <button
          className="button secondary"
          disabled={busy || page === 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          className="button secondary"
          disabled={busy || !data?.hasMore}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
      <details>
        <summary>Recent recovery delivery receipts</summary>
        <p>
          Metadata only. Recovery bodies and reset tokens are never recorded.
        </p>
        {data?.recovery?.length ? (
          data.recovery.map((x) => (
            <p key={x.provider_id}>
              {new Date(x.created_at).toLocaleString("en-IN")} · {x.outcome}{" "}
              <small>{x.provider_id}</small>
            </p>
          ))
        ) : (
          <p>No receipts recorded yet.</p>
        )}
      </details>
    </section>
  );
}
