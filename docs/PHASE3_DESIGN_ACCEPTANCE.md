# Phase 3 design-system integration acceptance

Result: **PASS for available isolated Phase 3 acceptance.**

Branch: codex/tpa-premium-redesign. Baseline: 76c92b2. Implementation is local; no push, merge, deployment or Phase 4.

## Direction and preservation

Visual thesis: cream paper and navy working surfaces, restrained gold accents and editorial titles, with practical Jakarta typography for tasks. Content hierarchy: page identity, current status, working surface, then secondary context. Interaction thesis: clear focus, 180ms control feedback, and quiet user-triggered transitions; no operational entrance loops or animated table rows.

The installed frontend-skill and installed Next CSS guidance informed this implementation. Existing Next App Router, React components, CSS and dependencies remain in use. Public artwork, atlas, licensed fonts and attribution are retained.

Shared foundations consolidate semantic action colors, control/panel radii, spacing, popover shadow, focus and reduced-motion handling in globals.css. The existing member/staff shells, forms, tables and panels use these foundations. Public/atlas presentation remains in premium.css. Native checkbox/radio semantics, readonly/invalid/disabled states and authored preview canvases remain intact.

Destructive actions (event cancellation, preset deletion, publication withdrawal and profile rejection/revocation) use semantic danger styling while retaining their existing handlers and confirmations. Admin overview attention is a compact full-width working panel; navigation shortcuts use a flat section instead of another nested card.

Before edits, table components were identified as holders of data, filtering, pagination and mutation handlers. Their changes add labeled scroll regions. Tables with an existing keyboard-scroll contract retain their own focus target; other tables scroll through the focusable container. LoadingScreen retains its status/live region and domain copy; styling moves from inline legacy colors to shared rules. Fallback CSS retains independent color/font fallbacks so outage routes do not require database, session, remote assets or the normal shell.

Authentication, permissions, API/domain/database code, workers, form handlers, request shapes, dependencies, branding configuration and reference assets remain unchanged from 76c92b2. Financial history, invitation holds, publication boundaries and private profile/document behavior are preserved.

## Route inventory

The audit reconciles all **26 filesystem page entrypoints** with the public page allowlist, sixteen permission-filtered staff workspaces, five preview workspaces, redirects and dynamic detail fixtures. It records **59 route/actor/state cases**, each checked at 1440, 1024, 768, 390 and 320px in light/dark modes. UUIDs below denote local synthetic records, never production records.

