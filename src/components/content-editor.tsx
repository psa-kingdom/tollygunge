"use client";
import { WorkspaceEmptyState } from "./workspace-ui";
import { useState, useEffect, useRef, useCallback } from "react";
import { useModalFocus } from "./use-modal-focus";
import Link from "next/link";
import { api } from "./operations-client";
import {
  pageSlugs,
  contentInput,
  content,
  type ContentBody,
} from "@/domain/operations";
import { sitePages } from "@/domain/site-pages";
import {
  contentLimits,
  plainDocument,
  sizes,
  type ContentSize,
} from "@/domain/rich-content";
import { RichEditor, TextCounter } from "./rich-editor";
import { ContentPreview } from "./content-preview";
import {
  emptyContentContext,
  type PublicContentContext,
} from "./public-content-view";
type Entry = {
  archived_at?:string|null;
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
    label:page.label,
    intro: page.intro,
    sections: page.sections.map((s) => ({ ...s })),
    sourceUrl: "",
    attribution: "",
  };
}
function editable(body: ContentBody): ContentBody {
  return {
    ...body,
    formatVersion: 1,
    introRich: body.introRich ?? plainDocument(body.intro),
    sections: body.sections.map((s) => ({
      ...s,
      rich: s.rich ?? plainDocument(s.text),
    })),
  };
}
function snapshot(body: ContentBody, kind: string) {
  try {
    return JSON.stringify(content(body, kind));
  } catch {
    return JSON.stringify(body);
  }
}
const initial = editable(pageBody("about"));
export function ContentEditor() {
  const [entries, setEntries] = useState<Entry[]>([]),
    [selected, setSelected] = useState<Entry | null>(null),
    [body, setBody] = useState(initial),
    [kind, setKind] = useState("page"),
    [slug, setSlug] = useState("about"),
    [message, setMessage] = useState("Loading content…"),
    [busy, setBusy] = useState(false),
    [baseline, setBaseline] = useState(snapshot(initial, "page")),
    [context, setContext] = useState<PublicContentContext>(emptyContentContext),
    [contextError, setContextError] = useState(""),
    [contextPage, setContextPage] = useState(""),
    [contextRefresh, setContextRefresh] = useState(0),
    [panel, setPanel] = useState("edit"),
    [pending, setPending] = useState<(() => void) | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [editGroup, setEditGroup] = useState("details");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [showArchived,setShowArchived]=useState(false);
  const closeDialog = useCallback(() => setPending(null), []);
  useModalFocus(Boolean(pending), dialogRef, closeDialog);
  const dirty =
    snapshot(body, kind) !== baseline ||
    (!selected && kind !== "page" && slug !== "");
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  const total =
    body.title.trim().length +
    body.intro.trim().length +
    body.sections.reduce(
      (n, s) => n + s.title.trim().length + s.text.trim().length,
      0,
    );
  let validation = "";
  try {
    contentInput({ kind, slug, body, version: 0 });
  } catch (e) {
    validation = e instanceof Error ? e.message : "Check content.";
  }
  useEffect(() => {
    api<Entry[]>("/api/staff/content?archived=true")
      .then(setEntries)
      .then(() => setMessage(""))
      .catch((e) => setMessage(e.message));
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (kind === "page")
      api<PublicContentContext>(`/api/staff/content/preview?page=${slug}`)
        .then((value) => {
          if (!cancelled) {
            if(value.defaultPage&&!selected&&!dirtyRef.current){const defaults=editable(value.defaultPage);setBody(defaults);setBaseline(snapshot(defaults,'page'));}
            setContext(value);
            setContextPage(slug);
            setContextError("");
          }
        })
        .catch(() => {
          if (!cancelled) {
            setContext(emptyContentContext);
            setContextPage(slug);
            setContextError("Unable to load published page inserts.");
          }
        });
    return () => {
      cancelled = true;
    };
  }, [slug, kind, contextRefresh,selected]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const navigate = (e: MouseEvent) => {
      const a = (e.target as Element).closest("a");
      if (
        dirtyRef.current &&
        a &&
        a.target !== "_blank" &&
        !a.hasAttribute("download") &&
        a.getAttribute("href")?.startsWith("/")
      ) {
        e.preventDefault();
        e.stopPropagation();
        setPending(() => () => {
          window.location.assign(a.href);
        });
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, []);
  function guard(fn: () => void) {
    if (dirty) setPending(() => fn);
    else fn();
  }
  function replace(next: ContentBody, nextKind = kind) {
    const value = editable(next);
    setBody(value);
    setBaseline(snapshot(value, nextKind));
  }
  function select(entry: Entry | null) {
    setSelected(entry);
    setKind(entry?.kind ?? "page");
    setSlug(entry?.slug ?? "about");
    replace(entry?.draft ?? pageBody("about"), entry?.kind ?? "page");
    setMessage("");
    setPanel("edit");
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
      setEntries(await api<Entry[]>("/api/staff/content?archived=true"));
      setMessage(
        action === "save"
          ? "Draft saved. Published content is unchanged."
          : action === "publish"
            ? "Published on the public site."
            : action==='archive' ? 'Entry archived. Its history is retained.' : action==='restore' ? 'Entry restored as a private draft.'
            : "Publication removed.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Request failed. Your edits are retained.",
      );
    } finally {
      setBusy(false);
    }
  }
  const sizing = (
    label: string,
    value: ContentSize | undefined,
    onChange: (size: ContentSize) => void,
  ) => (
    <label className="content-heading-size">
      {label}
      <select
        value={value ?? "body"}
        onChange={(e) => onChange(e.target.value as ContentSize)}
      >
        {sizes.map((s) => (
          <option key={s} value={s}>
            {s[0].toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="content-workspace page-content-workspace">
      <aside className="record-list" aria-label="Content catalogue">
        <h2>Content library</h2>
        <p>Choose a website page or saved entry to edit its private draft.</p>
        <label><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/>Include archived</label>
        <strong>Website pages</strong>
        {pageSlugs.map(page=><button type="button" key={page} disabled={busy} onClick={()=>guard(()=>{const existing=entries.find(e=>e.kind==='page'&&e.slug===page);if(existing)select(existing);else{setSelected(null);setKind('page');setSlug(page);replace(pageBody(page),'page');setMessage('Original page defaults · private until you save and publish.');}})}>{page.replace(/-/g, " ").replace(/^./, c => c.toUpperCase())}<small>/{page}</small></button>)}
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => guard(() => select(null))}
        >
          New entry
        </button>
        {entries.length === 0 && <WorkspaceEmptyState compact icon="file" title="No saved entries yet" description="Choose a website page above or create an entry. Drafts remain private until published." />}
        {entries.filter(entry=>showArchived||!entry.archived_at).map((entry) => (
          <button
            type="button"
            key={entry.id}
            disabled={busy}
            className={entry.id === selected?.id ? "selected" : ""}
            onClick={() => guard(() => select(entry))}
          >
            <strong>{entry.draft.title}</strong>
            <small>
              {entry.kind} · {entry.archived_at?'Archived':entry.published ? "Published" : "Draft"} · /
              {entry.slug}
            </small>
          </button>
        ))}
      </aside>
      <div className="content-editing-area">
        <div className="content-editor-heading">
          <div>
            <h2>{selected ? "Edit content" : "Create content"}</h2>
            <p>
              Format your copy and preview it here. Saving changes the private
              draft; publication is a separate action.
            </p>
          </div>
          <span className="content-save-state">
            {selected?.archived_at?'Archived · private':dirty ? "Unsaved changes" : selected ? "Saved draft" : "New entry"}
          </span>
        </div>
        {selected && <div className="action-row"><button type="button" className="button secondary" disabled={busy||dirty} onClick={()=>void act(selected.archived_at?'restore':'archive')}>{selected.archived_at?'Restore entry':'Archive entry'}</button></div>}
        <div
          className="content-mobile-tabs"
          role="tablist"
          aria-label="Content workspace view"
        >
          {["edit", "preview"].map((tab) => (
            <button
              type="button"
              key={tab}
              role="tab"
              id={`content-tab-${tab}`}
              aria-selected={panel === tab}
              aria-controls={`content-panel-${tab}`}
              tabIndex={panel === tab ? 0 : -1}
              onClick={() => setPanel(tab)}
              onKeyDown={(e) => {
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                ) {
                  e.preventDefault();
                  const next =
                    e.key === "Home"
                      ? "edit"
                      : e.key === "End"
                        ? "preview"
                        : panel === "edit"
                          ? "preview"
                          : "edit";
                  setPanel(next);
                  document.getElementById(`content-tab-${next}`)?.focus();
                }
              }}
            >
              {tab === "edit" ? "Edit" : "Preview"}
            </button>
          ))}
        </div>
        <div className="content-editor-columns">
          <section
            className={`content-editor-panel ${panel === "edit" ? "mobile-active" : ""}`}
            id="content-panel-edit"
            aria-label="Edit draft"
          >
            <form
              className="member-settings"
              onInvalidCapture={e => {
                const target = e.target as HTMLInputElement;
                if (!target.closest("[hidden]")) return;
                e.preventDefault();
                const group = target.closest<HTMLElement>("[data-content-group]");
                if (group) setEditGroup(group.dataset.contentGroup!);
                const section = target.closest<HTMLElement>("[data-section-index]");
                if (section) setSectionIndex(Number(section.dataset.sectionIndex));
                requestAnimationFrame(() => { target.focus(); target.reportValidity(); });
              }}
              onSubmit={(e) => {
                e.preventDefault();
                void act("save");
              }}
            >
              <nav className="content-group-tabs" aria-label="Draft editing groups">
                {[ ["details", "Page details"], ["intro", "Introduction"], ["sections", "Sections"], ["source", "Sources & checks"] ].map(([key, label]) => <button type="button" key={key} className="button secondary" aria-pressed={editGroup === key} onClick={() => setEditGroup(key)}>{label}</button>)}
              </nav>
              <fieldset className="content-save-lock" disabled={busy||!!selected?.archived_at}>
                <div className="action-row content-publish-actions">
                  <button className="button" disabled={busy || !!validation}>
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
                          dirty ||
                          !!validation ||
                          (kind === "page" && !!contextError) ||
                          (kind === "page" && contextPage !== slug)
                        }
                        onClick={() => void act("publish")}
                      >
                        Publish saved draft
                      </button>
                      {selected.published && (
                        <button
                          type="button"
                          className="button secondary"
                      disabled={busy||!!selected?.archived_at}
                          onClick={() =>
                            guard(() => {
                              void act("unpublish");
                            })
                          }
                        >
                          Unpublish
                        </button>
                      )}
                    </>
                  )}
                </div>
                <div data-content-group="details" className="content-edit-group" hidden={editGroup !== "details"}>
                <div className="form-grid">
                  <label>
                    Content type
                    <select
                      value={kind}
                      disabled={!!selected || busy}
                      onChange={(e) => {
                        const value = e.target.value;
                        guard(() => {
                          setKind(value);
                          setSlug(value === "page" ? "about" : "");
                          replace(
                            value === "page"
                              ? pageBody("about")
                              : {
                                  title: "",
                                  intro: "",
                                  sections: [{ title: "", text: "" }],
                                  sourceUrl: "",
                                  attribution: "",
                                },
                            value,
                          );
                        });
                      }}
                    >
                      <option value="page">Website page</option>
                      <option value="insight">Original insight</option>
                      <option value="news">Attributed news summary</option>
                    </select>
                  </label>
                  <label>
                    URL slug
                    {kind === "page" ? (
                      <select
                        disabled={!!selected || busy}
                        value={slug}
                        onChange={(e) => {
                          const value = e.target.value;
                          guard(() => {
                            setSlug(value);
                            replace(pageBody(value));
                          });
                        }}
                      >
                        {pageSlugs.map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        disabled={!!selected || busy}
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        maxLength={100}
                        required
                        pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      />
                    )}
                    <small>
                      Lowercase words separated by hyphens; fixed after
                      creation. Maximum 100 characters.
                    </small>
                  </label>
                </div>
                <label>
                  Title
                  <input
                    value={body.title}
                    onChange={(e) =>
                      setBody({ ...body, title: e.target.value })
                    }
                    required
                    minLength={3}
                    maxLength={contentLimits.title}
                  />
                </label>
                {kind==='page'&&<label>Page label<input maxLength={160} value={body.label??sitePages[slug]?.label??''} onChange={e=>setBody({...body,label:e.target.value})}/></label>}
                {kind!=='page'&&<label>Display order<input type="number" min={0} max={9999} value={body.displayOrder??0} onChange={e=>setBody({...body,displayOrder:Number(e.target.value)})}/></label>}
                <TextCounter
                  label="Title"
                  value={body.title}
                  limit={contentLimits.title}
                />
                {sizing("Page title size", body.titleSize, (titleSize) =>
                  setBody({ ...body, titleSize }),
                )}
                </div>
                <div data-content-group="intro" className="content-edit-group" hidden={editGroup !== "intro"}>
                <h3 className="editor-field-heading">Introduction</h3>
                <RichEditor
                  disabled={busy||!!selected?.archived_at}
                  label="Introduction"
                  document={body.introRich}
                  text={body.intro}
                  limit={
                    kind === "news"
                      ? contentLimits.newsIntro
                      : contentLimits.intro
                  }
                  onChange={(introRich, intro) =>
                    setBody({ ...body, introRich, intro })
                  }
                />
                </div>
                <div data-content-group="sections" className="content-edit-group" hidden={editGroup !== "sections"}>
                <label>Section to edit<select value={Math.min(sectionIndex, body.sections.length - 1)} onChange={e => setSectionIndex(Number(e.target.value))}>{body.sections.map((section, i) => <option key={i} value={i}>{i + 1}. {section.title || "Untitled section"}</option>)}</select></label>
                {kind === "page" && (
                  <p className="notice">
                      Section slots and links stay in place. Edit their headings and copy; the published navigation uses these headings.
                  </p>
                )}
                {body.sections.map((section, i) => (
                  <fieldset key={i} data-section-index={i} hidden={i !== Math.min(sectionIndex, body.sections.length - 1)}>
                    <legend>Section {i + 1}</legend>
                    <label>
                      Section title
                      <input
                        value={section.title}
                        required
                        maxLength={contentLimits.heading}
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
                    <TextCounter
                      label={`Section ${i + 1} heading`}
                      value={section.title}
                      limit={contentLimits.heading}
                    />
                    {sizing(
                      `Section ${i + 1} heading size`,
                      section.titleSize,
                      (titleSize) =>
                        setBody({
                          ...body,
                          sections: body.sections.map((s, j) =>
                            i === j ? { ...s, titleSize } : s,
                          ),
                        }),
                    )}
                    <RichEditor
                      disabled={busy}
                      label={`Section ${i + 1} text`}
                      document={section.rich}
                      text={section.text}
                      limit={
                        kind === "news"
                          ? contentLimits.newsSection
                          : contentLimits.section
                      }
                      onChange={(rich, text) =>
                        setBody({
                          ...body,
                          sections: body.sections.map((s, j) =>
                            i === j ? { ...s, rich, text } : s,
                          ),
                        })
                      }
                    />
                    {kind !== "page" && (
                      <button
                        type="button"
                        className="text-link"
                        disabled={body.sections.length <= 1}
                        onClick={() =>
                          setBody({
                            ...body,
                            sections: body.sections.filter((_, j) => i !== j),
                          })
                        }
                      >
                        Remove section {i + 1}
                      </button>
                    )}
                  </fieldset>
                ))}
                {kind !== "page" && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={body.sections.length >= contentLimits.sections}
                    onClick={() =>
                      setBody({
                        ...body,
                        sections: [
                          ...body.sections,
                          { title: "", text: "", rich: plainDocument("") },
                        ],
                      })
                    }
                  >
                    Add section ({body.sections.length} / 12)
                  </button>
                )}
                </div>
                <div data-content-group="source" className="content-edit-group" hidden={editGroup !== "source"}>
                {kind === "news" && (
                  <p className="notice">
                    News is an original attributed summary: maximum 1,000
                    introduction characters, 1,500 per section and 2,000 across
                    section bodies. Link to the source; do not copy an article.
                    Combined section bodies:{" "}
                    {body.sections
                      .reduce((n, s) => n + s.text.trim().length, 0)
                      .toLocaleString()}{" "}
                    / 2,000.
                  </p>
                )}
                <label>
                  Source URL
                  <input
                    type="url"
                    value={body.sourceUrl}
                    required={kind === "news"}
                    maxLength={1000}
                    onChange={(e) =>
                      setBody({ ...body, sourceUrl: e.target.value })
                    }
                  />
                  <small>
                    HTTPS without credentials. Maximum 1,000 characters.
                  </small>
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
                  <TextCounter
                    label="Attribution"
                    value={body.attribution}
                    limit={200}
                  />
                </label>
                <p
                  className={
                    total > contentLimits.total
                      ? "content-counter over"
                      : "content-counter"
                  }
                >
                  Entry total: {total.toLocaleString()} / 100,000 characters.
                  Counts include title, introduction, headings and body text;
                  formatting markup is excluded.
                </p>
                <p className="content-restrictions">
                  Links must use HTTPS. Tables support up to 20 rows and 12
                  columns. Scripts, embedded HTML, arbitrary styles and private
                  documents are not supported.
                </p>
                </div>
                {validation && (
                  <p className="form-error" role="status">
                    {validation}
                  </p>
                )}

              </fieldset>
            </form>
            <p role="status">{message}</p>
          </section>
          <div
            className={`content-preview-panel ${panel === "preview" ? "mobile-active" : ""}`}
            id="content-panel-preview"
          >
            <ContentPreview
              body={body}
              kind={kind}
              slug={slug}
              context={contextPage === slug ? context : emptyContentContext}
              contextError={contextPage === slug ? contextError : ""}
              contextLoading={kind === "page" && contextPage !== slug}
              onRetry={() => {
                setContextPage("");
                setContextRefresh((value) => value + 1);
              }}
              dirty={dirty}
              isNew={!selected}
            />
          </div>
        </div>
      </div>
      {pending && (
        <div className="content-dialog-backdrop">
          <section
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="discard-title"
            className="content-discard-dialog"
          >
            <h2 id="discard-title">Discard unsaved changes?</h2>
            <p>Save your draft first to keep these edits.</p>
            <button
              type="button"
              className="button"
              onClick={() => setPending(null)}
            >
              Keep editing
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                const next = pending;
                dirtyRef.current = false;
                setPending(null);
                next();
              }}
            >
              Discard changes
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
