# Event Operations upgrade

12 October 2026 (IST). **Implemented; isolated acceptance passed.** This extends the existing Event Flow baseline and integrates the concurrent Event Promotion Studio work. Production remains unchanged; hosted migration/deployment and real-provider acceptance remain release checks.

## Event Operations

The existing event manager remains the editing entry point. Its overview and disclosures bring booking/payment configuration, embedded payment verification, attendance reconciliation, financials, announcements, resources and manual perks into the selected event. Existing speakers, reminders, transactional queue, worker, flyers and exports are reused. Promotion and resource controls share the canonical engagement component.

Publication remains draft/published/cancelled. Scheduled, registration open/closed, live and past are derived; completion and archive are independent metadata. Completion requires an ended event, finalized attendance and explicit financial-review acknowledgement. Completion freezes operational writes. Reopening requires both event and payment permissions plus a reason, preserves the audit trail, and leaves booking closed. Prepare resources before completion; use audited reopening for subsequent corrections or uploads.

## Payment Accounts

Existing payment accounts and their revisions remain canonical. Drafts can select multiple active accounts; publication freezes their member-visible instructions and QR references. Published configuration changes use an explicit reason and create another immutable application-managed revision. Registrations point to their applicable revision, and the booking-revision archive preserves prior rebookings.

Member instructions resolve the member's own booking revision rather than the current account. Account changes and deactivation do not rewrite configured event history. Authorized historical QR downloads consult the applicable event revision.

Legacy records keep null account provenance: current shared instructions remain the compatibility fallback, clearly labelled as not historically recorded. Existing payments, fees and reference/history rows are preserved; no account is guessed for past bookings. Member-submitted references require ownership, pending/failed payment state, same-origin checks and the registration's latest version.

## Financials

All amounts are integer INR paise. Active booking value and unresolved collectible amounts come from existing registrations. Gross verified receipts and full refunds come from existing valid payment-history transitions, including migration baselines. A legacy refunded baseline implies an original receipt and refund of its recorded fee; the view explicitly identifies that inferred baseline rather than inventing a transfer date.

Net collected = recorded receipts − recorded refunds. Net result = net collected − non-voided recorded expenses. Pending bookings never contribute to net result. Cancelled paid registrations remain received revenue and appear separately as awaiting refund review.

Expenses include category, description, amount, date, vendor/payee, method, account snapshot, notes and an optional finance-only receipt. Edits and voids retain audit evidence and enforce optimistic conflicts. Detailed financials, payment history, expenses and receipts require payment permission. Manual refund recording does not transfer funds.

## Attendance

Registration/payment and attendance are independent. Existing confirmed-registration check-in remains supported. New bulk attended/absent/unmarked corrections enforce confirmation eligibility, registration and attendance versions, event-first locking, correction notes and per-row conflict results. Staff can search/filter and browse attendee pages. Missing check-in is unmarked until staff records/finalizes absence; the member view does not infer absence simply because an event ended.

Finalization marks remaining confirmed, unmarked registrations absent. Attendance changes invalidate finalization. Payment changes invalidate attendance/financial finalization while retaining the original event-settings edit-version contract. Attendance reports count attended outcomes, rather than all outcome rows.

## Member History

The member view provides upcoming/past filtering, selected-event continuation, recorded attendance dates, completed-event attendance badges, own payment transitions, eligible resources and manually granted/revoked perks. Person, Membership and User Account boundaries are preserved.

Resources use the shared private event-asset namespace, separate from onboarding evidence. Member/confirmed/attended/selected/public eligibility is checked at download; finance receipts are excluded from member projections. Recording links require validated HTTPS URLs. Attended resource access requires a current confirmed registration and actual attended outcome; historical footfall remains distinct from resource eligibility.

## Database Changes

Apply the existing `030_event_flow.sql` baseline, then `031_event_engagement.sql`, then `032_event_operations.sql` in ordered migration execution. Earlier migration files remain unchanged by this upgrade.

Migration 032 adds booking closure and completion/archive/finalization metadata, event payment configurations and per-booking revision associations, attendance outcomes/version/notes, completion attendance badges, event operation history, expenses, entitlements and announcement drafts. It extends the canonical engagement asset model for finance receipts and recording links; there is one event-asset table/storage implementation.

Migration backfills preserve existing registration fee/booking evidence and leave historical account provenance unknown. Financial and attendance mutations continue locking the event before child rows. Existing uncommitted work is preserved; this report does not imply a clean or committed checkout.

## Tests

The functional implementation passed on fixed production build `yQkiXXLezySV-FFJ20ZvI`:

