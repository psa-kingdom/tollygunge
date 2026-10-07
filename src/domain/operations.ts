import {
  contentLimits,
  validateRich,
  richText,
  size,
  type RichNode,
  type ContentSize,
} from "./rich-content";
export const pageSlugs = [
  "about",
  "governance",
  "membership",
  "events",
  "resources",
  "contact",
] as const;
export const pageSections: Record<string, string[]> = {
  about: ["About TPA", "Vision & Mission", "Founding Members"],
  governance: [
    "Executive Committee",
    "Sub-Committees",
    "Constitution & Bye-Laws",
  ],
  membership: ["Why Become a Member", "Membership Plans", "Renew Membership"],
  events: ["Upcoming Events", "Past Events", "Event Registration"],
  resources: ["Insights", "Media", "Downloads", "Important Links"],
  contact: ["Contact TPA", "Office / Secretariat", "Location", "Enquiry"],
};
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Provide valid details.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, label: string, max: number, min = 0) {
  if (typeof value !== "string") throw new Error(`${label} is required.`);
  const result = value.trim();
  if (
    result.length < min ||
    result.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result)
  )
    throw new Error(`Check ${label.toLowerCase()}.`);
  return result;
}
export function uuid(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new Error("Invalid record identifier.");
  return value;
}
export function version(value: unknown) {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < 0 ||
    Number(value) > 2147483646
  )
    throw new Error("Invalid version.");
  return Number(value);
}
export function webLink(value: unknown, required = false) {
  const source = text(value ?? "", "Source link", 1000, required ? 1 : 0);
  if (!source) return "";
  const url = new URL(source);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Use an HTTPS source link without credentials.");
  return url.href;
}
export function instant(value: unknown) {
  if (typeof value !== "string")
    throw new Error("Provide an ISO timestamp with timezone.");
  const parts =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!parts) throw new Error("Provide an ISO timestamp with timezone.");
  const [year, month, day, hour, minute, second] = parts.slice(1).map(Number),
    date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    throw new Error("Invalid calendar timestamp.");
  const result = new Date(value);
  if (!Number.isFinite(result.getTime())) throw new Error("Invalid timestamp.");
  return result;
}
export type ContentBody = {
  title: string;
  intro: string;
  formatVersion?: 1;
  introRich?: RichNode;
  titleSize?: ContentSize;
  sections: {
    title: string;
    text: string;
    rich?: RichNode;
    titleSize?: ContentSize;
  }[];
  sourceUrl: string;
  attribution: string;
};
export function content(value: unknown, kind: string): ContentBody {
  const input = record(value);
  if (
    !Array.isArray(input.sections) ||
    input.sections.length < 1 ||
    input.sections.length > contentLimits.sections
  )
    throw new Error("Use up to 12 sections.");
  const sections = input.sections.map((section) => {
    const s = record(section);
    const rich = s.rich === undefined ? undefined : validateRich(s.rich);
    return {
      title: text(s.title, "Section title", contentLimits.heading, 1),
      text: text(
        rich ? richText(rich) : s.text,
        "Section text",
        kind === "news" ? contentLimits.newsSection : contentLimits.section,
        1,
      ),
      ...(rich ? { rich } : {}),
      ...(s.titleSize !== undefined ? { titleSize: size(s.titleSize) } : {}),
    };
  });
  if (kind === "news" && sections.reduce((n, s) => n + s.text.length, 0) > 2000)
    throw new Error("News must be a short attributed summary.");
  if (input.formatVersion !== undefined && input.formatVersion !== 1)
    throw new Error("Unsupported content format.");
  const introRich =
    input.introRich === undefined ? undefined : validateRich(input.introRich);
  if ((introRich || sections.some((s) => s.rich)) && input.formatVersion !== 1)
    throw new Error("Rich content needs format version 1.");
  const title = text(input.title, "Title", contentLimits.title, 3);
  const intro = text(
    introRich ? richText(introRich) : input.intro,
    "Introduction",
    kind === "news" ? contentLimits.newsIntro : contentLimits.intro,
  );
  if (
    title.length +
      intro.length +
      sections.reduce((n, s) => n + s.title.length + s.text.length, 0) >
    contentLimits.total
  )
    throw new Error("Entry exceeds 100,000 characters.");
  return {
    title,
    intro,
    ...(input.formatVersion === 1 ? { formatVersion: 1 as const } : {}),
    ...(introRich ? { introRich } : {}),
    ...(input.titleSize !== undefined
      ? { titleSize: size(input.titleSize) }
      : {}),
    sections,
    sourceUrl: webLink(input.sourceUrl, kind === "news"),
    attribution: text(
      input.attribution ?? "",
      "Attribution",
      200,
      kind === "news" ? 1 : 0,
    ),
  };
}
export function contentInput(value: unknown) {
  const input = record(value),
    kind = String(input.kind);
  if (!["page", "insight", "news"].includes(kind))
    throw new Error("Choose a content type.");
  const slug = text(input.slug, "Slug", 100, 1);
  if (
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ||
    (kind === "page" && !pageSlugs.includes(slug as (typeof pageSlugs)[number]))
  )
    throw new Error("Invalid page slug.");
  const body = content(input.body, kind);
  if (
    kind === "page" &&
    (body.sections.length !== pageSections[slug].length ||
      body.sections.some((s, i) => s.title !== pageSections[slug][i]))
  )
    throw new Error("Preserve the website submenu sections and order.");
  return {
    id: input.id ? uuid(input.id) : undefined,
    version: version(input.version),
    kind,
    slug,
    body,
  };
}
export function applicationInput(value: unknown) {
  const input = record(value),
    details = record(input.details);
  if (
    !["Annual", "Life", "Patron"].includes(String(input.plan)) ||
    !["Professional", "Student"].includes(String(input.category))
  )
    throw new Error("Choose your plan and category.");
  if (!Array.isArray(input.documentIds) || input.documentIds.length > 10)
    throw new Error("Select up to 10 private documents.");
  const names = [
    "fullName",
    "phone",
    "organization",
    "qualification",
    "institution",
    "address",
  ] as const;
  const result = Object.fromEntries(
    names.map((name) => [
      name,
      text(details[name] ?? "", name, name === "address" ? 1000 : 200),
    ]),
  );
  return {
    plan: String(input.plan),
    category: String(input.category),
    details: result,
    documentIds: [...new Set(input.documentIds.map(uuid))],
    version: version(input.version),
  };
}
export function eventInput(value: unknown) {
  const input = record(value),
    starts = instant(input.startsAt),
    ends = instant(input.endsAt);
  if (
    !Number.isFinite(starts.getTime()) ||
    !Number.isFinite(ends.getTime()) ||
    ends <= starts ||
    ends.getTime() - starts.getTime() > 7 * 86400000
  )
    throw new Error("Check the event start and end times.");
  if (
    !Number.isInteger(input.capacity) ||
    Number(input.capacity) < 1 ||
    Number(input.capacity) > 10000
  )
    throw new Error("Capacity must be between 1 and 10,000.");
  // Paid events and learning-hour awards cannot be enabled through extra client fields.
  if (input.price || input.learningHours)
    throw new Error(
      "Payments and learning-hour awards await approved configuration.",
    );
  return {
    id: input.id ? uuid(input.id) : undefined,
    version: version(input.version),
    title: text(input.title, "Title", 160, 3),
    description: text(input.description, "Description", 6000),
    location: text(input.location, "Location", 200, 1),
    startsAt: starts.toISOString(),
    endsAt: ends.toISOString(),
    capacity: Number(input.capacity),
  };
}
