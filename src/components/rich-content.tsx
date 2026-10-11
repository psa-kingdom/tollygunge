import { createElement, Fragment, type ReactNode } from "react";
import type { RichNode } from "@/domain/rich-content";
export function RichContent({
  document,
  text,
}: {
  document?: RichNode;
  text: string;
}) {
  if (!document) return <p className="prose-text">{text}</p>;
  function render(n: RichNode, key: number): ReactNode {
    if (n.type === "text") {
      let value: ReactNode = n.text;
      for (const m of n.marks ?? []) {
        if (m.type === "link")
          value = (
            <a
              href={String(m.attrs?.href)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {value}
            </a>
          );
        else if (m.type === "textStyle")
          value = (
            <span className={`content-size-${m.attrs?.size ?? "body"}`}>
              {value}
            </span>
          );
        else
          value = createElement(
            (
              {
                bold: "strong",
                italic: "em",
                underline: "u",
                strike: "s",
              } as Record<string, string>
            )[m.type] ?? "span",
            null,
            value,
          );
      }
      return <Fragment key={key}>{value}</Fragment>;
    }
    const inner = n.content?.map(render);
    if (n.type === "doc") return <Fragment key={key}>{inner}</Fragment>;
    if (n.type === "hardBreak") return <br key={key} />;
    const tags: Record<string, string> = {
      paragraph: "p",
      blockquote: "blockquote",
      bulletList: "ul",
      orderedList: "ol",
      listItem: "li",
      table: "table",
      tableRow: "tr",
      tableCell: "td",
      tableHeader: "th",
    };
    const tag = n.type === "heading" ? `h${n.attrs?.level ?? 2}` : tags[n.type];
    if (!tag) return null;
    const props: Record<string, unknown> = { key };
    if (n.attrs?.textAlign) props.style = { textAlign: n.attrs.textAlign };
    if (n.type === "orderedList") {
      props.start = n.attrs?.start;
      props.type = n.attrs?.type;
    }
    if (["tableCell", "tableHeader"].includes(n.type)) {
      if (n.attrs?.align) props.style = { textAlign: n.attrs.align };
      props.colSpan = n.attrs?.colspan;
      props.rowSpan = n.attrs?.rowspan;
    }
    if (n.type === "table") {
      const columns = Math.max(
        ...(n.content ?? []).map((row) =>
          (row.content ?? []).reduce(
            (total, cell) => total + Number(cell.attrs?.colspan ?? 1),
            0,
          ),
        ),
      );
      props.style = { minWidth: Math.max(320, columns * 96) };
    }
    const element = createElement(
      tag,
      props,
      n.type === "table" ? <tbody>{inner}</tbody> : inner,
    );
    return n.type === "table" ? (
      <div className="content-table-scroll" key={key}>
        {element}
      </div>
    ) : (
      element
    );
  }
  return <div className="rich-prose">{render(document, 0)}</div>;
}
