"use client";
import { useState, useEffect, useId, useRef } from "react";
export function useEmailEditGuard(dirty: boolean, navigation = true) {
  const [pending, setPending] = useState<(() => void) | null>(null);
  const title = useId();
  const trigger = useRef<HTMLElement | null>(null);
  const request = (work: () => void) => {
    trigger.current = document.activeElement as HTMLElement | null;
    setPending(() => work);
  };
  useEffect(() => {
    if (!pending) return;
    const original = trigger.current;
    return () => { if (original?.isConnected) original.focus(); };
  }, [pending]);
  useEffect(() => {
    if (!dirty || !navigation) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const click = (e: MouseEvent) => {
      const link = (e.target as Element)?.closest?.("a");
      if (
        !link ||
        link.target === "_blank" ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        link.href === location.href ||
        link.getAttribute("href")?.startsWith("#")
      )
        return;
      e.preventDefault();
      trigger.current = document.activeElement as HTMLElement | null;
      setPending(() => () => location.assign(link.href));
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, navigation]);
  return {
    proceed: (work: () => void) => (dirty ? request(work) : work()),
    dialog: pending ? (
      <div className="email-dialog-backdrop">
        <section
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={title}
          className="email-dialog"
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setPending(null); }
            if (e.key === "Tab") {
              const buttons = Array.from(
                e.currentTarget.querySelectorAll("button"),
              );
              if (e.shiftKey && document.activeElement === buttons[0]) {
                e.preventDefault();
                buttons.at(-1)?.focus();
              } else if (
                !e.shiftKey &&
                document.activeElement === buttons.at(-1)
              ) {
                e.preventDefault();
                buttons[0]?.focus();
              }
            }
          }}
        >
          <h2 id={title}>Discard unsaved changes?</h2>
          <p>Changes made since your last save will be discarded.</p>
          <button
            className="button secondary"
            autoFocus
            onClick={() => setPending(null)}
          >
            Continue editing
          </button>{" "}
          <button
            className="button"
            onClick={() => {
              const work = pending;
              setPending(null);
              work();
            }}
          >
            Discard changes
          </button>
        </section>
      </div>
    ) : null,
  };
}
