"use client";
import { useState } from "react";
import { ContentEditor } from "./content-editor";
import { NewsSources } from "./news-sources";
export function ContentWorkspace() {
  const [tab, setTab] = useState("pages");
  return (
    <>
      <div
        className="action-row"
        role="tablist"
        aria-label="Content workspace views"
        onKeyDown={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            const next =
              e.key === "Home"
                ? "pages"
                : e.key === "End"
                  ? "sources"
                  : tab === "pages"
                    ? "sources"
                    : "pages";
            setTab(next);
            document.getElementById(`content-tab-${next}`)?.focus();
          }
        }}
      >
        <button
          className="button secondary"
          id="content-tab-pages"
          role="tab"
          aria-controls="content-panel-pages"
          aria-selected={tab === "pages"}
          tabIndex={tab === "pages" ? 0 : -1}
          onClick={() => setTab("pages")}
        >
          Pages and insights
        </button>
        <button
          className="button secondary"
          id="content-tab-sources"
          role="tab"
          aria-controls="content-panel-sources"
          aria-selected={tab === "sources"}
          tabIndex={tab === "sources" ? 0 : -1}
          onClick={() => setTab("sources")}
        >
          Sources
        </button>
      </div>
      <div
        id="content-panel-pages"
        role="tabpanel"
        aria-labelledby="content-tab-pages"
        hidden={tab !== "pages"}
      >
        <ContentEditor />
      </div>
      <div
        id="content-panel-sources"
        role="tabpanel"
        aria-labelledby="content-tab-sources"
        hidden={tab !== "sources"}
      >
        <NewsSources />
      </div>
    </>
  );
}
