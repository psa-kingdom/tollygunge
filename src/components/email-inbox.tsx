"use client";
import { PortalIcon } from "./portal-icon";
import { emailLabel } from "@/domain/communications-ui";
import styles from "./communications.module.css";
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
  sendingEnabled = false,
}: {
  onDirtyChange?: (dirty: boolean) => void;
  sendingEnabled?: boolean;
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
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("conversation");
    if (id) void open(id);
  }, []);
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
    <section>
      <header className={styles.sectionHeading}>
        <div>
          <h2>Inbox</h2>
          <p>Incoming messages to contact@updates.tpassociation.org</p>
        </div>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          Refresh
        </button>
      </header>
      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          {[false, true].map((value) => (
            <button
              className="text-button"
              key={String(value)}
              aria-pressed={archived === value}
              onClick={() => {
                setArchived(value);
                setPage(1);
              }}
            >
              {value ? "Archived" : "Inbox"}
            </button>
          ))}
        </div>
        <label className={styles.search}>
          <span className={styles.srOnly}>Search inbox</span>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search subject or sender"
          />
        </label>
        <label className={styles.filterSelect}>
          <span className={styles.srOnly}>Conversation status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {["all", "new", "in_progress", "closed"].map((x) => (
              <option key={x} value={x}>
                {x === "all" ? "All statuses" : emailLabel(x)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {message && (
        <p role="status" className={styles.notice}>
          {message}
        </p>
      )}
      {!entries.length && !entry && !busy ? (
        <div className={styles.empty}>
          <PortalIcon name="message" />
          <h3>
            {q || status !== "all"
              ? "No matching conversations"
              : archived
                ? "No archived conversations"
                : "Your inbox is clear"}
          </h3>
          <p>
            {q || status !== "all"
              ? "Try a different sender, subject or status."
              : "Incoming conversations will appear here. Select a message to read it and prepare a reply."}
          </p>
        </div>
      ) : !entries.length && !entry ? null : (
        <div className={styles.inboxLayout} aria-busy={busy}>
          <aside className={styles.conversationList} aria-label="Conversations">
            {entries.map((x) => (
              <button
                className="text-button"
                key={x.id}
                disabled={busy}
                aria-current={entry?.id === x.id}
                onClick={() => guard.proceed(() => void open(x.id))}
              >
                <strong>
                  {x.unread ? "● " : ""}
                  {x.subject || "(No subject)"}
                </strong>
                <small>{x.correspondent}</small>
                <small>
                  {emailLabel(x.status)}
                  {x.assigned_name ? ` · ${x.assigned_name}` : ""}
                </small>
              </button>
            ))}
            {!entries.length && (
              <p className={styles.notice}>
                No conversations match these filters.
              </p>
            )}
            {(hasMore || page > 1) && (
              <div className={styles.pagination}>
                <button
                  className="text-button"
                  disabled={busy || page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span>{page}</span>
                <button
                  className="text-button"
                  disabled={busy || !hasMore}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </aside>
          <section className={styles.conversation}>
            {entry ? (
              <>
                <h3>{entry.subject || "(No subject)"}</h3>
                <p>
                  {entry.correspondent}
                  <br />
                  Replies go to {entry.reply_to}
                </p>
                <div className={styles.conversationTools}>
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
                          {emailLabel(x)}
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
                            void update({
                              assigned_to: e.target.value || null,
                            }),
                        )
                      }
                    >
                      <option value="">Unassigned</option>
                      {staff.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className={styles.thread}>
                  {detail?.messages.map((m) => (
                    <article
                      className={styles.message}
                      data-direction={m.direction}
                      key={m.id}
                    >
                      <header>
                        <strong>
                          {m.direction === "incoming" ? "Received" : "Sent"} ·{" "}
                          {m.sender}
                        </strong>
                        <small>
                          {new Date(m.created_at).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                          })}
                        </small>
                      </header>
                      <div className={styles.messageBody}>
                        {m.body || "(No readable message text)"}
                      </div>
                      {m.attachments.length > 0 && (
                        <p>
                          Attachments:{" "}
                          {m.attachments.map((a) => a.name).join(", ")} · File
                          previews are unavailable.
                        </p>
                      )}
                    </article>
                  ))}
                </div>
                {(messagePage > 1 || detail?.hasMore) && (
                  <div className={styles.pagination}>
                    <button
                      className="text-button"
                      disabled={busy || messagePage === 1}
                      onClick={() =>
                        guard.proceed(
                          () => void open(entry.id, messagePage - 1),
                        )
                      }
                    >
                      Newer messages
                    </button>
                    <button
                      className="text-button"
                      disabled={busy || !detail?.hasMore}
                      onClick={() =>
                        guard.proceed(
                          () => void open(entry.id, messagePage + 1),
                        )
                      }
                    >
                      Older messages
                    </button>
                  </div>
                )}
                <form
                  className={`${styles.formCard} ${styles.replyBox}`}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action("draft", { body: draft });
                  }}
                >
                  <h3>Reply</h3>
                  <label>
                    Message
                    <textarea
                      disabled={busy}
                      value={draft}
                      maxLength={6000}
                      rows={6}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        setConfirm(false);
                      }}
                    />
                    <small>
                      {draft.length.toLocaleString("en-IN")} / 6,000 characters
                      · Save your reply before reviewing it.
                    </small>
                  </label>
                  <div className={styles.actions}>
                    <button
                      className="button secondary"
                      disabled={busy || draft === entry.draft}
                    >
                      Save draft
                    </button>
                    <button
                      className="button gold"
                      type="button"
                      disabled={
                        busy || dirty || !entry.draft.trim() || entry.archived
                      }
                      onClick={() => setConfirm(true)}
                    >
                      Review reply
                    </button>
                  </div>
                </form>
                {confirm && (
                  <section
                    className={styles.formCard}
                    aria-label="Confirm reply"
                  >
                    <h3>Review your reply</h3>
                    {!sendingEnabled && (
                      <p className={styles.notice}>
                        Sending is paused. Your saved reply is available for
                        later.
                      </p>
                    )}
                    <p>
                      To {entry.reply_to} from contact@updates.tpassociation.org
                    </p>
                    <div className={styles.messageBody}>{entry.draft}</div>
                    <div className={styles.actions}>
                      <button
                        className="button secondary"
                        onClick={() => setConfirm(false)}
                      >
                        Keep editing
                      </button>
                      <button
                        className="button gold"
                        disabled={busy || dirty || !sendingEnabled}
                        onClick={() =>
                          void action("send", {
                            draftVersion: entry.draft_version,
                            confirm: true,
                          })
                        }
                      >
                        Confirm and queue reply
                      </button>
                    </div>
                  </section>
                )}
                <details className={styles.history}>
                  <summary>Conversation options &amp; private notes</summary>
                  <div className={styles.actions}>
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        guard.proceed(
                          () => void update({ unread: !entry.unread }),
                        )
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
                    className={styles.formCard}
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (draft !== entry.draft || note)
                        guard.proceed(
                          () => void update({ inquiry_id: inquiryId || null }),
                        );
                      else void update({ inquiry_id: inquiryId || null });
                    }}
                  >
                    <label>
                      Linked website inquiry
                      <input
                        value={inquiryId}
                        onChange={(e) => setInquiryId(e.target.value)}
                        placeholder="Existing inquiry ID"
                      />
                    </label>
                    <button
                      className="button secondary"
                      disabled={busy || inquiryId === (entry.inquiry_id ?? "")}
                    >
                      Save inquiry link
                    </button>
                  </form>
                  <h4>Private notes</h4>
                  <p>Only your team can see these notes.</p>
                  {detail?.notes.map((n) => (
                    <article key={n.id}>
                      <div className={styles.messageBody}>{n.body}</div>
                      <p>
                        {n.actor_name} ·{" "}
                        {new Date(n.created_at).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                        })}
                      </p>
                    </article>
                  ))}
                  <form
                    className={`${styles.formCard} ${styles.replyBox}`}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action("note", { body: note });
                    }}
                  >
                    <label>
                      Add a private note
                      <textarea
                        disabled={busy}
                        value={note}
                        maxLength={2000}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </label>
                    <button
                      className="button secondary"
                      disabled={busy || !note.trim()}
                    >
                      Save note
                    </button>
                  </form>
                </details>
              </>
            ) : (
              <div className={`${styles.empty} ${styles.emptyCompact}`}>
                <PortalIcon name="message" />
                <h3>Select a conversation</h3>
                <p>Read the message, assign an owner and prepare a reply.</p>
              </div>
            )}
          </section>
        </div>
      )}
      {guard.dialog}
    </section>
  );
}
