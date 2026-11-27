"use client";
import { useState } from "react";
import { CmsPageEditor } from "./cms-page-editor";
import { ArticleWorkspace } from "./article-workspace";
import { PublishingMembers } from "./publishing-members";
import { MediaWorkspace } from "./media-workspace";
import { WebsiteControl } from "./website-control";
import { PortalIcon } from "./portal-icon";
import { useUnsavedProfile } from "./use-unsaved-profile";
import ui from "./communications.module.css";
import styles from "./publishing.module.css";
import cms from "./cms-workspace.module.css";
type View = "pages" | "articles" | "members" | "media" | "resources";
const main = [
  { id: "pages", label: "Website pages", icon: "panel" },
  { id: "articles", label: "Articles & news", icon: "file" },
  { id: "members", label: "Member profiles", icon: "people" },
] as const;
const tools = [
  { id: "media", label: "Media library", icon: "image" },
  { id: "resources", label: "Downloads & links", icon: "file" },
] as const;
export function ContentWorkspace({ initialView, initialId }: {
  initialView?: string;
  initialId?: string;
} = {}) {
  const startView = initialView === "media" || initialView === "members" ? initialView : "pages";
  const [view, setView] = useState<View>(startView),
    [dirty, setDirty] = useState(false),
    [recordId, setRecordId] = useState<string | undefined>(startView === "pages" ? undefined : initialId);
  const { guard, dialog } = useUnsavedProfile(dirty);
  function navigate(next: View, id?: string) {
    guard(() => {
      setView(next);
      setRecordId(id);
      setDirty(false);
    });
  }
  return (
    <section className={ui.workspace}>
      <h1 className="sr-only">Publishing</h1>
      <div className={ui.layout}>
        <aside className={ui.sidebar}>
          <nav className={styles.navigation} aria-label="Publishing tools">
            <span className={ui.navGroup}>CONTENT</span>
            {main.map((item) => (
              <div key={item.id}>
                <button
                  className="text-button"
                  aria-current={
                    view === item.id ||
                    (item.id === "pages" && tools.some((t) => t.id === view))
                      ? "page"
                      : undefined
                  }
                  onClick={() => navigate(item.id)}
                >
                  <PortalIcon name={item.icon} />
                  {item.label}
                </button>
              </div>
            ))}
          </nav>
          <div className={ui.sendingState}>
            <strong>Draft first, publish when ready</strong>
            <p>
              Saving keeps your work private. Publish to update the website.
            </p>
          </div>
        </aside>
        <div className={ui.content}>
          {view === "pages" || tools.some((t) => t.id === view) ? (
            <div className={styles.pages}>
              <header className={ui.sectionHeading}>
                <div>
                  <h2>Website pages</h2>
                  <p>
                    Edit a page or manage the images, downloads and links used
                    across your website.
                  </p>
                </div>
              </header>
              <div
                className={ui.tabs}
                role="group"
                aria-label="Website page tools"
              >
                <button
                  className="text-button"
                  aria-pressed={view === "pages"}
                  onClick={() => navigate("pages")}
                >
                  Page editor
                </button>
                {tools.map((item) => (
                  <button
                    className="text-button"
                    key={item.id}
                    aria-pressed={view === item.id}
                    onClick={() => navigate(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {view === "pages" ? (
                <>
                  <div className={cms.workspace}>
                    <CmsPageEditor
                      onDirty={setDirty}
                      onManage={(kind, id) => {
                        setView(kind === "people" ? "members" : "media");
                        setRecordId(id);
                        setDirty(false);
                      }}
                    />
                  </div>
                  <section
                    className={styles.pageLibraries}
                    aria-labelledby="website-libraries-heading"
                  >
                    <header className={ui.sectionHeading}>
                      <div>
                        <h2 id="website-libraries-heading">
                          Website libraries
                        </h2>
                        <p>Manage content that appears in page sections.</p>
                      </div>
                    </header>
                    <div className={styles.libraryGrid}>
                      {tools.map((item) => (
                        <button
                          className={`text-button ${styles.libraryCard}`}
                          key={item.id}
                          onClick={() => navigate(item.id)}
                        >
                          <PortalIcon name={item.icon} />
                          <strong>{item.label}</strong>
                          <span>
                            {item.id === "media"
                              ? "Images used on pages and articles, and in Resources  Media."
                              : "Files and reference links shown in Resources."}
                          </span>
                          <small>Manage </small>
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              ) : view === "media" ? (
                <section className={styles.pageTool}>
                  <h3>Media library</h3>
                  <MediaWorkspace
                    key={recordId ?? "media"}
                    initialId={recordId}
                    onDirty={setDirty}
                  />
                </section>
              ) : view === "resources" ? (
                <section className={styles.pageTool}>
                  <h3>Downloads & links</h3>
                  <p>
                    Published downloads and links appear on the Resources page.
                  </p>
                  <WebsiteControl
                    initialTab="document"
                    resourcesOnly
                    onDirty={setDirty}
                  />
                </section>
              ) : null}
            </div>
          ) : view === "articles" ? (
            <ArticleWorkspace onDirty={setDirty} />
          ) : view === "members" ? (
            <PublishingMembers
              key={recordId ?? "members"}
              initialId={recordId}
              onDirty={setDirty}
            />
          ) : null}
        </div>
      </div>
      {dialog}
    </section>
  );
}