| Route | Implementation source | Access | State | Status |
| --- | --- | --- | --- | --- |
| `/` | `src/app/page.tsx` | public | published settings/media, CTAs, inquiry native validation; atlas keyboard/focus/reduced motion | PASS · 10 visual states |
| `/about` | `src/app/[page]/page.tsx` | public | rendered | PASS · 10 visual states |
| `/governance` | `src/app/[page]/page.tsx` | public | rendered | PASS · 10 visual states |
| `/membership` | `src/app/[page]/page.tsx` | public | rendered | PASS · 10 visual states |
| `/events` | `src/app/[page]/page.tsx` | public | rendered | PASS · 10 visual states |
| `/resources` | `src/app/[page]/page.tsx` | public | rendered | PASS · 10 visual states |
| `/contact` | `src/app/[page]/page.tsx` | public | rendered | PASS · 10 visual states |
| `/join` | `src/app/join/page.tsx` | public | account registration or unavailable state; event return destination | PASS · 10 visual states |
| `/signup` | `src/app/signup/page.tsx` | public | required/password validation, save/signup failure and success; event return destination | PASS · 10 visual states |
| `/login` | `src/app/login/page.tsx` | public | sign-in, disabled provider, validation/error and account switch | PASS · 10 visual states |
| `/invitation` | `src/app/invitation/page.tsx` | public | missing-link recovery | PASS · 10 visual states |
| `/email-verification` | `src/app/email-verification/page.tsx` | public | missing-link recovery | PASS · 10 visual states |
| `/forgot-password` | `src/app/forgot-password/page.tsx` | public | request form, sender-disabled notice, validation and recovery flow | PASS · 10 visual states |
| `/reset-password` | `src/app/reset-password/page.tsx` | public | missing-link recovery | PASS · 10 visual states |
| `/unsubscribe` | `src/app/unsubscribe/page.tsx` | public | missing-link recovery | PASS · 10 visual states |
| `/events/[id]` | `src/app/events/[id]/page.tsx` | public | rendered | PASS · 10 visual states |
| `/flyers/[id]` | `src/app/flyers/[id]/page.tsx` | public | rendered | PASS · 10 visual states |
| `/resources/[slug]` | `src/app/resources/[slug]/page.tsx` | public | rendered | PASS · 10 visual states |
| `/member` | `src/app/member/page.tsx` | signed-in account | empty/verification states, separate membership/payment badges, service destinations | PASS · 10 visual states |
| `/member/application` | `src/app/member/application/page.tsx` | signed-in account | five steps, required fields, draft/save/retry, review/submission and legacy compatibility | PASS · 10 visual states |
| `/member/events` | `src/app/member/events/page.tsx` | signed-in account | empty/history, reservation, reference, payment/attendance/resource states | PASS · 10 visual states |
| `/member/inquiries` | `src/app/member/inquiries/page.tsx` | signed-in account | inquiry form, validation, assignment/follow-up contracts | PASS · 10 visual states |
| `/member/payments` | `src/app/member/payments/page.tsx` | signed-in account | empty/active bank instructions, historical event payee provenance | PASS · 10 visual states |
| `/member/security` | `src/app/member/security/page.tsx` | signed-in account | password requirements, validation and account navigation | PASS · 10 visual states |
| `/account/profile` | `src/app/account/profile/page.tsx` | signed-in account | private edit/preview, published snapshot, save/retry/privacy, responsive tabs and upload-disabled state | PASS · 10 visual states |
| `/account` | `src/app/account/page.tsx` | signed-in account | redirect to member | PASS · 10 visual states |
| `/account` | `src/app/account/page.tsx` | staff | redirect to admin | PASS · 10 visual states |
| `/admin` | `src/app/admin/page.tsx` | staff | permission-scoped attention/counts, empty state, workspace shortcuts | PASS · 10 visual states |
| `/admin/workspaces/members` | `src/app/admin/workspaces/[workspace]/page.tsx` | members:review | search/pagination, held/account/member distinction, record details | PASS · 10 visual states |
| `/admin/workspaces/verification` | `src/app/admin/workspaces/[workspace]/page.tsx` | members:review | requirements, selection, reasons, corrections and badge retention | PASS · 10 visual states |
| `/admin/workspaces/onboarding` | `src/app/admin/workspaces/[workspace]/page.tsx` | staff:manage | import modes, validation/correction export, progress/reload/retry; invitation holds | PASS · 10 visual states |
| `/admin/workspaces/crm` | `src/app/admin/workspaces/[workspace]/page.tsx` | communications:manage | search/filter, record selection, assignment and follow-up | PASS · 10 visual states |
| `/admin/workspaces/communications` | `src/app/admin/workspaces/[workspace]/page.tsx` | communications:manage | tabs, inbox, templates, campaigns and release review boundaries | PASS · 10 visual states |
| `/admin/workspaces/events` | `src/app/admin/workspaces/[workspace]/page.tsx` | events:manage | editor, registration, manual verification, attendance, expenses/resources and completion | PASS · 10 visual states |
| `/admin/workspaces/flyers` | `src/app/admin/workspaces/[workspace]/page.tsx` | events:manage | selection, current preview/export, draft/published/archive variants | PASS · 10 visual states |
| `/admin/workspaces/imports` | `src/app/admin/workspaces/[workspace]/page.tsx` | events:manage | CSV/XLSX validation, preview and confirmation/history contracts | PASS · 10 visual states |
| `/admin/workspaces/website` | `src/app/admin/workspaces/[workspace]/page.tsx` | content:publish | settings/page/homepage drafts, preview/publish/reload; links and protected downloads | PASS · 10 visual states |
| `/admin/workspaces/content` | `src/app/admin/workspaces/[workspace]/page.tsx` | content:publish | draft/editor/counter/preview, publication and archive boundaries | PASS · 10 visual states |
| `/admin/workspaces/media` | `src/app/admin/workspaces/[workspace]/page.tsx` | content:publish | upload/details, explicit publication and withdrawal | PASS · 10 visual states |
| `/admin/workspaces/governance` | `src/app/admin/workspaces/[workspace]/page.tsx` | content:publish or members:review | tabs, people/groups, pagination, publication/archive/private profiles | PASS · 10 visual states |
| `/admin/workspaces/payments` | `src/app/admin/workspaces/[workspace]/page.tsx` | payments:manage | empty keyboard table, manual status review, bank/QR drafts and activation | PASS · 10 visual states |
| `/admin/workspaces/onboarding-email` | `src/app/admin/workspaces/[workspace]/page.tsx` | staff:manage | template draft/review, readiness and disabled-provider feedback | PASS · 10 visual states |
| `/admin/workspaces/reports` | `src/app/admin/workspaces/[workspace]/page.tsx` | any staff role | permission-scoped filters, preset/export contracts; keyboard-scrollable results | PASS · 10 visual states |
| `/admin/workspaces/access` | `src/app/admin/workspaces/[workspace]/page.tsx` | staff:manage | verified account roles, search and audit; no member exposure | PASS · 10 visual states |
| `/admin/content/[id]` | `src/app/admin/content/[id]/page.tsx` | content:publish | rendered | PASS · 10 visual states |
| `/account/profile` | `src/app/account/profile/page.tsx` | staff | staff account shell | PASS · 10 visual states |
| `/preview/admin` | `src/app/preview/admin/page.tsx` | public | synthetic records, client-only review/filter/tabs; no live writes | PASS · 10 visual states |
| `/preview/admin/workspaces/events` | `src/app/preview/admin/workspaces/[workspace]/page.tsx` | public | rendered | PASS · 10 visual states |
| `/preview/admin/workspaces/content` | `src/app/preview/admin/workspaces/[workspace]/page.tsx` | public | rendered | PASS · 10 visual states |
| `/preview/admin/workspaces/crm` | `src/app/preview/admin/workspaces/[workspace]/page.tsx` | public | rendered | PASS · 10 visual states |
| `/preview/admin/workspaces/communications` | `src/app/preview/admin/workspaces/[workspace]/page.tsx` | public | rendered | PASS · 10 visual states |
| `/preview/admin/workspaces/payments` | `src/app/preview/admin/workspaces/[workspace]/page.tsx` | public | rendered | PASS · 10 visual states |
| `/missing/route/phase-three` | `src/components/fallback-screen.tsx` | public | not found | PASS · 10 visual states |
| `/events/not-a-uuid` | `src/components/fallback-screen.tsx` | public | not found | PASS · 10 visual states |
| `/events/da6fbae1-577f-4377-b416-860938ac363d` | `src/components/fallback-screen.tsx` | public | not found | PASS · 10 visual states |
| `/flyers/74c2a9e8-1375-4d5c-9933-93b878ac3caf` | `src/components/fallback-screen.tsx` | public | not found | PASS · 10 visual states |
| `/resources/missing-phase-three` | `src/components/fallback-screen.tsx` | public | not found | PASS · 10 visual states |
| `/admin/workspaces/unknown` | `src/app/admin/workspaces/[workspace]/page.tsx` | staff; invalid workspace denied | not found | PASS · 10 visual states |
| `/admin/content/7aa6db7a-2e59-4cbe-a9b3-57ba93371c82` | `src/app/admin/content/[id]/page.tsx` | content:publish | not found | PASS · 10 visual states |

