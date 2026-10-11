"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function MemberNavigation() {
  const pathname = usePathname();
  const main = [
    ["/member", "Overview"],
    ["/member/application", "Verification"],
    ["/account/profile", "Profile"],
    ["/member/events", "Events"],
  ];
  return (
    <nav aria-label="Account navigation">
      {main.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
      <details className="member-nav-more">
        <summary>More</summary>
        <div>
          {[
            ["/member/inquiries", "Inquiries"],
            ["/member/payments", "Payment details"],
            ["/member/security", "Security"],
            ["/", "Public website"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </div>
      </details>
    </nav>
  );
}
