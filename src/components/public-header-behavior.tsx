"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Enhance native disclosures; navigation and disclosure semantics work without JS. */
export function PublicHeaderBehavior() {
  const marker = useRef<HTMLSpanElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const header = marker.current?.closest("header");
    if (!header) return;
    const disclosures = () => [
      ...header.querySelectorAll<HTMLDetailsElement>(".nav-menu, .mobile-nav"),
    ];
    const close = (restoreFocus = false) => {
      const open = disclosures().filter((detail) => detail.open);
      if (restoreFocus)
        open[0]?.querySelector<HTMLElement>(":scope > summary")?.focus();
      open.forEach((detail) => {
        detail.open = false;
      });
    };
    header.querySelectorAll<HTMLElement>("[data-nav-href]").forEach((item) => {
      const current = item.dataset.navHref === pathname;
      item.dataset.currentPage = String(current);
      const link = item.matches("a")
        ? item
        : item.querySelector(".nav-overview");
      if (current) link?.setAttribute("aria-current", "page");
      else link?.removeAttribute("aria-current");
    });
    const pointer = (event: PointerEvent) => {
      header.dataset.input = "pointer";
      if (
        !disclosures().some((detail) => detail.contains(event.target as Node))
      )
        close();
    };
    const keyboard = (event: KeyboardEvent) => {
      header.dataset.input = "keyboard";
      if (
        event.key === "Escape" &&
        disclosures().some((detail) => detail.open)
      ) {
        event.preventDefault();
        close(true);
      }
    };
    const click = (event: MouseEvent) => {
      const target = (event.target as Element).closest("a");
      if (
        target &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        event.button === 0
      )
        close();
    };
    const focus = (event: FocusEvent) => {
      if (!header.contains(event.relatedTarget as Node)) close();
    };
    // A hidden menu must not reopen unexpectedly after changing viewport.
    const breakpoint = matchMedia("(max-width: 1100px)");
    const resize = () => close();
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", keyboard);
    header.addEventListener("click", click);
    header.addEventListener("focusout", focus);
    breakpoint.addEventListener("change", resize);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", keyboard);
      header.removeEventListener("click", click);
      header.removeEventListener("focusout", focus);
      breakpoint.removeEventListener("change", resize);
    };
  }, [pathname]);

  return <span ref={marker} hidden />;
}