System boundaries: app/loading.tsx, member/loading.tsx and admin/loading.tsx share LoadingScreen; error.tsx, global-error.tsx, not-found.tsx and global-not-found.tsx share recovery presentation. Forbidden routes retain their existing redirect/not-found response. JavaScript-disabled pages retain the existing enable/reload fallback.

## Executed verification

Final application build: **v2YgRP-1IOoEJFutSJARo**. Source edits finished before this build; subsequent changes improve test readiness only.

| Check | Exact result / evidence |
| --- | --- |
| npm run build | PASS; .local/phase3/accepted-build.log |
| npm run lint / npm run typecheck | PASS; lint.log / typecheck.log |
| npm test | 100 passed; zero failures/skips; unit.log |
| Isolated backend/member-foundation/onboarding/baseline HTTP tests | 27 passed, zero skips. accepted-isolated.log; disposable database cleanup confirmed. |
| Full existing browser suite | 63 passed, 12 skipped, zero failures in the final rerun; browser-final.log and browser-final-results.json (exit 0, cleanup confirmed). |
| Complete route audit | 590 states passed, zero overflow, failed assets, broken loaded images, browser errors or automated WCAG A/AA violations. Twelve authorization checks passed. routes-3168/results.json. |
| Public interactions | 12 passed, zero write requests. Current build; accepted-interactions/results.json. Keyboard, atlas assets, fonts, links, native inquiry validation, focus return, live reduced motion and JavaScript-disabled fallback. |
| Website control | Six scenario groups plus nine responsive admin accessibility scans passed; .local/website-control/2026-10-14T06-55-43.233Z. |
| Event flow | Thirteen scenario groups passed, including booking/sign-in/signup, manual payment, attendance, speaker PNG/PDF exports, reminders and mocked delivery; .local/event-flow/2026-10-14T06-57-44.118Z. |
| Event operations | Sixteen scenario groups and three responsive command-center accessibility scans passed, including the complete administrator/member UI lifecycle, four resource uploads, authorized downloads, expenses, attendance and completion; .local/event-operational/2026-10-14T07-01-40.625Z. |
| Worker-backed imports | HTTP acceptance and three browser projects passed; actual worker interruption/restart, reload/retry and correction lineage; zero invitations sent. member-jobs.log. |

