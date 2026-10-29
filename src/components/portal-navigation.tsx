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
}: {
  groups: PortalGroup[];
  subsections?: boolean;
  staff?: boolean;
}) {
  const pathname = usePathname();
  const query = useSearchParams();
  const directory =
    query.get("view") === "accounts" || Boolean(query.get("id"));
  const active = (href: string) => {
    const [path, search] = href.split("?");
    if (path === "/admin/workspaces/members" && pathname === path)
      return Boolean(search) === directory;
    return (
      pathname === path ||
      (path !== "/admin" &&
        path !== "/member" &&
        pathname.startsWith(path + "/"))
    );
  };
  const group = groups.find((item) =>
    item.items.some((item) => active(item.href)),
  );
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
  if (subsections && (!group || group.items.length < 2)) return null;
  return (
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
          ? `${group!.label} sections`
          : staff
            ? "Staff navigation"
            : "Member navigation"
      }
    >
      {subsections
        ? group!.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active(item.href) ? "page" : undefined}
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
}
