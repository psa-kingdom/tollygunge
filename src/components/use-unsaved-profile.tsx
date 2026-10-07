"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useModalFocus } from "./use-modal-focus";
export function useUnsavedProfile(dirty: boolean, observeNavigation = true) {
  const dirtyRef = useRef(dirty),
    [pending, setPending] = useState<(() => void) | null>(null),
    ref = useRef<HTMLElement>(null);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  const close = useCallback(() => setPending(null), []);
  useModalFocus(!!pending, ref, close);
  useEffect(() => {
    if (!observeNavigation) return;
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
        a.getAttribute("href")?.startsWith("/")
      ) {
        e.preventDefault();
        e.stopPropagation();
        setPending(() => () => window.location.assign(a.href));
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [observeNavigation]);
  const guard = (fn: () => void) => {
    if (dirtyRef.current) setPending(() => fn);
    else fn();
  };
  return {
    guard,
    dialog: pending ? (
      <div className="content-dialog-backdrop">
        <section
          ref={ref}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="profile-discard-title"
          className="content-discard-dialog"
        >
          <h2 id="profile-discard-title">Discard unsaved changes?</h2>
          <p>Save your draft to keep these edits.</p>
          <button className="button" onClick={close}>
            Keep editing
          </button>
          <button
            className="button secondary"
            onClick={() => {
              dirtyRef.current = false;
              setPending(null);
              pending();
            }}
          >
            Discard changes
          </button>
        </section>
      </div>
    ) : null,
  };
}
