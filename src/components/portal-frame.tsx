"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { PortalIcon } from "./portal-icon";
import styles from "./portal-theme.module.css";

gsap.registerPlugin(useGSAP);
const preferenceKey = "tpa.portal.sidebar-collapsed";
const preferenceEvent = "tpa-sidebar-change";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(preferenceEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(preferenceEvent, callback);
  };
}
function snapshot() {
  try { return localStorage.getItem(preferenceKey) === "true"; } catch { return false; }
}

/** Client boundary for shared portal navigation; page content stays server-rendered. */
export function PortalFrame({ staff, sidebar, children }: {
  staff: boolean; sidebar: React.ReactNode; children: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const collapsed = useSyncExternalStore(subscribe, snapshot, () => false);
  const [fallback, setFallback] = useState(false);
  const [tooltip, setTooltip] = useState<{ label: string; top: number; left: number } | null>(null);
  const compact = collapsed || fallback;

  useGSAP((context, contextSafe) => {
    if (!contextSafe) return;
    const media = gsap.matchMedia();
    media.add("(hover: hover) and (prefers-reduced-motion: no-preference)", () => {
      const links = root.current?.querySelectorAll<HTMLAnchorElement>(".portal-sidebar nav a") ?? [];
      const cleanup = Array.from(links).map(link => {
        const icon = link.querySelector("svg");
        if (!icon) return () => {};
        const enter = contextSafe(() => {
          gsap.to(icon, { y: -1.5, scale: 1.08, duration: .18, ease: "power2.out", overwrite: true });
        });
        const leave = contextSafe(() => {
          gsap.to(icon, { y: 0, scale: 1, duration: .2, ease: "power2.out", overwrite: true });
        });
        link.addEventListener("pointerenter", enter);
        link.addEventListener("pointerleave", leave);
        link.addEventListener("focus", enter);
        link.addEventListener("blur", leave);
        return () => {
          link.removeEventListener("pointerenter", enter);
          link.removeEventListener("pointerleave", leave);
          link.removeEventListener("focus", enter);
          link.removeEventListener("blur", leave);
          gsap.killTweensOf(icon);
          gsap.set(icon, { clearProps: "transform" });
        };
      });
      return () => cleanup.forEach(remove => remove());
    }, root);
    return () => media.revert();
  }, { scope: root, dependencies: [sidebar], revertOnUpdate: true });

  function showLabel(target: EventTarget) {
    const link = (target as HTMLElement).closest<HTMLAnchorElement>("[data-nav-label]");
    if (!compact || !link || !window.matchMedia("(min-width: 801px)").matches) { setTooltip(null); return; }
    const rect = link.getBoundingClientRect();
    setTooltip({ label: link.dataset.navLabel!, top: Math.max(8, Math.min(rect.top, innerHeight - 44)), left: rect.right + 10 });
  }
  return (
    <div ref={root} className={`${styles.portal} workspace ${staff ? "staff-shell" : "member-shell"}`}
      data-sidebar-collapsed={compact} onKeyDown={event => { if (event.key === "Escape") setTooltip(null); }}>
      <aside id="portal-sidebar" className={`sidebar portal-sidebar ${staff ? "staff-sidebar" : "member-sidebar"}`}
        aria-label={staff ? "Staff workspace sidebar" : "Member portal sidebar"}
        onPointerOver={event => showLabel(event.target)} onPointerLeave={() => setTooltip(null)}
        onFocusCapture={event => showLabel(event.target)} onBlurCapture={() => setTooltip(null)}
        onClick={() => setTooltip(null)} onScrollCapture={() => setTooltip(null)}>
        {sidebar}
        <button type="button" className="portal-collapse-toggle" aria-controls="portal-sidebar"
          aria-expanded={!compact} aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
          title={compact ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => {
            const next = !compact;
            try {
              localStorage.setItem(preferenceKey, String(next));
              setFallback(false);
              window.dispatchEvent(new Event(preferenceEvent));
            } catch { setFallback(next); }
          }}>
          <PortalIcon name="panel" /><span className="portal-nav-label">Collapse sidebar</span>
        </button>
      </aside>
      {children}
      {tooltip && <div className="portal-nav-tooltip" aria-hidden="true" style={{ top: tooltip.top, left: tooltip.left }}>{tooltip.label}</div>}
    </div>
  );
}
