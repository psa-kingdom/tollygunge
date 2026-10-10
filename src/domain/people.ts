import { record, text, uuid } from "./operations";
import {
  validateRich,
  richText,
  type RichNode,
  type ContentSize,
  size,
} from "./rich-content";
export const linkPlatforms = [
  "X",
  "Instagram",
  "Facebook",
  "GitHub",
  "Discord",
  "Medium",
  "LinkedIn",
  "Portfolio",
  "Website",
] as const;
export type Assignment = {
  groupId: string;
  role: string;
  term: string;
  label?: string;
  order: number;
};
export type PersonBody = {
  name: string;
  phone: string;
  organization: string;
  profession: string;
  jobTitle: string;
  city: string;
  biography: string;
  biographyRich?: RichNode;
  nameSize?: ContentSize;
  portraitId: string | null;
  portraitKind: "editorial" | "profile";
  links: { platform: string; label: string; url: string; public: boolean }[];
  assignments: Assignment[];
};
export type PersonEntry = {
  id: string;
  user_id: string | null;
  draft: PersonBody;
  accepted: PersonBody;
  published: PersonBody | null;
  version: number;
  status: string;
  accepted_verified: boolean;
  history?: {
    id: string;
    action: string;
    version: number;
    created_at: string;
  }[];
  reviews?: {
    id: string;
    body: PersonBody;
    baseline: PersonBody;
    status: string;
    reason: string;
    proposed_by: string;
    proposer_name?: string;
    reviewed_by: string | null;
    created_at: string;
  }[];
};
export type ProfileGroup = {
  id: string;
  parent_id: string | null;
  draft: { name: string; page: string; section: number; order: number };
  published: ProfileGroup["draft"] | null;
  archived: boolean;
  version: number;
};
export const emptyPerson: PersonBody = {
  name: "",
  phone: "",
  organization: "",
  profession: "",
  jobTitle: "",
  city: "",
  biography: "",
  portraitId: null,
  portraitKind: "editorial",
  links: [],
  assignments: [],
};
export function personBody(value: unknown): PersonBody {
  const p = record(value);
  const rich =
    p.biographyRich === undefined ? undefined : validateRich(p.biographyRich);
  const phone = text(p.phone ?? "", "Phone", 32);
  if (phone && !/^[+\d ().-]{5,32}$/.test(phone))
    throw Error("Check your phone number.");
  if (p.links !== undefined && !Array.isArray(p.links))
    throw Error("Invalid profile links.");
  const links = (p.links ?? []) as unknown[];
  if (links.length > 12) throw Error("Use up to 12 profile links.");
  const parsed = links.map((v) => {
    const l = record(v);
    const url = text(l.url, "Link URL", 1000, 1);
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password)
      throw Error("Use HTTPS links without credentials.");
    if (!linkPlatforms.includes(l.platform as (typeof linkPlatforms)[number]))
      throw Error("Choose a link platform.");
    if (typeof l.public !== "boolean") throw Error("Choose link visibility.");
    return {
      platform: String(l.platform),
      label: text(l.label ?? l.platform, "Link label", 60, 1),
      url: u.href,
      public: l.public,
    };
  });
  if (new Set(parsed.map((l) => l.url)).size !== parsed.length)
    throw Error("Remove duplicate profile links.");
  if (p.assignments !== undefined && !Array.isArray(p.assignments))
    throw Error("Invalid association assignments.");
  const assignments = ((p.assignments ?? []) as unknown[]).map((v) => {
    const a = record(v);
    const order = Number(a.order);
    if (!Number.isSafeInteger(order) || order < 0 || order > 999)
      throw Error("Use an order from 0 to 999.");
    return {
      groupId: uuid(a.groupId),
      role: text(a.role, "Association role", 120, 2),
      term: text(a.term ?? "", "Term", 80),
      ...(a.label ? { label: text(a.label, "Assignment label", 120) } : {}),
      order,
    };
  });
  if (
    assignments.length > 20 ||
    new Set(assignments.map((a) => a.groupId)).size !== assignments.length
  )
    throw Error("Use distinct groups, up to 20 assignments.");
  if (
    p.portraitKind !== undefined &&
    !["editorial", "profile"].includes(String(p.portraitKind))
  )
    throw Error("Invalid portrait category.");
  return {
    name: text(p.name, "Display name", 120, 2),
    phone,
    organization: text(p.organization ?? "", "Organization", 200),
    profession: text(p.profession ?? "", "Professional title", 160),
    jobTitle: text(p.jobTitle ?? "", "Job title", 120),
    city: text(p.city ?? "", "City", 120),
    biography: text(
      rich ? richText(rich) : (p.biography ?? ""),
      "Biography",
      20000,
    ),
    ...(rich ? { biographyRich: rich } : {}),
    ...(p.nameSize === undefined ? {} : { nameSize: size(p.nameSize) }),
    portraitId: p.portraitId ? uuid(p.portraitId) : null,
    portraitKind: (p.portraitKind ?? "editorial") as PersonBody["portraitKind"],
    links: parsed,
    assignments,
  };
}
export function publicPerson(body: PersonBody) {
  return {
    ...body,
    phone: "",
    links: body.links?.filter((l) => l.public) ?? [],
  };
}
export function redactPerson(body: PersonBody) {
  return { ...body, phone: "" };
}
export function groupBody(value: unknown) {
  const p = record(value);
  const section = Number(p.section),
    order = Number(p.order);
  if (
    !["about", "governance"].includes(String(p.page)) ||
    !Number.isInteger(section) ||
    section < 0 ||
    section > 2 ||
    !Number.isInteger(order) ||
    order < 0 ||
    order > 999
  )
    throw Error("Choose an existing About/Governance section and order 0–999.");
  return {
    name: text(p.name, "Group name", 120, 2),
    page: String(p.page),
    section,
    order,
  };
}
