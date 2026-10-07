export const sizes = ["small", "body", "large", "display"] as const;
export type ContentSize = (typeof sizes)[number];
export type RichNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichNode[];
};
export const contentLimits = {
  title: 160,
  intro: 3000,
  newsIntro: 1000,
  heading: 120,
  section: 20000,
  newsSection: 1500,
  newsSections: 2000,
  sections: 12,
  total: 100000,
  requestBytes: 1048576,
} as const;
export function size(value: unknown): ContentSize | undefined {
  if (value === undefined) return undefined;
  if (!sizes.includes(value as ContentSize))
    throw new Error("Choose an approved text size.");
  return value as ContentSize;
}
export function plainDocument(value: string): RichNode {
  return {
    type: "doc",
    content: value.split("\n").map((text) => ({
      type: "paragraph",
      ...(text ? { content: [{ type: "text", text }] } : {}),
    })),
  };
}
export function richText(node: RichNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  const separator = [
    "doc",
    "blockquote",
    "bulletList",
    "orderedList",
    "listItem",
    "table",
    "tableRow",
  ].includes(node.type)
    ? "\n"
    : "";
  return (node.content ?? []).map(richText).join(separator);
}
const children: Record<string, string[]> = {
  doc: [
    "paragraph",
    "heading",
    "blockquote",
    "bulletList",
    "orderedList",
    "table",
  ],
  paragraph: ["text", "hardBreak"],
  heading: ["text", "hardBreak"],
  blockquote: ["paragraph", "heading", "bulletList", "orderedList"],
  bulletList: ["listItem"],
  orderedList: ["listItem"],
  listItem: ["paragraph", "heading", "bulletList", "orderedList", "blockquote"],
  table: ["tableRow"],
  tableRow: ["tableCell", "tableHeader"],
  tableCell: [
    "paragraph",
    "heading",
    "bulletList",
    "orderedList",
    "blockquote",
  ],
  tableHeader: [
    "paragraph",
    "heading",
    "bulletList",
    "orderedList",
    "blockquote",
  ],
  text: [],
  hardBreak: [],
};
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("Invalid rich content.");
  return v as Record<string, unknown>;
}
function link(v: unknown) {
  if (typeof v !== "string" || v.length > 1000)
    throw new Error("Invalid content link.");
  const u = new URL(v);
  if (u.protocol !== "https:" || u.username || u.password)
    throw new Error("Content links must use HTTPS without credentials.");
  return u.href;
}
export function validateRich(value: unknown): RichNode {
  let count = 0;
  function visit(v: unknown, depth: number): RichNode {
    const n = object(v);
    if (
      ++count > 10000 ||
      depth > 20 ||
      typeof n.type !== "string" ||
      !Object.hasOwn(children, n.type)
    )
      throw new Error("Unsupported or overly complex rich content.");
    if (
      Object.keys(n).some(
        (k) => !["type", "text", "content", "attrs", "marks"].includes(k),
      )
    )
      throw new Error("Unsupported rich content property.");
    const out: RichNode = { type: n.type };
    if (n.text !== undefined) {
      if (
        n.type !== "text" ||
        typeof n.text !== "string" ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(n.text)
      )
        throw new Error("Invalid rich text.");
      out.text = n.text;
    }
    if (n.type === "text" && (!out.text || n.content !== undefined))
      throw new Error("Invalid text node.");
    if (n.attrs !== undefined) {
      const a = object(n.attrs),
        attrs: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(a)) {
        if (["paragraph", "heading"].includes(n.type) && k === "textAlign") {
          if (
            v !== null &&
            !["left", "center", "right", "justify"].includes(String(v))
          )
            throw new Error("Invalid alignment.");
          if (v !== null) attrs[k] = v;
        } else if (n.type === "heading" && k === "level") {
          if (![2, 3, 4].includes(Number(v)))
            throw new Error("Use section headings H2–H4.");
          attrs.level = Number(v);
        } else if (n.type === "orderedList" && k === "start") {
          if (!Number.isInteger(v) || Number(v) < 1 || Number(v) > 10000)
            throw new Error("Invalid list start.");
          attrs.start = v;
        } else if (n.type === "orderedList" && k === "type") {
          if (v !== null && !["1", "a", "A", "i", "I"].includes(String(v)))
            throw new Error("Invalid list numbering.");
          if (v !== null) attrs.type = v;
        } else if (
          ["tableCell", "tableHeader"].includes(n.type) &&
          k === "align"
        ) {
          if (v !== null && !["left", "center", "right"].includes(String(v)))
            throw new Error("Invalid cell alignment.");
          if (v !== null) attrs.align = v;
        } else if (
          ["tableCell", "tableHeader"].includes(n.type) &&
          ["colspan", "rowspan"].includes(k)
        ) {
          if (!Number.isInteger(v) || Number(v) < 1 || Number(v) > 12)
            throw new Error("Invalid table span.");
          attrs[k] = v;
        } else if (
          ["tableCell", "tableHeader"].includes(n.type) &&
          k === "colwidth"
        ) {
          if (
            v !== null &&
            (!Array.isArray(v) ||
              v.length > 12 ||
              v.some((w) => !Number.isInteger(w) || w < 20 || w > 1200))
          )
            throw new Error("Invalid column width.");
          attrs[k] = v;
        } else throw new Error("Unsupported rich content attribute.");
      }
      out.attrs = attrs;
    }
    if (n.type === "heading" && !out.attrs?.level)
      throw new Error("Heading level is required.");
    if (n.marks !== undefined) {
      if (n.type !== "text" || !Array.isArray(n.marks) || n.marks.length > 6)
        throw new Error("Invalid formatting.");
      out.marks = n.marks.map((m) => {
        const mark = object(m);
        if (Object.keys(mark).some((k) => !["type", "attrs"].includes(k)))
          throw new Error("Invalid mark.");
        if (
          ["bold", "italic", "underline", "strike"].includes(String(mark.type))
        ) {
          if (mark.attrs && Object.keys(object(mark.attrs)).length)
            throw new Error("Unsupported mark attributes.");
          return { type: String(mark.type) };
        }
        if (mark.type === "textStyle") {
          const a = object(mark.attrs);
          if (Object.keys(a).some((k) => k !== "size"))
            throw new Error("Unsupported text style.");
          return {
            type: "textStyle",
            attrs: {
              size: size(a.size === null ? undefined : a.size) ?? "body",
            },
          };
        }
        if (mark.type === "link") {
          const a = object(mark.attrs);
          if (
            Object.keys(a).some(
              (k) => !["href", "target", "rel", "class"].includes(k),
            ) ||
            (a.target !== undefined &&
              a.target !== null &&
              !["_blank", "_self"].includes(String(a.target))) ||
            (a.class !== undefined && a.class !== null)
          )
            throw new Error("Unsupported link attribute.");
          return {
            type: "link",
            attrs: {
              href: link(a.href),
              target: "_blank",
              rel: "noopener noreferrer",
            },
          };
        }
        throw new Error("Unsupported formatting.");
      });
    }
    if (n.content !== undefined) {
      if (!Array.isArray(n.content) || n.content.length > 10000)
        throw new Error("Invalid rich content children.");
      out.content = n.content.map((c) => visit(c, depth + 1));
      if (out.content.some((c) => !children[out.type].includes(c.type)))
        throw new Error("Invalid rich content structure.");
    }
    if (
      ["table", "tableRow"].includes(n.type) &&
      (out.content?.length ?? 0) > (n.type === "table" ? 20 : 12)
    )
      throw new Error("Tables support up to 20 rows and 12 columns.");
    if (
      !["text", "hardBreak", "paragraph"].includes(n.type) &&
      !out.content?.length
    )
      throw new Error("Empty rich structure.");
    return out;
  }
  const doc = visit(value, 0);
  if (doc.type !== "doc") throw new Error("Rich content must be a document.");
  return doc;
}
