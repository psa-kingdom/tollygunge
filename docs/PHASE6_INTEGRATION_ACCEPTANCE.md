# Phase 6–8 — Premium integration and full local acceptance

15 October 2026. **IMPLEMENTED. LOCAL ACCEPTANCE PASSED. NOT DEPLOYED.**

The application combines main and the approved redesign while preserving both histories. Exact publication identity, GitHub CI and branch-cleanup outcomes are recorded after direct verification in the private publication manifests. This report does not authorize production deployment.

## Git scope and recovery

- Audited redesign: `34b3a29b8aa98d7fda1b150d0c89274c1cb9d695`.
- Remote main: `6532f3a9d8a58ae462a9902fce95fe01bce4d8a4`; merge base: `93d00250d42e81fb8c983a9f61d977f14d8ba42f`.
- Preserved application: `ae7fadc954207e067778ea80933a6ac79dfbc407`.
- Two-parent merge checkpoint: `8de8a05`. Authoritative simulation and actual merge identified 24 conflicts, reconciled at the hunk level. Main's invitation-review and keyboard-table safeguards were already present in the audited application. The initial merged application source therefore matches that baseline; a redundant Google-font import introduced outside conflict markers was removed.
- Presentation: `ff29b2b`; narrow-table correction: `26462ef`; strengthened browser regression: `df458a504ba0388f9709ff88d08294c595204672`.
- Comparison with main spans **197 files**, including pre-redesign backend, event, CMS, storage, migration and runtime work. This is not a styling-only release.
- Recovery tags preserve the initial tips, application foundation, frontend exercise, earlier release worktrees and pre-existing stash. A verified complete bundle is `../phase6-preintegration-20261015.bundle`, relative to the original app checkout. Recovery refs stay private; the stash is neither applied nor deleted.

No API, service-library, domain, migration, dependency lockfile, Dockerfile, homepage composition, atlas implementation, premium-home stylesheet or imported-asset changes were introduced after the audited baseline. All 29 historical migrations match main after Git line-ending normalization. All ten canonical imported assets match approved reference hashes; four checked-out text files differ only in Windows line endings.

## Actual visual issues and corrections

Visual thesis: calm editorial navy/gold surfaces, intentional widths and readable operational density. Preserve published content, anchors and workflows. Use once-only entrances and short feedback rather than decorative loops.

| Issue found | Implemented correction |
| --- | --- |
| Narrow informational pages underused desktop space | Scoped containers up to 1320px, readable text measures, section title/body columns and natural mobile stacking |
| Plain introductions lacked visual depth | Existing approved watercolor assets on about, membership and resources; no fabricated facts, fees or records |
| Other pages felt static | 450ms once-only section reveals and restrained workspace/account introductions; existing 180ms control/overlay conventions; no animated rows or new loops |
| Empty payment headers broke words across letters at 320px | Whole-word headers in existing focusable scroll tables; browser assertion now covers header readability and keyboard scrolling at 320/390px |

Shared foundations remain in `src/app/globals.css`; public/atlas presentation stays in `src/app/premium.css`. The informational renderer and reveal helper retain their data contracts. Motion respects live reduced-motion changes and content starts visible before enhancement. No new runtime dependency or artwork was added.

**Homepage preservation:** the initial 1440×900 hero and final 1440px full-page captures are pixel-identical to Phase 5. Artwork, tagline arrangement, book/atlas and CTA composition are unchanged. Twelve atlas states pass keyboard operation, focus return, chapter bounds, links/assets, inquiry validation and live reduced motion, with zero writes.

Manual rendered review covered desktop/light and 320px/dark membership, the in-app membership view, 390px/dark member profile, 1024px/light staff overview and 320px/dark payments before/after the fix. The fresh gallery retains every final capture; not every screenshot received manual pixel review.

## Exact executed results

Final Windows build: **`e2jkt1x_uIwWhQOo6Id-d`**. Earlier post-polish build `9G7eFAzHpduXXzcLNxenK` remains separately identified. After the final table CSS correction, the full browser suite and visual audit were repeated.

