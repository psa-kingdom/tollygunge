"use client";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
import { useUnsavedProfile } from "./use-unsaved-profile";
import { sitePages } from "@/domain/site-pages";
import type { ProfileGroup } from "@/domain/people";
import ui from "./communications.module.css";
import styles from "./publishing.module.css";
const blank = { name: "", page: "governance", section: 0, order: 0 };
export function PublishingGroups({
  groups,
  onDirty,
  onClose,
}: {
  groups: ProfileGroup[];
  onDirty?: (dirty: boolean) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState(groups),
    [entry, setEntry] = useState<ProfileGroup | null>(null),
    [editing, setEditing] = useState(false),
    [body, setBody] = useState(blank),
    [parent, setParent] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const dirty =
      JSON.stringify(body) !== JSON.stringify(entry?.draft ?? blank) ||
      parent !== (entry?.parent_id ?? ""),
    { guard, dialog } = useUnsavedProfile(dirty, false);
  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);
  async function action(action: string) {
    setBusy(true);
    setError("");
    try {
      const row = await api<ProfileGroup>("/api/staff/profile-groups", {
        action,
        id: entry?.id,
        version: entry?.version ?? 0,
        body,
        parentId: parent || null,
      });
      setEntry(row);
      setBody(row.draft);
      setParent(row.parent_id ?? "");
      setRows((r) => [row, ...r.filter((g) => g.id !== row.id)]);
      setNotice(
        action === "publish"
          ? "Group published. Profiles can now be placed here."
          : action === "save"
            ? "Group draft saved. Publish to make this placement available."
            : `Group ${action} completed.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function open(row: ProfileGroup | null) {
    guard(() => {
      setEntry(row);
      setBody(row?.draft ?? blank);
      setParent(row?.parent_id ?? "");
      setEditing(true);
      setNotice("");
    });
  }
  return (
    <section>
      <button
        className={`text-button ${ui.back}`}
        disabled={busy}
        onClick={() => guard(onClose)}
      >
         Member profiles
      </button>
      <header className={ui.sectionHeading}>
        <div>
          <h2>Website groups</h2>
          <p>Choose where committee profiles appear on About and Governance.</p>
        </div>
        {!editing && (
          <button className="button gold" onClick={() => open(null)}>
            ＋ New group
          </button>
        )}
      </header>
      {error && (
        <p className={ui.notice} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className={ui.notice} role="status">
          {notice}
        </p>
      )}
      {editing ? (
        <div className={styles.writing}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action("save");
            }}
          >
            <fieldset disabled={busy || !!entry?.archived}>
              <label>
                Group name
                <input
                  value={body.name}
                  minLength={2}
                  maxLength={120}
                  required
                  onChange={(e) => setBody({ ...body, name: e.target.value })}
                />
              </label>
              <div className={styles.row}>
                <label>
                  Website page
                  <select
                    disabled={!!parent}
                    value={body.page}
                    onChange={(e) =>
                      setBody({ ...body, page: e.target.value, section: 0 })
                    }
                  >
                    <option value="about">About</option>
                    <option value="governance">Governance</option>
                  </select>
                </label>
                <label>
                  Page section
                  <select
                    disabled={!!parent}
                    value={body.section}
                    onChange={(e) =>
                      setBody({ ...body, section: Number(e.target.value) })
                    }
                  >
                    {sitePages[body.page].sections.map((s, i) => (
                      <option key={i} value={i}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <details className={styles.placement}>
                <summary>Ordering & parent group</summary>
                <label>
                  Parent group
                  <select
                    disabled={!!entry?.published}
                    value={parent}
                    onChange={(e) => {
                      setParent(e.target.value);
                      const p = rows.find((g) => g.id === e.target.value);
                      if (p)
                        setBody({
                          ...body,
                          page: p.draft.page,
                          section: p.draft.section,
                        });
                    }}
                  >
                    <option value="">No parent group</option>
                    {rows
                      .filter(
                        (g) =>
                          !g.parent_id && !g.archived && g.id !== entry?.id,
                      )
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.draft.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Display order
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={body.order}
                    onChange={(e) =>
                      setBody({ ...body, order: Number(e.target.value) })
                    }
                  />
                </label>
              </details>
            </fieldset>
            <div className={ui.actions}>
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() =>
                  guard(() => {
                    setEditing(false);
                    setEntry(null);
                    setBody(blank);
                    setParent("");
                    onDirty?.(false);
                  })
                }
              >
                All groups
              </button>
              <div className={ui.headerActions}>
                <button
                  className="button secondary"
                  disabled={busy || !!entry?.archived || (!dirty && !!entry)}
                >
                  Save draft
                </button>
                <button
                  className="button gold"
                  type="button"
                  disabled={busy || dirty || !entry || entry.archived}
                  onClick={() => void action("publish")}
                >
                  Publish group
                </button>
              </div>
            </div>
          </form>
          {entry && (
            <details className={styles.placement}>
              <summary>Archive options</summary>
              <p className={styles.notice}>
                Archiving removes this placement from public pages.
              </p>
              <button
                className="button secondary"
                disabled={busy || dirty}
                onClick={() =>
                  void action(entry.archived ? "restore" : "archive")
                }
              >
                {entry.archived ? "Restore group" : "Archive group"}
              </button>
            </details>
          )}
        </div>
      ) : (
        <div className={ui.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Group</th>
                <th>Page</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id}>
                  <td>
                    <button
                      className={`text-button ${ui.tableLink}`}
                      onClick={() => open(g)}
                    >
                      {g.draft.name}
                    </button>
                  </td>
                  <td>
                    {g.draft.page === "about" ? "About" : "Governance"} ·{" "}
                    {sitePages[g.draft.page]?.sections[g.draft.section]?.title}
                  </td>
                  <td>
                    {g.archived
                      ? "Archived"
                      : g.published
                        ? "Published"
                        : "Draft"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dialog}
    </section>
  );
}
