"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import Link from "next/link";
import { SignOut } from "./auth-controls";

function usePopoverPosition(
  open: boolean,
  root: RefObject<HTMLDivElement | null>,
) {
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const box = root.current?.getBoundingClientRect();
      if (box)
        root.current?.style.setProperty(
          "--popover-top",
          Math.max(12, Math.min(innerHeight - 150, box.bottom + 10)) + "px",
        );
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, root]);
}

function ModeControl() {
  const [mode, setMode] = useState(() =>
    typeof document === "undefined"
      ? "system"
      : document.documentElement.dataset.mode || "system",
  );
  useEffect(() => {
    const sync = () =>
      setMode(document.documentElement.dataset.mode || "system");
    window.addEventListener("storage", sync);
    window.addEventListener("tpa-appearance", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("tpa-appearance", sync);
    };
  }, []);
  return (
    <fieldset className="mode-options">
      <legend>Mode</legend>
      {["light", "dark", "system"].map((value) => (
        <label key={value}>
          <input
            type="radio"
            name="appearance-mode"
            value={value}
            checked={mode === value}
            onChange={() => {
              try {
                localStorage.setItem(
                  "tpa-appearance",
                  JSON.stringify({ theme: "tpa", mode: value }),
                );
              } catch {}
              document.documentElement.dataset.mode = value;
              document.documentElement.dataset.colorMode =
                value === "system"
                  ? matchMedia("(prefers-color-scheme: dark)").matches
                    ? "dark"
                    : "light"
                  : value;
              document.documentElement.style.colorScheme =
                document.documentElement.dataset.colorMode;
              setMode(value);
              window.dispatchEvent(new Event("tpa-appearance"));
            }}
          />
          {value[0].toUpperCase() + value.slice(1)}
        </label>
      ))}
    </fieldset>
  );
}
export function AccountControls({
  actor,
}: {
  actor?: { name: string; email: string; roles: string[] } | null;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className="account-controls">
      {actor && <AttentionBell />}
      <div className="account-popover" ref={root}>
        <button
          ref={trigger}
          className="avatar-trigger"
          aria-label={actor ? "Account menu" : "Appearance settings"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {actor ? actor.name.slice(0, 1).toUpperCase() : "◐"}
        </button>
        {open && (
          <div
            className="account-menu"
            role="dialog"
            aria-label="Account settings"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setOpen(false);
            }}
          >
            {actor && (
              <>
                <strong>{actor.name}</strong>
                <small>{actor.email}</small>
                <Link href="/account/profile">Your profile</Link>
                <Link href="/member/security">Account security</Link>
                <Link href={actor.roles.length ? "/admin" : "/member"}>
                  {actor.roles.length ? "Staff workspace" : "Member portal"}
                </Link>
                <Link href="/">Public website ↗</Link>
              </>
            )}
            <ModeControl />
            <button disabled className="theme-coming">
              Themes <span>Coming later</span>
            </button>
            {actor && <SignOut />}
          </div>
        )}
      </div>
    </div>
  );
}
type Alert = {
  id: string;
  label: string;
  href: string;
  category: string;
  priority: "High" | "Normal" | "Low";
  count: number;
};
function AttentionBell() {
  const [open, setOpen] = useState(false),
    [items, setItems] = useState<Alert[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [category, setCategory] = useState("All");
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  usePopoverPosition(open, root);
  const pinned = useRef(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      if (document.hidden) return;
      setLoading(true);
      try {
        const response = await fetch("/api/attention", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw Error();
        setItems((await response.json()).items);
        setError("");
      } catch {
        if (!controller.signal.aborted)
          setError(
            "Unable to load attention items. Try opening this panel again.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 60000);
    document.addEventListener("visibilitychange", load);
    const dismiss = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        pinned.current = false;
        setOpen(false);
      }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        pinned.current = false;
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", key);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div
      className="account-popover"
      ref={root}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        setOpen(true);
      }}
      onPointerLeave={() => {
        if (!pinned.current)
          hoverTimer.current = setTimeout(() => setOpen(false), 250);
      }}
    >
      <button
        ref={trigger}
        className="bell-trigger"
        aria-label={`Notifications: ${items.length} active alerts`}
        aria-expanded={open}
        onClick={() => {
          pinned.current = !pinned.current;
          setOpen(pinned.current);
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
          <path d="M10 21h4" />
        </svg>
        {items.length > 0 && <span className="alert-dot">{items.length}</span>}
      </button>
      {open && (
        <section className="attention-panel">
          <h2>Needs attention</h2>
          <p>Active workflow items</p>
          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {[
                "All",
                "Account",
                "Verification",
                "Publication",
                "Inquiries",
                "Communications",
                "Delivery",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          {loading ? (
            <p role="status">Loading attention items…</p>
          ) : error ? (
            <p role="alert">{error}</p>
          ) : items.filter((x) => category === "All" || x.category === category)
              .length ? (
            items
              .filter((x) => category === "All" || x.category === category)
              .map((x) => (
                <Link key={x.id} href={x.href}>
                  <small>
                    {x.category} · {x.priority}
                  </small>
                  <strong>{x.label}</strong>
                </Link>
              ))
          ) : (
            <p>
              {category === "All"
                ? "You’re up to date."
                : "No active alerts in this category."}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
