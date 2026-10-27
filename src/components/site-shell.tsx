import Link from "./navigation-link";
import { currentActor } from "@/lib/actor";
import { AccountControls } from "./account-controls";
import { MemberNavigation } from "./member-navigation";
import { StickyHeaderState } from "./sticky-header-state";
import {publishedSettings,publicNavigation} from '@/lib/website-content';
import {sharedDefaults,type SharedSettings} from '@/domain/website-settings';
import { TpaLogo } from './tpa-logo';
import { PublicFooter } from './public-footer';
import { StaffNavigation } from "./staff-navigation";
import { staffNavigation } from "@/domain/staff-navigation";
import { WorkspaceSearch } from "./workspace-search";
import { PortalIcon } from "./portal-icon";
import { PortalFrame } from "./portal-frame";
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
    <Link href="/" className="brand" aria-label={`${settings.organisation.replace(/\s+/g, ' ').trim()} homepage`}>
      <TpaLogo src={settings.logoMediaId ? `/media/${settings.logoMediaId}` : undefined} />
      <span className="brand-name" style={{whiteSpace:'pre-line'}}>{settings.organisation}</span>
    </Link>
  );
}
export async function Header() {
  const [actor, settings, navigation] = await Promise.all([currentActor(), publishedSettings("shared"), publicNavigation()]);
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
  return <PortalShell actor={actor}>{children}</PortalShell>;
}

export function PortalShell({ actor, children }: {
  actor: Awaited<ReturnType<typeof currentActor>>;
  children: React.ReactNode;
}) {
  const staff = Boolean(actor?.roles.length);
  return (
    <PortalFrame staff={staff} sidebar={<>
        <Brand />
        <p className="portal-workspace-label">{staff ? "Association workspace" : "Member portal"}</p>
        {staff ? <StaffNavigation groups={staffNavigation(actor?.roles ?? [])} /> : <MemberNavigation />}
        <Link className="portal-public-link" href="/" aria-label="Public website" data-nav-label="Public website"><PortalIcon name="external" /><span className="portal-nav-label">Public website</span></Link>
      </>}>
      <div className="staff-content portal-content">
        <header className="workspace-topbar portal-topbar">
          <StickyHeaderState />
          <div className="portal-context"><span className="portal-context-mark">TPA</span><span className="portal-context-divider">/</span><span>{staff ? "Staff workspace" : "Member portal"}</span></div>
          <div className="portal-utilities">
            {staff && <WorkspaceSearch />}
            <AccountControls actor={actor} />
          </div>
        </header>
        {children}
      </div>
    </PortalFrame>
  );
}
export async function Footer() {
  return <PublicFooter settings={await publishedSettings('shared')}/>;
}
export function SiteShell({ children, variant }: { children: React.ReactNode; variant?: "v3" }) {
  return (
    <div className={variant === "v3" ? "public-shell v3-landing" : "public-shell"}>
      <Header />
      {children}
      <Footer />
    </div>
  );
}
