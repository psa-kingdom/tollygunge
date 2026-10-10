"use client";
import { useState, useEffect, useId } from "react";
import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";
import { TextStyle } from "@tiptap/extension-text-style";
import {
  plainDocument,
  richText,
  sizes,
  type RichNode,
} from "@/domain/rich-content";
const SizedText = TextStyle.extend({
  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: (element) =>
          sizes.includes(
            element.getAttribute("data-content-size") as (typeof sizes)[number],
          )
            ? element.getAttribute("data-content-size")
            : null,
        renderHTML: (attrs) =>
          attrs.size
            ? {
                "data-content-size": attrs.size,
                class: `content-size-${attrs.size}`,
              }
            : {},
      },
    };
  },
});
export function TextCounter({
  value,
  limit,
  label,
}: {
  value: string;
  limit: number;
  label: string;
}) {
  const length = value.trim().length;
  return (
    <small
      className={length > limit ? "content-counter over" : "content-counter"}
      aria-live="polite"
    >
      {label}: {length.toLocaleString()} / {limit.toLocaleString()} characters ·{" "}
      {value.trim() ? value.trim().split(/\s+/u).length : 0} words
    </small>
  );
}
export function RichEditor({
  label,
  disabled = false,
  document,
  text,
  limit,
  onChange,
}: {
  label: string;
  disabled?: boolean;
  document?: RichNode;
  text: string;
  limit: number;
  onChange: (doc: RichNode, text: string) => void;
}) {
  const id = useId(),
    [linkOpen, setLinkOpen] = useState(false),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: false,
          linkOnPaste: false,
          protocols: ["https"],
        },
      }),
      SizedText,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: document ?? plainDocument(text),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
      },
    },
    onUpdate: ({ editor }) => {
      const doc = editor.getJSON() as RichNode;
      onChange(doc, richText(doc));
    },
  });
  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);
  useEditorState({ editor, selector: ({ editor }) => editor?.state });
  useEffect(() => {
    if (editor) {
      const desired = document ?? plainDocument(text);
      if (JSON.stringify(editor.getJSON()) !== JSON.stringify(desired))
        editor.commands.setContent(desired, { emitUpdate: false });
    }
  }, [editor, document, text]);
  function addLink() {
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" || u.username || u.password)
        throw new Error();
      editor
        ?.chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: u.href })
        .run();
      setLinkOpen(false);
      setError("");
    } catch {
      setError("Use an HTTPS link without credentials.");
    }
  }
  if (!editor)
    return (
      <div className="rich-editor-loading">
        Loading {label.toLowerCase()} editor…
      </div>
    );
  const tool = (
    name: string,
    run: () => void,
    active = false,
    disabled = false,
  ) => (
    <button
      type="button"
      aria-label={name}
      aria-pressed={active}
      disabled={disabled}
      onClick={run}
    >
      {name}
    </button>
  );
  return (
    <div className="rich-editor">
      <div
        className="rich-toolbar"
        role="group"
        aria-label={`${label} formatting`}
      >
        <label className="toolbar-select">
          Style
          <select
            aria-label={`${label} paragraph style`}
            value={
              editor.isActive("heading")
                ? String(editor.getAttributes("heading").level)
                : "paragraph"
            }
            onChange={(e) => {
              if (e.target.value === "paragraph")
                editor.chain().focus().setParagraph().run();
              else
                editor
                  .chain()
                  .focus()
                  .setHeading({ level: Number(e.target.value) as 2 | 3 | 4 })
                  .run();
            }}
          >
            <option value="paragraph">Paragraph</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
            <option value="4">Heading 4</option>
          </select>
        </label>
        <label className="toolbar-select">
          Size
          <select
            aria-label={`${label} text size`}
            value={editor.getAttributes("textStyle").size ?? "body"}
            onChange={(e) =>
              editor
                .chain()
                .focus()
                .setMark("textStyle", { size: e.target.value })
                .run()
            }
          >
            {sizes.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>
        {tool(
          "Bold",
          () => {
            editor.chain().focus().toggleBold().run();
          },
          editor.isActive("bold"),
        )}
        {tool(
          "Italic",
          () => {
            editor.chain().focus().toggleItalic().run();
          },
          editor.isActive("italic"),
        )}
        {tool(
          "Underline",
          () => {
            editor.chain().focus().toggleUnderline().run();
          },
          editor.isActive("underline"),
        )}
        {tool(
          "Strike",
          () => {
            editor.chain().focus().toggleStrike().run();
          },
          editor.isActive("strike"),
        )}
        {tool(
          "Bullets",
          () => {
            editor.chain().focus().toggleBulletList().run();
          },
          editor.isActive("bulletList"),
        )}
        {tool(
          "Numbers",
          () => {
            editor.chain().focus().toggleOrderedList().run();
          },
          editor.isActive("orderedList"),
        )}
        {tool(
          "Quote",
          () => {
            editor.chain().focus().toggleBlockquote().run();
          },
          editor.isActive("blockquote"),
        )}
        {tool(
          "Link",
          () => {
            setUrl(editor.getAttributes("link").href ?? "");
            setLinkOpen(!linkOpen);
          },
          linkOpen,
        )}
        {tool(
          "Unlink",
          () => {
            editor.chain().focus().unsetLink().run();
          },
          false,
          !editor.isActive("link"),
        )}
        <label className="toolbar-select">
          Align
          <select
            aria-label={`${label} alignment`}
            value={
              editor.getAttributes("paragraph").textAlign ??
              editor.getAttributes("heading").textAlign ??
              "left"
            }
            onChange={(e) =>
              editor.chain().focus().setTextAlign(e.target.value).run()
            }
          >
            {["left", "center", "right", "justify"].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        {tool("Insert table", () => {
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run();
        })}
        {editor.isActive("table") && (
          <>
            {tool("Add row", () => {
              editor.chain().focus().addRowAfter().run();
            })}
            {tool("Add column", () => {
              editor.chain().focus().addColumnAfter().run();
            })}
            {tool("Delete row", () => {
              editor.chain().focus().deleteRow().run();
            })}
            {tool("Delete column", () => {
              editor.chain().focus().deleteColumn().run();
            })}
            {tool("Delete table", () => {
              editor.chain().focus().deleteTable().run();
            })}
          </>
        )}
        {tool(
          "Undo",
          () => {
            editor.chain().focus().undo().run();
          },
          false,
          !editor.can().undo(),
        )}
        {tool(
          "Redo",
          () => {
            editor.chain().focus().redo().run();
          },
          false,
          !editor.can().redo(),
        )}
        {tool("Clear formatting", () => {
          editor.chain().focus().unsetAllMarks().clearNodes().run();
        })}
      </div>
      {linkOpen && (
        <div className="rich-link-editor">
          <label htmlFor={id}>HTTPS link</label>
          <input
            id={id}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            type="url"
            maxLength={1000}
          />
          <button type="button" onClick={addLink}>
            Apply link
          </button>
          <button type="button" onClick={() => setLinkOpen(false)}>
            Cancel
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
      <EditorContent editor={editor} />
      <TextCounter label={label} value={text} limit={limit} />
    </div>
  );
}
