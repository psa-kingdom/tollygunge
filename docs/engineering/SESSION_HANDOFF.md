# Portal redesign session handoff

Updated: 27 October 2026. Continue in this existing checkout; work is uncommitted.

## Workspace and scope

- Repository: `psa-kingdom/tollygunge`.
- Windows checkout: `C:\Users\srv93\OneDrive\Documents\ChatGPT\New project\tollygunge`.
- Shell: PowerShell. User timezone: Asia/Calcutta.
- Local preview: `http://127.0.0.1:3000/admin`. The user's Codex browser has this open.
- Production site: `https://tpassociation.org`; no deployment, push, or commit has been performed.
- User wants elegant, modern, clean admin and member portals: compact spacing,
  clear information architecture, consistent fields/buttons/icons, useful empty
  states and subtle motion. Public landing-page work is deferred until the portals
  are finished. Preserve business logic, permissions and existing workflows.

## Completed work

1. Shared portal shell and scoped visual system across staff, member and account
   pages: white surfaces, navy text, blue accents, Jakarta typography, compact
   controls, grouped navigation, dark mode and responsive layouts. Public styling
   stays outside this portal CSS scope.
2. Reorganized sidebar workspaces, including verification, bulk onboarding,
   inquiries, communications, events, flyers, historical imports, website/content,
   media, committees, payments, email settings, reports and staff access. Improved
   headings, toolbars, browse/edit layouts, empty-state actions and workflow steps.
3. Added desktop sidebar collapse in both staff and member portals. Expanded width
   is 232px (216px at intermediate widths); collapsed rail is 72px. CSS grid
   transitions over 240ms, with instant changes under reduced motion. A labelled
   button at the bottom of the sidebar toggles it. Preference persists in
   localStorage under `tpa.portal.sidebar-collapsed`.
4. Collapsed links retain accessible names and show labels on hover or keyboard
   focus. The desktop preference does not alter the mobile menu below 801px.
5. Installed `gsap` and `@gsap/react` for navigation icon feedback. Scoped
   `useGSAP`/`contextSafe` handlers apply a subtle 1.5px lift and 1.08 scale on hover
   or focus, overwrite interrupted tweens, clean up listeners and stop/revert
   when reduced motion is enabled. No looping animation.
6. Latest requested change: removed the redundant **Your workspaces** shortcut card
   from `/admin`. Sidebar links already provide those destinations. Recent activity
   now follows the attention/status cards. The permitted-workspace count remains.

## Key files

- `src/components/site-shell.tsx`: server portal composition; public shell also
  lives here, so keep changes scoped.
- `src/components/portal-frame.tsx`: client boundary, persistent collapse state,
  collapse button, label overlay and GSAP handlers.
- `src/components/portal-theme.module.css`: portal-only palette, layouts, controls,
  navigation rail, responsive and reduced-motion rules.
- `src/components/portal-icon.tsx`: shared stroke icon set.
- `src/components/staff-navigation.tsx`, `member-navigation.tsx`: grouped links,
  accessible names and independent mobile menus.
- `src/components/workspace-ui.tsx` and `.module.css`: shared workspace layout,
  headings, empty states, workflow and tabs.
- `src/components/payments-workspace.tsx`: payment tool tabs.
- `src/app/admin/page.tsx`: overview, including latest card removal.
- `tests/browser/portal-design.spec.ts`: local-only UI regression coverage.
- `docs/engineering/PORTAL_DESIGN_SYSTEM.md`: reference lock, decisions and
  workspace layout patterns. Read before changing the visual direction.

Many other workspace components are modified as part of this session. Inspect
`git status --short` and preserve the existing edits and untracked files. Do not
reset the checkout or assume uncommitted changes are disposable.

## Design references and skills

Refero research established Open Collective Raise as the navy/white foundation,
Linear/Zapier for grouped navigation and compact data controls, and Luma for
action-led event empty states and editing flows. Exact references are in the design
system document. Keep this established direction when applying small follow-ups.

User requested Emil Kowalski's design-engineering and animate guidance, and later
the official GreenSock skills. These were read remotely and applied; do not claim
they were installed globally:

- https://github.com/emilkowalski/skills
- https://github.com/greensock/gsap-skills/tree/main/skills/gsap-react
- https://github.com/greensock/gsap-skills/tree/main/skills/gsap-core

Use the available Refero design skill for new design research. Use Agent Reach's
GitHub route when retrieving GitHub skill contents. BrowserOS Neo tools were not
configured; browser verification used Codex's in-app browser through CUA.

## Validation and current runtime

- Earlier portal pass: 111 unit tests passed.
- After sidebar work: **21 browser checks passed** across desktop, tablet and phone,
  including all staff/member destinations, overflow, mobile keyboard navigation,
  dark mode, reduced motion, collapse persistence and public style isolation.
