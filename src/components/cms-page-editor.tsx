"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { api } from "./operations-client";
import { CmsPagePreview } from "./cms-page-preview";
import { RichEditor } from "./rich-editor";
import { StatusBadge } from "./portal-values";
import { useUnsavedProfile } from "./use-unsaved-profile";
import { contentInput, type ContentBody } from "@/domain/operations";
import { sitePages } from "@/domain/site-pages";
import { homeDefaults } from "@/domain/website-home";
import {
  websiteDefaults,
  settingsBody,
  footerGroups,
  type SharedSettings,
} from "@/domain/website-settings";
import {
  pageFields,
  settingFields,
  getCmsValue,
  setCmsValue,
} from "@/domain/cms-fields";
import {
  emptyContentContext,
  type PublicContentContext,
} from "./public-content-view";
import styles from "./cms-workspace.module.css";
type Entry = {
  id?: string;
  key?: string;
  kind?: string;
  slug?: string;
  draft: unknown;
  published: unknown;
  version: number;
};
type Asset = {
  id: string;
  draft: {
    title: string;
    altText: string;
    category: string;
    homepageFeatured?: boolean;
    displayOrder?: number;
  };
  published: unknown;
  version: number;
};
export function CmsPageEditor({
  onDirty,
  onManage,
}: {
  onDirty?: (dirty: boolean) => void;
  onManage?: (kind: string, id: string) => void;
}) {
  const [page, setPage] = useState("home"),
    [data, setData] = useState<Entry>(),
    [draft, setDraft] = useState<unknown>(homeDefaults),
    [shared, setShared] = useState<SharedSettings>(websiteDefaults.shared);
  const [selected, setSelected] = useState("copy.heroCopy02"),
    [context, setContext] = useState<PublicContentContext>(emptyContentContext),
    [assets, setAssets] = useState<Asset[]>([]);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [mobile, setMobile] = useState(false),
    [ready, setReady] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");
  const [loadedPage,setLoadedPage]=useState("");
  const inspector = useRef<HTMLElement>(null);
  const request = useRef(0);
  const pendingField = useRef<string | undefined>(undefined);
  const dirty = !!data && JSON.stringify(draft) !== JSON.stringify(data.draft);
  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);
  const { guard, dialog } = useUnsavedProfile(dirty, false);
  const isSetting = page === "home" || page === "shared";
  const pageReady=ready&&loadedPage===page;
  const load = useCallback(async () => {
    const token = ++request.current;
    setLoading(true);
    setError("");
    setReady(false);
    try {
      const [row, site, media, inserts] = await Promise.all([
        page === "home" || page === "shared"
          ? api<Entry>(`/api/staff/website-settings?key=${page}`)
          : api<Entry[]>("/api/staff/content").then((rows) => {
              const existing = rows.find(
                (r) => r.kind === "page" && r.slug === page,
              );
              const defaults = sitePages[page];
              return (
                existing || {
                  draft: {
                    ...defaults,
                    sections: defaults.sections.map((s) => ({ ...s })),
                    sourceUrl: "",
                    attribution: "",
                  },
                  published: null,
                  version: 0,
                }
              );
            }),
        api<Entry>("/api/staff/website-settings?key=shared"),
        api<{ assets: Asset[] }>("/api/staff/media"),
        page === "shared"
          ? Promise.resolve(emptyContentContext)
          : api<PublicContentContext>(
              `/api/staff/content/preview?page=${page === "home" ? "events" : page}`,
            ),
      ]);
      if (token !== request.current) return;
      let value = row.draft;
      if (page === "home")
        value = { ...homeDefaults, ...(row.draft as object) };
      if (page === "shared") {
        const sharedValue = value as SharedSettings;
        value = {
          ...sharedValue,
          footer: {
            ...sharedValue.footer,
            groups: footerGroups(sharedValue.footer),
          },
        };
      }
      if (
        page !== "home" &&
        page !== "shared" &&
        !row.id &&
        inserts.defaultPage
      )
        value = inserts.defaultPage;
      setLoadedPage(page);
      setData({ ...row, draft: value });
      setDraft(value);
      setShared({ ...websiteDefaults.shared, ...(site.published as object) });
      setAssets(media.assets);
      setContext(inserts);
      setSelected(
        pendingField.current ??
          (page === "home"
            ? "copy.heroCopy02"
            : page === "shared"
              ? "organisation"
              : "title"),
      );
      pendingField.current = undefined;
      setReady(true);
    } catch (e) {
      if (token === request.current) setError((e as Error).message);
    } finally {
      if (token === request.current) setLoading(false);
    }
  }, [page]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);
  const fields = !pageReady ? [] : isSetting
    ? settingFields(draft, page as "home" | "shared")
    : pageFields(draft as ContentBody);
  const field = fields.find((f) => f.id === selected);
  const filtered = fields.filter((f) =>
    `${f.label} ${f.group}`.toLowerCase().includes(fieldSearch.toLowerCase()),
  );
  const groups = [...new Set(filtered.map((f) => f.group))];
  function choose(next: string) {
    if (next.startsWith("shared:")) {
      guard(() => {
        pendingField.current = next.slice(7);
        setPage("shared");
      });
      return;
    }
    if (next.startsWith("record:")) {
      const [, kind, id] = next.split(":");
      guard(() => onManage?.(kind, id));
      return;
    }
    setSelected(next);
    if (window.innerWidth < 900)
      inspector.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function change(path: string[], value: unknown) {
    setDraft((current: unknown) => setCmsValue(current, path, value));
    setNotice("");
  }
  async function save(publish = false) {
    if (!data || !pageReady) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (isSetting) settingsBody(page as "home" | "shared", draft);
      else
        contentInput({
          kind: "page",
          slug: page,
          body: draft,
          version: data.version,
        });
      let saved = data;
      if (dirty || data.version === 0 || !(isSetting ? data.key : data.id)) {
        saved = await api<Entry>(
          isSetting ? "/api/staff/website-settings" : "/api/staff/content",
          isSetting
            ? { action: "save", key: page, version: data.version, body: draft }
            : {
                action: "save",
                id: data.id,
                version: data.version,
                slug: page,
                kind: "page",
                body: draft,
              },
        );
        if (page === "home")
          saved = {
            ...saved,
            draft: { ...homeDefaults, ...(saved.draft as object) },
          };
        setData(saved);
        setDraft(saved.draft);
      }
      if (publish) {
        const imageIds = fields
          .filter((f) => f.type === "image" && f.value)
          .map((f) => f.value);
        for (const asset of assets.filter(
          (a) => imageIds.includes(a.id) && !a.published,
        ))
          await api("/api/staff/media", {
            action: "publish",
            id: asset.id,
            version: asset.version,
          });
        saved = await api<Entry>(
          isSetting ? "/api/staff/website-settings" : "/api/staff/content",
          isSetting
            ? { action: "publish", key: page, version: saved.version }
            : { action: "publish", id: saved.id, version: saved.version },
        );
        if (page === "home")
          saved = {
            ...saved,
            draft: { ...homeDefaults, ...(saved.draft as object) },
          };
        setData(saved);
        setDraft(saved.draft);
        setAssets((await api<{ assets: Asset[] }>("/api/staff/media")).assets);
        if (page === "shared") setShared(saved.draft as SharedSettings);
      }
      setNotice(
        publish
          ? "Page published. The website now shows these changes."
          : "Draft saved. Publish when you’re ready to update the website.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        <label className={styles.pageSelect}>
          Website page
          <select
            value={page}
            disabled={busy}
            onChange={(e) => {
              const next = e.target.value;
              guard(() => {
                setPage(next);
                setNotice("");
                setFieldSearch("");
              });
            }}
          >
            <option value="home">Home</option>
            {Object.keys(sitePages).map((slug) => (
              <option key={slug} value={slug}>
                {slug[0].toUpperCase() + slug.slice(1)}
              </option>
            ))}
            <option value="shared">Header & footer · all pages</option>
          </select>
        </label>
        <div className={styles.saveState}>
          <StatusBadge
            tone={dirty ? "pending" : data?.published ? "success" : "neutral"}
          >
            {dirty
              ? "Unsaved changes"
              : data?.published
                ? "Published"
                : data?.version === 0
                  ? "Original page"
                  : "Draft"}
          </StatusBadge>
        </div>
        <div className={styles.toolbarActions}>
          <button
            className="button secondary"
            disabled={
              busy || loading || !pageReady || (!dirty && data?.version !== 0)
            }
            onClick={() => void save(false)}
          >
            {busy ? "Saving…" : "Save draft"}
          </button>
          <button
            className="button gold"
            disabled={busy || loading || !pageReady}
            onClick={() => void save(true)}
          >
            Publish changes
          </button>
        </div>
      </div>
      {(error || notice) && (
        <p className={styles.message} role={error ? "alert" : "status"}>
          {error || notice}
          {error && !pageReady && (
            <button onClick={() => void load()}>Retry loading page</button>
          )}
        </p>
      )}
      {loading || (!pageReady && !error) ? (
        <div className={styles.loading} role="status">
          Loading website page…
        </div>
      ) : (
        pageReady && (
          <div className={styles.columns}>
            <section className={styles.canvas} aria-label="Page preview">
              <header className={styles.canvasHeader}>
                <div>
                  <strong>
                    {page === "shared"
                      ? "Header & footer"
                      : page === "home"
                        ? "Home"
                        : sitePages[page]?.label}
                  </strong>
                  <span>Click text or an image to edit</span>
                </div>
                <div
                  className={styles.deviceToggle}
                  role="group"
                  aria-label="Preview device"
                >
                  <button
                    aria-pressed={!mobile}
                    onClick={() => setMobile(false)}
                  >
                    Desktop
                  </button>
                  <button aria-pressed={mobile} onClick={() => setMobile(true)}>
                    Mobile
                  </button>
                </div>
              </header>
              <CmsPagePreview
                page={page}
                body={draft}
                shared={page === "shared" ? (draft as SharedSettings) : shared}
                context={context}
                fields={fields}
                selected={selected}
                onSelect={choose}
                mobile={mobile}
              />
              <footer className={styles.canvasFooter}>
                <span>
                  /{isSetting ? (page === "home" ? "" : "all pages") : page}
                </span>
                <a
                  href={isSetting ? "/" : `/${page}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open website
                </a>
              </footer>
            </section>
            <aside
              ref={inspector}
              className={styles.inspector}
              aria-label="Selected content editor"
            >
              <header>
                <span className={styles.eyebrow}>EDIT CONTENT</span>
                <h2>{field?.label || "Select content"}</h2>
                <p>{field?.group || "Choose something in the page preview."}</p>
              </header>
              {field && (
                <div className={styles.fieldEditor}>
                  {field.type === "image" ? (
                    <>
                      {field.value ? (
                        <Image
                          unoptimized
                          width={640}
                          height={480}
                          className={styles.selectedImage}
                          src={`/media/${field.value}`}
                          alt={String(getCmsValue(draft, field.altPath!) || "")}
                        />
                      ) : (
                        <div className={styles.imagePlaceholder}>
                          Choose an image for this area
                        </div>
                      )}
                      <label>
                        Image
                        <select
                          disabled={busy}
                          value={field.value}
                          onChange={(e) => {
                            const asset = assets.find(
                              (a) => a.id === e.target.value,
                            );
                            change(field.path, e.target.value);
                            if (asset && field.altPath)
                              change(field.altPath, asset.draft.altText);
                          }}
                        >
                          <option value="">
                            Use original image / no image
                          </option>
                          {assets.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.draft.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      {field.value && field.altPath && (
                        <label>
                          Image description
                          <textarea
                            value={String(
                              getCmsValue(draft, field.altPath) || "",
                            )}
                            disabled={busy}
                            maxLength={240}
                            onChange={(e) =>
                              change(field.altPath!, e.target.value)
                            }
                          />
                          <small>
                            Describe the image for people using screen readers.
                          </small>
                        </label>
                      )}
                      <label className={styles.upload}>
                        Upload a new image
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          disabled={busy}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setBusy(true);
                            setError("");
                            try {
                              const title = file.name
                                .replace(/\.[^.]+$/, "")
                                .replace(/[-_]/g, " ")
                                .slice(0, 100)
                                .padEnd(3, " ");
                              const form = new FormData();
                              form.set("file", file);
                              form.set("title", title);
                              form.set(
                                "altText",
                                title.length >= 5
                                  ? title
                                  : `Website image: ${title}`,
                              );
                              form.set("category", "Website");
                              const response = await fetch("/api/staff/media", {
                                method: "POST",
                                body: form,
                              });
                              const result = await response.json();
                              if (!response.ok)
                                throw Error(
                                  result.error || "Image upload failed.",
                                );
                              const media = await api<{ assets: Asset[] }>(
                                "/api/staff/media",
                              );
                              setAssets(media.assets);
                              change(field.path, result.id);
                              if (field.altPath)
                                change(
                                  field.altPath,
                                  media.assets.find((a) => a.id === result.id)!
                                    .draft.altText,
                                );
                              setNotice(
                                "Image uploaded to your draft. Add a useful image description before publishing.",
                              );
                            } catch (err) {
                              setError((err as Error).message);
                            } finally {
                              setBusy(false);
                              e.target.value = "";
                            }
                          }}
                        />
                        <small>JPEG or PNG · up to 5 MB</small>
                      </label>
                    </>
                  ) : field.type === "rich" ? (
                    <RichEditor
                      key={`${page}:${field.id}`}
                      label={field.label}
                      text={field.value}
                      document={
                        field.id === "intro"
                          ? (draft as ContentBody).introRich
                          : (draft as ContentBody).sections[
                              Number(field.path[1])
                            ].rich
                      }
                      limit={field.id === "intro" ? 8000 : 16000}
                      disabled={busy}
                      onChange={(document, text) => {
                        setDraft((current: unknown) => {
                          let next = setCmsValue(current, field.path, text);
                          next = setCmsValue(
                            next,
                            field.id === "intro"
                              ? ["introRich"]
                              : ["sections", field.path[1], "rich"],
                            document,
                          );
                          return setCmsValue(next, ["formatVersion"], 1);
                        });
                        setNotice("");
                      }}
                    />
                  ) : (
                    <label>
                      {field.type === "link" ? "Link destination" : field.label}
                      <textarea
                        rows={field.value.length > 120 ? 7 : 3}
                        maxLength={isSetting ? 3000 : 16000}
                        disabled={busy}
                        value={field.value}
                        onChange={(e) => change(field.path, e.target.value)}
                      />
                      {field.type === "link" && (
                        <small>
                          Use a website path such as /membership or a complete
                          HTTPS link.
                        </small>
                      )}
                    </label>
                  )}
                  {field.linkPath && (
                    <label>
                      Link destination
                      <input
                        disabled={busy}
                        value={String(getCmsValue(draft, field.linkPath) || "")}
                        onChange={(e) =>
                          change(field.linkPath!, e.target.value)
                        }
                      />
                    </label>
                  )}
                  <p className={styles.helper}>
                    Changes appear in the preview. Save a draft or publish when
                    ready.
                  </p>
                </div>
              )}
              <details className={styles.contentList}>
                <summary>Find content on this page</summary>
                <label>
                  <span className={styles.srOnly}>Find a content field</span>
                  <input
                    type="search"
                    value={fieldSearch}
                    placeholder="Find a heading, image or section…"
                    onChange={(e) => setFieldSearch(e.target.value)}
                  />
                </label>
                {groups.map((group) => (
                  <div key={group}>
                    <h3>{group}</h3>
                    {filtered
                      .filter((f) => f.group === group)
                      .map((f) => (
                        <button
                          className={styles.fieldButton}
                          key={f.id}
                          aria-pressed={f.id === selected}
                          onClick={() => choose(f.id)}
                        >
                          <span>
                            {f.type === "image"
                              ? "▧"
                              : f.type === "link"
                                ? "Link"
                                : "T"}
                          </span>
                          {f.label.replace(`${group} · `, "")}
                        </button>
                      ))}
                  </div>
                ))}
              </details>
            </aside>
          </div>
        )
      )}
      {dialog}
    </div>
  );
}
