import Link from "next/link";
import { currentActor } from "@/lib/actor";
import { AccountControls } from "./account-controls";
import { MemberNavigation } from "./member-navigation";
import { StickyHeaderState } from "./sticky-header-state";
import {publishedSettings,publicNavigation} from '@/lib/website-content';
import {sharedDefaults,type SharedSettings} from '@/domain/website-settings';
import Image from 'next/image';
export const navigation = [
  {
    title: "About",
    href: "/about",
    links: ["About TPA", "Vision & Mission", "Founding Members"],
  },
  {
    title: "Governance",
    href: "/governance",
    links: ["Executive Committee", "Sub-Committees", "Constitution & Bye-Laws"],
  },
  {
    title: "Membership",
    href: "/membership",
    links: ["Why Become a Member", "Membership Plans", "Renew Membership"],
  },
  {
    title: "Events",
    href: "/events",
    links: ["Upcoming Events", "Past Events", "Event Registration"],
  },
  {
    title: "Resources",
    href: "/resources",
    links: ["Insights", "Media", "Downloads", "Important Links"],
  },
];
export function Brand({settings=sharedDefaults}:{settings?:SharedSettings}={}) {
  return (
    <Link href="/" className="brand">
      {settings.logoMediaId ? <Image src={`/media/${settings.logoMediaId}`} alt={settings.logoAlt} width={48} height={48} unoptimized/> : <span className="brand-mark">{settings.brandMark.endsWith('·')?<>{settings.brandMark.slice(0,-1)}<span>·</span></>:settings.brandMark}</span>}
      <span className="brand-name" style={{whiteSpace:'pre-line'}}>{settings.organisation}</span>
    </Link>
  );
}
export async function Header() {
  const actor = await currentActor();
  const settings=await publishedSettings('shared'),navigation=await publicNavigation();
  return (
    <header className="site-header">
      <StickyHeaderState />
      <Brand settings={settings}/>
      <nav className="desktop-nav" aria-label="Primary">
        {navigation.map((n,navIndex) => (
          <details className="nav-menu" name="primary-navigation" key={navIndex}>
            <summary>
              {n.title}
              <span>⌄</span>
            </summary>
            <div className="dropdown">
              {n.links.map((label, i) => (
                <Link key={i} href={`${n.href}#section-${i}`}>
                  {label}
                </Link>
              ))}
            </div>
          </details>
        ))}
        <Link href={settings.contactHref}>{settings.contactLabel}</Link>
      </nav>
      <div className="header-actions">
        <Link href={actor ? "/account" : "/login"} className="login-link">
          {actor
            ? actor.roles.length
              ? "Staff workspace ↗"
              : "Your account ↗"
            : `${settings.loginLabel} ↗`}
        </Link>
        {!actor && (
          <Link className="button small" href="/join">
            {settings.joinLabel} <span>→</span>
          </Link>
        )}
        <AccountControls actor={actor} />
      </div>
      <details className="mobile-nav">
        <summary>Menu</summary>
        <nav aria-label="Mobile">
          {navigation.map((n,navIndex) => (
            <details key={navIndex} name="mobile-sections">
              <summary>{n.title}</summary>
              {n.links.map((label, i) => (
                <Link key={i} href={`${n.href}#section-${i}`}>
                  {label}
                </Link>
              ))}
            </details>
          ))}
          <Link href={settings.contactHref}>{settings.contactLabel}</Link>
          <Link href={actor ? "/account" : "/login"}>
            {actor ? "Your workspace" : settings.loginLabel}
          </Link>
        </nav>
      </details>
    </header>
  );
}
export async function AccountShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await currentActor();
  const staff = Boolean(actor?.roles.length);
  return (
    <div className={staff ? "staff-account-shell" : "member-shell"}>
      <header className="site-header account-header">
        <StickyHeaderState />
        <Brand />
        {staff ? (
          <nav aria-label="Account navigation">
            <Link href={staff ? "/admin" : "/member"}>
              {staff ? "Staff workspace" : "Your account"}
            </Link>
            <Link href="/account/profile">Profile</Link>
            {!staff && (
              <>
                <Link href="/member/application">Application</Link>
                <Link href="/member/events">Events</Link>
                <Link href="/member/inquiries">Inquiries</Link>
                <Link href="/member/payments">Payment details</Link>
              </>
            )}
            <Link href="/member/security">Security</Link>
            <Link href="/">Public website</Link>
          </nav>
        ) : (
          <MemberNavigation />
        )}
        <AccountControls actor={actor} />
      </header>
      {children}
    </div>
  );
}
export async function Footer() {
  const settings=await publishedSettings('shared'),footer=settings.footer;
  return (
    <footer className="site-footer">
      <div>
        <Brand settings={settings}/>
        <p style={{whiteSpace:'pre-line'}}>{footer.tagline}</p>
      </div>
      <div>
        <span className="eyebrow">{footer.exploreTitle}</span>
        {footer.links.map(link=><Link key={link.href+link.label} href={link.href}>{link.label}</Link>)}
      </div>
      <div>
        <span className="eyebrow">{footer.contactTitle}</span>
        <Link href={footer.contactHref}>{footer.contactLabel}</Link>
        <span>{footer.location}</span>
      </div>
      <div className="footer-bottom">
        © {new Date().getFullYear()} {footer.copyrightName}
        <span>{footer.closing}</span>
      </div>
    </footer>
  );
}
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-shell">
      <Header />
      {children}
      <Footer />
    </div>
  );
}