- Sidebar implementation passed build, lint, typecheck and structure checks.
- After latest overview-card removal: production build (including TypeScript) and
  structure check passed; refreshed the actual local browser and confirmed the
  card is absent and the remaining overview sections are present. The full browser
  suite was not rerun for this simple removal.
- Local app is currently `npm run start` on port 3000, last tool session `53357`.
  Session IDs may not be controllable from a different chat: inspect the process
  before starting another server. Do not kill unrelated Node processes.
- Local PostgreSQL was started via `.local/start-postgres.mjs`, on port 55432 with
  database `tpa_local_test`. `.env.local` is local-only; do not print or commit it.
- Synthetic admin/member accounts exist. Browser tests take credentials through
  `TPA_UI_ADMIN_EMAIL`, `TPA_UI_ADMIN_PASSWORD`, `TPA_UI_MEMBER_EMAIL`, and
  `TPA_UI_MEMBER_PASSWORD`; do not put passwords in tracked documentation.
- Browser tests use `TPA_TEST_URL=http://127.0.0.1:3000` and
  `TPA_BROWSER_CHANNEL=msedge` (installed Edge; bundled Chromium is unavailable).
  Run `npx playwright test tests/browser/portal-design.spec.ts` with synthetic
  credentials supplied locally. Tests reuse auth sessions and do not submit
  business changes. Do not bypass other integration tests' database safety gates.
- Avoid `networkidle` waits: background status polling can keep the page busy.
  Existing tests wait for page content, fonts and animation frames instead.
- Stop the local app before rebuilding, then restart it; serving an old build
  during replacement can cause stale chunks/stream errors. `next start` emits an
  existing standalone-output warning but serves successfully.
- `next-env.d.ts` had pre-existing references to `.next/dev/types/`. Builds rewrite
  them to `.next/types/`; restore the original dev references after build rather
  than discarding the user's pre-existing modification.

## Browser and visual evidence

In the previous CUA runtime, browser `iab` had local tab `3` and production tab `2`.
Re-inventory tabs in a new chat; do not assume old bindings remain available. The
local tab is authenticated and marked as a deliverable. Production was left alone.

Ignored screenshots under `output/playwright/portal-workspaces/`:

- `overview-simplified.png`: latest full overview after removing duplicate links.
- `sidebar-collapsed.png`: compact navigation in the members workspace.
- `events-editor.png`, `bulk-onboarding.png`, `communications.png`,
  `bulk-onboarding-phone.png`: prior workspace layout evidence.

## How to continue

Read this handoff and the design system, inspect the current diff, and continue
the user's next portal feedback in this checkout. No explicit feature request is
currently pending: the latest card removal is complete. Do not begin public
landing-page redesign or deploy automatically. Follow `AGENTS.md` and the
repository structure policy; this Next.js version requires reading relevant
bundled docs under `node_modules/next/dist/docs` before writing framework code.
For small reversible changes, act without unnecessary confirmation. Show the
updated local preview and report only validation actually performed.

## Follow-up: verification field layout

Fixed the expanded requirements editor after user feedback: stacked form-grid
labels, full-width controls, explicit fieldset/checkbox/action spacing, and removal
of an inherited form-grid top margin. Changes remain portal-scoped. Browser
coverage now checks actual field geometry inside the accordion. The earlier
21-check browser suite, lint and structure checks passed; production rebuild also
passed. The latest local runtime was restarted on port 3000.

## Campaign stepper navigation — 28 October 2026

Campaigns show one stage at a time. Save and continue persists the draft before
opening Preview. An audience preview unlocks Review & send. Step buttons and Back
navigation preserve controlled draft fields; edits invalidate preview access.
Review is unmounted when leaving its stage, discarding its previous confirmation.
Loading/applying templates uses explicit non-submit buttons. Shared WorkspaceSteps
supports optional interactive navigation; bulk onboarding keeps its existing
indicator behavior. Six browser checks passed across desktop, tablet and phone,
including a mocked campaign save/preview flow that asserts no send was requested.
Production build, focused lint and structure checks passed. Local preview is on
port 3000; work remains uncommitted and undeployed.


## Commit checkpoint — 28 October 2026

The user requested committing the accumulated portal redesign and follow-up work.
Content/settings editing now uses smaller groups, catalogue text stays inside its
buttons, and actions sit above the active fields. Latest build, focused lint,
structure and desktop/tablet/phone content checks passed. Local evidence, test
accounts and environment files remain ignored. Loading-screen diagnosis is the
next topic; no loading-navigation changes have been made. Public landing-page
redesign remains deferred. No push or deployment is included in this checkpoint.
