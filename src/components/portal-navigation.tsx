"use client";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
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
  const participants =
    pathname === "/admin/workspaces/events" &&
    query.get("view") === "participants";
  const active = (href: string) => {
    const [path, search] = href.split("?");
    if (path === "/admin/workspaces/events") {
      const isParticipants = new URLSearchParams(search).get("view") === "participants";
      return pathname === path && isParticipants === participants;
    }
    if (path === "/admin/workspaces/members" && pathname === path) return true;
    return (
      pathname === path ||
      (path !== "/admin" &&
        path !== "/member" &&
        pathname.startsWith(path + "/"))
    );
  };
  const group = participants
    ? groups.find((item) => item.label === "Events")
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
  const people = subsections && group?.label === "Members";
  const historical = participants && query.get("source") !== "live" && !query.get("eventId");
  const sections = participants && !historical
    ? ["Registrations", "Receipt status", "Attendance"].map((label, index) => {
        const params = new URLSearchParams({
          view: "participants",
          tab: ["registrations", "payments", "attendance"][index],
        });
        params.set("source", "live");
        if (query.get("eventId")) params.set("eventId", query.get("eventId")!);
        return { label, href: "/admin/workspaces/events?" + params };
      })
    : participants ? [] : (group?.items ?? []);
  if (subsections && participants) return <section className="participant-context" aria-label="Event participant workspace">
    <div className="participant-context-heading">
      <Link href="/admin/workspaces/events">← All events</Link>
      <strong>Event participants</strong>
      <span>{historical ? "Past attendance registers" : "Online registrations"}</span>
    </div>
    {!historical && <nav className="portal-subsections" aria-label="Event participant sections">
      {sections.map((item,index) => <Link key={item.href} href={item.href} aria-current={(query.get("tab") ?? "registrations") === ["registrations","payments","attendance"][index] ? "page" : undefined}>{item.label}</Link>)}
    </nav>}
  </section>;
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
  return (
    <div className="member-section-navigation">
      {navigation}
      {canViewParticipants && <Link className="participant-shortcut" href="/admin/workspaces/events?view=participants">Event attendance & participants →</Link>}
    </div>
  );
}
