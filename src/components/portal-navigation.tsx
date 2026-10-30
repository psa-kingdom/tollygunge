"use client";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { portalNavigationEvent } from "./email-edit-guard";
import Link from "./navigation-link";
import type { PortalGroup } from "@/domain/portal-navigation";
function reveal(nav: HTMLElement, target: HTMLElement) {
  const frame = nav.getBoundingClientRect(),
    item = target.getBoundingClientRect();
  if (item.right > frame.right - 8)
    nav.scrollLeft += item.right - frame.right + 8;
  else if (item.left < frame.left + 8)
    nav.scrollLeft -= frame.left - item.left + 8;
}
export function PortalNavigation({
  groups,
  subsections = false,
  staff = false,
  canViewParticipants = false,
}: {
  groups: PortalGroup[];
  subsections?: boolean;
  staff?: boolean;
  canViewParticipants?: boolean;
}) {
  const pathname = usePathname();
  const query = useSearchParams();
  const router = useRouter();
  const participants =
    pathname === "/admin/workspaces/events" &&
    query.get("view") === "participants";
  const active = (href: string) => {
    const [path] = href.split("?");
    if (path === "/admin/workspaces/members" && pathname === path) return true;
    return (
      pathname === path ||
      (path !== "/admin" &&
        path !== "/member" &&
        pathname.startsWith(path + "/"))
    );
  };
  const group = participants
    ? (groups.find((item) => item.label === "Members") ??
      groups.find((item) => item.label === "Events"))
    : groups.find((item) => item.items.some((item) => active(item.href)));
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = root.current;
    if (!nav) return;
    let active = true;
    const update = () => {
      if (!active) return;
      const focused =
        document.activeElement instanceof HTMLElement &&
        nav.contains(document.activeElement)
          ? document.activeElement
          : undefined;
      const target =
        focused ?? nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (target) reveal(nav, target);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    void document.fonts.ready.then(update);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [pathname, query]);
  const people = subsections && (group?.label === "Members" || participants);
  const sections = participants
    ? ["Registrations", "Payment status", "Attendance"].map((label, index) => {
        const params = new URLSearchParams({
          view: "participants",
          tab: ["registrations", "payments", "attendance"][index],
        });
        if (query.get("eventId")) params.set("eventId", query.get("eventId")!);
        return { label, href: "/admin/workspaces/events?" + params };
      })
    : (group?.items ?? []);
  if (subsections && (!group || sections.length < 2)) return null;
  const navigation = (
    <nav
      ref={root}
      onFocusCapture={(event) =>
        reveal(event.currentTarget, event.target as HTMLElement)
      }
      id={
        subsections
          ? undefined
          : staff
            ? "staff-navigation"
            : "member-navigation"
      }
      className={subsections ? "portal-subsections" : "portal-navigation"}
      aria-label={
        subsections
          ? participants
            ? "Event participant sections"
            : `${group!.label} sections`
          : staff
            ? "Staff navigation"
            : "Member navigation"
      }
    >
      {subsections
        ? sections.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={
                (
                  participants
                    ? (query.get("tab") ?? "registrations") ===
                      ["registrations", "payments", "attendance"][index]
                    : active(item.href)
                )
                  ? "page"
                  : undefined
              }
            >
              {item.label}
            </Link>
          ))
        : groups.map((item) => (
            <Link
              key={item.label}
              href={item.items[0].href}
              aria-current={item === group ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
    </nav>
  );
  if (!people) return navigation;
  const hasMembers = groups.some((item) => item.label === "Members");
  return (
    <div className="portal-section-tools">
      <label className="portal-audience-label">
        People
        <select
          aria-label="Directory audience"
          value={participants ? "participants" : "members"}
          disabled={!hasMembers || !canViewParticipants}
          onChange={(event) => {
            const href =
              event.target.value === "participants"
                ? "/admin/workspaces/events?view=participants"
                : "/admin/workspaces/members";
            if (
              window.dispatchEvent(
                new CustomEvent(portalNavigationEvent, {
                  detail: href,
                  cancelable: true,
                }),
              )
            )
              router.push(href);
          }}
        >
          {hasMembers && <option value="members">Association members</option>}
          {canViewParticipants && (
            <option value="participants">Event participants</option>
          )}
        </select>
      </label>
      {navigation}
    </div>
  );
}
