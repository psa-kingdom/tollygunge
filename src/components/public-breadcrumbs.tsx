import Link from "next/link";
export function PublicBreadcrumbs({ section, href, title }: { section: string; href: string; title: string }) {
  return <nav aria-label="Breadcrumb" className="public-breadcrumbs"><ol><li><Link href="/">Home</Link></li><li><Link href={href}>{section}</Link></li><li aria-current="page">{title}</li></ol></nav>;
}
