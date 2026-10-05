"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "./operations-client";
import { pageSlugs, type ContentBody } from "@/domain/operations";
import { sitePages } from "@/domain/site-pages";
type Entry = {
  id: string;
  slug: string;
  kind: string;
  draft: ContentBody;
  published: ContentBody | null;
  version: number;
};
function pageBody(slug: string): ContentBody {
  const page = sitePages[slug];
  return {
    title: page.title,
    intro: page.intro,
    sections: page.sections.map((s) => ({ ...s })),
    sourceUrl: "",
    attribution: "",
  };
}
const empty: ContentBody = pageBody("about");
export function ContentEditor() {
  const [entries, setEntries] = useState<Entry[]>([]),
    [selected, setSelected] = useState<Entry | null>(null),
    [body, setBody] = useState<ContentBody>(empty),
    [kind, setKind] = useState("page"),
    [slug, setSlug] = useState("about"),
    [message, setMessage] = useState("Loading content…"),
    [busy, setBusy] = useState(false);
  async function load() {
    setEntries(await api<Entry[]>("/api/staff/content"));
  }
  useEffect(() => {
    api<Entry[]>("/api/staff/content")
      .then(setEntries)
      .then(() => setMessage(""))
      .catch((e) => setMessage(e.message));
  }, []);
  function select(entry: Entry | null) {
    setSelected(entry);
    setBody(entry?.draft ?? empty);
    setKind(entry?.kind ?? "page");
    setSlug(entry?.slug ?? "about");
    setMessage("");
  }
  async function act(action: string) {
    setBusy(true);
    setMessage("");
    try {
      const entry = await api<Entry>("/api/staff/content", {
        action,
        id: selected?.id,
        version: selected?.version ?? 0,
        slug,
        kind,
        body,
      });
      select(entry);
      await load();
      setMessage(
        action === "save"
          ? "Draft saved. Published content is unchanged."
          : action === "publish"
            ? "Published on the public site."
            : "Publication removed.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="operations-layout">
      <aside className="record-list">
        <button className="button secondary" onClick={() => select(null)}>
          New entry
        </button>
        {entries.length === 0 && <p>No content entries yet.</p>}
        {entries.map((entry) => (
          <button
            key={entry.id}
            className={entry.id === selected?.id ? "selected" : ""}
            onClick={() => select(entry)}
          >
            <strong>{entry.draft.title}</strong>
            <small>
              {entry.kind} · {entry.published ? "Published" : "Draft"} · /
              {entry.slug}
            </small>
          </button>
        ))}
      </aside>
      <section>
        <h2>{selected ? "Edit content" : "Create content"}</h2>
        <p>
          Save a private draft, preview it, then publish. Sections use plain
          text for safe, readable content.
        </p>
        <form
          className="member-settings"
          onSubmit={(e) => {
            e.preventDefault();
            void act("save");
          }}
        >
          <div className="form-grid">
            <label>
              Type
              <select
                value={kind}
                disabled={!!selected}
                onChange={(e) => {
                  setKind(e.target.value);
                  setSlug(e.target.value === "page" ? "about" : "");
                  setBody(
                    e.target.value === "page"
                      ? pageBody("about")
                      : {
                          title: "",
                          intro: "",
                          sections: [{ title: "", text: "" }],
                          sourceUrl: "",
                          attribution: "",
                        },
                  );
                }}
              >
                <option value="page">Website page</option>
                <option value="insight">Insight</option>
                <option value="news">Attributed news summary</option>
              </select>
            </label>
            <label>
              URL slug
              {kind === "page" ? (
                <select
                  disabled={!!selected}
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setBody(pageBody(e.target.value));
                  }}
                >
                  {pageSlugs.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  disabled={!!selected}
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  maxLength={100}
                />
              )}
            </label>
          </div>
          <label>
            Title
            <input
              value={body.title}
              onChange={(e) => setBody({ ...body, title: e.target.value })}
              required
              minLength={3}
              maxLength={160}
            />
          </label>
          <label>
            Introduction
            <textarea
              value={body.intro}
              onChange={(e) => setBody({ ...body, intro: e.target.value })}
              maxLength={1000}
            />
          </label>
          {body.sections.map((section, i) => (
            <fieldset key={i}>
              <legend>Section {i + 1}</legend>
              <label>
                Section title
                <input
                  value={section.title}
                  readOnly={kind === "page"}
                  required
                  maxLength={120}
                  onChange={(e) =>
                    setBody({
                      ...body,
                      sections: body.sections.map((s, j) =>
                        i === j ? { ...s, title: e.target.value } : s,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Text
                <textarea
                  value={section.text}
                  required
                  maxLength={kind === "news" ? 1500 : 6000}
                  onChange={(e) =>
                    setBody({
                      ...body,
                      sections: body.sections.map((s, j) =>
                        i === j ? { ...s, text: e.target.value } : s,
                      ),
                    })
                  }
                />
              </label>
              {kind !== "page" && (
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    setBody({
                      ...body,
                      sections: body.sections.filter((_, j) => i !== j),
                    })
                  }
                >
                  Remove section
                </button>
              )}
            </fieldset>
          ))}
          {kind !== "page" && (
            <button
              type="button"
              className="button secondary"
              disabled={body.sections.length >= 12}
              onClick={() =>
                setBody({
                  ...body,
                  sections: [...body.sections, { title: "", text: "" }],
                })
              }
            >
              Add section
            </button>
          )}
          {kind === "news" && (
            <p>
              Write a short original summary, up to 2,000 characters across
              sections. Attribute the source and link to the original; do not
              copy an article.
            </p>
          )}
          <label>
            Source URL
            <input
              type="url"
              value={body.sourceUrl}
              required={kind === "news"}
              maxLength={1000}
              onChange={(e) => setBody({ ...body, sourceUrl: e.target.value })}
            />
          </label>
          <label>
            Source / author attribution
            <input
              value={body.attribution}
              required={kind === "news"}
              maxLength={200}
              onChange={(e) =>
                setBody({ ...body, attribution: e.target.value })
              }
            />
          </label>
          <div className="action-row">
            <button className="button" disabled={busy}>
              Save draft
            </button>
            {selected && (
              <>
                <Link
                  className="button secondary"
                  href={`/admin/content/${selected.id}`}
                >
                  Preview saved draft
                </Link>
                <button
                  type="button"
                  className="button secondary"
                  disabled={
                    busy ||
                    JSON.stringify(body) !== JSON.stringify(selected.draft)
                  }
                  onClick={() => void act("publish")}
                >
                  Publish saved draft
                </button>
                {selected.published && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy}
                    onClick={() => void act("unpublish")}
                  >
                    Unpublish
                  </button>
                )}
              </>
            )}
          </div>
        </form>
        <p role="status">{message}</p>
      </section>
    </div>
  );
}
