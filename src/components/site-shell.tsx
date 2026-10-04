import Link from "next/link";
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
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="TPA home">
      <span className="brand-mark">
        tpa<span>·</span>
      </span>
      <span className="brand-name">
        TOLLYGUNGE
        <br />
        PROFESSIONAL ASSOCIATION
      </span>
    </Link>
  );
}
export function Header() {
  return (
    <header className="site-header">
      <Brand />
      <nav className="desktop-nav" aria-label="Primary">
        {navigation.map((n) => (
          <details className="nav-menu" name="primary-navigation" key={n.title}>
            <summary>
              {n.title}
              <span>⌄</span>
            </summary>
            <div className="dropdown">
              {n.links.map((label, i) => (
                <Link key={label} href={`${n.href}#section-${i}`}>
                  {label}
                </Link>
              ))}
            </div>
          </details>
        ))}
        <Link href="/contact">Contact</Link>
      </nav>
      <div className="header-actions">
        <Link href="/login" className="login-link">
          Member login ↗
        </Link>
        <Link className="button small" href="/join">
          Join TPA <span>→</span>
        </Link>
      </div>
      <details className="mobile-nav">
        <summary>Menu</summary>
        <nav aria-label="Mobile">
          {navigation.map((n) => (
            <details key={n.title} name="mobile-sections">
              <summary>{n.title}</summary>
              {n.links.map((label, i) => (
                <Link key={label} href={`${n.href}#section-${i}`}>
                  {label}
                </Link>
              ))}
            </details>
          ))}
          <Link href="/contact">Contact</Link>
          <Link href="/login">Member login</Link>
        </nav>
      </details>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <Brand />
        <p>
          Connect. Learn. Collaborate.
          <br />
          Grow. Contribute.
        </p>
      </div>
      <div>
        <span className="eyebrow">EXPLORE</span>
        <Link href="/about">Our association</Link>
        <Link href="/membership">Become a member</Link>
        <Link href="/events">Events & learning</Link>
      </div>
      <div>
        <span className="eyebrow">GET IN TOUCH</span>
        <Link href="/contact">Contact the secretariat ↗</Link>
        <span>Tollygunge · Kolkata, India</span>
      </div>
      <div className="footer-bottom">
        © {new Date().getFullYear()} Tollygunge Professional Association
        <span>A shared commitment to progress.</span>
      </div>
    </footer>
  );
}
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
