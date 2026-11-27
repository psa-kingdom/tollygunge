import type { ContentBody } from "./operations";
import { homeFieldLabels } from "./website-home";
export type CmsField = {
  id: string;
  label: string;
  group: string;
  path: string[];
  type: "text" | "rich" | "image" | "link";
  value: string;
  altPath?: string[];
  selector?: string;
  linkPath?: string[];
};
export const friendly = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/Media Id$/, "image")
    .replace(/^./, (c) => c.toUpperCase());
export function pageFields(body: ContentBody): CmsField[] {
  const field = (
    id: string,
    label: string,
    group: string,
    type: CmsField["type"],
    value: string,
    extra: Partial<CmsField> = {},
  ): CmsField => ({
    id,
    label,
    group,
    type,
    value,
    path: id.split("."),
    ...extra,
  });
  return [
    field("label", "Page label", "Page introduction", "text", body.label || ""),
    field("title", "Page heading", "Page introduction", "text", body.title),
    field("intro", "Introduction", "Page introduction", "rich", body.intro),
    field(
      "heroMediaId",
      "Page image",
      "Page introduction",
      "image",
      body.heroMediaId || "",
      { altPath: ["heroAlt"], selector: ".page-heading-art" },
    ),
    ...body.sections.flatMap((s, i) => [
      field(`sections.${i}.title`, "Heading", s.title, "text", s.title),
      field(`sections.${i}.text`, "Body text", s.title, "rich", s.text),
      field(
        `sections.${i}.mediaId`,
        "Section image",
        s.title,
        "image",
        s.mediaId || "",
        {
          altPath: ["sections", String(i), "mediaAlt"],
          selector: `#section-${i} .public-section-body > img`,
        },
      ),
    ]),
  ];
}
export function settingFields(
  value: unknown,
  kind: "home" | "shared",
): CmsField[] {
  const fields: CmsField[] = [];
  function walk(node: unknown, path: string[]) {
    if (typeof node === "string") {
      const key = path.at(-1)!;
      if (key === "heroAlt" || key === "logoAlt") return;
      if (kind === "home" && path[0] === "media") return;
      if (
        kind === "home" &&
        path[0] === "copy" &&
        /^(eyebrow09|communityGuide|guide|valuesStrip25|eyebrow36|textLink38|button43|section45|section46)/.test(
          key,
        )
      )
        return;
      if (
        kind === "home" &&
        path[0] === "links" &&
        /^(guideLinks|textLink07Href)/.test(key)
      )
        return;
      const label =
        homeFieldLabels[key] ||
        path
          .map((p) => (/^\d+$/.test(p) ? String(Number(p) + 1) : friendly(p)))
          .join(" · ");
      const image = key.endsWith("MediaId");
      fields.push({
        id: path.join("."),
        path,
        label,
        group:
          kind === "home"
            ? homeFieldLabels[key]?.split(" · ")[0] || friendly(path[0])
            : friendly(path[0]),
        type: image ? "image" : /(?:href|link)$/i.test(key) ? "link" : "text",
        value: node,
        ...(() => {
          if (
            kind === "shared" &&
            ["label", "title"].includes(key) &&
            getCmsValue(value, [...path.slice(0, -1), "href"])
          )
            return { linkPath: [...path.slice(0, -1), "href"] };
          const links: Record<string, string> = {
            button06: "button01Href",
            textLink07: "textLink02Href",
            textLink35: "textLink06Href",
            section47: "section09Href",
            section48: "section10Href",
            section49: "section11Href",
          };
          if (path[0] === "copy" && links[key])
            return { linkPath: ["links", links[key]] };
          if (path[0] === "cards" && key === "cta")
            return { linkPath: [...path.slice(0, -1), "link"] };
          if (path[0] === "membershipContent" && key === "button")
            return {
              linkPath: [
                "links",
                path[2] === "1" ? "button01Href" : "button08Href",
              ],
            };
          return {};
        })(),
        ...(image
          ? {
              altPath:
                key === "logoMediaId" ? ["logoAlt"] : ["images", "heroAlt"],
              selector: key === "logoMediaId" ? ".brand img" : ".hero img",
            }
          : {}),
      });
    } else if (node && typeof node === "object")
      Object.entries(node).forEach(([key, v]) => walk(v, [...path, key]));
  }
  walk(value, []);
  return fields;
}
export function setCmsValue<T>(
  value: T,
  path: readonly string[],
  next: unknown,
): T {
  const clone = structuredClone(value);
  let cursor = clone as Record<string, unknown>;
  for (const part of path.slice(0, -1))
    cursor = cursor[part] as Record<string, unknown>;
  cursor[path.at(-1)!] = next;
  return clone;
}
export function getCmsValue(value: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>(
    (node, key) => (node as Record<string, unknown>)?.[key],
    value,
  );
}
