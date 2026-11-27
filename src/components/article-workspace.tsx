"use client";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
import { ArticleEditor } from "./article-editor";
import { PortalIcon } from "./portal-icon";
import { StatusBadge } from "./portal-values";
import { publicationState, type ArticleEntry } from "@/domain/publishing";
import ui from "./communications.module.css";
export function ArticleWorkspace({
  onDirty,
}: {
  onDirty?: (dirty: boolean) => void;
}) {
  const [entries, setEntries] = useState<ArticleEntry[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All articles"),
    [editing, setEditing] = useState(false),
    [selected, setSelected] = useState<ArticleEntry | null>(null);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await api<(ArticleEntry & { kind: string })[]>(
        "/api/staff/content?archived=true",
      );
      setEntries(rows.filter((e) => e.kind === "insight" || e.kind === "news"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void api<(ArticleEntry & { kind: string })[]>(
      "/api/staff/content?archived=true",
    )
      .then((rows) =>
        setEntries(
          rows.filter((e) => e.kind === "insight" || e.kind === "news"),
        ),
      )
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const visible = entries.filter(
    (e) =>
      (filter === "All articles" ||
        publicationState(e) === (filter === "Drafts" ? "Draft" : filter)) &&
      `${e.draft.title} ${e.slug}`.toLowerCase().includes(search.toLowerCase()),
  );
  function create() {
    setSelected(null);
    setEditing(true);
  }
  if (editing)
    return (
      <ArticleEditor
        initial={selected}
        onDirty={onDirty}
        onClose={() => {
          setEditing(false);
          onDirty?.(false);
          void load();
        }}
      />
    );
  return (
    <section>
      <header className={ui.sectionHeading}>
        <div>
          <h2>
            Articles & news <span className={ui.count}>{entries.length}</span>
          </h2>
          <p>Write, review and publish updates for your website.</p>
        </div>
        <button className="button gold" onClick={create}>
          ＋ New article
        </button>
      </header>
      <div className={ui.toolbar}>
        <div className={ui.tabs} role="group" aria-label="Filter articles">
          {["All articles", "Drafts", "Published", "Archived"].map((t) => (
            <button
              className="text-button"
              key={t}
              aria-pressed={filter === t}
              onClick={() => setFilter(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <label className={ui.search}>
          <span className={ui.srOnly}>Search articles</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search articles…"
          />
        </label>
      </div>
      {error && (
        <p role="alert" className={ui.notice}>
          {error}{" "}
          <button className="button secondary" onClick={() => void load()}>
            Retry
          </button>
        </p>
      )}
      {loading ? (
        <p role="status">Loading articles…</p>
      ) : error ? null : !visible.length ? (
        <div className={ui.empty}>
          <PortalIcon name="file" />
          <h3>
            {entries.length
              ? "No matching articles"
              : "Your next story starts here"}
          </h3>
          <p>
            {entries.length
              ? "Try another search or status."
              : "Create an article, add your copy and images, then preview it before publishing."}
          </p>
          {!entries.length && (
            <button className="button gold" onClick={create}>
              Write an article
            </button>
          )}
        </div>
      ) : (
        <div
          className={ui.tableWrap}
          role="region"
          aria-label="Articles"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>
                  <span className={ui.srOnly}>Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.id}>
                  <td>
                    <button
                      className={`text-button ${ui.tableLink}`}
                      onClick={() => {
                        setSelected(e);
                        setEditing(true);
                      }}
                    >
                      {e.draft.title}
                    </button>
                    <small>/resources/{e.slug}</small>
                  </td>
                  <td>{e.kind === "news" ? "News summary" : "Article"}</td>
                  <td>
                    <StatusBadge
                      tone={
                        e.archived_at
                          ? "neutral"
                          : e.published
                            ? "success"
                            : "pending"
                      }
                    >
                      {publicationState(e)}
                    </StatusBadge>
                  </td>
                  <td>
                    <button
                      className="button secondary"
                      onClick={() => {
                        setSelected(e);
                        setEditing(true);
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
