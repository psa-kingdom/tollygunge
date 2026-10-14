# Event Platform - Operational Acceptance

Date: 12 October 2026 (IST).

## Decision: PARTIAL

The complete administrator/member lifecycle passes isolated operational acceptance. This is not a production-readiness claim: hosted rollout, approved inbox delivery, real payment reconciliation, physical-device checks and actual administrator acceptance remain unverified in this pass. No production writes, deployment, external email or real payment transfer was performed.

The implementation extends the existing event system and preserves its accepted registration, payment, reminder and flyer behavior. It adds the event command center, saved payment revisions, attendance reconciliation, financial close, expenses, private resources, completion badges, manual perks and reviewed promotions.

## Evidence

Final build: `nN1mjlYzqDsnXTtpOBGRs`. The preceding functional build `yQkiXXLezySV-FFJ20ZvI` passed the complete original Event Flow and engagement suites. The final build changes only milestone-badge wording; the complete operational suite, including affected member UI, passed again on that build.

| Verification | Result | Evidence |
| --- | --- | --- |
| Independent operational acceptance | PASS, 16 groups; exact disposable database cleanup | `.local/event-operational/2026-10-12T11-20-16.673Z/acceptance.json` |
| Preserved Event Flow acceptance | PASS, all 13 original groups | `.local/event-flow/2026-10-12T11-13-58.411Z/acceptance.json` |
| Engagement acceptance, final build | PASS, 6 groups | `.local/event-engagement/2026-10-12T11-20-01.984Z/acceptance.json` |
| Preserved browser journeys, final copy build | PASS, 8 groups | `.local/event-flow/2026-10-12T11-19-53.089Z/acceptance.json` |
| Unit suite | PASS, 94 tests, zero failures | `.local/event-operations-validation/2026-10-12-final/unit.log` |
| Build and type checking | PASS, final production build and type check | Final build ID above; `.local/event-operations-validation/2026-10-12-final/typecheck.log` |
| ESLint | PASS, exit 0 without warnings/errors | `.local/event-operations-validation/2026-10-12-final/lint.log` |
| Responsive and automated accessibility | PASS, Chrome 1440/768/390px; zero WCAG violations in checked command-center states | Independent acceptance `accessibility` and screenshot records |
| Public/member flyers | PASS, PNG/PDF, QR destinations and visual review | Public one/six speaker PDFs in Event Flow evidence; member PNG/PDF in operational evidence |

Evidence folders contain screenshots, exports and server logs. Records and recipients are synthetic; object storage runs on loopback and transport is mocked. Unexpected external HTTPS is rejected by the operational test shim. Automated checks do not establish real inbox receipt or physical-device accessibility.

Latest final artifacts: `command-center-1440.png`, `command-center-768.png`, `command-center-390.png`, `admin-completed-workshop.png`, `member-completed-workshop.png`, `operational-workshop.pdf` (draft), `member-workshop-published.png`, `member-workshop-published.pdf`, and `member-presentation.pdf` in the operational evidence folder. Draft and published member PDFs were rendered with Poppler at 96 DPI and visually inspected; both are single-page 810 by 1012.5 point PDFs. The published member QR decodes to the selected member event route. Public one/six-speaker PDFs were likewise rendered and inspected without clipping or overlap.

## Completed lifecycle

The browser scenario creates a realistic paid member workshop, sets information/speaker/fee/capacity/reminders, selects an association payment account, exports a draft flyer, publishes, exports the published member flyer, reviews and approves a promotion, reserves a place, submits a payment reference, verifies it as staff, records attendance, adds expenses, uploads four resources, completes the event, displays the member's attendance badge and downloads the presentation from the member portal.

Promotion scheduling/transport and the configured reminder use the same workshop. Controlled time advances exercise the reminder offset and event-end boundary. Fixture account creation and time advancement are test setup; no event operation requires a developer endpoint or a manual database repair.

Completion follows attendance finalization and explicit financial review. Completed operations are frozen. Administrators can reopen with an audit reason for later expenses, resource changes or corrections, then finalize/review/complete again. Resources are prepared before closure; later post-event additions use this visible reopening workflow.

## Acceptance coverage

