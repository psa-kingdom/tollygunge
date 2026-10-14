# Phase 4 — Premium finishing and responsive acceptance

Status: IMPLEMENTED AND LOCALLY VERIFIED; NOT DEPLOYED. Isolated development branch `codex/tpa-premium-redesign`; starting commit `f90cc70`. Production and main are untouched.

## Visual and interaction decisions

Preserve the approved Kolkata watercolor composition, editorial public titles and navy/gold identity. Improve working surfaces through clear numeric hierarchy, readable form widths and consistent controls. Preserve operational Jakarta typography and dense tables. Use existing native disclosures/dialogs with 180ms opacity/2px entrances; disable motion immediately when reduced motion changes. No looping decoration, new dependencies or assets.

## Observed defects and focused fixes

| Observed rendered issue | Correction | Evidence |
| --- | --- | --- |
| At 320px, login panel retains 30px padding and squeezes working fields. | Shared panel padding scales between 18px and 30px. | Live Chrome measured 18px after change. |
| Appearance popover begins 1px from usable viewport edge because 100vw includes scrollbar width. | Use viewport insets, auto width and a capped width; retain scrollable height. | Live Chrome measured left 16px after change. |
| Mobile navigation trigger is 41.8px high. | Minimum 44px with centered label. | Live Chrome measured 44px after change. |
| Open mobile navigation overlaps the header (top 48.5px, header bottom 78px), with a 3.4px left gutter. | Place below header, use viewport insets and a capped width. | Verified in final Chrome screenshots and open-menu checks. |
| Dashboard metric labels can orphan the arrow on a separate line at 1024px. | Structured count/label/arrow grid with tabular numerals and wrapping label. | Baseline administrator screenshot; final screenshots confirm alignment. |
| CSS audit found competing 6/8/9px control radii, while body-wide button rule competes with portal tokens. | Reuse the 6px control token; retain public authored 5px buttons. | CSS audit plus route regression. |
| Preview membership table compresses words into vertical letters at 320px, despite zero automated overflow/axe findings. | Extend the existing minimum readable table width to both shared scroll wrappers; label and focus the preview container. | Live Chrome: 560px table in 268px container, zero page overflow. All 126 affected states pass. |
| Empty payment table leaves a white strip past its short header group on wide screens. | Remove the fill only from operational tables with no body rows. | Final 1920px screenshot confirms removal; keyboard/table regression passes. |

`src/app/preview/admin/review-workspace.tsx` retains its synthetic records, local-only review state, tabs, search and preview disclosure; only scroll-container semantics change. No live decisions or API calls were added.

`src/app/admin/page.tsx` retains actor redirects, role-filtered navigation, real overview counts, attention data and every destination; only link presentation changes. CSS retains authentication, validation, handlers, APIs, assets, focus return and table scrolling semantics.

## Evidence and scope

Baseline scout: 108 route/theme/viewport states at 320/1024/1920px, zero overflow, broken assets, page errors or axe violations; 12 authorization checks passed. Evidence `.local/phase4/routes-3170/`; disposable database cleanup true, external providers false.



## Route and viewport matrix

Full finishing-matrix build: `1XOKa6Xga5vRiI42rdeUf`. Latest production build after the localized preview-table correction: `vneT_bLEJ5YAq9bsbPOQs`. All 26 filesystem page sources reconciled with the existing navigation and dynamic allowlists. 59 route/actor/state cases × nine widths × light/dark = **1,062 inspected automated states**, zero measured overflow, failed assets, broken loaded images, page exceptions or WCAG A/AA axe violations. Closed-atlas lazy images are independently checked when opened.

Widths: **320, 360, 390, 430, 768, 1024, 1280, 1440, 1920px**. Height 844px on phones, 1000px elsewhere, 1080px at 1920.

