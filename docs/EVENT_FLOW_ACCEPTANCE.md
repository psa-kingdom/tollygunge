# Event flow implementation and acceptance

Date: 12 October 2026 (IST). Status: implementation and isolated acceptance passed. Hosted rollout remains subject to release review.

## Changes

| Area | Finding | Implemented behavior |
| --- | --- | --- |
| Reminders | No pre-event scheduler | Durable per-event schedules, up to three offsets from 15 minutes to seven days, optional pending-payment messages |
| Reminder validity | Event/payment changes could make a scheduled message obsolete | Recheck event, schedule revision, booking revision, registration and payment state immediately before delivery; preserve accepted-message history |
| Rebooking | Reusing a registration identifier could retain an old schedule | Separate booking revision; invalidate prior booking jobs |
| Cancellation | Member self-cancellation did not send mail | Transactional cancellation notice; repeated cancellation does not duplicate mail |
| Payment evidence | Current reference and note were overwritten by status updates | Append-only payment transition history with previous and new references/notes |
| Confirmation | Sparse emails omitted practical details | Event time in IST, venue/joining instructions, fee, payment state, registration identifier and event/payment links |
| Speakers | Flyer-only data limited to two speakers | Shared ordered event speaker list, add/remove/reorder controls, up to six speakers |
| Flyers | Paid events were labelled free | Actual fee/manual verification and booking status; adaptive one/two-column speaker layout |
| Flyer text | A maximum-length name with long words could fail preview generation | Measure before drawing and wrap long words across remaining line space; verified 60-character names and 120-character credentials |
| Registration links | Member-only flyers used a public-only route; sign-in lost the selected event | Visibility-aware QR destinations and restricted event continuation through sign-in/signup |
| Public event markup | Nested paragraphs could cause hydration errors | Valid markup, speaker details, IST dates and booking-state messaging |
| Staff workflow | No event-specific email/reminder delivery view | Latest 100 messages and reminders with distinct scheduled/queued/accepted/delivered/failed/skipped states and reasons |
| Member workflow | Payment instructions and registration reference were separate | Amount, reservation state, identifier and published payment instructions together; expandable speaker details on member cards |

## Verification

- Unit suite: 85 tests passed, including four event-flow validation, email, IST and safe-continuation tests.
- Production build and type compilation: passed.
- ESLint: passed without warnings.
- Fixed production build identifier: `-iexbiEG9wVfx5AB_QWrk`.
- Combined isolated acceptance: passed all 13 scenario groups against the fixed production build. Completed 12 October 2026 at 10:21 IST; disposable database and local server were cleaned up successfully (command exit 0).
- Browser acceptance: Chrome desktop 1440px, tablet 768px and phone 390px; 17 screenshots, no recorded page errors or horizontal overflow in the checked journeys. Keyboard focus and anonymous sign-in/signup continuation passed.
- Exports: one, two, three and six speakers; all four PNGs are 1080 by 1350, and public/member-only QR destinations decode correctly. All four PDFs contain one page, measure 810 by 1012.5 points, and render at 1080 by 1350 with Poppler at 96 DPI. Every PDF page was visually inspected; text and QR codes remain readable without clipping or overlap.
- Synthetic recipients use `example.invalid`. Real transport credentials are removed; provider/quota behavior is mocked. No real payment transfer, external email, publication or hosted migration occurs.

### Acceptance coverage

| Group | Verified |
| --- | --- |
| Migration | Legacy flyer speakers, paid-registration amount/reference/note and templates preserved; existing reminders disabled |
| Registration and payments | Free/paid bookings, reservation deduplication, last-seat concurrency, windows, draft/member restrictions, stale edits, failed/paid/refunded transitions, immutable transition history, cancellation and rebooking restrictions |
| Emails | Reservation versus confirmed wording, event updates/cancellation/self-cancellation, transactional queue deduplication, mail sink acceptance, retry, suppression and signed delivered/bounced projections |
| Reminders | Three distinct offsets, confirmed/pending audiences, late registrations, rescheduling, settings changes, cancellation, concurrent scheduling, exact catch-up boundary and expiry before/after event start |
| Worker | Real compiled worker pause/enable/restart, quota pause, transient retry and expired lease recovery without duplicate reminders |
| Browsers | Event creation/publishing/editing, speaker reorder, reminder configuration, public details, login/signup continuation, member reservation, staff payment verification and confirmed attendance at three viewport sizes |
| Flyers | One/two/three/six speakers, maximum name/credentials, correct fee, visibility-aware QR links, PNG dimensions, PDF structure and rendered page inspection |

### Evidence and screenshots

Full run: [machine-readable acceptance results](D:/Downloads/Workspace/TPA/app/.local/event-flow/2026-10-12T04-43-33.972Z/acceptance.json). Evidence remains local under `.local/`; it is not committed or published.

