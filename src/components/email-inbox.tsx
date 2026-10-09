"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./operations-client";
import { useEmailEditGuard } from "./email-edit-guard";
type Conversation = {
  id: string;
  version: number;
  subject: string;
  correspondent: string;
  reply_to: string;
  status: string;
  unread: boolean;
  archived: boolean;
  assigned_to: string | null;
  inquiry_id: string | null;
  draft: string;
  draft_version: number;
  assigned_name?: string;
};
type Message = {
  id: string;
  direction: string;
  sender: string;
  body: string;
  created_at: string;
  attachments: { name: string; type: string }[];
};
type Detail = {
  entry: Conversation;
  messages: Message[];
  hasMore: boolean;
  notes: { id: string; body: string; actor_name: string; created_at: string }[];
};
export function EmailInbox({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [entries, setEntries] = useState<Conversation[]>([]),
    [staff, setStaff] = useState<{ id: string; name: string }[]>([]),
    [entry, setEntry] = useState<Conversation>(),
    [detail, setDetail] = useState<Detail>(),
    [draft, setDraft] = useState(""),
    [note, setNote] = useState(""),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("all"),
    [archived, setArchived] = useState(false),
    [page, setPage] = useState(1),
    [hasMore, setHasMore] = useState(false),
    [messagePage, setMessagePage] = useState(1),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("Loading shared inbox…"),
    [confirm, setConfirm] = useState(false),
    [inquiryId, setInquiryId] = useState("");
  const requestSequence = useRef(0);
  const dirty =
    !!entry &&
    (draft !== entry.draft || !!note || inquiryId !== (entry.inquiry_id ?? ""));
  const guard = useEmailEditGuard(dirty, false);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setBusy(true);
    try {
      const data = await api<{
        entries: Conversation[];
        staff: { id: string; name: string }[];
        hasMore: boolean;
      }>(
        `/api/staff/inbox?${new URLSearchParams({ q, status, archived: String(archived), page: String(page) })}`,
      );
      if (sequence !== requestSequence.current) return;
      setEntries(data.entries);
      setStaff(data.staff);
      setHasMore(data.hasMore);
      setMessage("");
    } catch (e) {
      if (sequence === requestSequence.current)
        setMessage((e as Error).message);
    } finally {
      if (sequence === requestSequence.current) setBusy(false);
    }
  }, [q, status, archived, page]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);
  async function open(id: string, p = 1) {
    setBusy(true);
    setMessage("");
    try {
      const data = await api<Detail>(`/api/staff/inbox?id=${id}&page=${p}`);
      setDetail(data);
      setEntry(data.entry);
      setDraft(data.entry.draft);
      setInquiryId(data.entry.inquiry_id ?? "");
      setNote("");
      setMessagePage(p);
      setConfirm(false);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function action(kind: string, fields: Record<string, unknown> = {}) {
    if (!entry) return;
    const retainedDraft = draft,
      retainedNote = note,
      retainedInquiry = inquiryId;
    setBusy(true);
    setMessage("");
    try {
      await api("/api/staff/inbox", {
        action: kind,
        id: entry.id,
        version: entry.version,
        ...fields,
      });
      await open(entry.id);
      if (kind === "note") setDraft(retainedDraft);
      if (kind === "draft" || kind === "note") setInquiryId(retainedInquiry);
      if (kind === "draft") setNote(retainedNote);
      await load();
      setMessage(
        kind === "send"
          ? "Reply queued. Delivery is tracked separately."
          : "Inbox changes saved.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }
  async function update(fields: Partial<Conversation>) {
    if (!entry) return;
    await action("update", {
      status: fields.status ?? entry.status,
      unread: fields.unread ?? entry.unread,
      archived: fields.archived ?? entry.archived,
      assignedTo:
        fields.assigned_to === undefined
          ? entry.assigned_to
          : fields.assigned_to,
      inquiryId:
        fields.inquiry_id === undefined ? entry.inquiry_id : fields.inquiry_id,
    });
  }
  return (
    <section className="content-section">
      <h2>Shared inbox</h2>
      <p>
        contact@updates.tpassociation.org · Staff-only conversations.
        Attachments are shown as metadata; files are not retrieved.
      </p>
      <div className="crm-filters">
        <label>
          Search inbox
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Subject or sender"
          />
        </label>
        <label>
          Conversation status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {["all", "new", "in_progress", "closed"].map((x) => (
              <option key={x} value={x}>
                {x.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => {
              setArchived(e.target.checked);
              setPage(1);
            }}
          />
          Archived conversations
        </label>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          Refresh inbox
        </button>
      </div>
      <p role="status">{message}</p>
      <div className="operations-layout">
        <aside className="record-list">
          {!entries.length && !busy && <p>No conversations match.</p>}
          {entries.map((x) => (
            <button
              key={x.id}
              disabled={busy}
              onClick={() => guard.proceed(() => void open(x.id))}
            >
              <strong>
                {x.unread ? "● " : ""}
                {x.subject || "(No subject)"}
              </strong>
              <small>{x.correspondent}</small>
              <small>
                {x.status.replaceAll("_", " ")}
                {x.assigned_name ? ` · ${x.assigned_name}` : ""}
              </small>
            </button>
          ))}
          <div className="email-actions">
            <button
              disabled={busy || page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span>Page {page}</span>
            <button
              disabled={busy || !hasMore}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </aside>
        <section>
          {entry ? (
            <>
              <h3>{entry.subject}</h3>
              <p>
                From {entry.correspondent}
                <br />
                Reply destination: {entry.reply_to}
              </p>
              <div className="email-actions">
                <label>
                  Status
                  <select
                    disabled={busy}
                    value={entry.status}
                    onChange={(e) =>
                      guard.proceed(
                        () => void update({ status: e.target.value }),
                      )
                    }
                  >
                    {["new", "in_progress", "closed"].map((x) => (
                      <option key={x} value={x}>
                        {x.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Assigned to
                  <select
                    disabled={busy}
                    value={entry.assigned_to ?? ""}
                    onChange={(e) =>
                      guard.proceed(
                        () =>
                          void update({ assigned_to: e.target.value || null }),
                      )
                    }
                  >
                    <option value="">Unassigned</option>
                    {staff.map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    guard.proceed(() => void update({ unread: !entry.unread }))
                  }
                >
                  {entry.unread ? "Mark read" : "Mark unread"}
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    guard.proceed(
                      () => void update({ archived: !entry.archived }),
                    )
                  }
                >
                  {entry.archived
                    ? "Restore conversation"
                    : "Archive conversation"}
                </button>
              </div>
              <form
                className="email-actions"
                onSubmit={(e) => {
                  e.preventDefault();
                  const id = String(
                    new FormData(e.currentTarget).get("inquiryId"),
                  );
                  if (draft !== entry.draft || note)
                    guard.proceed(
                      () => void update({ inquiry_id: id || null }),
                    );
                  else void update({ inquiry_id: id || null });
                }}
              >
                <label>
                  Linked CRM inquiry ID
                  <input
                    name="inquiryId"
                    key={entry.inquiry_id ?? "none"}
                    value={inquiryId}
                    onChange={(e) => setInquiryId(e.target.value)}
                    placeholder="Existing inquiry ID (optional)"
                  />
                </label>
                <button className="button secondary" disabled={busy}>
                  Link inquiry
                </button>
              </form>
              <div className="email-thread">
                {detail?.messages.map((m) => (
                  <article className="email-message" key={m.id}>
                    <strong>
                      {m.direction === "incoming" ? "Received" : "Sent"} ·{" "}
                      {m.sender}
                    </strong>
                    <small>
                      {new Date(m.created_at).toLocaleString("en-IN")}
                    </small>
                    <div className="email-message-body">
                      {m.body || "(No readable message text)"}
                    </div>
                    {m.attachments.length > 0 && (
                      <p>
                        Attachments:{" "}
                        {m.attachments.map((a) => a.name).join(", ")}. File
                        access is deferred.
                      </p>
                    )}
                  </article>
                ))}
              </div>
              <div className="email-actions">
                <button
                  className="button secondary"
                  disabled={busy || messagePage === 1}
                  onClick={() =>
                    guard.proceed(() => void open(entry.id, messagePage - 1))
                  }
                >
                  Newer messages
                </button>
                <button
                  className="button secondary"
                  disabled={busy || !detail?.hasMore}
                  onClick={() =>
                    guard.proceed(() => void open(entry.id, messagePage + 1))
                  }
                >
                  Older messages
                </button>
              </div>
              <h3>Reply draft</h3>
              <form
                className="member-settings"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action("draft", { body: draft });
                }}
              >
                <label>
                  Reply message
                  <textarea
                    value={draft}
                    maxLength={6000}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      setConfirm(false);
                    }}
                    rows={7}
                  />
                  <small>{draft.length}/6,000 characters · Plain text</small>
                </label>
                <button className="button secondary" disabled={busy}>
                  Save reply draft
                </button>
              </form>
              <button
                className="button"
                disabled={
                  busy || dirty || !entry.draft.trim() || entry.archived
                }
                onClick={() => setConfirm(true)}
              >
                Review and send reply
              </button>
              {confirm && (
                <section
                  className="email-confirm"
                  role="region"
                  aria-label="Confirm reply"
                >
                  <h4>Send saved reply</h4>
                  <p>
                    To {entry.reply_to} from contact@updates.tpassociation.org
                  </p>
                  <div className="email-message-body">{entry.draft}</div>
                  <p>
                    This queues the saved reply. Quota limits may delay
                    delivery.
                  </p>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      void action("send", {
                        draftVersion: entry.draft_version,
                        confirm: true,
                      })
                    }
                  >
                    Confirm send reply
                  </button>{" "}
                  <button
                    className="button secondary"
                    onClick={() => setConfirm(false)}
                  >
                    Cancel
                  </button>
                </section>
              )}
              <h3>Private notes</h3>
              {detail?.notes.map((n) => (
                <p key={n.id}>
                  {n.body}
                  <small>
                    {n.actor_name} ·{" "}
                    {new Date(n.created_at).toLocaleString("en-IN")}
                  </small>
                </p>
              ))}
              <form
                className="member-settings"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action("note", { body: note });
                }}
              >
                <label>
                  Private note
                  <textarea
                    value={note}
                    maxLength={2000}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <button
                  className="button secondary"
                  disabled={busy || !note.trim()}
                >
                  Save private note
                </button>
              </form>
            </>
          ) : (
            <p>Select a conversation to read messages and prepare a reply.</p>
          )}
        </section>
      </div>
      {guard.dialog}
    </section>
  );
}
