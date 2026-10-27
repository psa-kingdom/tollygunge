# Session handoff: portals and navigation

Updated: 28 October 2026 (Asia/Calcutta). Continue in the existing checkout.

## Start here

- Repository: `psa-kingdom/tollygunge`.
- Checkout: `C:\Users\srv93\OneDrive\Documents\ChatGPT\New project\tollygunge`.
- Shell: PowerShell. Branch: `main`.
- Portal redesign checkpoint: `c74af8f` — `Redesign portals and simplify staff workspace workflows`.
- The portal redesign and layout follow-ups are committed. The user also
  requested committing the subsequent navigation fixes and this handoff. They are
  included in the following checkpoint, titled `Improve navigation loading and
  document session handoff`. Use `git log -1 --oneline` for its hash.
- No push or deployment was performed. Production: `https://tpassociation.org`.
- Local preview: `http://127.0.0.1:3000/admin`.
- Read `AGENTS.md`, `docs/engineering/REPOSITORY_STRUCTURE.md`, and
  `docs/engineering/PORTAL_DESIGN_SYSTEM.md` before implementation. Read relevant
  installed Next.js docs in `node_modules/next/dist/docs` before framework edits.
- Inspect `git status --short` and preserve all existing changes/untracked files.
  Do not reset the checkout or discard local runtime/evidence files.

## User priorities and scope

The user wants compact, readable, easily understandable admin/member portals,
consistent controls and spacing, clear actions, useful empty states, and less
scrolling. They give concrete browser annotations and expect fixes to be visually
verified rather than declared complete from code inspection alone.

Public landing-page redesign remains deferred. The latest navigation fix applies
to public and authenticated navigation without changing public visual design.
Preserve business logic, authorization, publication rules and sending safeguards.
Do not automatically commit subsequent work, push, publish content or deploy.

## Completed and committed in c74af8f

- Shared portal shell: white surfaces, navy text, blue actions, bundled Jakarta
  typography, grouped navigation, dark mode and responsive layouts. Portal CSS
  stays scoped away from public pages.
- Collapsible staff/member desktop sidebar: 232px expanded (216px intermediate),
  72px collapsed; localStorage key `tpa.portal.sidebar-collapsed`. Accessible names
  and hover/focus labels remain available. Mobile navigation is independent.
- GSAP/@gsap/react navigation-icon hover/focus feedback with cleanup and reduced
  motion support. No looping icon animation.
- Removed duplicate Your workspaces overview card; recent activity follows metrics.
- Verification requirements: stacked labels, full-width controls and checkbox/
  action spacing inside expanded field settings.
- Inquiries: count, pagination and Refresh moved below results/empty state.
- Communications: Delivery details button opens a native modal with separate
  campaign readiness, password-reset setup, subscriber and consent explanations.
  Close/Escape/focus restoration work; unrelated CRM shortcut was removed.
- Campaigns: an interactive three-step workflow shows one stage at a time:
  Write -> Preview -> Review & send. Saving advances to Preview; audience preview
  unlocks Review. Back/step navigation preserves edits; editing invalidates later
  steps. Review unmounts on leaving its stage to discard old confirmation.
  Loading/applying templates uses non-submit buttons. Nothing sends on Next/save.
- Payments: standalone full-width empty state; table headers appear only for
  populated results. Native table layout with keyboard-focusable scroll region.
- Email settings: stacked fields, wider recipient textarea, separate recipient
  rows and short Send test actions; empty history layout improved.
- Website settings: related links moved into Manage other website content,
  with explicit descriptions of the separate staff-workspace destinations.
- Content: clearer catalogue page names/paths; Edit and Preview are separate
  full-width views at every viewport. Editing groups: Page details, Introduction,
  Sections (one section selected at a time), Sources & checks. Fields remain
  mounted to retain edits; native invalid fields reveal their group before focus.
- Website settings also uses smaller field groups. Catalogue buttons no longer
  flex-shrink and clip paths outside their borders. Save/publish actions sit
  **above active fields**, not in a sticky overlay that can cover controls.

## Latest uncommitted work: loading/navigation

The user complained about the generic Loading your page / Please wait screen
appearing on almost every link. They explicitly authorized fixing both the
presentation and unnecessary work after the portal commit.

Implemented:

1. Deleted `src/app/loading.tsx`, `src/app/admin/loading.tsx`, and
   `src/app/member/loading.tsx`. These broad Suspense fallbacks replaced whole
   pages. Client navigation now retains the current content until the destination
   is ready; error and not-found boundaries remain intact.
2. Added `src/components/navigation-link.tsx` and `.module.css`. It wraps Next
   Link for the main public/portal links, prefetches on hover/keyboard focus, and
   uses `useLinkStatus` for a thin top indicator after 180ms. The indicator is
   portalled to document.body so closing a mobile menu cannot hide it. It has
   reduced-motion styling. Existing events, destinations/modifier behavior and
   explicit prefetch=false are retained. No eager prefetch of every menu item.
