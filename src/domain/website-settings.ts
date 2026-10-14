import { record, text, uuid } from "./operations";
import { homeDefaults } from "./website-home";
export const sharedDefaults = {
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
export type SharedSettings = typeof sharedDefaults;
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
