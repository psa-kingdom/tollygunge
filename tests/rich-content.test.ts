import test from "node:test";
import assert from "node:assert/strict";
import { content, contentInput, pageSections } from "../src/domain/operations";
import {
  plainDocument,
  richText,
  validateRich,
  contentLimits,
  type RichNode,
} from "../src/domain/rich-content";
const base = {
  title: "Association update",
  intro: "An introduction",
  sections: [{ title: "Context", text: "Existing text" }],
  sourceUrl: "",
  attribution: "",
};
test("rich content derives compatibility text; old documents and sitemap sections remain readable", () => {
  assert.equal(content(base, "insight").sections[0].text, "Existing text");
  const rich: RichNode = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 3, textAlign: "center" },
        content: [
          {
            type: "text",
            text: "Professional learning",
            marks: [
              { type: "bold" },
              { type: "textStyle", attrs: { size: "large" } },
            ],
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "A safe link",
            marks: [
              {
                type: "link",
                attrs: {
                  href: "https://example.org",
                  target: "_blank",
                  rel: "noopener noreferrer",
                  class: null,
                },
              },
            ],
          },
        ],
      },
    ],
  };
  const value = content(
    {
      ...base,
      formatVersion: 1,
      sections: [{ title: "Context", text: "forged projection", rich }],
    },
    "insight",
  );
  assert.equal(value.sections[0].text, "Professional learning\nA safe link");
  assert.equal(value.formatVersion, 1);
  assert.equal(
    contentInput({
      kind: "page",
      slug: "about",
      version: 0,
      body: {
        ...base,
        sections: pageSections.about.map((title) => ({
          title,
          text: "Original",
        })),
      },
    }).body.sections.length,
    3,
  );
});
test("shared rendered-text limits accept long original text and reject over-limit/news totals", () => {
  assert.equal(
    content(
      {
        ...base,
        intro: "i".repeat(3000),
        sections: [{ title: "Context", text: "a".repeat(20000) }],
      },
      "insight",
    ).sections[0].text.length,
    20000,
  );
  assert.throws(() => content({ ...base, intro: "i".repeat(3001) }, "page"));
  assert.throws(() =>
    content(
      { ...base, sections: [{ title: "Context", text: "a".repeat(20001) }] },
      "insight",
    ),
  );
  assert.throws(() =>
    content(
      {
        ...base,
        sections: Array.from({ length: 5 }, () => ({
          title: "Context",
          text: "a".repeat(20000),
        })),
      },
      "insight",
    ),
  );
  assert.throws(() =>
    content(
      {
        ...base,
        formatVersion: 1,
        sections: [
          { title: "Context", rich: plainDocument("a".repeat(20001)) },
        ],
      },
      "insight",
    ),
  );
  assert.throws(() =>
    content(
      {
        ...base,
        intro: "i".repeat(1001),
        sourceUrl: "https://example.org",
        attribution: "Publisher",
      },
      "news",
    ),
  );
  assert.throws(() =>
    content(
      {
        ...base,
        sourceUrl: "https://example.org",
        attribution: "Publisher",
        sections: [
          { title: "A", text: "a".repeat(1500) },
          { title: "B", text: "b".repeat(501) },
        ],
      },
      "news",
    ),
  );
  assert.equal(contentLimits.requestBytes, 1048576);
});
test("rich allowlist rejects hostile nodes, attributes, links, structure and complexity", () => {
  const paragraph = (node: RichNode) => ({
    type: "doc",
    content: [{ type: "paragraph", content: [node] }],
  });
  for (const doc of [
    { type: "doc", content: [{ type: "script", text: "alert(1)" }] },
    paragraph({
      type: "text",
      text: "Link",
      marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
    }),
    paragraph({
      type: "text",
      text: "Text",
      marks: [{ type: "textStyle", attrs: { style: "position:fixed" } }],
    }),
    {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Extra H1" }],
        },
      ],
    },
    {
      type: "doc",
      content: [{ type: "paragraph", attrs: { onclick: "alert(1)" } }],
    },
    paragraph({
      type: "text",
      text: "Text",
      marks: [
        { type: "link", attrs: { href: "https://user:secret@example.org" } },
      ],
    }),
  ])
    assert.throws(() => validateRich(doc));
  assert.throws(() =>
    validateRich({
      type: "doc",
      content: [{ type: "table", content: [{ type: "paragraph" }] }],
    }),
  );
  assert.throws(() =>
    validateRich({
      type: "doc",
      content: Array.from({ length: 10001 }, () => ({ type: "paragraph" })),
    }),
  );
  assert.throws(() => content({ ...base, formatVersion: 2 }, "insight"));
  assert.throws(() =>
    content({ ...base, introRich: plainDocument("Text") }, "insight"),
  );
});
test("tables and lists preserve readable text and enforce bounded rows/columns", () => {
  const cell = {
    type: "tableCell",
    attrs: { colspan: 1, rowspan: 1, colwidth: null },
    content: [{ type: "paragraph", content: [{ type: "text", text: "Cell" }] }],
  };
  const doc = validateRich({
    type: "doc",
    content: [
      { type: "table", content: [{ type: "tableRow", content: [cell, cell] }] },
    ],
  });
  assert.equal(richText(doc), "Cell\nCell");
  assert.throws(() =>
    validateRich({
      type: "doc",
      content: [
        {
          type: "table",
          content: Array.from({ length: 21 }, () => ({
            type: "tableRow",
            content: [cell],
          })),
        },
      ],
    }),
  );
});

test("native editor defaults for numbered lists and table alignment round-trip safely", () => {
  const doc = validateRich({
    type: "doc",
    content: [
      {
        type: "orderedList",
        attrs: { start: 1, type: null },
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                attrs: { textAlign: null },
                content: [{ type: "text", text: "Item" }],
              },
            ],
          },
        ],
      },
    ],
  });
  assert.equal(richText(doc), "Item");
  assert.throws(() =>
    validateRich({
      type: "doc",
      content: [
        {
          type: "orderedList",
          attrs: { start: 1, type: "unsafe" },
          content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
        },
      ],
    }),
  );
});
