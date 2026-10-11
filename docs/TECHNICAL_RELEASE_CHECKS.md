# Technical release checks — 11 October 2026

The resumed work addresses technical release checks after the real-data rollout. Member import outcomes remain 0 created, 0 updated, 0 skipped, 134 held conflicts and 77 validation failures. Districts remain blank; no invitations are sent. This report supplements [REAL_DATA_READINESS.md](REAL_DATA_READINESS.md), retaining all unresolved gates in [DELIVERY_CHECKLIST.md](DELIVERY_CHECKLIST.md).

## Findings and fixes

The hosted baseline scanned 60 rendered states across 14 public, authentication, member-form and staff routes, desktop/phone widths and light/dark appearance. Fifty-four states flagged either visible-text/accessible-name mismatches or duplicate complementary landmarks. These are rule occurrences, not 54 distinct defects.

- Brand links now take their accessible names from their visible text.
- Application step buttons use their visible number and title as their accessible names.
- The staff sidebar has a distinct landmark name.
- Preview controls and verification records have named group roles. Fallback avatars have image roles. Account initials and the appearance symbol are decorative within an explicitly named button.
- Responses explicitly send `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` and `Referrer-Policy: strict-origin-when-cross-origin`. Same-origin staff previews remain permitted. These narrowly scoped settings follow the [OWASP header guidance](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html).

No schema, import policy, payment values, publication or business records are changed by these fixes. Private QA files and tooling remain excluded from Docker uploads and Git.

## Validation

Uploaded runtime source **8409aec**; Railway deployment **e09ffa3b-34c8-4961-a7ff-a8d87ecacdc0** is SUCCESS on the existing `tpa-web` production service. No services or capacity settings were added. Restricted evidence lives under ignored `.local/real-data`; it contains no shareable member roster.

| Check | Verified result |
| --- | --- |
| Frontend/static | Typecheck, lint and production build pass. The isolated application-step regression passes, preserving legacy Student evidence through the Professional transition. |
| Isolated accessibility | 66 rendered states; zero automated rule violations. The disposable recovery clone was removed after the run. |
| Hosted accessibility | Final sequential run passes all 66 rendered states with zero automated rule violations; initial throttled run is excluded. |
| HTTP/runtime | Hosted release smoke passes public/protected routes, staff reports/inbox/deliveries/media/access and explicit sign-out. The shared mail worker is healthy with processing enabled; editorial uploads are enabled. No recovery email was sent by this pass. |
| Response protection | All three headers pass locally and on hosted `/`, `/login` and anonymous `/api/member/payment-details`; the private API remains 401 with `Cache-Control: private, no-store`. |
| Private boundaries/secrets | Anonymous member/import/governance/payment APIs return 401. No matches for four configured values in 38 rebuilt browser files or seven hosted values in 11 hosted JavaScript files. |
| Data/recovery | All 211 persisted source rows, committed outcomes, source hash and preservation/no-district-inference choices match the restricted upload evidence. The only API/DB shape difference is the documented presentation `error` alias for `reason`. Counts remain six accounts, eleven people, zero memberships, eight onboarding mail jobs and one pre-existing invitation. Original four people, private fields, verification badges and all account credentials remain preserved. The workbook checksum is unchanged. |
| Governance/payment | The final sequential run passes eight portraits, expanded biographies, responsive governance, sticky header and exact bank display at desktop, tablet and phone widths. |

Prior unit/database/HTTP/onboarding/integration suites remain the separate evidence in [REAL_DATA_READINESS.md](REAL_DATA_READINESS.md). This narrowly scoped batch changes markup and response configuration; it does not claim a new full backend-suite or remote-CI run. The original restored recovery database and SQL remain intact. Rollback for these fixes is the preceding production deployment **4628fde7-7847-45b4-afa0-3d487c2dfde7**, requiring no schema reversal.

Final cleanup verification confirms both disposable accessibility databases are absent, port 3126 has no QA listener, the retained recovery database exists and the pre-rollout SQL checksum is unchanged. Zero production records were removed. The final post-browser database audit passes the same preserved counts, persisted outcomes and original private-field/credential comparisons.

`npm audit --omit=dev` reports zero vulnerabilities across 386 production dependencies. The full dependency audit reports five high-severity package entries through one development-only chain: `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. The [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched version. npm proposes downgrading the Next.js lint configuration to 14.2.35; that incompatible downgrade is not applied. Build/lint tooling hardening remains open. No dependency version or lockfile is changed.

The scanner uses axe-core 4.14.0 with WCAG 2 A/AA, 2.1 A/AA, 2.2 AA and best-practice tags. It adds expanded committee biographies, mobile navigation and the account menu, including Escape focus restoration. The [axe API documentation](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md) describes rendered-state limitations. A zero automated-violation result does not establish full WCAG conformance. Human interpretation, unexercised form/dialog states and assistive-technology journeys remain outside this automated result. Staff authentication means the member-only dashboard is not covered by this scanner; prior isolated member journeys are separate evidence.

The final reports retain `incomplete` entries for contrast and visible-label interpretation on symbol/initial controls. Unsupported-ARIA findings are resolved. These retained review entries are not counted as automated passes or a completed manual accessibility audit.

For reproduction, install the pinned scanner in ignored tooling with `npm install --prefix .local/technical-qa --no-save --ignore-scripts axe-core@4.14.0`. `scripts/verify-accessibility-isolated.mts` requires the retained verified recovery snapshot and local administrator credential; it creates a disposable clone, disables outbound mail/storage credentials, runs the fixed build, asserts headers, scans rendered states, exercises the existing application-step regression and removes the clone. `scripts/audit-accessibility.mts` defaults to the canonical hosted site, signs out its sessions and submits no business forms. Do not run general database/HTTP/browser suites directly against `.env.local`, which targets production.

Run authenticated hosted scripts sequentially. An initial concurrent run of accessibility, content and release checks hit the existing sign-in limit (three requests per ten seconds), returning 429 to the accessibility login and final phone-payment login. Protection was left enabled; incomplete runs are retained as restricted evidence and excluded from successful acceptance counts.

## Retained gates

Physical-device testing, teammate usability, manual screen-reader acceptance, the human recovery/password sign-in exercise and exact legacy synthetic-fixture cleanup remain open. Source address corrections and duplicate/existing-identity decisions remain necessary for member eligibility. Large synchronous import transport, Google/WhatsApp, consent and membership/payment/refund/learning/news policies remain separate gates.

Strict CSP/nonces and HSTS rollout are not introduced by this batch. They require a compatibility and persistent-HTTPS policy review; the three verified headers are a limited hardening result. Bank display verification does not establish successful collection, reconciliation or refunds. No blanket production-readiness claim is made.