3. Updated link imports in staff/member navigation, site-shell, account-controls,
   homepage-view and public-footer to use the wrapper. No public redesign.
4. Replaced embedded LoadingScreen presentation with local neutral skeletons,
   used by member-events and password-controls. New `loading-screen.module.css`.
5. Wrapped `currentActor` in `src/lib/actor.ts` and `publishedPage` in
   `src/lib/public-content.ts` with React cache to deduplicate repeated reads
   **within a server render only**. No cross-user/persistent session/role cache.
   Database permission checks and dynamic rendering remain intact.
6. Parallelized independent Header dependencies in site-shell and home/shared
   settings in `src/app/page.tsx` using Promise.all.
7. Added navigation regression checks to `tests/browser/portal-design.spec.ts`
   and implementation notes to `PORTAL_DESIGN_SYSTEM.md`.

Local three-route click samples: before 751/77/84ms; after 290/87/103ms.
These small, noisy samples are diagnostic only, not a production speed guarantee.
The retained-page behavior is verified with intentionally held server responses.

## Latest validation

- Production build (including TypeScript): passed on final navigation code.
- Full lint: passed; focused lint rerun after the final indicator adjustment passed.
- `npm run check:structure` and `git diff --check`: passed. The structure checker
  checks indexed paths; manually reviewed new CSS/component files are in src/components.
- `npm test`: all **111 unit tests passed**.
- **15 navigation browser checks passed** across desktop/tablet/phone: all staff/
  member destinations, mobile navigation, dark/reduced-motion checks, public style
  isolation, admin/member/anonymous session isolation, and retained-page navigation.
- **3 additional focused slow-navigation checks passed**, including actual opacity
  after the indicator delay, not just DOM presence.
- Previous targeted UI checks covered campaign progression, mocked save/preview
  (no send), payment empty/populated tables, email settings, and content/settings.
- The entire expanded browser suite was NOT rerun after the navigation changes.
  Report only the actual targeted runs above.
- The user was told to refresh the local page once to load the new build. The
  latest checks used fresh Playwright contexts; do not assume their existing
  in-app browser tab has refreshed or that production has these changes.

## Runtime and verification

- App was left running via `npm run start` on port 3000; latest tool session 54499.
  Session IDs may not survive a new chat. Inspect the listening process before
  starting another server. Do not kill unrelated Node processes.
- Local PostgreSQL: port 55432, database `tpa_local_test`, started through ignored
  `.local/start-postgres.mjs`. Check its state before restarting.
- `.env.local` and local synthetic account scripts are ignored. Never print or
  commit passwords, environment files, session cookies or private data.
- Browser test environment: `TPA_TEST_URL=http://127.0.0.1:3000`,
  `TPA_BROWSER_CHANNEL=msedge`, plus locally supplied `TPA_UI_ADMIN_EMAIL`,
  `TPA_UI_ADMIN_PASSWORD`, `TPA_UI_MEMBER_EMAIL`, `TPA_UI_MEMBER_PASSWORD`.
- Run `npx playwright test tests/browser/portal-design.spec.ts` with those local
  credentials for the full suite, or use a targeted --grep. Synthetic save flows
  are mocked. Do not send emails, publish content or change real payment records.
- Ignored `.local/check-navigation-regressions.mjs` runs the 15-check subset;
  `.local/check-navigation.mjs` runs the three slow-navigation checks.
  These runners source local synthetic credentials; inspect without exposing them.
- Use content/font/frame waits, not networkidle (background polling continues).
- Stop the local app before rebuilding; restart afterward to avoid stale chunks.
  `next start` emits the existing standalone-output warning but serves locally.
- `next-env.d.ts` is committed with `.next/dev/types/` imports. Builds rewrite
  them to `.next/types/`; restore the dev references after a build.
- BrowserOS Neo tools were unavailable in this session. Verification used local
  Playwright/installed Edge; an earlier session used CUA. Re-inventory tools/tabs
  rather than assuming previous browser IDs or bindings still exist.

## Evidence and references

- Latest ignored screenshots: `test-results/portal-design-slow-navigat-*/navigation-pending.png`.
  Test-results are replaced by subsequent Playwright runs.
- Prior UI screenshots remain under ignored `output/playwright/portal-workspaces/`
  (campaign-workflow, communications-details, crm-footer, and earlier portal views).
- The reference lock is in `PORTAL_DESIGN_SYSTEM.md`: Refero Open Collective Raise
  foundation, Linear/Zapier navigation/data controls, Luma action-led empty states.
- Emil Kowalski and official GreenSock skills were previously read remotely and
  applied; they were not installed globally. Exact links are in the design system.

## Next chat

There is no new feature request pending. The navigation implementation was
reported complete locally; the user requested this handoff and then authorized
committing all remaining work.
Read this file and the design system, inspect the current diff, and continue from
user feedback. The navigation checkpoint follows the existing portal checkpoint
c74af8f. Confirm current status rather than assuming there are uncommitted changes. Do not resume the deferred public landing-page
redesign or push/deploy without instruction.
