"use client";
import Link from "./navigation-link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PortalIcon } from "./portal-icon";

const groups = [
  { label: "Your membership", items: [
    { href: "/member", label: "Overview", icon: "home" },
    { href: "/member/application", label: "Verification", icon: "shield" },
    { href: "/account/profile", label: "Profile", icon: "profile" },
  ] },
  { label: "Community", items: [
    { href: "/member/events", label: "Events", icon: "calendar" },
    { href: "/member/inquiries", label: "Inquiries", icon: "message" },
    { href: "/member/payments", label: "Payment details", icon: "wallet" },
  ] },
  { label: "Account", items: [
    { href: "/member/security", label: "Security", icon: "shield" },
  ] },
];
export function MemberNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = groups.flatMap(group => group.items).find(item =>
    pathname === item.href || (item.href !== "/member" && pathname.startsWith(item.href + "/")),
  );
  return (
    <>
      <button className="member-menu-toggle" type="button" aria-expanded={open} aria-controls="member-navigation" onClick={() => setOpen(!open)}>
        <PortalIcon name={open ? "close" : "menu"} />
        <span>Member navigation</span>
        <strong>{active?.label ?? "Overview"}</strong>
      </button>
      <nav id="member-navigation" aria-label="Account navigation" className={`portal-member-navigation ${open ? "is-open" : ""}`} onKeyDown={event => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          document.querySelector<HTMLButtonElement>(".member-menu-toggle")?.focus();
        }
      }}>
        {groups.map(group => (
          <section key={group.label}>
            <h2>{group.label}</h2>
            {group.items.map(item => (
              <Link key={item.href} href={item.href} aria-label={item.label} data-nav-label={item.label} aria-current={active?.href === item.href ? "page" : undefined} onClick={() => setOpen(false)}>
                <PortalIcon name={item.icon} />
                <span className="portal-nav-label">{item.label}</span>
              </Link>
            ))}
          </section>
        ))}
      </nav>
    </>
  );
}
