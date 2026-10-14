"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { api } from "./operations-client";
import {
  websiteDefaults,
  type SettingsKey,
  type SharedSettings,
  settingsBody,
} from "@/domain/website-settings";
import { homeDefaults,homeFieldLabels } from "@/domain/website-home";
import { HomeView } from "./homepage-view";
import { ContentPreview } from "./content-preview";
import { emptyContentContext } from "./public-content-view";
import { useUnsavedProfile } from "./use-unsaved-profile";
type Tree = string | Tree[] | { [key: string]: Tree };
type Setting = {
  key: SettingsKey;
  draft: Tree;
  published: Tree | null;
  version: number;
  history?: { version: number; action: string; created_at: string }[];
};
type Resource = {
  id: string;
  kind: string;
  draft: {
    title: string;
    description: string;
    url: string;
    fileId: string | null;
    order: number;
  };
  published: Resource["draft"] | null;
  archived_at: string | null;
  version: number;
};
const words = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/Href$/, " destination")
    .replace(/Id$/, " image")
    .replace(/^./, (s) => s.toUpperCase());
function TreeFields({
  value,
  path = [],
  onChange,
  logos = [],
}: {
  value: Tree;
  path?: string[];
  onChange: (path: string[], value: string) => void;
  logos?: { id: string; draft: { title: string }; published: unknown }[];
}) {
  if (typeof value === "string") {
    const key = path.at(-1) ?? "Text";
    let label = path
      .map((k) => (/^\d+$/.test(k) ? String(Number(k) + 1) : words(k)))
      .join(" · ");
    if((path[0]==='copy'||path[0]==='links')&&homeFieldLabels[key])label=homeFieldLabels[key];
    if (key === "logoMediaId")
      return (
        <label>
          Brand image
          <select
            value={value}
            onChange={(e) => onChange(path, e.target.value)}
          >
            <option value="">Use text brand</option>
            {logos
              .filter((l) => l.published)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.draft.title}
                </option>
              ))}
          </select>
          <small>
            Upload and publish branding assets in Media library first.
          </small>
        </label>
      );
    return (
      <label>
        {label}
        <textarea
          rows={value.length > 120 ? 3 : 2}
          maxLength={3000}
          value={value}
          onChange={(e) => onChange(path, e.target.value)}
        />
      </label>
    );
  }
  return (
    <>
      {Object.entries(value).map(([key, child]) =>
        typeof child === "string" ? (
          <TreeFields
            key={key}
            value={child}
            path={[...path, key]}
            onChange={onChange}
            logos={logos}
          />
        ) : (
          <details key={key} className="profile-section" open={path.length > 0}>
            <summary>
              {/^\d+$/.test(key) ? `Item ${Number(key) + 1}` : words(key)}
            </summary>
            <div className="member-settings">
              <TreeFields
                value={child}
                path={[...path, key]}
                onChange={onChange}
                logos={logos}
              />
            </div>
          </details>
        ),
      )}
    </>
  );
}
function SharedPreview({ body }: { body: SharedSettings }) {
  return (
    <>
      <header className="site-header">
        <div className="brand">
          {body.logoMediaId ? (
            <Image
              src={"/media/" + body.logoMediaId}
              alt={body.logoAlt}
              width={48}
              height={48}
              unoptimized
            />
          ) : (
            <span className="brand-mark">{body.brandMark}</span>
          )}
          <span className="brand-name" style={{ whiteSpace: "pre-line" }}>
            {body.organisation}
          </span>
        </div>
        <nav aria-label="Navigation preview">
          {body.navigation.map((n) => (
            <details key={n.title}>
              <summary>{n.title}</summary>
              {n.links.map((l, i) => (
                <Link prefetch={false} key={i} href={`${n.href}#section-${i}`}>
                  {l}
                </Link>
              ))}
            </details>
          ))}
        </nav>
      </header>
      <main className="page-content">
        <h1>
          {body.biographyHeading.replaceAll("{name}", "CA Example Person")}
        </h1>
        <p>
          Biography heading example. Publication uses the current page section
          headings for matching navigation destinations.
        </p>
      </main>
      <footer className="site-footer">
        <div style={{ whiteSpace: "pre-line" }}>{body.footer.tagline}</div>
        <div>
          <strong>{body.footer.exploreTitle}</strong>
          {body.footer.links.map((l) => (
            <Link prefetch={false} key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </div>
        <div>
          <strong>{body.footer.contactTitle}</strong>
          <Link prefetch={false} href={body.footer.contactHref}>
            {body.footer.contactLabel}
          </Link>
          <p>{body.footer.location}</p>
        </div>
        <div className="footer-bottom">
          © {new Date().getFullYear()} {body.footer.copyrightName} ·{" "}
          {body.footer.closing}
        </div>
      </footer>
    </>
  );
}
export function WebsiteControl() {
  const [tab, setTab] = useState("shared"),
    [dirty, setDirty] = useState(false);
  const { guard, dialog } = useUnsavedProfile(dirty);
  const tabs = ["shared", "home", "link", "document"];
  return (
    <>
      <p>
        Manage the public website here. Saving keeps changes private; publishing
        updates the website.
      </p>
      <div
        className="workspace-tabs"
        role="tablist"
        aria-label="Website controls"
        onKeyDown={(event) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            const index = tabs.indexOf(tab),
              next =
                event.key === "Home"
                  ? tabs[0]
                  : event.key === "End"
                    ? tabs.at(-1)!
                    : tabs[
                        (index +
                          (event.key === "ArrowRight" ? 1 : -1) +
                          tabs.length) %
                          tabs.length
                      ];
            guard(() => {
              setTab(next);
              setDirty(false);
              document.getElementById("website-tab-" + next)?.focus();
            });
          }
        }}
      >
        {[
          ["shared", "Website settings"],
          ["home", "Homepage"],
          ["link", "Important links"],
          ["document", "Downloads"],
        ].map(([key, label]) => (
          <button
            role="tab"
            aria-selected={tab === key}
            tabIndex={tab === key ? 0 : -1}
            id={"website-tab-" + key}
            aria-controls="website-control-panel"
            key={key}
            onClick={() =>
              guard(() => {
                setTab(key);
                setDirty(false);
              })
            }
          >
            {label}
          </button>
        ))}
      </div>
      <div className="action-row">
        <Link prefetch={false} href="/admin/workspaces/content">
          Pages and articles →
        </Link>
        <Link prefetch={false} href="/admin/workspaces/governance">
          People and committees →
        </Link>
        <Link prefetch={false} href="/admin/workspaces/media">
          Media library →
        </Link>
        <Link prefetch={false} href="/admin/workspaces/events">
          Events →
        </Link>
        <Link prefetch={false} href="/admin/workspaces/flyers">
          Flyers →
        </Link>
      </div>
      <section
        role="tabpanel"
        id="website-control-panel"
        aria-labelledby={"website-tab-" + tab}
      >
        {tab === "shared" || tab === "home" ? (
          <SettingsEditor key={tab} settingKey={tab} onDirty={setDirty} />
        ) : (
          <ResourceEditor key={tab} kind={tab} onDirty={setDirty} />
        )}
      </section>
      {dialog}
    </>
  );
}
function SettingsEditor({
  settingKey,
  onDirty,
}: {
  settingKey: SettingsKey;
  onDirty: (v: boolean) => void;
}) {
  const [row, setRow] = useState<Setting>(),
    [draft, setDraft] = useState<Tree>(websiteDefaults[settingKey] as Tree),
    [message, setMessage] = useState("Loading…"),
    [busy, setBusy] = useState(false),
    [logos, setLogos] = useState<
      { id: string; draft: { title: string }; published: unknown }[]
    >([]);
  const dirty =
    JSON.stringify(draft) !==
    JSON.stringify(row?.draft ?? websiteDefaults[settingKey]);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useEffect(() => {
    let active = true;
    api<Setting>(`/api/staff/website-settings?key=${settingKey}`)
      .then((r) => {
        if (active) {
          setRow(r);
          setDraft(r.draft);
          setMessage("");
        }
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    api<{ assets: typeof logos }>("/api/staff/media")
      .then((r) => {
        if (active) setLogos(r.assets);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [settingKey]);
  function change(path: string[], value: string) {
    setDraft((current) => {
      const next = structuredClone(current);
      let cursor = next as { [key: string]: Tree };
      for (const key of path.slice(0, -1))
        cursor = cursor[key] as { [key: string]: Tree };
      cursor[path.at(-1)!] = value;
      return next;
    });
  }
  let validation = "";
  try {
    settingsBody(settingKey, draft);
  } catch (e) {
    validation = (e as Error).message;
  }
  async function act(action: string) {
    setBusy(true);
    try {
      const r = await api<Setting>("/api/staff/website-settings", {
        key: settingKey,
        action,
        version: row?.version ?? 0,
        body: draft,
      });
      setRow(r);
      setDraft(r.draft);
      setMessage(
        action === "save"
          ? "Draft saved. Published content is unchanged."
          : action === "publish"
            ? "Published. Refresh the public website to verify."
            : "Publication withdrawn; the original defaults are active.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const rendered: ReactNode =
    settingKey === "home" ? (
      <HomeView home={draft as typeof homeDefaults} readOnly />
    ) : (
      <SharedPreview body={draft as SharedSettings} />
    );
  return (
    <div className="content-editor-columns">
      <form
        className="member-settings"
        onSubmit={(e) => {
          e.preventDefault();
          void act("save");
        }}
      >
        <h2>{settingKey === "home" ? "Homepage" : "Website settings"}</h2>
        <p>
          {dirty
            ? "Unsaved changes"
            : row?.published
              ? "Saved draft · published version available"
              : "Private draft · original defaults remain public"}
        </p>
        {settingKey === "shared" && (
          <p>
            Use {"{name}"} in the biography default. Content page headings
            supply matching submenu labels after publication.
          </p>
        )}
        <fieldset disabled={busy || !row}>
          <TreeFields value={draft} onChange={change} logos={logos} />
          <div className="action-row">
            <button className="button" disabled={!!validation}>
              Save draft
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={dirty || !!validation || !row?.version}
              onClick={() => void act("publish")}
            >
              Publish saved draft
            </button>
            <button
              type="button"
              className="button danger"
              disabled={dirty || !row?.published}
              onClick={() => void act("withdraw")}
            >
              Withdraw settings
            </button>
          </div>
        </fieldset>
        <p role="status">{validation || message}</p>
        <details>
          <summary>Revision history</summary>
          {row?.history?.map((h) => (
            <p key={h.version}>
              {h.version} · {h.action} ·{" "}
              {new Date(h.created_at).toLocaleString("en-IN")}
            </p>
          ))}
        </details>
      </form>
      <ContentPreview
        body={{
          title: "",
          intro: "",
          sections: [],
          sourceUrl: "",
          attribution: "",
        }}
        kind="page"
        slug="about"
        context={emptyContentContext}
        dirty={dirty}
        isNew={!row?.version}
        contextError=""
        contextLoading={false}
        onRetry={() => {}}
        rendered={rendered}
      />
    </div>
  );
}
function ResourceEditor({
  kind,
  onDirty,
}: {
  kind: string;
  onDirty: (v: boolean) => void;
}) {
  const blank = {
    title: "",
    description: "",
    url: "",
    fileId: null as string | null,
    order: 0,
  };
  const [rows, setRows] = useState<Resource[]>([]),
    [selected, setSelected] = useState<Resource | null>(null),
    [body, setBody] = useState(blank),
    [archived, setArchived] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("Loading…"),
    [file, setFile] = useState<File>();
  const [history, setHistory] = useState<{
    entity: string;
    rows: {
      version: number;
      action: string;
      created_at: string;
      body: Resource["draft"];
    }[];
  }>();
  const dirty =
    JSON.stringify(body) !== JSON.stringify(selected?.draft ?? blank);
  const { guard, dialog } = useUnsavedProfile(dirty, false);
  useEffect(() => {
    let active = true;
    if (selected)
      api<{ history: NonNullable<typeof history>["rows"] }>(
        `/api/staff/website-resources?kind=${kind}&id=${selected.id}`,
      )
        .then((data) => {
          if (active) setHistory({ entity: selected.id, rows: data.history });
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [kind, selected]);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useEffect(() => {
    let active = true;
    api<Resource[]>(
      `/api/staff/website-resources?kind=${kind}&archived=${archived}`,
    )
      .then((r) => {
        if (active) {
          setRows(r);
          setMessage("");
        }
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [kind, archived]);
  function select(r: Resource | null) {
    setSelected(r);
    setBody(r?.draft ?? blank);
    setFile(undefined);
    setMessage("");
  }
  async function act(action: string) {
    setBusy(true);
    try {
      const r = await api<Resource>("/api/staff/website-resources", {
        id: selected?.id,
        kind,
        action,
        version: selected?.version ?? 0,
        body,
      });
      select(r);
      setRows(
        await api<Resource[]>(
          `/api/staff/website-resources?kind=${kind}&archived=${archived}`,
        ),
      );
      setMessage(
        action === "save"
          ? "Draft saved. Published content is unchanged."
          : `Resource ${action} completed.`,
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload() {
    if (!file || !selected) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("resourceId", selected.id);
      form.set("version", String(selected.version));
      form.set("file", file);
      const response = await fetch("/api/staff/website-resource-files", {
        method: "POST",
        body: form,
      });
      const r = await response.json();
      if (!response.ok) throw Error(r.error ?? "Upload failed.");
      select(r);
      setRows(
        await api<Resource[]>(
          `/api/staff/website-resources?kind=${kind}&archived=${archived}`,
        ),
      );
      setMessage(
        "New PDF saved to the draft. The published download is unchanged.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={archived}
          onChange={(e) => setArchived(e.target.checked)}
        />
        Include archived resources
      </label>
      <div className="content-workspace">
        <aside className="record-list">
          <button
            className="button secondary"
            onClick={() => guard(() => select(null))}
          >
            New {kind === "link" ? "link" : "download"}
          </button>
          {rows.map((r) => (
            <button key={r.id} onClick={() => guard(() => select(r))}>
              <strong>{r.draft.title}</strong>
              <small>
                {r.archived_at
                  ? "Archived"
                  : r.published
                    ? "Published"
                    : "Draft"}
              </small>
            </button>
          ))}
        </aside>
        <form
          className="member-settings"
          onSubmit={(e) => {
            e.preventDefault();
            void act("save");
          }}
        >
          <h2>
            {selected ? "Edit" : "New"}{" "}
            {kind === "link" ? "important link" : "download"}
          </h2>
          <fieldset disabled={busy || !!selected?.archived_at}>
            <label>
              Title
              <input
                required
                maxLength={160}
                value={body.title}
                onChange={(e) => setBody({ ...body, title: e.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                maxLength={2000}
                value={body.description}
                onChange={(e) =>
                  setBody({ ...body, description: e.target.value })
                }
              />
            </label>
            <label>
              Destination
              <input
                value={body.url}
                onChange={(e) =>
                  setBody({ ...body, url: e.target.value, fileId: null })
                }
              />
              <small>
                Website path or HTTPS link. Downloads may use an uploaded PDF
                instead.
              </small>
            </label>
            <label>
              Display order
              <input
                type="number"
                min={0}
                max={9999}
                value={body.order}
                onChange={(e) =>
                  setBody({ ...body, order: Number(e.target.value) })
                }
              />
            </label>
            {body.fileId && (
              <p>
                Draft PDF attached. Publishing makes it available at the
                download link.
              </p>
            )}
            <button className="button">Save draft</button>
            {selected && (
              <div className="action-row">
                <button
                  type="button"
                  className="button secondary"
                  disabled={dirty}
                  onClick={() => void act("publish")}
                >
                  Publish saved draft
                </button>
                <button
                  type="button"
                  className="button danger"
                  disabled={dirty || !selected.published}
                  onClick={() => void act("withdraw")}
                >
                  Withdraw
                </button>
                <button
                  type="button"
                  className="button danger"
                  disabled={dirty}
                  onClick={() => void act("archive")}
                >
                  Archive
                </button>
              </div>
            )}
            {kind === "document" && (
              <>
                <label>
                  Upload / replace PDF
                  <input
                    type="file"
                    accept="application/pdf"
                    disabled={!selected || dirty}
                    onChange={(e) => setFile(e.target.files?.[0])}
                  />
                  <small>
                    Save the download first. PDF up to 5 MB; replacement stays
                    private until publication.
                  </small>
                </label>
                <button
                  type="button"
                  className="button secondary"
                  disabled={!file || !selected || dirty}
                  onClick={() => void upload()}
                >
                  Upload PDF to draft
                </button>
              </>
            )}
          </fieldset>
          {selected?.archived_at && (
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => void act("restore")}
            >
              Restore resource
            </button>
          )}
          {selected?.published && (
            <a
              href={
                selected.published.fileId
                  ? "/downloads/" + selected.id
                  : selected.published.url
              }
            >
              View published resource →
            </a>
          )}
          <p role="status">
            {dirty ? "Unsaved changes. " : ""}
            {message}
          </p>
          {selected && history?.entity === selected.id && (
            <details>
              <summary>Revision history</summary>
              {history.rows.map((row) => (
                <details key={row.version}>
                  <summary>
                    Version {row.version} · {row.action} ·{" "}
                    {new Date(row.created_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}{" "}
                    IST
                  </summary>
                  <p>{row.body.title}</p>
                  <p>{row.body.description}</p>
                  <p>{row.body.fileId ? "PDF attached" : row.body.url}</p>
                </details>
              ))}
            </details>
          )}
        </form>
      </div>
      {dialog}
    </>
  );
}