- [Desktop event editor](D:/Downloads/Workspace/TPA/app/.local/event-flow/2026-10-12T04-43-33.972Z/desktop-event-editor.png), [tablet event editor](D:/Downloads/Workspace/TPA/app/.local/event-flow/2026-10-12T04-43-33.972Z/tablet-event-editor.png), [phone event editor](D:/Downloads/Workspace/TPA/app/.local/event-flow/2026-10-12T04-43-33.972Z/phone-event-editor.png).
- [Phone reservation and payment instructions](D:/Downloads/Workspace/TPA/app/.local/event-flow/2026-10-12T04-43-33.972Z/phone-pending-payment.png), [public event](D:/Downloads/Workspace/TPA/app/.local/event-flow/2026-10-12T04-43-33.972Z/phone-public-event.png), [confirmed attendance](D:/Downloads/Workspace/TPA/app/.local/event-flow/2026-10-12T04-43-33.972Z/confirmed-attendance-390.png).
- Rendered PDFs: [one speaker](D:/Downloads/Workspace/TPA/app/.local/event-flow/2026-10-12T04-43-33.972Z/flyer-1-speakers-rendered.png), [two speakers](D:/Downloads/Workspace/TPA/app/.local/event-flow/2026-10-12T04-43-33.972Z/flyer-2-speakers-rendered.png), [three speakers](D:/Downloads/Workspace/TPA/app/.local/event-flow/2026-10-12T04-43-33.972Z/flyer-3-speakers-rendered.png), [six speakers and long text](D:/Downloads/Workspace/TPA/app/.local/event-flow/2026-10-12T04-43-33.972Z/flyer-6-speakers-rendered.png).
- Original PDFs: [one](D:/Downloads/Workspace/TPA/app/.local/event-flow/2026-10-12T04-43-33.972Z/flyer-1-speakers.pdf), [two](D:/Downloads/Workspace/TPA/app/.local/event-flow/2026-10-12T04-43-33.972Z/flyer-2-speakers.pdf), [three](D:/Downloads/Workspace/TPA/app/.local/event-flow/2026-10-12T04-43-33.972Z/flyer-3-speakers.pdf), [six](D:/Downloads/Workspace/TPA/app/.local/event-flow/2026-10-12T04-43-33.972Z/flyer-6-speakers.pdf).

## Interfaces and migration

`030_event_flow.sql` adds event speaker/reminder configuration, schedule and booking revisions, durable reminder records, event/registration mail association and payment history. Existing flyer data is copied into events without deleting templates. Existing events default to reminders disabled; events created through the API default to confirmed-attendee reminders 24 hours and one hour before starting.

Event save interfaces accept `speakers` and `reminders`. Flyer APIs retain `template_version` as a compatibility field backed by the event's current version; saving flyer speakers now updates the canonical event speaker list. Staff event, attendance and flyer edits therefore share optimistic conflict protection. The event delivery endpoint requires `events:manage`; payment history remains behind `payments:manage`.

The worker checks scheduling every 30 seconds to avoid scanning all future registrations on every delivery tick. The scheduler persists both eligible audience schedules when pending-payment reminders are enabled. At each due time only the current audience is mailed; the other schedule is marked skipped. Missed reminders are eligible for a maximum 15-minute catch-up window, and never after the event starts. Retries use the existing durable queue/provider idempotency; expiry or changed eligibility prevents further sending.

## Reproduce

```powershell
npm test
npm run typecheck
npm run lint
npm run build
npm run test:events
node --import tsx scripts/test-flyer-layout.mts
```

The acceptance command creates a database named `tpa_event_test_<random suffix>`, applies ordered migrations, starts the fixed production build at localhost port 3144, creates synthetic accounts, runs HTTP/database and Chrome desktop/tablet/phone journeys, captures screenshots and exports, and drops the disposable database in `finally`. Chrome is used by default; `TPA_BROWSER_CHANNEL` and `TPA_EVENT_TEST_PORT` override browser/port. Evidence is saved under `.local/event-flow/`. Focused `--browser-only` and `--worker-only` modes reuse the same isolated setup. The canvas-only flyer check exercises the actual shared renderer without database/network dependencies.

## Release boundaries and limitations

- Hosted rollout and applying migration 030 still require release review. Apply migration before starting the new web/worker version. Review sender readiness, active association payee instructions, provider quota and worker health before enabling reminders for hosted events.
- `EVENT_REMINDERS_ENABLED=false` pauses scheduling and reminder claims without disabling confirmation or account emails. Existing per-event settings remain saved. Re-enabling respects the catch-up/expiry rules.
- Manual bank/UPI verification remains the collection model. A recorded refund describes a staff-performed refund; the application never transfers or refunds money itself.
- Provider acceptance, signed delivery projection and mailbox receipt are distinct evidence. This pass uses a mail sink/mocked transport and synthetic signed webhooks; real inbox receipt remains an approved-test-inbox release check.
- Speaker portraits and online checkout are outside this implementation. Flyers contain names and credentials. The staff delivery view is capped at the latest 100 records.
- Desktop/tablet/phone checks use Chrome viewport sizes, not physical mobile devices. Real-device acceptance remains a release check.
- Previous uncommitted work remains present. No commit, push or deployment is performed.