| Family | Cases | States | All nine widths, both modes |
| --- | ---: | ---: | --- |
| Public / valid dynamic content | 10 | 180 | PASS |
| Account access | 8 | 144 | PASS |
| Member / account / redirect | 8 | 144 | PASS |
| Admin / staff account / redirect | 20 | 360 | PASS |
| Read-only preview | 6 | 108 | PASS |
| Recovery / missing records | 7 | 126 | PASS |

The screenshot review then found the preview-table column collapse described above. Its correction changes only the existing shared table-wrapper selector and preview region attributes. The latest build was verified on **126 affected states** (all six preview pages plus staff verification, all nine widths and both modes), with zero collapsed tables, overflow, failed assets, page errors or axe violations. Keyboard horizontal scrolling passed at 320px in both themes. This scoped follow-up is in `.local/phase4/routes-3180/results.json`; the other families retain the preceding full-matrix evidence. A second complete 1,062-state scan was not performed after this localized correction. The gallery uses the updated affected-route screenshots without replacing historical evidence.

12 direct-navigation authorization checks passed for anonymous users, members and limited staff. The final overlay audit passed **82 states**: 54 account/appearance panels (including axe and live reduced motion), 18 keyboard search dialogs (input focus, Escape, focus return, live reduced motion) and 10 narrow navigation panels with expanded membership menus.

### Individual route cases

Every row below passed all nine widths in light and dark. Exact synthetic IDs, HTTP outcomes and screenshot names are in `.local/phase4/routes-3178/inventory.json` and `results.json`. Fixtures were disposable and have been removed.

