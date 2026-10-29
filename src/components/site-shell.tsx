import Link from "./navigation-link";
import { currentActor } from "@/lib/actor";
import { AccountControls } from "./account-controls";
import { StickyHeaderState } from "./sticky-header-state";
import { publishedSettings, publicNavigation } from "@/lib/website-content";
import { sharedDefaults, type SharedSettings } from "@/domain/website-settings";
import { TpaLogo } from "./tpa-logo";
import { PublicFooter } from "./public-footer";
import {
  portalNavigation,
  deploymentEnvironment,
} from "@/domain/portal-navigation";
import { PortalNavigation } from "./portal-navigation";
import { StatusBadge } from "./portal-values";
import { WorkspaceSearch } from "./workspace-search";
import { PortalIcon } from "./portal-icon";
import { PortalFrame } from "./portal-frame";
import { PublicHeaderBehavior } from "./public-header-behavior";
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
export function Brand({
  settings = sharedDefaults,
}: { settings?: SharedSettings } = {}) {
  return (
    <Link
      href="/"
      className="brand"
      aria-label={`${settings.organisation.replace(/\s+/g, " ").trim()} homepage`}
    >
      <TpaLogo
        src={
          settings.logoMediaId ? `/media/${settings.logoMediaId}` : undefined
        }
      />
      <span className="brand-name" style={{ whiteSpace: "pre-line" }}>
        {settings.organisation}
      </span>
    </Link>
  );
}
export async function Header() {
  const [actor, settings, navigation] = await Promise.all([
    currentActor(),
    publishedSettings("shared"),
    publicNavigation(),
  ]);
  return (
    <header className="site-header">
      <StickyHeaderState />
      <PublicHeaderBehavior />
      <Brand settings={settings} />
      <nav className="desktop-nav" aria-label="Primary">
        {navigation.map((n, navIndex) => (
          <details
            className="nav-menu"
            name="primary-navigation"
            data-nav-href={n.href}
            key={navIndex}
          >
            <summary>
              {n.title}
              <svg
                className="nav-chevron"
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="m4 6 4 4 4-4" />
              </svg>
            </summary>
            <div className="dropdown">
              <Link className="nav-overview" href={n.href}>
                {n.title} overview <span aria-hidden="true">↗</span>
              </Link>
              {n.links.map((label, i) => (
                <Link key={i} href={`${n.href}#section-${i}`}>
                  {label}
                  <span className="nav-link-arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </details>
        ))}
        <Link href={settings.contactHref} data-nav-href={settings.contactHref}>
          {settings.contactLabel}
        </Link>
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
        <summary>
          <PortalIcon name="menu" />
          <span>Menu</span>
        </summary>
        <nav aria-label="Mobile">
          {navigation.map((n, navIndex) => (
            <details
              key={navIndex}
              name="mobile-sections"
              data-nav-href={n.href}
            >
              <summary>
                {n.title}
                <svg
                  className="nav-chevron"
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="m4 6 4 4 4-4" />
                </svg>
              </summary>
              <Link className="nav-overview" href={n.href}>
                {n.title} overview <span aria-hidden="true">↗</span>
              </Link>
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
          {!actor && (
            <Link className="button" href="/join">
              {settings.joinLabel}
              <span aria-hidden="true">→</span>
            </Link>
          )}
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

export function PortalShell({
  actor,
  children,
}: {
  actor: Awaited<ReturnType<typeof currentActor>>;
  children: React.ReactNode;
}) {
  const staff = Boolean(actor?.roles.length);
  return (
    <PortalFrame staff={staff}>
      <div className="staff-content portal-content">
        <header className="workspace-topbar portal-topbar">
          <div className="portal-brand-row">
            <Brand />
            {deploymentEnvironment(process.env.TPA_DEPLOYMENT_ENV) && (
              <StatusBadge
                tone={
                  process.env.TPA_DEPLOYMENT_ENV === "testing"
                    ? "testing"
                    : process.env.TPA_DEPLOYMENT_ENV === "production"
                      ? "active"
                      : "neutral"
                }
              >
                {process.env.TPA_DEPLOYMENT_ENV}
              </StatusBadge>
            )}
          </div>
          <div className="portal-utilities">
            {staff && <WorkspaceSearch />}
            <AccountControls actor={actor} portal />
          </div>
        </header>
        <PortalNavigation
          groups={portalNavigation(actor?.roles ?? [])}
          staff={staff}
        />
        {children}
      </div>
    </PortalFrame>
  );
}
export async function Footer() {
  return <PublicFooter settings={await publishedSettings("shared")} />;
}
export function SiteShell({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: "v3";
}) {
  return (
    <div
      className={variant === "v3" ? "public-shell v3-landing" : "public-shell"}
    >
      <Header />
      {children}
      <Footer />
    </div>
  );
}
