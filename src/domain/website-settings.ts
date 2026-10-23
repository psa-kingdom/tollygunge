import { record, text, uuid } from "./operations";
import { homeDefaults } from "./website-home";
const sharedBaseDefaults = {
  organisation: "TOLLYGUNGE\nPROFESSIONAL ASSOCIATION",
  brandMark: "tpa·",
  logoMediaId: "",
  logoAlt: "TPA",
  defaultTitle: "TPA — A community for what comes next",
  defaultDescription:
    "Tollygunge Professional Association. Connect, learn, collaborate, grow and contribute.",
  titleSuffix: "TPA",
  biographyHeading: "About {name}",
  contactLabel: "Contact",
  contactHref: "/contact",
  loginLabel: "Member login",
  joinLabel: "Join TPA",
  navigation: [
    {
      title: "About",
      href: "/about",
      links: ["About TPA", "Vision & Mission", "Founding Members"],
    },
    {
      title: "Governance",
      href: "/governance",
      links: [
        "Executive Committee",
        "Sub-Committees",
        "Constitution & Bye-Laws",
      ],
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
  ],
  footer: {
    tagline: "Connect. Learn. Collaborate.\nGrow. Contribute.",
    exploreTitle: "EXPLORE",
    contactTitle: "GET IN TOUCH",
    location: "Tollygunge · Kolkata, India",
    copyrightName: "Tollygunge Professional Association",
    closing: "A shared commitment to progress.",
    links: [
      { label: "Our association", href: "/about" },
      { label: "Become a member", href: "/membership" },
      { label: "Events & learning", href: "/events" },
    ],
    contactLabel: "Contact the secretariat ↗",
    contactHref: "/contact",
  },
};
export type FooterGroup = { title: string; links: { label: string; href: string }[] };
export type SharedSettings = typeof sharedBaseDefaults & { footer: typeof sharedBaseDefaults.footer & { groups?: FooterGroup[] } };
export const sharedDefaults: SharedSettings = sharedBaseDefaults;
export const defaultFooterGroups: FooterGroup[] = [
  {title:"Association",links:[{label:"About TPA",href:"/about"},{label:"Governance",href:"/governance"},{label:"Membership",href:"/membership"}]},
  {title:"Explore",links:[{label:"Events",href:"/events"},{label:"Insights",href:"/resources#section-0"},{label:"Downloads",href:"/resources#section-2"},{label:"Important links",href:"/resources#section-3"}]},
  {title:"Connect",links:[{label:"Contact",href:"/contact"},{label:"Member login",href:"/login"},{label:"Join TPA",href:"/join"},{label:"Newsletter subscription",href:"/#subscribe"}]},
];
export function footerGroups(footer: SharedSettings["footer"]): FooterGroup[] {
  if (footer.groups) return footer.groups;
  const defaults = JSON.stringify(footer.links) === JSON.stringify(sharedDefaults.footer.links);
  return [
    defaults ? {...defaultFooterGroups[0],title:footer.exploreTitle===sharedDefaults.footer.exploreTitle?defaultFooterGroups[0].title:footer.exploreTitle} : {title:footer.exploreTitle,links:footer.links},
    defaultFooterGroups[1],
    {...defaultFooterGroups[2],title:footer.contactTitle===sharedDefaults.footer.contactTitle?defaultFooterGroups[2].title:footer.contactTitle,links:[{label:footer.contactLabel,href:footer.contactHref},...defaultFooterGroups[2].links.slice(1)]},
  ];
}
export const websiteDefaults = { shared: sharedDefaults, home: homeDefaults };
export type SettingsKey = keyof typeof websiteDefaults;
export function websiteLink(value: unknown) {
  const link = text(value, "Link", 1000, 1);
  if (/^\/(?!\/)[^\\\s]*$/.test(link) || /^#[a-zA-Z0-9_-]+$/.test(link))
    return link;
  const url = new URL(link);
  if (url.protocol !== "https:" || url.username || url.password)
    throw Error(
      "Use a website path, section anchor or HTTPS link without credentials.",
    );
  return url.href;
}
type Tree = string | Tree[] | { [key: string]: Tree };
export function settingsBody(
  key: SettingsKey,
  value: unknown,
): (typeof websiteDefaults)[SettingsKey] {
  if (!Object.hasOwn(websiteDefaults, key))
    throw Error("Choose website settings or homepage.");
  function parse(shape: Tree, input: unknown, path: string): Tree {
    if (typeof shape === "string") {
      const result = text(input, path, 3000);
      if (/(?:href|link)$/i.test(path)) return websiteLink(result);
      if (path.endsWith("logoMediaId") && result) uuid(result);
      if (typeof input !== "string" || input.length > 3000)
        throw Error("Use text up to 3,000 characters.");
      return input;
    }
    if (Array.isArray(shape)) {
      if (!Array.isArray(input) || input.length !== shape.length)
        throw Error("Preserve the existing layout slots.");
      return shape.map((s, i) => parse(s, input[i], path + "." + i));
    }
    const object = record(input);
    return Object.fromEntries(
      Object.entries(shape).map(([name, s]) => [
        name,
        parse(s, object[name], path ? path + "." + name : name),
      ]),
    );
  }
  const result = parse(
    websiteDefaults[key] as Tree,
    value,
    "",
  ) as (typeof websiteDefaults)[SettingsKey];
  if (key === "shared") {
    const body = result as SharedSettings;
    const footer = record(record(value).footer);
    if (footer.groups !== undefined) {
      if (!Array.isArray(footer.groups) || footer.groups.length < 1 || footer.groups.length > 6) throw Error("Use one to six footer groups.");
      body.footer.groups = footer.groups.map(value => {
        const group = record(value);
        if (!Array.isArray(group.links) || group.links.length < 1 || group.links.length > 12) throw Error("Use one to twelve links per footer group.");
        return { title: text(group.title,"Footer group title",80,1), links:group.links.map(value => {const link=record(value);return {label:text(link.label,"Footer link label",100,1),href:websiteLink(link.href)};}) };
      });
    }
    if (
      !body.organisation.trim() ||
      !body.brandMark.trim() ||
      !body.biographyHeading.trim()
    )
      throw Error("Organisation, brand and biography heading are required.");
    if (
      body.biographyHeading.length > 160 ||
      /[{}]/.test(body.biographyHeading.replaceAll("{name}", ""))
    )
      throw Error(
        "The biography heading supports only {name}, up to 160 characters.",
      );
  }
  return result;
}
export function biographyHeading(
  name: string,
  override?: string,
  template = "About {name}",
) {
  return override?.trim() || template.replaceAll("{name}", name);
}
export function resourceBody(value: unknown, kind: string) {
  const r = record(value),
    order = Number(r.order ?? 0);
  if (!Number.isSafeInteger(order) || order < 0 || order > 9999)
    throw Error("Use an order between 0 and 9999.");
  const fileId = r.fileId ? uuid(r.fileId) : null,
    url = r.url ? websiteLink(r.url) : "";
  if (kind === "link" && (!url || fileId))
    throw Error("Important links require a URL.");
  if (kind === "document" && fileId && url)
    throw Error("Choose one PDF or document link.");
  return {
    title: text(r.title, "Title", 160, 2),
    description: text(r.description ?? "", "Description", 2000),
    order,
    url,
    fileId,
  };
}
