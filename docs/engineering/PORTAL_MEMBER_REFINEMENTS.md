# TPA member-directory refinements — local review

Branch: `feature/portal-member-refinements`, based on main `9912c5513321d20333d49a20030eb13360f828aa`.

## Design reference and decisions

The approved Crazy Hands horizontal shell and the user's five annotated TPA examples remain the reference. This change keeps TPA's logo bytes, blue/white palette, typography roles, appearance controls and permission model. No public-page styles, schemas, dependencies, sending behaviour or production configuration change.

- **Association members:** one Directory tab combines membership records and website accounts. Linked accounts appear once. Accounts without membership have an explicit Account only label; this never implies membership approval. Existing register-only API responses and account-ID deep links remain available. The legacy account detail view links back to the combined directory.
- **Event participants:** the audience selector opens Registrations, Payment status and Attendance through the existing events workspace and protected roster endpoints. These are read-only views; event operations and payment verification remain in their established workspaces and under their existing permissions. Verification and Bulk onboarding stay with Association members. Roles without event access cannot switch into participants; event-only staff cannot access association records.
- **Portal branding:** prominent TPA wordmark, original logo and full accessible organization identity. Public branding is unchanged.
- **Membership:** Verification / Payment details sit beside the page title on desktop and remain horizontally scrollable at small widths.
- **Addresses:** country and PIN precede derived state/district/locality. A complete Indian PIN triggers lookup automatically. Multiple postal localities require an explicit choice. House/building/colony fields remain manual. Existing valid addresses and manual text entered during lookup are preserved. International entry and explicit retry remain supported.
- **Signup:** restrained responsive heading sizing keeps Create your TPA account on one line at the five target widths without clipping.
- **Polish:** long records scroll within tables; floating quick cards shift on both axes to remain inside narrow viewports. Unsaved-edit confirmation also applies to the audience selector.

## Review locally

Use the existing isolated demo at `http://127.0.0.1:3185`. Synthetic credentials remain in the existing private handoff; no passwords or session cookies are stored in this document.

1. Open Members. Switch Record type and the expandable email/phone/profile filters; inspect membership and account-only records. Open account details and return to the association directory.
2. Use People to switch to Event participants; choose an event and switch the three tabs. The retained demo now includes the clearly labelled TPA professional seminar — synthetic review and three synthetic registrations covering verified, pending and no-payment states. No mail was queued and no external payment occurred. Populated participant presentation is additionally exercised with explicitly synthetic API responses in the tracked browser suite.
3. Open member verification and payment details at desktop and phone widths.
4. In Contact & preferences, enter PIN 768018, review the derived geography, and fill the remaining address lines. Use 700001 to exercise locality selection where the postal reference returns multiple offices.
5. Open signup in both appearances and inspect the title at 320, 390, 768, 1024 and 1440px.

Screenshots/gallery: `output/playwright/portal-member-refinements/gallery/index.html` (local synthetic records, light/dark, desktop/phone, plus address detail captures). No hosted or external-provider claim is made.

## Validation evidence

Final optimized build, worker build, typecheck, lint, unit/runtime tests and structure check: `.local/launch-readiness/2026-10-30T06-23-40.710Z-4008af6e/results.json` — seven stages passed; 142 tests passed.

Address acceptance after provisioning the existing postal reference into the disposable demo database: 12/12 passed across desktop, tablet and phone. Covers ambiguity, international entry, unavailable lookup/retry, country-change races, automatic lookup, manual text retention and real structured-address persistence. Earlier missing-reference failures are retained separately in `address-tests`; the successful rerun is `address-verified`.

Final focused interaction/layout run: 2/2 passed, covering viewport-edge preview positioning and one-line signup/right-aligned member navigation at all five widths in both appearances. Evidence: `output/playwright/portal-member-refinements/final-interactions`.

An initial broader regression run found a quick-card edge-positioning defect and an outdated empty-state text expectation. It was stopped after those findings; its disposable database and roles were successfully cleaned. Those findings were corrected before the final run. Final portal rerun: **72 passed, 24 intentionally skipped** (duplicate acceptance-suite runs under tablet/phone; that suite explicitly loops all five viewport widths). Evidence: `.local/launch-readiness/restricted-2026-10-30T06-25-39.796Z-93a95faa/results.json` and `portal.log`. The disposable database and all its registered roles were cleaned successfully. The log retains Next.js destination-stream-closed diagnostics during interrupted navigation; browser assertions, page-error checks and the test process all passed.

## Delivery boundary

Local implementation/review only. Main, production, Crazy Hands and unrelated repositories remain unchanged. Folder cleanup keeps its separate approval gate.

The additional populated participant matrix passed separately after the full suite had been collected: three tabs × five widths × two appearances, including long values and viewport-contained keyboard previews. Evidence: `output/playwright/portal-member-refinements/participant-matrix`. Real protected roster API checks also passed 20/20 against the retained synthetic fixture, without mocked responses: `output/playwright/portal-member-refinements/participant-api.json`.

Optimized build ID: `yPksqCMJIzemEgulx611V`. The candidate is an uncommitted working-tree change on the review branch; the recorded base SHA is not presented as a new release revision. The latest tracked tests also pass typecheck/lint/structure in `.local/launch-readiness/2026-10-30T06-36-26.600Z-d2af8366/results.json`.

## Release authorization — 30 October 2026

The user has authorized committing, pushing, merging and deploying this reviewed candidate. The local-review evidence above is historical acceptance evidence. GitHub checks on the committed candidate, the merged revision, provider deployment status, health and hosted read-only acceptance remain release gates. The verified pre-release Railway runtime is deployment `0b059abf-7ccd-4f35-9a22-c85275b3c3fe` at `9912c5513321d20333d49a20030eb13360f828aa`; retain it as rollback. Preserve one CPU, 1 GB, one replica and existing operational settings.