Website/event/import acceptance above ran on the preceding Phase 3 build Yg3qei0upLifO-7jcGP_C. The final application change was the table scroll-owner correction; the complete current-build route audit and current-build full browser suite cover that correction. No handlers, contracts, assets or data logic changed between these builds.

Initial local runs exposed dark selected-control contrast, the embedded recovery-panel contrast and the payment table focus regression. Those were corrected and the final 590-state audit is clean. The audit now distinguishes unloaded closed-atlas lazy images from failed assets; open-atlas imagery is independently checked. Two existing browser harness timing races were corrected by awaiting initial data/hydration before manipulating controls; assertions and business checks were retained. One event runner startup collided with the outage-test port; its isolated retry used TPA_EVENT_QA_PORT=3164. Initial failing results and traces remain separate.

Native browser inspection confirmed the current public and preview workspace. Desktop/tablet/phone screenshots, the mobile profile, 320px reporting controls and all primary route compositions in both theme overview sheets were inspected. The full 590-screenshot gallery is .local/phase3/gallery/index.html; screenshots establish visual evidence, not hosted readiness.

Reproduction: use the dedicated local root DATABASE_URL=postgresql://tpa_qa@127.0.0.1:55439/postgres. Run verify-launch-isolated.mjs --fallback-outage for database/HTTP/browser acceptance; --browser-only --skip-browser --design-audit with TPA_ISOLATED_PORT=3168 runs the full route audit. Optional TPA_ISOLATED_OUTPUT preserves separate JSON results. Event/website runners use their existing local mocks; no production credentials or recipients are used.

Changed application files: globals.css; fallback-screen.module.css; LoadingScreen; table-region attributes in email deliveries, event manager, historical imports, reports, registration payments, staff access and verification history; danger classes in event manager, reports, verification reviews and website control. Verification changes: route audit, isolated ports/outage runner, event harness readiness and bank-editor hydration wait. premium.css and the approved reference assets remain unchanged.

## Skips and remaining gates

All inventoried routes have shared styling and passed their ten visual states; no local Phase 3 blocker or known unresolved regression remains.

The main browser suite has twelve intentional skips: three worker-backed import cases (all three passed in the separate worker runner), three supplied-committee-photo rehearsal cases (the current disposable fixture does not contain that supplied-content rehearsal), and six duplicate tablet/phone cases for desktop-only session boundaries, persistence checks and the separate viewport matrix. No test expectation was weakened. The supplied-photo rehearsal remains unverified in this phase; reference/media asset files remain unchanged.

Next logs include the existing standalone-start warning and aborted-stream warnings during navigation, plus expected connection errors from the deliberate outage server. These were not browser runtime errors; the route audit and event lifecycle record no client errors.

No hosted/provider/inbox, real-recipient, physical-device or production release claims follow from local acceptance. Comprehensive Phase 4 and existing release gates remain deferred.