| Route | Access / actor | Important state | Source |
| --- | --- | --- | --- |
| `/` | anonymous | rendered | `src/app/page.tsx` |
| `/about` | anonymous | rendered | `src/app/[page]/page.tsx` |
| `/governance` | anonymous | rendered | `src/app/[page]/page.tsx` |
| `/membership` | anonymous | rendered | `src/app/[page]/page.tsx` |
| `/events` | anonymous | rendered | `src/app/[page]/page.tsx` |
| `/resources` | anonymous | rendered | `src/app/[page]/page.tsx` |
| `/contact` | anonymous | rendered | `src/app/[page]/page.tsx` |
| `/join` | anonymous | rendered | `src/app/join/page.tsx` |
| `/signup` | anonymous | rendered | `src/app/signup/page.tsx` |
| `/login` | anonymous | rendered | `src/app/login/page.tsx` |
| `/invitation` | anonymous | missing-link recovery | `src/app/invitation/page.tsx` |
| `/email-verification` | anonymous | missing-link recovery | `src/app/email-verification/page.tsx` |
| `/forgot-password` | anonymous | rendered | `src/app/forgot-password/page.tsx` |
| `/reset-password` | anonymous | missing-link recovery | `src/app/reset-password/page.tsx` |
| `/unsubscribe` | anonymous | missing-link recovery | `src/app/unsubscribe/page.tsx` |
| `/events/<synthetic-id>` | anonymous | rendered | `src/app/events/[id]/page.tsx` |
| `/flyers/<synthetic-id>` | anonymous | rendered | `src/app/flyers/[id]/page.tsx` |
| `/resources/<synthetic-slug>` | anonymous | rendered | `src/app/resources/[slug]/page.tsx` |
| `/member` | member | rendered | `src/app/member/page.tsx` |
| `/member/application` | member | rendered | `src/app/member/application/page.tsx` |
| `/member/events` | member | rendered | `src/app/member/events/page.tsx` |
| `/member/inquiries` | member | rendered | `src/app/member/inquiries/page.tsx` |
| `/member/payments` | member | rendered | `src/app/member/payments/page.tsx` |
| `/member/security` | member | rendered | `src/app/member/security/page.tsx` |
| `/account/profile` | member | rendered | `src/app/account/profile/page.tsx` |
| `/account` | member | redirect to member | `src/app/account/page.tsx` |
| `/account` | administrator | redirect to admin | `src/app/account/page.tsx` |
| `/admin` | administrator | rendered | `src/app/admin/page.tsx` |
| `/admin/workspaces/members` | administrator | rendered | `src/app/admin/workspaces/[workspace]/page.tsx` |
| `/admin/workspaces/verification` | administrator | rendered | `src/app/admin/workspaces/[workspace]/page.tsx` |
| `/admin/workspaces/onboarding` | administrator | rendered | `src/app/admin/workspaces/[workspace]/page.tsx` |
| `/admin/workspaces/crm` | administrator | rendered | `src/app/admin/workspaces/[workspace]/page.tsx` |
| `/admin/workspaces/communications` | administrator | rendered | `src/app/admin/workspaces/[workspace]/page.tsx` |
| `/admin/workspaces/events` | administrator | rendered | `src/app/admin/workspaces/[workspace]/page.tsx` |
| `/admin/workspaces/flyers` | administrator | rendered | `src/app/admin/workspaces/[workspace]/page.tsx` |
| `/admin/workspaces/imports` | administrator | rendered | `src/app/admin/workspaces/[workspace]/page.tsx` |
| `/admin/workspaces/website` | administrator | rendered | `src/app/admin/workspaces/[workspace]/page.tsx` |
| `/admin/workspaces/content` | administrator | rendered | `src/app/admin/workspaces/[workspace]/page.tsx` |
| `/admin/workspaces/media` | administrator | rendered | `src/app/admin/workspaces/[workspace]/page.tsx` |
| `/admin/workspaces/governance` | administrator | rendered | `src/app/admin/workspaces/[workspace]/page.tsx` |
| `/admin/workspaces/payments` | administrator | rendered | `src/app/admin/workspaces/[workspace]/page.tsx` |
| `/admin/workspaces/onboarding-email` | administrator | rendered | `src/app/admin/workspaces/[workspace]/page.tsx` |
| `/admin/workspaces/reports` | administrator | rendered | `src/app/admin/workspaces/[workspace]/page.tsx` |
| `/admin/workspaces/access` | administrator | rendered | `src/app/admin/workspaces/[workspace]/page.tsx` |
| `/admin/content/<synthetic-id>` | administrator | rendered | `src/app/admin/content/[id]/page.tsx` |
| `/account/profile` | administrator | staff account shell | `src/app/account/profile/page.tsx` |
| `/preview/admin` | anonymous | rendered | `src/app/preview/admin/page.tsx` |
| `/preview/admin/workspaces/events` | anonymous | rendered | `src/app/preview/admin/workspaces/[workspace]/page.tsx` |
| `/preview/admin/workspaces/content` | anonymous | rendered | `src/app/preview/admin/workspaces/[workspace]/page.tsx` |
| `/preview/admin/workspaces/crm` | anonymous | rendered | `src/app/preview/admin/workspaces/[workspace]/page.tsx` |
| `/preview/admin/workspaces/communications` | anonymous | rendered | `src/app/preview/admin/workspaces/[workspace]/page.tsx` |
| `/preview/admin/workspaces/payments` | anonymous | rendered | `src/app/preview/admin/workspaces/[workspace]/page.tsx` |
| `/missing/route/phase-three` | anonymous | not found | `src/components/fallback-screen.tsx` |
| `/events/not-a-uuid` | anonymous | not found | `src/components/fallback-screen.tsx` |
| `/events/<synthetic-id>` | anonymous | not found | `src/components/fallback-screen.tsx` |
| `/flyers/<synthetic-id>` | anonymous | not found | `src/components/fallback-screen.tsx` |
| `/resources/missing-phase-three` | anonymous | not found | `src/components/fallback-screen.tsx` |
| `/admin/workspaces/unknown` | administrator | not found | `src/app/admin/workspaces/[workspace]/page.tsx` |
| `/admin/content/<synthetic-id>` | administrator | not found | `src/app/admin/content/[id]/page.tsx` |

## Executed checks and functional preservation