| Check | Observed result |
| --- | --- |
| Build, lint, typecheck | Exit 0; server and both worker bundles build |
| Unit / supervisor | 106 / five passed |
| Core isolated database/HTTP | 27 passed; all runner stages exit 0, cleanup true |
| Initial full browser suite | 63 passed, 12 skipped, zero failed |
| Final full browser suite | 60 passed, 15 skipped, zero failed; strengthened table regression included |
| Final supplemental outage run | Three passed, zero failed; executes the three outage cases skipped by the final full run's fixture configuration |
| Final rendered audit | 1,062 route states, 82 overlays, 12 authorization checks; zero failures; database cleanup true |
| Additional public audit | 100 states on the earlier post-polish build; HTTP 200 throughout; zero measured overflow, page exceptions or automated WCAG A/AA violations |
| Informational interactions | Six desktop/tablet/mobile light/dark states pass live reduced motion, reveals, destinations and bounds |
| Extended acceptance | All nine stages pass, with CMS successfully rerun after restoring its axe fixture; Event Flow 13, engagement six, operations 16 groups |
| CMS | Six groups, including real browser save/reload/publish, pagination, draft/history boundaries and protected PDFs |
| Standalone email worker | Dependencies and rolling leadership handover pass; sends disabled; cleanup true |
| Linux Docker | Final runtime image builds; non-root layout verified; homepage/login/health HTTP 200 against a disposable database; both deliberately terminated workers restart while web remains available; cleanup true |
| Preservation/security | 29 historical migrations and ten canonical assets verified; 538 tracked files and 45 browser files scanned against two configured values/private-key patterns, zero findings |

Skips are not passes. Three additional outage skips were executed separately. The other 12 comprise three dedicated import-worker scenarios covered by separate acceptance, three supplied-photo cases without their fixture and six duplicate tablet/phone cases owned by desktop tests. Initial failures and retry evidence remain separate.

The scanner is bounded, not universal secret certification. Axe reported incomplete checks in all 100 public states; zero automated violations does not certify assistive-technology behavior. Expected outage/canceled-navigation messages remain in server logs; zero page exceptions does not mean empty server logs.

### Route and viewport matrix

Every family was checked at **320, 360, 390, 430, 768, 1024, 1280, 1440 and 1920px**, in light and dark modes. All 26 filesystem page sources reconcile with navigation and dynamic allowlists. Valid details use synthetic records; missing outcomes are separate.

| Family | Route/actor cases | States |
| --- | ---: | ---: |
| Public homepage, information, details | 10 | 180 |
| Account access/link recovery | 8 | 144 |
| Member/profile/account redirect | 8 | 144 |
| Staff overview, 16 workspaces, editor, profile, redirect | 20 | 360 |
| Read-only previews | 6 | 108 |
| Missing/invalid outcomes | 7 | 126 |
| Total | 59 | 1,062 |

The existing auditor's `--phase4` flag selects nine-width coverage; its fixture labels still say Phase 4. Current build identity, fresh files and execution results establish new Phase 6 captures.

### Feature and notification matrix

| Feature / actors | Verified behavior and evidence |
| --- | --- |
| New account/member/reviewer | Validation, duplicates, verification, activation with another staff session, recovery/revocation, profile save/retry, private documents, submission/review/corrections and direct role denial; core browser/HTTP/member foundation |
| Administrator mass onboarding | 10/50/250 synthetic imports, durable chunks/restart, dedupe, correction, rollback, account-only distinctions and held invitations; approved-account/import/invitation suites |
| Identity notifications | Review-required release, recipient/template controls, invalid/expired links and sink job outcomes; invitation database/HTTP and onboarding journeys; no real inbox claim |
| Staff/member events | Draft/edit/publish, IST/window/visibility/capacity rules, duplicate booking, paid cancellation protection, speakers/resources/flyers and authorized actions; event suites and browser journeys |
| Finance/member payments | Reference submission, allowed manual verification/refund transitions, stale versions, immutable history, historical payee snapshots and financial reconciliation; Event Flow/operations |
| Event/payment mail | Reservation versus confirmation, failure/refund, updates/cancellation, registration context, provider failures and dedupe; sealed jobs and mock/sink transport |
| Attendance/history | Eligibility, duplicates, versioned corrections, per-row bulk errors, historical records, completion/reopening, badges and ownership; operations/browser acceptance |
| Reminders/promotions/announcements | Pauses, offsets, consent/suppression/permission checks, retries, accepted-message preservation and restart/replay dedupe; event suites and worker handover |
| CMS/communications/storage | Draft/publication/history/preview boundaries, canonical people beyond 200 records, permission-filtered lists, private bytes and denied eligibility; CMS/engagement/HTTP/browser acceptance |

Unapproved plan pricing/renewal rules and unavailable external capabilities were not invented or labeled complete. Local substitutes do not prove hosted delivery or storage availability.

## Retained failures and release gates

