"use client";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
import { CampaignComposer } from "./campaign-composer";
import { StatusBadge } from "./portal-values";
import { PortalIcon } from "./portal-icon";
import {
  audienceLabel,
  campaignState,
  type CampaignEntry,
  type EmailTemplate,
} from "@/domain/communications-ui";
import styles from "./communications.module.css";
export function CampaignWorkspace({
  onDirtyChange,
  initialCreate = false,
  initialId,
  initialTemplate,
  onCreate,
  onDelivery,
}: {
  onDirtyChange?: (dirty: boolean) => void;
  initialCreate?: boolean;
  initialId?: string;
  initialTemplate?: EmailTemplate;
  onCreate: () => void;
  onDelivery?: () => void;
}) {
  const [rows, setRows] = useState<CampaignEntry[]>([]),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All emails"),
    [editing, setEditing] = useState(initialCreate || !!initialId),
    [selected, setSelected] = useState<CampaignEntry>(),
    [id, setId] = useState(initialId),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    api<{ campaigns: CampaignEntry[] }>("/api/staff/campaigns")
      .then((data) => {
        if (active) {
          setRows(data.campaigns);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function refresh() {
    try {
      setRows(
        (await api<{ campaigns: CampaignEntry[] }>("/api/staff/campaigns"))
          .campaigns,
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }
  const visible = rows.filter(
    (row) =>
      `${row.name} ${row.subject}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "All emails" ||
        campaignState(row) === (filter === "Drafts" ? "Draft" : filter)),
  );
  if (editing)
    return (
      <CampaignComposer
        key={id || "new"}
        initial={selected}
        id={id}
        initialTemplate={initialTemplate}
        onDirtyChange={onDirtyChange}
        onClose={() => {
          setEditing(false);
          setId(undefined);
          onDirtyChange?.(false);
          void refresh();
        }}
        onSaved={async () => {
          await refresh();
        }}
        onQueued={() => {
          setEditing(false);
          setId(undefined);
          onDirtyChange?.(false);
          setNotice("Email queued. Follow its progress in Delivery activity.");
          void refresh();
        }}
        onDelivery={onDelivery}
      />
    );
  return (
    <section aria-labelledby="email-campaigns-title">
      <header className={styles.sectionHeading}>
        <div>
          <h2 id="email-campaigns-title">
            Email campaigns{" "}
            <span className={styles.count}>
              {loaded
                ? `${rows.length} ${rows.length === 1 ? "email" : "emails"}`
                : ""}
            </span>
          </h2>
          <p>
            Write an email, choose who receives it, and review before sending.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className="button secondary" disabled={!loaded} onClick={() => void refresh()}>
            Refresh
          </button>
          <button type="button" className="button gold" onClick={() => onCreate()}>
            <span aria-hidden="true">＋</span> Create email
          </button>
        </div>
      </header>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className={styles.notice} role="alert">
          {error}{" "}
          <button className="button secondary" onClick={() => void refresh()}>
            Retry
          </button>
        </p>
      )}
      <div className={styles.toolbar}>
        <div
          className={styles.tabs}
          role="group"
          aria-label="Filter email campaigns"
        >
          {[
            "All emails",
            "Drafts",
            "Queued",
            "Sent",
            "Needs review",
            "Cancelled",
            "Archived",
          ].map((tab) => (
            <button
              className="text-button"
              key={tab}
              aria-pressed={filter === tab}
              onClick={() => setFilter(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <label className={styles.search}>
          <span className={styles.srOnly}>Search emails</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email name or subject…"
          />
        </label>
      </div>
      {!loaded ? (
        <p role="status">Loading email campaigns…</p>
      ) : error && !rows.length ? null : !visible.length ? (
        <div className={styles.empty}>
          <PortalIcon name="mail" />
          <h3>
            {rows.length
              ? "No emails match this view"
              : "Your first email starts here"}
          </h3>
          <p>
            {rows.length
              ? "Try another search or choose All emails."
              : "Create a campaign for your community. Choose recipients, write your message, and review everything before sending."}
          </p>
          {rows.length ? (
            <button
              className="button secondary"
              onClick={() => {
                setSearch("");
                setFilter("All emails");
              }}
            >
              Clear filters
            </button>
          ) : (
            <button className="button gold" onClick={() => onCreate()}>
              Create your first email
            </button>
          )}
        </div>
      ) : (
        <div
          className={styles.tableWrap}
          role="region"
          aria-label="Email campaigns"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Audience</th>
                <th>Status</th>
                <th>Last updated</th>
                <th>
                  <span className={styles.srOnly}>Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button
                      className={`${styles.tableLink} text-button`}
                      onClick={() => {
                        setSelected(row);
                        setId(row.id);
                        setEditing(true);
                        setNotice("");
                      }}
                    >
                      {row.name}
                    </button>
                    <small>{row.subject}</small>
                  </td>
                  <td>
                    {audienceLabel(row.audience)}
                    {row.audience.city && <small>{row.audience.city}</small>}
                  </td>
                  <td>
                    <StatusBadge
                      tone={
                        campaignState(row) === "Sent"
                          ? "success"
                          : campaignState(row) === "Queued"
                            ? "pending"
                            : "neutral"
                      }
                    >
                      {campaignState(row)}
                    </StatusBadge>
                    {!!row.recipient_count && (
                      <small>{row.recipient_count} recipients</small>
                    )}
                  </td>
                  <td className={styles.muted}>
                    {row.updated_at
                      ? new Intl.DateTimeFormat("en-IN", {
                          timeZone: "Asia/Kolkata",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }).format(new Date(row.updated_at))
                      : "—"}
                  </td>
                  <td>
                    <button
                      className="button secondary"
                      onClick={() => {
                        setSelected(row);
                        setId(row.id);
                        setEditing(true);
                      }}
                    >
                      {row.status === "archived" ? "View" : "Open"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {loaded && (
        <p className={styles.helper}>
          {visible.length} {visible.length === 1 ? "email" : "emails"} shown
          {rows.length === 100 ? " · Latest 100 campaigns" : ""}. Sent means
          accepted by the provider; final delivery is shown in Delivery
          activity.
        </p>
      )}
    </section>
  );
}
