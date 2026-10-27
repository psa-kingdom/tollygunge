import Link from "./navigation-link";
import { TpaLogo } from "./tpa-logo";
import { footerGroups, type SharedSettings } from "@/domain/website-settings";

export function PublicFooter({settings,preview=false}:{settings:SharedSettings;preview?:boolean}) {
  const footer=settings.footer;
  return <footer className="site-footer footer-complete">
    <div className="footer-identity">
      <Link href="/" className="brand" aria-label={`${settings.organisation.replace(/\s+/g," ").trim()} homepage`} prefetch={preview?false:undefined}>
        <TpaLogo src={settings.logoMediaId?`/media/${settings.logoMediaId}`:undefined} alt={settings.logoMediaId?settings.logoAlt:"Tollygunge Professional Association logo"}/>
        <span className="brand-name" style={{whiteSpace:"pre-line"}}>{settings.organisation}</span>
      </Link>
      <p style={{whiteSpace:"pre-line"}}>{footer.tagline}</p>
    </div>
    <nav className="footer-groups" aria-label="Footer">
      {footerGroups(footer).map((group,index)=><div className="footer-group" key={index}>
        <h2>{group.title}</h2>
        <ul>{group.links.map((link,index)=><li key={index}><Link href={link.href} prefetch={preview?false:undefined}>{link.label}</Link></li>)}</ul>
      </div>)}
    </nav>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} {footer.copyrightName}</span><span>{footer.location}</span><span>{footer.closing}</span></div>
  </footer>;
}
