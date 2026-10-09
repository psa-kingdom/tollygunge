"use client";
import { useEffect, useRef, useState } from "react";
type Result = {
  id: string;
  group: string;
  title: string;
  summary: string;
  href: string;
};
export function WorkspaceSearch() {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [results, setResults] = useState<Result[]>([]),
    [state, setState] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((x) => !x);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      input.current?.focus();
    } else if (dialog.current?.open) {
      dialog.current.close();
      trigger.current?.focus();
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState("Loading…");
      setResults([]);
      try {
        const response = await fetch(
          "/api/staff/search?q=" + encodeURIComponent(query),
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) throw Error();
        const body = await response.json();
        if (controller.signal.aborted) return;
        setResults(body.results);
        setState(body.results.length ? "" : "No matching records.");
      } catch {
        if (!controller.signal.aborted)
          setState("Search unavailable. Try again.");
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);
  return (
    <>
      <button
        ref={trigger}
        className="search-entry"
        onClick={() => setOpen(true)}
      >
        Search workspace <kbd>Ctrl / ⌘ K</kbd>
      </button>
      <dialog
        className="command-dialog"
        ref={dialog}
        onCancel={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!["ArrowDown", "ArrowUp"].includes(e.key)) return;
          const links = Array.from(
            dialog.current?.querySelectorAll<HTMLAnchorElement>(
              ".command-results a",
            ) || [],
          );
          if (!links.length) return;
          e.preventDefault();
          const i = links.indexOf(document.activeElement as HTMLAnchorElement);
          links[
            (i +
              (e.key === "ArrowDown" ? 1 : links.length - 1) +
              links.length) %
              links.length
          ].focus();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <div className="command-header">
          <label htmlFor="workspace-search">
            Search your permitted workspaces and records
          </label>
          <button aria-label="Close search" onClick={() => setOpen(false)}>
            ×
          </button>
        </div>
        <input
          id="workspace-search"
          ref={input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Names, emails, titles or identifiers"
          autoComplete="off"
        />
        <p role="status">
          {state ||
            (query.length < 2 ? "Type two characters to search records." : "")}
        </p>
        <div className="command-results">
          {[...new Set(results.map((x) => x.group))].map((group) => (
            <section key={group}>
              <h2>{group}</h2>
              {results
                .filter((x) => x.group === group)
                .map((x) => (
                  <a key={x.id} href={x.href}>
                    <strong>{x.title}</strong>
                    <small>{x.summary}</small>
                  </a>
                ))}
            </section>
          ))}
        </div>
      </dialog>
    </>
  );
}
