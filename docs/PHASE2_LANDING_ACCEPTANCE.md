# Phase 2: landing-page refinement and acceptance

14 October 2026. Branch: `codex/tpa-premium-redesign`. Starting commit: `3c1583b`. Tested application build: `K6rtwtVU7SbhYtYkAJbDk`.

## Result and scope

PASS for the available isolated Phase 2 checks. The existing selective landing-page integration is retained and refined. No push, merge, main modification, production deployment, or Phase 3 portal redesign was performed.

The approved source remains `kingsrv18/tpa-site` commit `a909b06319d1badd479982e9f94fcecdd8cc26bb`. Its Kolkata watercolor, licensed Cormorant/Jakarta fonts, navy/gold adaptation, book/atlas and map attribution remain unchanged. Existing TPA copy, configurable branding/navigation/footer, live-content slots, media injection, links and inquiry form remain unchanged. Reference sample events and visual-only registration forms were not imported.

The installed `frontend-skill` and installed Next CSS guidance were read. Visual direction: calm cream paper, navy editorial hierarchy and restrained gold accents. Content sequence and operational destinations remain those of the current application. Interaction direction: small entrances, once-only reveals, user-triggered atlas motion and immediate accessible controls.

## Changes

| File | Purpose |
| --- | --- |
| `src/app/globals.css` | One default token block and one dark-theme token block; shared font faces, focus/controls, fallback and existing portal rules consolidated into the established global stylesheet. Conditional viewport, authored-canvas and print behavior retained. |
| `src/app/premium.css` | Public-page and atlas presentation only; use shared motion variables instead of separate global tokens. |
| `scripts/verify-phase2-styles.mts` | Compare every standard computed CSS property in representative synthetic portal markup against `3c1583b`, across width/theme/print combinations. Explicitly not a substitute for authenticated application tests. |
| `scripts/verify-premium-interactions.mts` | Include 1024px, local font/artwork loading, valid public link destinations, native inquiry validation, keyboard/atlas/focus/reduced-motion checks and separate evidence output. |
| `scripts/verify-launch-public.mts` | Support a separate local evidence directory and record the tested build ID. Hosted read-only defaults remain unchanged. |

Motion foundations: `--motion-enter:450ms`, `--motion-atlas:450ms`, `--motion-control:180ms`, `--motion-distance:8px`. Hero and section entrances use 450ms and at most 8px vertical movement. Atlas opening/chapter/image transitions use 450ms, with a smaller opening tilt. The book cover lifts 2px without changing its resting angle. No looping animation or automatic scrolling was introduced. Existing reduced-motion handling disables entrances, reveals and atlas movement; its live preference response remains intact.

Existing member/admin rule values were moved rather than redesigned. The original effective print colors were retained explicitly because the old late theme block overrode earlier print declarations. This phase does not change that existing print policy.

## Preservation

Only the two stylesheets, verification scripts and this acceptance document changed. Landing-page components, public header/footer, CMS settings/domain contracts, authentication, authorization, form handlers/validation, APIs, metadata, database migrations, runtime workers, dependencies and reference assets remain byte-for-byte unchanged from `3c1583b`.

Responsibilities are retained: server components load published settings/media; `HomeView` renders all editable slots and read-only preview behavior; `SiteShell` supplies actor-aware navigation and the configurable footer; `PublicInquiry` retains real submission/consent/idempotency behavior; the atlas remains independent of business data.

All database-writing acceptance used disposable local databases rooted at `postgresql://tpa_qa@127.0.0.1:55439/postgres`, with synthetic identities and provider/storage mocks or mail sinks. No production records, invitations, provider settings, or environment files were changed.

## Executed checks

| Command | Result |
| --- | --- |
| `npm run build` | PASS: production Next build, TypeScript phase and bundled workers. |
| `npm run lint` | PASS. Scoped lint also passed for the final verification-script changes. |
| `npm run typecheck` | PASS after final script updates. |
| `npm test` | 100 passed, zero failures or skips. |
| `node --import tsx scripts/verify-phase2-styles.mts` | 20 states passed: five widths × light/dark × screen/print. Computed portal styles identical to `3c1583b`. These are synthetic style fixtures. |
| `node --import tsx scripts/verify-launch-public.mts` | 100 actual rendered public route states passed: ten routes × five widths × light/dark. Zero overflow, failed responses, browser runtime errors or automated accessibility violations. |
| `node --import tsx scripts/verify-premium-interactions.mts` | 12 passed: ten atlas width/theme combinations and two no-JavaScript fallback states. Fonts and all atlas/hero imagery load; public destinations resolve; empty inquiry validation prevents submission; keyboard, focus return and live reduced motion pass. Zero write requests. |
| `node scripts/verify-launch-isolated.mjs --browser-only --browser-grep 'appearance controls persist\|staff header\|bank editor\|profile uses full-size\|new account resumes\|empty payment roster'` | 18 actual authenticated desktop/tablet/phone workflows passed, zero skips or failures; disposable database cleanup confirmed. |
| `node --import tsx scripts/test-website-control.mts --browser` | Six API/browser scenario groups passed, including editable homepage draft/preview/publish/reload, navigation anchors, published resources, and nine responsive administrator accessibility scans. |

Public routes checked: `/`, `/about`, `/governance`, `/membership`, `/events`, `/resources`, `/contact`, `/login`, `/forgot-password`, `/join`. Widths: 1440, 1024, 768, 390, 320px. The public audit uses reduced motion; the separate interaction checks exercise normal motion and switching to reduced motion live.

Native browser inspection confirmed the actual desktop and phone composition, readable responsive menu, and mobile navigation to the rendered login page. Screenshots from the current build were inspected. No visual claim is based solely on code inspection.

Evidence: `.local/phase2` contains build/lint/typecheck/unit logs, computed-style comparison, public screenshots/results, interaction screenshots/results, selected authenticated browser logs/results and website-control logs. Detailed website-control evidence is `.local/website-control/2026-10-14T06-12-44.997Z`. Historical evidence from the previous integration remains separate.

Local test configuration: `TPA_PUBLIC_QA_URL=http://127.0.0.1:3159`, `TPA_PUBLIC_QA_OUTPUT=.local/phase2/public`, `TPA_INTERACTION_QA_OUTPUT=.local/phase2/interactions`; database runners used the local QA URL and `DATABASE_SSL=false`. These are process-local test values, not changes to application environment files.

## Remaining boundaries

No local Phase 2 blocker remains. This phase does not establish hosted/provider/inbox, physical-device or production-release readiness; existing delivery and launch gates remain in force. The streamed application still requires JavaScript and retains its explicit enable/reload fallback. Comprehensive member/admin redesign is deferred to Phase 3.