| Area | Proven behavior |
| --- | --- |
| Creation and command center | Related event controls, section links, overview, registration/attendance counts, payment configuration, financial results, communications, flyers and resources |
| Publish and visibility | Draft/public/member restrictions, visibility-aware QR links, canonical information and saved account configuration |
| Registration | Eligible/ineligible members, free/paid bookings, duplicate booking, capacity/window boundaries and concurrent last-seat booking |
| Manual payments | Member reference, pending/confirmed states, staff verification, full refund, transition history and cancelled paid refund review |
| Account history | Two accounts and a changed event revision; subsequent bookings receive the new payee while existing bookings retain their original revision |
| Communications | Reviewed promotion audiences, consent/membership/suppression checks, deduplication, announcement replay rejection, transactional mail and reminders |
| Worker | Preserved real compiled reminder worker pause/restart/retry/lease tests; engagement scheduling, quota/retry and accepted-message preservation |
| Attendance | Attended/absent/unmarked, finalization, per-row bulk conflicts, filtering, pagination and audited correction |
| Financials | Booked/pending/receipts/refunds/expenses/net; expense create/edit/void and role separation |
| Resources | PDF presentation/report/reading resource and PNG photo; byte-identical download; denial for anonymous, guest, pending and refunded registrations |
| History and benefits | Attendance date, event badge, resources, payment history, own perk projection and revocation; correction removes badge/access |
| Flyers | Staff draft preview, published exports, one/two/three/six speakers, maximum text, PNG dimensions, PDF structure/rendering and decoded public/member QR |
| Regression and security | Existing unit/HTTP/database/browser coverage retained; permissions, ownership, private downloads, origin/conflict protections and invalid upload checks |

The API financial scenario reconciles two verified receipts of ₹750, one full refund of ₹750, ₹375 expenses and a ₹375 net result; a separate pending ₹750 booking remains explicitly outstanding. The browser workshop records ₹750 received, ₹250 expense and ₹500 net result.

## Failures found and corrected

| Failure / cause | Reproduction | Severity | Fix and retest |
| --- | --- | --- | --- |
| Perk revocation returned 503 because `version` was ambiguous in a joined SQL update | Grant a perk, then revoke its current version | P1 | Qualify entitlement version; ownership/revocation acceptance passes |
| Draft flyer could not be created because staff flyer APIs selected only published events | Save draft with a speaker, open Flyer/Promotion, attempt preview | P1 | Allow staff draft preview/save while retaining public publication gates; strict lifecycle exports before publish |
| Payment/check-in changes invalidated unrelated event edits through the event settings version | Verify payment, then save an otherwise current event edit | P1 | Preserve event settings conflict semantics and separately invalidate close/review state; original Event Flow suite passes |
| Phone registration table could not be keyboard-scrolled when rows had no active controls | Open completed event at 390px; run WCAG checks or keyboard traversal | P2 | Focus the actual scrolling table and label its region; zero final violations |
| Milestone empty-state copy contradicted an individual event attendance badge | Complete attendance with milestone rules disabled; open member events | P2 | Clarify milestone badges separately from event awards; final member screenshot and full operational retest pass |

No unresolved operational blocker remains in the tested final build. The final member screenshot distinguishes milestone badges from individual event attendance awards. All 16 operational groups pass with zero recorded failures and all three checked viewport states have zero automated WCAG violations.

Cleanup verified: zero remaining `tpa_event_test_*` or `tpa_engagement_test_*` databases. Acceptance servers, browsers and mock storage were stopped by their runners. The exact local PostgreSQL cluster started for this pass was stopped after all coordinated acceptance completed. Evidence artifacts remain local.

## Release checks still required

| Unverified check | Why it remains open | Validation / recommended action | Severity |
| --- | --- | --- | --- |
| Hosted web/worker/migrations and actual payment accounts | This pass is isolated and does not deploy | Review backup/migration order, sender/account configuration and worker switches; validate an approved hosted event | Release gate |
| Approved test inbox and provider delivery | Mock acceptance/synthetic callbacks do not prove mailbox receipt | Send only to an explicitly approved inbox; confirm links, receipt and delivery projections | Release gate |
| Actual administrator acceptance | The complete journey is automated browser evidence | Have an administrator operate a disposable rehearsal event without assistance | Release gate |
| Physical devices and assistive technology | Viewport simulation and automated WCAG checks have limited coverage | Check real phone/tablet, keyboard and screen reader workflows | Release gate |

Supported file uploads are PDF/JPEG/PNG up to 5 MB. Native presentation files must be exported as PDF. Payments and refunds are manually performed and verified by staff; the platform records their state and never transfers money.

## Reproduce safely

Use the existing dedicated QA PostgreSQL instance on loopback port 55439. Do not use inherited `.env.local` database credentials: they can point to hosted production.

```powershell
$env:DATABASE_URL = 'postgresql://tpa_qa@127.0.0.1:55439/postgres'
$env:DATABASE_SSL = 'false'
node --import tsx scripts/test-event-operational.mts --browser
```

The runner refuses a non-loopback database or a different port, creates a uniquely named database, clears dotenv credentials for its child server, uses local mock storage, saves evidence, terminates its server/browser and removes its exact database and mock objects. It does not rebuild the application; run against the reviewed fixed production build. `--migration-only` validates additive migration application without lifecycle operations.
