"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "./operations-client";
import { RichEditor } from "./rich-editor";
import { ContentPreview } from "./content-preview";
import { emptyContentContext } from "./public-content-view";
import { StatusBadge } from "./portal-values";
import { useUnsavedProfile } from "./use-unsaved-profile";
import { contentInput, type ContentBody } from "@/domain/operations";
import { contentLimits } from "@/domain/rich-content";
import {
  articleSlug,
  emptyArticle,
  publicationState,
  type ArticleEntry,
} from "@/domain/publishing";
import ui from "./communications.module.css";
import styles from "./publishing.module.css";
type Media = {
  id: string;
  published: { title: string; altText: string } | null;
};
export function ArticleEditor({
  initial,
  onDirty,
  onClose,
}: {
  initial: ArticleEntry | null;
  onDirty?: (dirty: boolean) => void;
  onClose: () => void;
}) {
  const [entry, setEntry] = useState(initial),
    [body, setBody] = useState<ContentBody>(initial?.draft ?? emptyArticle),
    [kind, setKind] = useState<"insight" | "news">(initial?.kind ?? "insight"),
    [slug, setSlug] = useState(initial?.slug ?? ""),
    [customSlug, setCustomSlug] = useState(false),
    [mode, setMode] = useState("write"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [media, setMedia] = useState<Media[]>([]),
    [review, setReview] = useState(false);
  const dirty =
      JSON.stringify(body) !== JSON.stringify(entry?.draft ?? emptyArticle) ||
      kind !== (entry?.kind ?? "insight") ||
      (!entry && !!slug),
    { guard, dialog } = useUnsavedProfile(dirty, false);
  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    api<{ assets: Media[] }>("/api/staff/media")
      .then((v) => setMedia(v.assets.filter((a) => a.published)))
      .catch(() => {});
  }, []);
  let validation = "";
  try {
    contentInput({ kind, slug, body, version: entry?.version ?? 0 });
  } catch (e) {
    validation = (e as Error).message;
  }
  function edit(patch: Partial<ContentBody>) {
    setBody((current) => ({ ...current, ...patch }));
    setReview(false);
    setNotice("");
  }
  async function action(action: string) {
    setBusy(true);
    setError("");
    try {
      const row = await api<ArticleEntry>("/api/staff/content", {
        action,
        id: entry?.id,
        version: entry?.version ?? 0,
        kind,
        slug,
        body,
      });
      if (action === "delete") {
        onClose();
        return;
      }
      setEntry(row);
      setBody(row.draft);
      setKind(row.kind);
      setSlug(row.slug);
      setReview(false);
      setNotice(
        action === "save"
          ? "Draft saved. You can preview it before publishing."
          : action === "publish"
            ? "Article published on the website."
            : action === "unpublish"
              ? "Article moved back to draft."
              : action === "archive"
                ? "Article archived."
                : "Article restored as a draft.",
      );
      onDirty?.(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const locked = busy || !!entry?.archived_at;
  return (
    <section aria-label="Article editor">
      <button
        className={`text-button ${ui.back}`}
        disabled={busy}
        onClick={() => guard(onClose)}
      >
         All articles
      </button>
      <header className={ui.composerHeader}>
        <div>
          <h2>{entry ? "Edit article" : "New article"}</h2>
          <p>
            {dirty
              ? "Unsaved changes"
              : entry
                ? "Draft saved"
                : "Write your story, then preview and publish."}
          </p>
        </div>
        <div className={ui.headerActions}>
          {entry && (
            <button
              type="button"
              className="button danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Delete “${entry.draft.title}”? It will be removed from Publishing and the public website. Unsaved edits will be discarded.`))
                  void action("delete");
              }}
            >
              Delete article
            </button>
          )}
          <button
            className="button secondary"
            disabled={locked || !!validation || (!dirty && !!entry)}
            onClick={() => void action("save")}
          >
            {busy ? "Working…" : "Save draft"}
          </button>
          <button
            className="button gold"
            disabled={locked || dirty || !entry || !!validation}
            onClick={() => {
              setMode("preview");
              setReview(true);
            }}
          >
            Review & publish
          </button>
        </div>
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
      <div className={ui.toolbar}>
        <div className={ui.tabs} role="group" aria-label="Article view">
          {["write", "preview"].map((t) => (
            <button
              className="text-button"
              aria-pressed={mode === t}
              key={t}
              onClick={() => setMode(t)}
            >
              {t === "write" ? "Write" : "Preview"}
            </button>
          ))}
        </div>
        <StatusBadge tone={entry?.published ? "success" : "neutral"}>
          {entry ? publicationState(entry) : "Draft"}
        </StatusBadge>
      </div>
      {review && (
        <section
          className={ui.notice}
          aria-label="Publish article confirmation"
        >
          <strong>Publish “{body.title}”?</strong>
          <p>
            The saved article will be visible on your website at /resources/
            {slug}.
          </p>
          <div className={ui.headerActions}>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setReview(false)}
            >
              Keep as draft
            </button>
            <button
              className="button gold"
              disabled={busy || dirty}
              onClick={() => void action("publish")}
            >
              Publish article
            </button>
          </div>
        </section>
      )}
      <div className={styles.editorLayout}>
        <div>
          {mode === "write" ? (
            <form
              className={styles.writing}
              onSubmit={(e) => {
                e.preventDefault();
                if (!validation) void action("save");
              }}
            >
              <fieldset disabled={locked}>
                <label>
                  Title
                  <input
                    className={styles.titleInput}
                    value={body.title}
                    maxLength={contentLimits.title}
                    placeholder="Your article title"
                    onChange={(e) => {
                      edit({ title: e.target.value });
                      if (!entry && !customSlug)
                        setSlug(articleSlug(e.target.value));
                    }}
                  />
                </label>
                <label>
                  Summary{" "}
                  <small>
                    Optional · A short introduction shown before the article.
                  </small>
                  <textarea
                    value={body.intro}
                    rows={3}
                    maxLength={
                      kind === "news"
                        ? contentLimits.newsIntro
                        : contentLimits.intro
                    }
                    onChange={(e) =>
                      edit({ intro: e.target.value, introRich: undefined })
                    }
                  />
                </label>
                {body.sections.map((section, i) => (
                  <section className={styles.section} key={i}>
                    <div className={ui.sectionHeading}>
                      <h3>
                        {body.sections.length > 1
                          ? `Section ${i + 1}`
                          : "Article body"}
                      </h3>
                      {body.sections.length > 1 && (
                        <button
                          className="text-button"
                          type="button"
                          onClick={() =>
                            edit({
                              sections: body.sections.filter((_, n) => n !== i),
                            })
                          }
                        >
                          Remove section
                        </button>
                      )}
                    </div>
                    <RichEditor
                      compact
                      label={
                        body.sections.length > 1
                          ? `Section ${i + 1} text`
                          : "Article text"
                      }
                      document={section.rich}
                      text={section.text}
                      disabled={locked}
                      limit={
                        kind === "news"
                          ? contentLimits.newsSection
                          : contentLimits.section
                      }
                      onChange={(rich, text) =>
                        edit({
                          formatVersion: 1,
                          sections: body.sections.map((s, n) =>
                            n === i ? { ...s, rich, text } : s,
                          ),
                        })
                      }
                    />
                    <details className={styles.placement}>
                      <summary>Section heading & image</summary>
                      <label>
                        Section heading
                        <input
                          value={section.title}
                          maxLength={contentLimits.heading}
                          onChange={(e) =>
                            edit({
                              sections: body.sections.map((s, n) =>
                                n === i ? { ...s, title: e.target.value } : s,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Section image
                        <select
                          value={section.mediaId ?? ""}
                          onChange={(e) => {
                            const asset = media.find(
                              (a) => a.id === e.target.value,
                            );
                            edit({
                              sections: body.sections.map((s, n) =>
                                n === i
                                  ? {
                                      ...s,
                                      mediaId: asset?.id,
                                      mediaAlt: asset?.published?.altText,
                                    }
                                  : s,
                              ),
                            });
                          }}
                        >
                          <option value="">No image</option>
                          {media.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.published!.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      {section.mediaId && (
                        <label>
                          Image description
                          <input
                            value={section.mediaAlt ?? ""}
                            maxLength={240}
                            onChange={(e) =>
                              edit({
                                sections: body.sections.map((s, n) =>
                                  n === i
                                    ? { ...s, mediaAlt: e.target.value }
                                    : s,
                                ),
                              })
                            }
                          />
                        </label>
                      )}
                    </details>
                  </section>
                ))}
                <button
                  className="button secondary"
                  type="button"
                  disabled={body.sections.length >= 12}
                  onClick={() =>
                    edit({
                      sections: [
                        ...body.sections,
                        { title: "New section", text: "" },
                      ],
                    })
                  }
                >
                  ＋ Add section
                </button>
              </fieldset>
            </form>
          ) : (
            <div className={styles.preview}>
              <ContentPreview
                body={body}
                kind={kind}
                slug={slug}
                context={emptyContentContext}
                dirty={dirty}
                isNew={!entry}
                contextError=""
                contextLoading={false}
                onRetry={() => {}}
              />
            </div>
          )}
        </div>
        <aside className={styles.settings}>
          <section>
            <h3>Article settings</h3>
            <label>
              Type
              <select
                disabled={locked || !!entry}
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as "news" | "insight");
                  setReview(false);
                }}
              >
                <option value="insight">Article</option>
                <option value="news">News summary</option>
              </select>
            </label>
            {kind === "news" && (
              <>
                <p>News summaries need the original source and attribution.</p>
                <label>
                  Source link
                  <input
                    type="url"
                    disabled={locked}
                    value={body.sourceUrl}
                    onChange={(e) => edit({ sourceUrl: e.target.value })}
                  />
                </label>
                <label>
                  Source / author
                  <input
                    disabled={locked}
                    value={body.attribution}
                    maxLength={200}
                    onChange={(e) => edit({ attribution: e.target.value })}
                  />
                </label>
              </>
            )}
            <details>
              <summary>Article details & website address</summary>
              {kind === "insight" && (
                <>
                  <label>
                    Author (optional)
                    <input
                      disabled={locked}
                      value={body.attribution}
                      maxLength={200}
                      onChange={(e) => edit({ attribution: e.target.value })}
                    />
                  </label>
                  <label>
                    Reference link (optional)
                    <input
                      type="url"
                      disabled={locked}
                      value={body.sourceUrl}
                      onChange={(e) => edit({ sourceUrl: e.target.value })}
                    />
                  </label>
                </>
              )}
              <label>
                Article address
                <input
                  disabled={locked || !!entry}
                  value={slug}
                  maxLength={100}
                  onChange={(e) => {
                    setCustomSlug(true);
                    setSlug(e.target.value);
                    setReview(false);
                  }}
                />
              </label>
              <p>/resources/{slug || "your-article"}</p>
              <label>
                Display order
                <input
                  type="number"
                  disabled={locked}
                  min={0}
                  max={9999}
                  value={body.displayOrder ?? 0}
                  onChange={(e) =>
                    edit({ displayOrder: Number(e.target.value) })
                  }
                />
              </label>
            </details>
            {validation && (
              <p>
                {!body.title
                  ? "Add a title and article text to save your draft."
                  : validation === "Check section text."
                    ? "Add article text before saving."
                    : validation}
              </p>
            )}
          </section>
          <section>
            <h3>Cover image</h3>
            <label>
              <span className={ui.srOnly}>Cover image</span>
              <select
                disabled={locked}
                value={body.heroMediaId ?? ""}
                onChange={(e) => {
                  const a = media.find((a) => a.id === e.target.value);
                  edit({ heroMediaId: a?.id, heroAlt: a?.published?.altText });
                }}
              >
                <option value="">Choose an image (optional)</option>
                {media.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.published!.title}
                  </option>
                ))}
              </select>
            </label>
            {body.heroMediaId && (
              <label>
                Image description
                <input
                  disabled={locked}
                  value={body.heroAlt ?? ""}
                  maxLength={240}
                  onChange={(e) => edit({ heroAlt: e.target.value })}
                />
              </label>
            )}
            <p>Choose a published image from the media library.</p>
          </section>
          {entry && (
            <section>
              <h3>Publication</h3>
              {entry.published && (
                <>
                  <Link
                    href={`/resources/${entry.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View published article
                  </Link>
                  <button
                    className="button secondary"
                    disabled={busy || dirty}
                    onClick={() => void action("unpublish")}
                  >
                    Unpublish article
                  </button>
                </>
              )}
              <details>
                <summary>Archive options</summary>
                <p>
                  Archiving removes this article from the website. You can
                  restore its draft later.
                </p>
                <button
                  className="button secondary"
                  disabled={busy || dirty}
                  onClick={() =>
                    void action(entry.archived_at ? "restore" : "archive")
                  }
                >
                  {entry.archived_at ? "Restore draft" : "Archive article"}
                </button>
              </details>
            </section>
          )}
        </aside>
      </div>
      {dialog}
    </section>
  );
}
