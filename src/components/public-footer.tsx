import Link from "./navigation-link";
import { TpaLogo } from "./tpa-logo";
import { footerGroups, type SharedSettings } from "@/domain/website-settings";
import { releaseVersion } from "@/domain/release";
import { ReportIssueLink } from "./report-issue-link";

export function PublicFooter({
  settings,
  preview = false,
  showDownloads = true,
}: {
  settings: SharedSettings;
  preview?: boolean;
  showDownloads?: boolean;
}) {
  const footer = settings.footer;
  const groups = footerGroups(footer);
  const archiveLinks = [
    { label: "Blogs", href: "/blogs" },
    { label: "Media", href: "/media" },
  ].filter((link) => !groups.some((group) => group.links.some((existing) => existing.href === link.href)));
  const archiveGroupIndex = groups.findIndex((group) => group.title.toLowerCase() === "explore");
  return (
    <footer className="site-footer footer-complete">
      <div className="footer-identity">
        <Link
          href="/"
          className="brand"
          aria-label={`${settings.organisation.replace(/\s+/g, " ").trim()} homepage`}
          prefetch={preview ? false : undefined}
        >
          <TpaLogo
            src={
              settings.logoMediaId
                ? `/media/${settings.logoMediaId}`
                : undefined
            }
            alt={
              settings.logoMediaId
                ? settings.logoAlt
                : "Tollygunge Professional Association logo"
            }
          />
          <span
            data-cms-field={preview ? "organisation" : undefined}
            className="brand-name"
            style={{ whiteSpace: "pre-line" }}
          >
            {settings.organisation}
          </span>
        </Link>
        <p
          data-cms-field={preview ? "footer.tagline" : undefined}
          style={{ whiteSpace: "pre-line" }}
        >
          {footer.tagline}
        </p>
      </div>
      <nav className="footer-groups" aria-label="Footer">
        {groups.map((group, index) => (
          <div className="footer-group" key={index}>
            <h2
              data-cms-field={
                preview ? `footer.groups.${index}.title` : undefined
              }
            >
              {group.title}
            </h2>
            <ul>
              {group.links.map((link, linkIndex) => (showDownloads || link.href !== "/resources#section-2") && (
                <li key={linkIndex}>
                  <Link
                    data-cms-field={
                      preview
                        ? `footer.groups.${index}.links.${linkIndex}.label`
                        : undefined
                    }
                    href={link.href}
                    prefetch={preview ? false : undefined}
                  >
                    {link.label.replace(/[→↗←↓]/g, "").trim()}
                  </Link>
                </li>
              ))}
              {index === (archiveGroupIndex < 0 ? 0 : archiveGroupIndex) && archiveLinks.map((link) => (
                <li key={link.href}><Link href={link.href}>{link.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} {footer.copyrightName}
        </span>
        <span>{footer.location}</span>
        <span>{footer.closing}</span>
      </div>
      <nav className="footer-utility" aria-label="Website support">
        <Link href="/privacy">Privacy</Link>
        <ReportIssueLink />
        <span>Version {releaseVersion}</span>
      </nav>
    </footer>
  );
}
