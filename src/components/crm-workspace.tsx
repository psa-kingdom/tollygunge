"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "./operations-client";
import { inquiryStatuses } from "@/domain/inquiries";
type History = {
  version: number;
  status: string;
  tags: string[];
  created_at: string;
  assigned_to: string | null;
  follow_up_at: string | null;
};
type Inquiry = {
  id: string;
  version: number;
  subject: string;
  message: string;
  name: string;
  email: string;
  status: string;
  assigned_to: string | null;
  follow_up_at: string | null;
  phone: string;
  organization: string;
  job_title: string;
  location: string;
  topic: string;
  contact_preference: string;
  consent_at: string | null;
  source: string;
  created_at: string;
  tags: string[];
  notes: { id: string; body: string; created_at: string }[];
  history: History[];
};
type Data = {
  records: Inquiry[];
  assignees: { id: string; name: string }[];
  tags: string[];
  total: number;
  page: number;
  pageSize: number;
};
export function CrmWorkspace() {
  const [data, setData] = useState<Data>({
      records: [],
      assignees: [],
      tags: [],
      total: 0,
      page: 1,
      pageSize: 50,
    }),
    [selected, setSelected] = useState<Inquiry | null>(null),
    [status, setStatus] = useState("new"),
    [assigned, setAssigned] = useState(""),
    [due, setDue] = useState(""),
    [note, setNote] = useState(""),
    [tags, setTags] = useState(""),
    [filter, setFilter] = useState("all"),
    [focus, setFocus] = useState("all"),
    [tag, setTag] = useState(""),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [message, setMessage] = useState("Loading inquiries…"),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [reload, setReload] = useState(0),
    [dirty, setDirty] = useState(false);
  const path = useCallback(
    () =>
      "/api/staff/crm?" +
      new URLSearchParams({
        status: filter,
        focus,
        tag,
        q: search,
        page: String(page),
      }),
    [filter, focus, tag, search, page],
  );
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    api<Data>(
      id
        ? "/api/staff/crm?id=" + encodeURIComponent(id)
        : path() +
            (params.get("focus")
              ? "&focus=" + encodeURIComponent(params.get("focus")!)
              : ""),
    )
      .then((value) => {
        if (active) {
          setData(value);
          if (id && value.records[0]) select(value.records[0]);
          setMessage("");
        }
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, reload]);
  function select(row: Inquiry) {
    setSelected(row);
    setStatus(row.status);
    setAssigned(row.assigned_to ?? "");
    setDue(
      row.follow_up_at
        ? new Date(row.follow_up_at).toISOString().slice(0, 10)
        : "",
    );
    setTags(row.tags.join(", "));
    setNote("");
    setDirty(false);
    setMessage("");
  }
  function discard() {
    return !dirty || window.confirm("Discard the unsaved inquiry changes?");
  }
  return (
    <>
      <p>
        Public website and account inquiries arrive here. Contact details are
        supplied by the sender; public submissions do not verify an email
        address or create membership.
      </p>
      <form
        className="crm-filters"
        onSubmit={(event) => {
          event.preventDefault();
          if (discard()) {
            setSelected(null);
            setDirty(false);
            setLoading(true);
            setSearch(query);
            setReload((value) => value + 1);
            setPage(1);
          }
        }}
      >
        <label className="crm-search">
          Search inquiries
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={160}
            placeholder="Name, company, email, phone or subject"
          />
        </label>
        <button className="button secondary" disabled={busy}>
          Search
        </button>
        <label>
          Status
          <select
            value={filter}
            disabled={busy}
            onChange={(e) => {
              if (discard()) {
                setLoading(true);
                setFilter(e.target.value);
                setPage(1);
                setSelected(null);
                setDirty(false);
              }
            }}
          >
            <option value="all">All statuses</option>
            {inquiryStatuses.map((s) => (
              <option value={s} key={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Follow-up
          <select
            value={focus}
            disabled={busy}
            onChange={(e) => {
              if (discard()) {
                setLoading(true);
                setFocus(e.target.value);
                setPage(1);
                setSelected(null);
                setDirty(false);
              }
            }}
          >
            <option value="all">All inquiries</option>
            <option value="active">Open work</option>
            <option value="overdue">Overdue</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </label>
        <label>
          Tag
          <select
            value={tag}
            disabled={busy}
            onChange={(e) => {
              if (discard()) {
                setLoading(true);
                setTag(e.target.value);
                setPage(1);
                setSelected(null);
                setDirty(false);
              }
            }}
          >
            <option value="">All tags</option>
            {data.tags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </form>
      <div className="crm-result-bar">
        <span>
          {loading
            ? "Loading…"
            : `${data.total} matching ${data.total === 1 ? "inquiry" : "inquiries"}`}
        </span>
        <div>
          <button
            type="button"
            disabled={busy || loading || page === 1}
            onClick={() => {
              if (discard()) {
                setLoading(true);
                setPage(page - 1);
                setSelected(null);
                setDirty(false);
              }
            }}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            type="button"
            disabled={busy || loading || page * data.pageSize >= data.total}
            onClick={() => {
              if (discard()) {
                setLoading(true);
                setPage(page + 1);
                setSelected(null);
                setDirty(false);
              }
            }}
          >
            Next
          </button>
        </div>
        <button
          type="button"
          disabled={busy || loading}
          onClick={async () => {
            if (!discard()) return;
            setLoading(true);
            try {
              setData(await api<Data>(path()));
              setSelected(null);
              setDirty(false);
              setMessage("Inquiries refreshed.");
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Refresh failed.");
            } finally {
              setLoading(false);
            }
          }}
        >
          Refresh
        </button>
      </div>
      <div className="operations-layout crm-layout">
        <aside className="record-list" aria-label="Inquiry results">
          {!loading && data.records.length === 0 && (
            <p>No inquiries match these filters.</p>
          )}
          {data.records.map((row) => (
            <button
              type="button"
              key={row.id}
              className={selected?.id === row.id ? "selected" : ""}
              aria-pressed={selected?.id === row.id}
              disabled={busy || loading}
              onClick={() => {
                if (selected?.id === row.id || discard()) select(row);
              }}
            >
              <span className={`inquiry-status status-${row.status}`}>
                {row.status}
              </span>
              <strong>{row.subject}</strong>
              <small>
                {row.name}
                {row.organization ? ` · ${row.organization}` : ""}
              </small>
              <small>
                {row.topic} ·{" "}
                {new Date(row.created_at).toLocaleDateString("en-IN")}
              </small>
              {row.tags.length > 0 && (
                <span className="inquiry-tags">
                  {row.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </span>
              )}
              {row.status !== "closed" &&
                row.follow_up_at &&
                new Date(row.follow_up_at) < new Date() && (
                  <small className="overdue-label">Follow-up overdue</small>
                )}
            </button>
          ))}
        </aside>
        <section className="crm-detail">
          {selected ? (
            <>
              <div className="section-heading">
                <h2>{selected.subject}</h2>
                <span className={`inquiry-status status-${selected.status}`}>
                  {selected.status}
                </span>
              </div>
              <dl className="contact-details">
                <div>
                  <dt>Contact</dt>
                  <dd>
                    {selected.name}
                    <br />
                    <a href={`mailto:${selected.email}`}>{selected.email}</a>
                    {selected.phone && (
                      <>
                        <br />
                        <a
                          href={`tel:${selected.phone.replace(/[^+0-9]/g, "")}`}
                        >
                          {selected.phone}
                        </a>
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Organization / role</dt>
                  <dd>
                    {selected.organization || "Not provided"}
                    {selected.job_title && (
                      <>
                        <br />
                        {selected.job_title}
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Location / topic</dt>
                  <dd>
                    {selected.location || "Not provided"}
                    <br />
                    {selected.topic}
                  </dd>
                </div>
                <div>
                  <dt>Source / reply preference</dt>
                  <dd>
                    {selected.source} · {selected.contact_preference}
                    {selected.consent_at && (
                      <>
                        <br />
                        Contact consent recorded{" "}
                        {new Date(selected.consent_at).toLocaleDateString(
                          "en-IN",
                        )}
                      </>
                    )}
                  </dd>
                </div>
              </dl>
              <p className="prose-text inquiry-message">{selected.message}</p>
              <form
                className="member-settings"
                onChange={() => setDirty(true)}
                onSubmit={async (event) => {
                  event.preventDefault();
                  setBusy(true);
                  try {
                    await api("/api/staff/crm", {
                      id: selected.id,
                      version: selected.version,
                      status,
                      assignedTo: assigned,
                      followUpAt: due ? `${due}T09:00:00+05:30` : null,
                      note,
                      tags: tags
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    });
                    const refreshed = await api<Data>(path());
                    setData(refreshed);
                    const detail = await api<Data>(
                      "/api/staff/crm?id=" + selected.id,
                    );
                    if (detail.records[0]) select(detail.records[0]);
                    setMessage("Status, tags, assignment and follow-up saved.");
                  } catch (error) {
                    setMessage(
                      error instanceof Error ? error.message : "Save failed.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <fieldset className="plain-fieldset" disabled={busy}>
                  <div className="form-grid">
                    <label>
                      Status
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        {inquiryStatuses.map((s) => (
                          <option key={s} value={s}>
                            {s[0].toUpperCase() + s.slice(1)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Assigned to
                      <select
                        value={assigned}
                        onChange={(e) => setAssigned(e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {data.assignees.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    Tags (comma separated, up to 8)
                    <input
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      maxLength={248}
                      placeholder="partnership, priority, follow-up"
                    />
                  </label>
                  <label>
                    Follow-up date (09:00 India time)
                    <input
                      type="date"
                      value={due}
                      onChange={(e) => setDue(e.target.value)}
                    />
                  </label>
                  <label>
                    Add a private staff note
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={2000}
                    />
                  </label>
                  <button className="button" disabled={busy}>
                    {busy ? "Saving…" : "Save inquiry"}
                  </button>
                  {dirty && <small>Unsaved changes</small>}
                </fieldset>
              </form>
              <h3>Private staff notes</h3>
              {selected.notes.length === 0 && <p>No staff notes.</p>}
              {selected.notes.map((n) => (
                <article className="content-section" key={n.id}>
                  <p className="prose-text">{n.body}</p>
                  <small>
                    {new Date(n.created_at).toLocaleString("en-IN")}
                  </small>
                </article>
              ))}
              <details className="inquiry-history">
                <summary>Change history ({selected.history.length})</summary>
                {selected.history.length === 0 && (
                  <p>No staff changes recorded yet.</p>
                )}
                {selected.history.map((h) => (
                  <p key={h.version}>
                    <strong>
                      Version {h.version} · {h.status}
                    </strong>
                    <br />
                    {h.tags.join(", ") || "No tags"} ·{" "}
                    {new Date(h.created_at).toLocaleString("en-IN")}
                    <br />
                    Assigned:{" "}
                    {data.assignees.find((a) => a.id === h.assigned_to)?.name ??
                      (h.assigned_to ? "Former operator" : "Unassigned")}{" "}
                    · Follow-up:{" "}
                    {h.follow_up_at
                      ? new Date(h.follow_up_at).toLocaleDateString("en-IN")
                      : "None"}
                  </p>
                ))}
              </details>
            </>
          ) : (
            <div className="crm-empty">
              <h2>A clear path to follow-up.</h2>
              <p>
                Select an inquiry to review the contact details, update its
                status or organize it with tags. Notes and tags are private to
                authorized staff.
              </p>
            </div>
          )}
          <p role="status">{message}</p>
        </section>
      </div>
    </>
  );
}