| Check | Result / evidence |
| --- | --- |
| Production build (`npm run build`) | Exit 0; final build above; `.local/phase4/build-preview-fix.log`. Includes existing worker bundles. |
| ESLint (`npm run lint`) | Exit 0; `.local/phase4/lint-final-source.log`. |
| TypeScript (`npm run typecheck`) | Exit 0; `.local/phase4/typecheck-final-source.log`. |
| Unit tests (`npm run test`) | 100 passed, 0 failed/skipped; `.local/phase4/unit-final-source.log`. |
| Full existing browser suite | 63 passed, 12 skipped on first finishing build; `.local/phase4/acceptance.log`. |
| Finishing-build targeted browser regression | 18 passed, 0 skipped: profile save/retry, bank editing/activation/member display, appearance synchronisation, staff navigation/search, keyboard empty-payment table, 404 recovery. `.local/phase4/accepted.log`. |
| Isolated database/HTTP acceptance | 27 passed (9 backend, 6 member foundation, 2 onboarding/UX HTTP, 10 baseline HTTP); first finishing build, unchanged backend. Covers permissions, identity, private uploads, inquiries, manual payments, publication and operational boundaries. |
| Atlas / public regression | 12 states passed on the full finishing-matrix build, 0 writes: ten width/theme interaction states plus two JavaScript-disabled states. Fonts/artwork, CTA destinations, keyboard chapter controls, focus return, live reduced motion, invalid inquiry blocking. `.local/phase4/interactions/results.json`. |
| Latest-build table refinement | 126 affected route states and 12 authorization checks passed; native preview table scrolling checked in both themes at 320px. `.local/phase4/table-runner-results.json`, cleanup true. |
| Full route / overlay / authorization acceptance | 1062 + 82 + 12 passed; `.local/phase4/routes-3178/results.json`. |

Server logs retain expected isolated outage errors and canceled-navigation stream diagnostics; these are not counted as zero server errors. The recorded browser page exceptions and failed asset requests are the scoped zero findings above.

The first full route scan had 1,062 clean closed-page states but the new open-navigation assertion failed on the known header overlap before its updated CSS build. That run is **not** reported as a full pass: `.local/phase4/final-runner-results.json` records design-audit exit 1. Its database/HTTP and browser suites passed. A final-build capture attempt timed out after 687 clean states at the browser screenshot step; it was not a completed pass (`accepted-runner-results.json`). The remaining 375 states were captured with the original lower concurrency, preserving build identity and route-case inventory. The two runs used independent disposable fixtures; counts can vary, and this is responsive acceptance rather than an identical-data pixel comparison. The 1,062-state final matrix combines those explicit per-frame evidence directories. The first resumed process completed all page states, then stopped on an automation selector that treated the native submenu summary as a button. This was corrected to target its actual summary and assert Enter expands the membership links, without changing application behavior. All 82 overlay and 12 authorization checks ran in the final completion process. The completion runner has every stage exit 0, `cleanup:true`, `externalProviders:false`.

The 12 full-suite skips are three standalone import-worker scenarios requiring their dedicated runner, three supplied committee photograph rehearsals whose fixture was not provisioned, and six desktop-owned verification/session concurrency/save-retry scenarios intentionally skipped on duplicate tablet/phone projects. Phase 3 evidence remains baseline for these dedicated runs; they were not rerun in Phase 4. Hosted R2, Google/provider auth and real email delivery remain outside these isolated checks.

No real membership, inquiry, payment or destructive admin data was submitted. Backend handlers, schemas, request contracts, authorization, validations, editors/uploads, publication boundaries, metadata and destinations remain unchanged. Final tests use synthetic local accounts with sanitized provider configuration and a mail sink.

## Rendered visual review

Live Chrome: 1920px landing, 1440px informational page, 320px login and both overlays; the final mobile menu measured left 16px, right 289px, top 90px with header bottom 78px. Login padding measured 18px; menu trigger 44px. Escape restored appearance-trigger focus. Screenshots were inspected for actual composition, rather than inferred from CSS.

