"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { renderToStaticMarkup } from "react-dom/server";
import type { ContentBody } from "@/domain/operations";
import type { CmsField } from "@/domain/cms-fields";
import { homeDefaults } from "@/domain/website-home";
import type { SharedSettings } from "@/domain/website-settings";
import { HomeView } from "./homepage-view";
import { HomepageEventsView } from "./homepage-events-view";
import {
  PublicContentView,
  type PublicContentContext,
} from "./public-content-view";
import { PublicFooter } from "./public-footer";
import styles from "./cms-workspace.module.css";
export function CmsPagePreview({
  page,
  body,
  shared,
  context,
  fields,
  selected,
  onSelect,
  mobile = false,
}: {
  page: string;
  body: unknown;
  shared: SharedSettings;
  context: PublicContentContext;
  fields: CmsField[];
  selected: string;
  onSelect: (id: string) => void;
  mobile?: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null),
    container = useRef<HTMLDivElement>(null);
  const [styleHtml, setStyleHtml] = useState(""),
    [available, setAvailable] = useState(800);
  const scroll = useRef(0);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    const read = () =>
      setStyleHtml(
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
    if (!container.current) return;
    const observer = new ResizeObserver((entries) =>
      setAvailable(entries[0].contentRect.width),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const doc = frame.current?.contentDocument;
    doc
      ?.querySelectorAll("[data-cms-selected]")
      .forEach((el) => el.removeAttribute("data-cms-selected"));
    doc
      ?.querySelector(`[data-cms-field="${CSS.escape(selected)}"]`)
      ?.setAttribute("data-cms-selected", "true");
  }, [selected]);
  const width = mobile ? 390 : 1100,
    scale = Math.min(1, available / width);
  const html = renderToStaticMarkup(
    <div className="public-shell v3-landing">
      <header className="site-header">
        <Link href="/" className="brand">
          <Image
            unoptimized
            src={
              shared.logoMediaId
                ? `/media/${shared.logoMediaId}`
                : "/design/tpa-logo.png"
            }
            alt={shared.logoAlt}
            width={48}
            height={48}
            data-cms-field="logoMediaId"
          />
          <span
            className="brand-name"
            data-cms-field="organisation"
            style={{ whiteSpace: "pre-line" }}
          >
            {shared.organisation}
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary">
          {shared.navigation.map((n, index) => (
            <a
              key={n.href}
              href={n.href}
              data-cms-field={`navigation.${index}.title`}
            >
              {n.title}
            </a>
          ))}
          <a href={shared.contactHref} data-cms-field="contactLabel">
            {shared.contactLabel}
          </a>
        </nav>
      </header>
      {page === "home" ? (
        <HomeView
          home={body as typeof homeDefaults}
          readOnly
          events={
            <HomepageEventsView
              events={context.events}
              pastEvents={context.pastEvents}
              heading={(body as typeof homeDefaults).copy.sectionHeading37}
              copy={(body as typeof homeDefaults).eventContent}
              newsletter={(body as typeof homeDefaults).newsletterContent}
              readOnly
            />
          }
        />
      ) : page === "shared" ? (
        <HomeView home={homeDefaults} readOnly />
      ) : (
        <PublicContentView
          page={page}
          data={body as ContentBody}
          context={context}
          readOnly
        />
      )}
      <PublicFooter settings={shared} preview />
    </div>,
  );
  const srcDoc = `<!doctype html><html lang="en" data-color-mode="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styleHtml}<style>body{margin:0}html{scrollbar-width:thin}*{animation:none!important;transition:none!important}[data-cms-field]{cursor:pointer!important;outline:2px solid transparent;outline-offset:5px;border-radius:3px}[data-cms-field]:hover,[data-cms-field]:focus-visible{outline-color:#b38e4a;background-color:#b38e4a12}[data-cms-selected]{outline-color:#b38e4a!important;background-color:#b38e4a12}input,textarea,select{pointer-events:none}.hero-copy,.reveal,.v3-value,.editorial-grid article{opacity:1!important;transform:none!important}</style></head><body>${html}</body></html>`;
  return (
    <div ref={container} className={styles.previewViewport}>
      <iframe
        ref={frame}
        title="Website page preview — select content to edit"
        sandbox="allow-same-origin"
        srcDoc={srcDoc}
        style={{
          width,
          height: Math.max(1000, 740 / scale),
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          marginLeft: Math.max(0, (available - width * scale) / 2),
        }}
        onLoad={() => {
          const doc = frame.current?.contentDocument,
            win = frame.current?.contentWindow;
          if (!doc || !win) return;
          if (page === "shared")
            doc
              .querySelector("main")
              ?.querySelectorAll("[data-cms-field]")
              .forEach((el) => el.removeAttribute("data-cms-field"));
          else
            doc
              .querySelectorAll(
                "header [data-cms-field],footer [data-cms-field]",
              )
              .forEach((el) =>
                el.setAttribute(
                  "data-cms-field",
                  "shared:" + el.getAttribute("data-cms-field"),
                ),
              );
          const normalize = (s: string) =>
            s.replace(/[↗→↓]/g, "").replace(/\s+/g, " ").trim();
          const scope =
            page === "shared"
              ? Array.from(doc.querySelectorAll("header,footer"))
              : [doc.querySelector("main")].filter(Boolean);
          const candidates = scope.flatMap((root) =>
            Array.from(
              root!.querySelectorAll<HTMLElement>(
                "h1,h2,h3,h4,p,span,em,a,li,strong,summary,div",
              ),
            ),
          );
          fields.forEach((field) => {
            let elements = Array.from(
              doc.querySelectorAll<HTMLElement>(
                `[data-cms-field="${CSS.escape(field.id)}"]`,
              ),
            );
            if (!elements.length && field.selector)
              elements = Array.from(
                doc.querySelectorAll<HTMLElement>(field.selector),
              );
            if (
              !elements.length &&
              field.type !== "image" &&
              normalize(field.value)
            )
              elements = candidates.filter(
                (el) =>
                  !el.hasAttribute("data-cms-field") &&
                  normalize(el.textContent || "") === normalize(field.value),
              );
            elements = elements.filter(
              (el) =>
                !elements.some((child) => child !== el && el.contains(child)),
            );
            elements.forEach((el) => {
              el.dataset.cmsField = field.id;
              el.tabIndex = 0;
              el.setAttribute("role", "button");
              el.setAttribute("aria-label", `Edit ${field.label}`);
              el.title = `Edit ${field.label}`;
              if (field.id === selected) el.dataset.cmsSelected = "true";
            });
          });
          doc
            .querySelectorAll<HTMLElement>("[data-cms-record]")
            .forEach((el) => {
              el.dataset.cmsField = "record:" + el.dataset.cmsRecord;
              el.tabIndex = 0;
              el.setAttribute("role", "button");
              el.setAttribute(
                "aria-label",
                "Edit " +
                  (el.querySelector("h3,strong")?.textContent ||
                    "website image"),
              );
            });
          doc
            .querySelectorAll("a,button,input,select,textarea")
            .forEach((el) => {
              if (!el.hasAttribute("data-cms-field"))
                el.setAttribute("tabindex", "-1");
            });
          const select = (event: Event) => {
            event.preventDefault();
            event.stopPropagation();
            const el = (event.target as Element).closest<HTMLElement>(
              "[data-cms-field]",
            );
            if (el) onSelectRef.current(el.dataset.cmsField!);
          };
          doc.addEventListener("click", select, true);
          doc.addEventListener(
            "submit",
            (event) => event.preventDefault(),
            true,
          );
          doc.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") select(event);
          });
          win.scrollTo(0, scroll.current);
          win.addEventListener("scroll", () => {
            scroll.current = win.scrollY;
          });
        }}
      />
    </div>
  );
}
