import { PublicEventPopup } from "./public-event-popup";
import Link from "./navigation-link";
import { currentActor } from "@/lib/actor";
import { AccountControls } from "./account-controls";
import { StickyHeaderState } from "./sticky-header-state";
import { publishedSettings, publicNavigation, publishedResources } from "@/lib/website-content";
import { sharedDefaults, type SharedSettings } from "@/domain/website-settings";
import { TpaLogo } from "./tpa-logo";
import { PublicFooter } from "./public-footer";
import { portalNavigation } from "@/domain/portal-navigation";
import { PortalNavigation } from "./portal-navigation";
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
    title: "Media",
    href: "/resources",
    links: ["Insights", "Gallery", "Downloads", "Important Links"],
  },
];
export function Brand({
  settings = sharedDefaults,
  compact = false,
}: { settings?: SharedSettings; compact?: boolean } = {}) {
  const organisation = settings.organisation.replace(/\s+/g, " ").trim();
  const showWordmark =
    !compact &&
    organisation.toLowerCase() === "tollygunge professional association";

  return (
    <Link
      href="/"
      className="brand"
      aria-label={`${organisation} homepage`}
    >
      <TpaLogo
        src={
          settings.logoMediaId ? `/media/${settings.logoMediaId}` : undefined
        }
      />
      {showWordmark ? (
        <span className="brand-wordmark">
          <span className="brand-wordmark-name">Tollygunge</span>
          <span className="brand-wordmark-description">Professional Association</span>
        </span>
      ) : (
        <span className="brand-name" style={{ whiteSpace: "pre-line" }}>
          {compact ? "TPA" : settings.organisation}
        </span>
      )}
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
        {navigation.map((n) => (
          <Link key={n.href} href={n.href} data-nav-href={n.href}>
            {n.title}
          </Link>
        ))}
        <Link href={settings.contactHref} data-nav-href={settings.contactHref}>
          {settings.contactLabel}
        </Link>
      </nav>
      <div className="header-actions">
        <Link href={actor ? "/account" : "/login"} className="login-link">
          {actor
            ? actor.roles.length
              ? "Staff workspace "
              : "Your account "
            : `${settings.loginLabel.replace(/[→↗←↓]/g, "").trim()}`}
        </Link>
        {!actor && (
          <Link className="button small" href="/join">
            {settings.joinLabel}
          </Link>
        )}
        <AccountControls actor={actor} portal />
      </div>
      <details className="mobile-nav">
        <summary>
          <PortalIcon name="menu" />
          <span>Menu</span>
        </summary>
        <nav aria-label="Mobile">
          {navigation.map((n) => (
            <Link key={n.href} href={n.href} data-nav-href={n.href}>
              {n.title}
            </Link>
          ))}
          <Link href={settings.contactHref}>{settings.contactLabel}</Link>
          <Link href={actor ? "/account" : "/login"}>
            {actor ? "Your workspace" : settings.loginLabel}
          </Link>
          {!actor && (
            <Link className="button" href="/join">
              {settings.joinLabel}

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
            <Brand compact />
          </div>
          <PortalNavigation
            groups={portalNavigation(actor?.roles ?? [])}
            staff={staff}
          />
          <div className="portal-utilities">
            {staff && <WorkspaceSearch />}
            <AccountControls actor={actor} portal />
          </div>
        </header>
        {children}
      </div>
    </PortalFrame>
  );
}
export async function Footer() {
  const [settings, downloads] = await Promise.all([publishedSettings("shared"), publishedResources("document")]);
  return <PublicFooter settings={settings} showDownloads={downloads.length > 0} />;
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
      <PublicEventPopup />
      {children}
      <Footer />
    </div>
  );
}
