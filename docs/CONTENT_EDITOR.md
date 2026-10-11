# Rich content editing

Content staff can format introductions and section bodies with headings H2–H4,
bold/italic/underline/strike, lists, quotes, safe links, alignment, tables and
Small/Body/Large/Display text presets. Page titles retain H1 semantics and section
headings retain stable submenu anchors while their appearance changes.

## Limits and persistence

Limits and validation are shared in the rich-content domain: 160 title characters,
3,000 introduction, 120 section heading, 20,000 section body, 12 sections and
100,000 total title/introduction/headings/body characters. News retains 1,000 intro,
1,500 per body and 2,000 across bodies, plus source and attribution requirements.
Counters measure trimmed rendered text, including paragraph boundaries, excluding
formatting markup. Word counts are informational. Oversized rich pastes stay visible
with a counter/error; save is disabled until corrected rather than silently truncating.

Optional formatVersion=1, introRich, section rich and approved size presets extend
existing ContentBody JSONB records. The server derives compatibility text from rich
JSON; it does not trust supplied projections. No database migration is necessary.
Legacy drafts/publications/revisions render as before; opening legacy text constructs
editor documents in memory and only saving persists the new representation.

The existing content endpoint allows a bounded 1 MiB request; all other request
limits are unchanged. A node/mark/attribute allowlist validates links, nesting,
complexity and table bounds. Public rendering uses React elements, never raw user
HTML. Unsupported scripts/styles/embeds are rejected. Pasted markup is constrained
by the editor schema and checked again server-side.

## Preview and publication

Inline preview uses the same public layout/rich renderer and CSS inside a sandboxed
iframe. Unsaved content stays in memory. Current published event/media/governance
and resource inserts load through permission-protected GET /api/staff/content/preview.
No private documents or unpublished inserts are returned. Preview cannot navigate
or submit forms and contains no runnable application scripts. It supports 1280/768/
390-pixel layouts, expansion with Escape dismissal, and mobile Edit/Preview keyboard
tabs that preserve state. The content area is previewed; site-wide header/footer
layout editing is outside this slice.

Saving only changes the draft. Publish is disabled for unsaved edits; the server
publishes the saved version with conflict checks and revision/audit history.
Unsaved entry changes/internal links prompt before discard; browser unload has a
native warning. Failed saves keep edits. Edits are disabled while a save is running.

## Remaining improvements / release gates

Global design/page building, collaboration and DOCX import are separate future work.
Resend, Google onboarding, payments, membership policy and scoped hosted R2 remain
unchanged dependencies in DELIVERY_CHECKLIST.md. Existing npm audit findings concern
Next's development lint dependency chain; no forced framework downgrade was made.
Real-device/assistive-technology acceptance still belongs to the release checklist.

Validation evidence is recorded in DELIVERY_CHECKLIST.md.