Final saved screenshots were manually reviewed for wide member overview and payment workspace, 1024px metrics, 768px member application/profile, narrow access/member/admin screens, publishing and preview surfaces, dark/light themes and missing/error states. The final gallery contains every captured route state: `.local/phase4/gallery/index.html`; overview contact sheets are orientation aids, with full screenshots available for readable inspection. These are representative manual reviews, not a claim of manual pixel review of every one of the 1,062 frames.

## Performance and assets

No new assets, frameworks, dependencies or effects were introduced. Approved local fonts are 27,348 and 37,640 bytes. The watercolor source remains 492,082 bytes; community and knowledge art 246,484 / 245,432 bytes. Existing Next Image responsive sizes, explicit dimensions, priority hero and lazy chapter art are retained. Overlay effects use transform/opacity only, one 180ms entrance, no loops; live reduced motion removes them.

Local PerformanceObserver samples use cold Chrome contexts and a warm local production server in the DB-disabled read-only preview, unthrottled, with competing QA finished. These default-content samples exclude database and provider latency. They measure lab observations rather than hosted/field Core Web Vitals or physical-device performance. Samples use latest build `vneT_bLEJ5YAq9bsbPOQs`. Existing startup long tasks were observed and retained in the evidence; no field interaction score is claimed. Full resource sizes and long tasks are in `.local/phase4/performance/results.json`.

| Route | Width | Observed LCP (ms) | Observed CLS | Long tasks | Transferred bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| / | 390 | 308 | 0.00000 | 2 | 308925 |
| /about | 390 | 124 | 0.00000 | 0 | 255793 |
| /login | 390 | 268 | 0.00000 | 2 | 259520 |
| / | 1440 | 236 | 0.00000 | 2 | 417159 |
| /about | 1440 | 132 | 0.00000 | 0 | 260045 |
| /login | 1440 | 160 | 0.00000 | 1 | 266865 |
| / | 1920 | 208 | 0.00000 | 2 | 542847 |
| /about | 1920 | 160 | 0.00000 | 2 | 260046 |
| /login | 1920 | 180 | 0.00000 | 2 | 266281 |

## Remaining issues and verification limits

- **P1 release gates:** no hosted/provider, production data, real inbox or physical-device acceptance was performed. Deployment remains unauthorized.
- **P2 coverage limits:** dedicated worker/photo rehearsals above are not fresh Phase 4 evidence. Screen-reader testing, complete keyboard traversal of every dialog and every permission combination were not performed; automated axe and the documented keyboard journeys provide bounded evidence.
- **P2 performance limits:** no Chrome DevTools MCP trace/insight tools were available; no Lighthouse, throttled CPU/network benchmark, field INP or hosted percentile measurements were executed. Local samples cannot establish production performance.
- **P3 maintenance:** historical CSS selector layering remains where consolidation would broaden this finishing pass. Shared control/focus tokens and the specific conflicts identified here are aligned; authored public presentation remains intentional.

No unresolved major visual defect was observed in the inspected states. This is bounded local acceptance, not perfect responsiveness or complete accessibility certification.

## Changed files

- `src/app/globals.css`: panel/menu sizing, control/focus consistency, shared table widths, empty-table fill, metric layout, reduced-motion-aware overlay entrance.
- `src/app/preview/admin/review-workspace.tsx`: named, keyboard-focusable preview table scroll region; local preview handlers retained.
- `src/app/admin/page.tsx`: semantic metric link presentation; existing data, handlers and destinations retained.
- `scripts/verify-phase3-design.mts`: reuse route inventory for Phase 4 widths, long synthetic content, per-frame resume evidence, table sizing and overlay acceptance. Default Phase 3 evidence path remains separate.
- `scripts/verify-launch-isolated.mjs`: forward optional Phase 4/scout/resume/table audit flags, retaining disposable-database/provider safeguards.
- `docs/PHASE4_PREMIUM_ACCEPTANCE.md`: this acceptance record.

No push, merge, main modification or deployment was performed.