- Initial build failed because a dependency junction escaped Turbopack's root. Only that junction was removed; local installation from the unchanged lockfile and fresh builds passed.
- Initial CMS/public/atlas accessibility attempts lacked the pre-existing axe fixture. Restoring the fixture enabled successful reruns; assertions/timeouts were not weakened.
- The added route harness initially exceeded PostgreSQL's identifier limit. Its identity guard stopped migration safely; the name was shortened and cleanup verified. Container-probe fixture/typo failures and the successful DB-backed run are retained.
- One quality pass was deferred under local memory pressure, then resumed successfully. An interrupted check is not counted as passed.
- `npm audit` reports five high-severity findings in the existing development lint chain. The production-only audit reports zero. No forced dependency downgrade/upgrade was applied; compatible tooling remediation is separate work.
- Supervisor, health-reader and diagnostic source match the locally preserved availability hotfix after line-ending normalization. Full hosted artifact equivalence remains unverified.
- Production migration identity/checksums, fresh backup/restore, providers/inbox/R2, physical devices, human accessibility and capacity remain separate release gates. Do not deploy an older reviewed tarball or treat local success as production acceptance.

## Evidence and publication

Private evidence is archived under `.local/phase6-evidence/phase6` in the canonical app checkout: acceptance summary, logs/results, conflict decisions, `routes-final/inventory.json`, screenshots, gallery, integrity/pixel comparisons, Docker checks and failure history. Supporting synthetic workflow artifacts are alongside it under `.local/phase6-evidence`.

`publication.json` and `branch-cleanup.json` record exact tips, GitHub CI, unchanged production identity and cleanup after direct verification. Recovery refs/bundles and the pre-existing stash remain intact. No production deployment, live migration/settings change, real email or payment transaction is authorized by this phase.

## Per-file conflict reconciliation

Decisions apply to reviewed hunks. Both-parent history, unchanged service/API/domain source relative to the audit and fresh behavioral checks independently support preservation.

| Conflict path | Retained intent |
| --- | --- |
| docs/DELIVERY_CHECKLIST.md | Retain dated hosted closeout alongside main publication gates. |
| docs/FINAL_LAUNCH_GATE.md | Retain scoped hosted retests without closing outstanding launch gates. |
| docs/INDEPENDENT_QA_CLOSEOUT.md | Retain dated evidence and main publication history. |
| docs/MAIN_RELEASE_ACCEPTANCE.md | Retain publication and later scoped hosted acceptance. |
| scripts/start-runtime.mjs | Keep credential isolation plus independent worker restart, backoff and writable health path. |
| scripts/verify-launch-isolated.mjs | Keep main acceptance stages plus provider scrubbing, outage and separate design output. |
| scripts/verify-launch-public.mts | Keep bounded hosted reads plus allowlisted local theme and viewport audit. |
| src/app/admin/page.tsx | Keep role-filtered main operational data with aligned metric markup. |
| src/app/admin/workspaces/[workspace]/page.tsx | Keep main invitation/payment capability props and website/promotion guards. |
| src/app/api/member/events/route.ts | Keep main membership/window/payment protections plus snapshots, closed-state guards and reference versions. |
| src/app/api/staff/attendance/route.ts | Keep confirmed-registration eligibility and event-first locks plus corrections, versions, batch outcomes and legacy API. |
| src/app/api/staff/events/route.ts | Keep main capacity/fee/window restrictions plus schedule revision, speakers, lifecycle and payment freezing. |
| src/app/api/staff/registration-payments/route.ts | Keep main transition/permission checks plus immutable history and financial invalidation. |
| src/app/api/staff/registrations/route.ts | Keep main cancellation transaction and add editable-event protection. |
| src/app/events/[id]/page.tsx | Keep public published-only reads and manual-payment wording plus lifecycle/speakers/resources. |
| src/app/globals.css | Preserve main local-font performance intent using licensed premium local fonts, shared tokens and table focus. |
| src/app/layout.tsx | Preserve local fonts, appearance/skip link, configurable metadata failure fallback and noscript shell. |
| src/components/event-manager.tsx | Preserve main management handlers with IST, lifecycle, speakers/reminders, payment snapshots and accessible tables. |
| src/components/member-editor.tsx | Keep versioned edit form and Person-ID governance navigation. |
| src/components/member-events.tsx | Keep booking/manual-payment flows plus event-specific instructions, reference, attendance and retry states. |
| src/components/member-register.tsx | Keep main explicit invitation review and held filtering plus direct Person-ID selection. |
| src/components/registration-payments.tsx | Keep main focusable empty table plus event scope, history, transition states and refresh callback. |
| src/domain/operations.ts | Keep main fee/window rules plus bounded speakers/reminders and CMS presentation fields. |
| src/lib/event-mail.ts | Keep sealed transaction/dedupe and manual-payment wording using registration-aware shared templates. |
