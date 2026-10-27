"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PortalIcon } from "./portal-icon";
import type { staffNavigation } from "@/domain/staff-navigation";

export function StaffNavigation({
  groups,
}: {
  groups: ReturnType<typeof staffNavigation>;
}) {
  const pathname = usePathname(),
    [open, setOpen] = useState(false);
  const current = groups
    .flatMap((group) => group.items)
    .find(
      (item) =>
        pathname === item.href ||
        (item.href.endsWith("/content") &&
          pathname.startsWith("/admin/content/")),
    );
  return (
    <>
      <button
        className="staff-menu-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="staff-navigation"
        onClick={() => setOpen(!open)}
      >
        <PortalIcon name={open ? "close" : "menu"} />
        <span>Workspace navigation</span>
        <strong>
          {current?.label ?? (pathname === "/account/profile" ? "Your profile" : pathname === "/member/security" ? "Account security" : "Overview")}
        </strong>
      </button>
      <nav
        id="staff-navigation"
        aria-label="Staff workspaces"
        className={`staff-navigation ${open ? "is-open" : ""}`}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            setOpen(false);
            document.querySelector<HTMLButtonElement>(".staff-menu-toggle")?.focus();
          }
        }}
      >
        {groups.map((group) => (
          <section key={group.label}>
            <h2>{group.label}</h2>
            {group.items.map((item) => {
              const active = current?.href === item.href;
              return (
                <Link
                  href={item.href} aria-label={item.label} data-nav-label={item.label}
                  key={item.href}
                  className={active ? "current" : ""}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <PortalIcon name={item.icon} />
                  <span className="portal-nav-label">{item.label}</span>
                  {active && <span className="nav-current-dot" />}
                </Link>
              );
            })}
          </section>
        ))}
      </nav>
    </>
  );
}
