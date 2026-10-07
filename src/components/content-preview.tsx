"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useModalFocus } from "./use-modal-focus";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PublicContentView,
  ArticleContentView,
  type PublicContentContext,
} from "./public-content-view";
import { sitePages } from "@/domain/site-pages";
import type { ContentBody } from "@/domain/operations";
export function ContentPreview({
  body,
  kind,
  slug,
  context,
  dirty,
  isNew,
  contextError,
  contextLoading,
  onRetry,
}: {
  body: ContentBody;
  kind: string;
  slug: string;
  context: PublicContentContext;
  dirty: boolean;
  isNew: boolean;
  contextError: string;
  contextLoading: boolean;
  onRetry: () => void;
}) {
  const [width, setWidth] = useState(1280),
    [expanded, setExpanded] = useState(false),
    [styles, setStyles] = useState(""),
    [available, setAvailable] = useState(500);
  const frame = useRef<HTMLIFrameElement>(null),
    container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const read = () =>
      setStyles(
        Array.from(document.querySelectorAll('link[rel="stylesheet"],style'))
          .map((s) => s.outerHTML)
          .join(""),
      );
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.head, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) =>
      setAvailable(entries[0].contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded]);
  const modalRef = useRef<HTMLElement>(null);
  const closeModal = useCallback(() => setExpanded(false), []);
  useModalFocus(expanded, modalRef, closeModal);
  const scale = Math.min(1, available / width);
  const html = renderToStaticMarkup(
    <div className="public-shell">
      {kind === "page" ? (
        <PublicContentView
          page={slug}
          data={{ ...body, label: sitePages[slug]?.label }}
          readOnly
          context={context}
        />
      ) : (
        <ArticleContentView body={body} />
      )}
    </div>,
  );
  const srcDoc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${styles}<style>body{margin:0}a,button,input,select,textarea,summary{pointer-events:none}html{scrollbar-width:thin}</style></head><body>${html}</body></html>`;
  return (
    <>
      {" "}
      {expanded && (
        <div
          className="preview-modal-backdrop"
          onClick={closeModal}
          aria-hidden="true"
        />
      )}
      <section
        ref={modalRef}
        role={expanded ? "dialog" : undefined}
        aria-modal={expanded || undefined}
        className={`content-preview${expanded ? " expanded" : ""}`}
        aria-label="Live content preview"
      >
        <div className="content-preview-header">
          <div>
            <strong>Live preview</strong>
            <small>
              {dirty
                ? "Unsaved changes · private"
                : isNew
                  ? "New entry · private"
                  : "Saved draft · private"}{" "}
              · interactions disabled
            </small>
          </div>
          <button
            type="button"
            className="button secondary small"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Close expanded preview" : "Expand preview"}
          </button>
        </div>
        <label className="preview-width">
          Preview width
          <select
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          >
            <option value={1280}>Desktop · 1280px</option>
            <option value={768}>Tablet · 768px</option>
            <option value={390}>Phone · 390px</option>
          </select>
        </label>
        {contextLoading && (
          <p role="status" className="preview-context-state">
            Loading current published inserts…
          </p>
        )}
        {contextError && (
          <p role="alert">
            {contextError} Contextual inserts are unavailable.{" "}
            <button type="button" onClick={onRetry}>
              Retry loading inserts
            </button>
          </p>
        )}
        <div
          className="preview-viewport"
          ref={container}
          style={{ height: Math.max(360, 900 * scale) }}
        >
          <iframe
            ref={frame}
            title="Private live page preview"
            sandbox="allow-same-origin"
            srcDoc={srcDoc}
            style={{
              width,
              marginLeft: Math.max(0, (available - width * scale) / 2),
              height: 900,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            onLoad={() => {
              frame.current?.contentDocument
                ?.querySelectorAll("a,button,input,select,textarea,summary")
                .forEach((el) => el.setAttribute("tabindex", "-1"));
            }}
          />
        </div>
      </section>
    </>
  );
}
