import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RichContent } from "../src/components/rich-content";
import { validateRich } from "../src/domain/rich-content";
test("public rich rendering escapes text and preserves approved formatting, table and heading semantics", () => {
  const doc = validateRich({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 3, textAlign: "center" },
        content: [{ type: "text", text: "Learning" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "<script>alert(1)</script>",
            marks: [
              { type: "bold" },
              { type: "underline" },
              { type: "textStyle", attrs: { size: "large" } },
              { type: "link", attrs: { href: "https://example.org" } },
            ],
          },
        ],
      },
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              {
                type: "tableHeader",
                attrs: {
                  colspan: 1,
                  rowspan: 1,
                  colwidth: null,
                  align: "center",
                },
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Topic" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  const html = renderToStaticMarkup(
    createElement(RichContent, { document: doc, text: "untrusted projection" }),
  );
  assert.ok(html.includes('<h3 style="text-align:center">Learning</h3>'));
  assert.ok(html.includes("content-size-large"));
  assert.ok(html.includes("<strong>"));
  assert.ok(html.includes("<u>"));
  assert.ok(html.includes('rel="noopener noreferrer"'));
  assert.ok(html.includes("<table style="));
  assert.ok(html.includes('colSpan="1"'));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("untrusted projection"));
});