- 94 unit tests passed; production build/TypeScript and ESLint passed without warnings.
- Original Event Flow: all 13 scenario groups passed, including actual bundled worker restart/retry, payment history, last-seat concurrency, reminders, three viewport browser journeys and flyer PNG/PDF/QR checks. [Evidence](../.local/event-flow/2026-10-12T11-13-58.411Z/acceptance.json).
- Event Operations: all 15 groups passed, including two-account historical revisions, references, refunds, expense edits/voids, permission boundaries, manual perk grant/revoke and ownership, announcement replay/deduplication, free bookings, bulk attendance conflicts, resource byte equality/access denials, completion/freeze/reopening, full administrator/member UI lifecycle, reviewed promotion and configured reminder. [Evidence](../.local/event-operational/2026-10-12T11-14-23.500Z/acceptance.json).
- Engagement integration: all six groups passed, including private uploads/downloads, finance isolation, anonymous public-resource access, promotion review/eligibility/deduplication/retry, legacy attendance and responsive flyer/resource/member journeys. [Evidence](../.local/event-engagement/2026-10-12T11-14-24.247Z/acceptance.json).
- Desktop 1440px, tablet 768px and phone 390px: no recorded runtime errors or viewport overflow. Automated axe checks recorded zero violations at all three widths. A short decorative brand dot remains a manual contrast-review item; automated results do not establish full accessibility or physical-device acceptance.
- PDF exports were rendered and visually inspected; draft flyers clearly state that the event is not published. Test mail uses a sink/mocked provider, and resource storage uses a localhost mock. Disposable databases were removed.

The original Event Flow assertions remain; only its keyboard Description locator is scoped to the Event details fieldset because the upgrade adds several unrelated description inputs. Defects discovered and corrected include event-edit version compatibility, ambiguous perk-revocation SQL, anonymous download auditing, phone control overflow and keyboard scrolling, and staff draft-flyer preview access.

The final copy-only clarification distinguishes configurable attendance milestone badges from individual event completion badges. Final artifact: `nN1mjlYzqDsnXTtpOBGRs`.

- [Final expanded operations acceptance](../.local/event-operational/2026-10-12T11-20-16.673Z/acceptance.json): all 16 groups passed, including published member-only PNG/PDF exports and decoded member QR, three automated accessibility checks, no failures, and verified fixture cleanup.
- [Final engagement acceptance](../.local/event-engagement/2026-10-12T11-20-01.984Z/acceptance.json): all six groups passed with 13 responsive screenshots.
- [Final preserved browser regression](../.local/event-flow/2026-10-12T11-19-53.089Z/acceptance.json): all eight browser-mode groups passed; original full 13-group functional/worker regression remains the preceding functional-build evidence above. Only the member milestone-badge wording changed between those builds.
- Final check logs: [94 passing unit tests](../.local/event-operations-validation/2026-10-12-final/unit.log), [TypeScript](../.local/event-operations-validation/2026-10-12-final/typecheck.log), [ESLint](../.local/event-operations-validation/2026-10-12-final/lint.log).
- [Final full administrator scenario](../.local/event-operational/2026-10-12T11-20-16.673Z/admin-completed-workshop.png), [member completion/history](../.local/event-operational/2026-10-12T11-20-16.673Z/member-completed-workshop.png), [phone resource controls](../.local/event-engagement/2026-10-12T11-20-01.984Z/resource-panel-390.png).

Final cleanup verified: no event/engagement fixture databases remain; the acceptance servers, browsers, mock storage and exact local QA PostgreSQL cluster were stopped. Evidence artifacts remain local.

The independent [operational acceptance report](EVENT_OPERATIONAL_ACCEPTANCE.md) and [engagement acceptance report](EVENT_ENGAGEMENT_ACCEPTANCE.md) record detailed scenarios, evidence and release boundaries.

## Remaining Limitations

- Hosted migration/reconciliation, backup and recovery validation, provider/worker health, approved inbox delivery, physical-device testing and actual administrator acceptance remain release checks.
- The original pre-upgrade application should not be rolled back blindly after recording new attendance outcomes or booking-closure settings: its queries do not understand these additive semantics. Retain a compatible rollback build or pause new operations while preparing rollback; never delete the additive history to make an older binary work.
- Legacy attendee-array callers retain their response shape; the UI pages filtered rows and the optional paginated API returns 50 rows per page. Existing member event cards show the newest 200 events, payment queues up to 250 rows, and delivery/audit summaries their latest-record limits; milestone totals/resources use the eligible full history.
- Automatic certificates, learning-hour awards, online checkout, partial refunds, tax engines and double-entry accounting remain outside this upgrade. Certificates can be uploaded as protected files.
- Recording links are access-controlled within TPA; the external recording host remains responsible for its own permissions.
- Resources must be prepared before completion or added through audited reopening. Completion acknowledges unresolved amounts; it does not claim that every pending payment/refund has been settled.
