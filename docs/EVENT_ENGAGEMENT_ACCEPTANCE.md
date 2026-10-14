# Event engagement upgrade

Date: 12 October 2026 (IST). Status: local implementation and isolated acceptance passed. Hosted release remains separate.

## Flyer system

The existing Flyers route, shared canvas renderer, 1–6 speaker support, PNG/PDF exports and visibility-aware registration QR remain. Saved variants contain only presentation, headline, name and publication state. Event facts come from the event. Saving speakers retains the existing API contract and updates the shared event list. Editing presentation clears the preview; generation, export and publication check current versions. Static exports record generation time. Staff can prepare drafts before event publication; draft exports are explicitly marked and their public sharing is blocked. `/flyers/[id]` renders current published event facts; member-only views require active membership and unpublished/cancelled events are unavailable.

## Speaker model

Ordered event snapshots retain names and credentials and add optional designation, organization and short professional description. Legacy wire shapes and stored values remain readable. Additional fields are validated and displayed on event details; the flyer remains concise. Reusable profiles, portraits and biographies are deferred.

## Promotion foundation

Per-event settings configure registration-open, capacity-pressure, final-registration and upcoming messages. All default off. Saved settings require signed audience/message review and explicit approval before scheduling. Review binds actor, event version, setting version and recipient digest and expires after ten minutes. Event/settings edits invalidate approval. The shared worker evaluates persisted settings every 30 seconds when `EVENT_PROMOTIONS_ENABLED=true`.

Each kind sends once per event after accepted delivery; obsolete unsent versions may be replaced following a new review. Registration/final/upcoming messages have a 15-minute catch-up window and never send after booking closes or the event starts. Capacity pressure uses active registrations versus capacity and never promotes a full event. Pause/resume does not replay expired messages. No independent campaigns platform or frontend timers are introduced.

## Notifications

Promotions reuse campaign jobs, newsletter consent, contact preferences, email verification, suppression, unsubscribe, quota handling, provider idempotency, retry and delivery projection. Eligibility additionally requires active membership and excludes current registrations. Eligibility and sender permissions are rechecked before transport. Existing attendee/payment reminders and transactional confirmations remain independent. The promotion panel shows current eligible count, reviewed samples/messages and latest 100 delivery records.

## Event history

My Events retains existing account registration history and payment/attendance boundaries, with upcoming/live and past period filters. Verified attendance totals count distinct events with `outcome=attended`, including historical records. Cancellation/payment changes do not silently erase recorded footfall. Operational attendance records are shared with the coordinated event operations implementation. To preserve its explicit attendance-finalization contract, ended events with unmarked attendance say attendance has not been finalized; only staff-recorded/finalized absence is presented as absent.

## Perks/assets

Event resources store title, description, category, publication state, eligibility, upload time and optimistic version. PDF/JPEG/PNG files up to 5 MB use a separate private event-assets namespace. File signatures and sizes are checked; failed persistence/storage compensates with deletion and failed cleanup is audited. Downloads stream through the application after authorization with private/no-store headers. Storage keys never appear in member responses.

Initial access rules: public, active members, confirmed registrants, verified attendees and explicitly selected members. Finance-only receipts and authorized HTTPS recording links integrate with the coordinated operations migration. Attendee assets require verified attendance plus an active paid/free-confirmed registration. Selected-account grants use existing member identities. Public assets cannot bypass member-only event visibility. Completed/archived events require audited reopening before resource mutation.

## Badges

Attendance milestone rules have configurable threshold, name, description, built-in icon and enabled state. Editable 1/5/10-event examples start disabled. Earned milestones are derived on read from actual recorded attendance; absent/unmarked rows and registration alone never earn them. Changing/disabling a rule changes its projection. Operations completion badges remain a separate event-level record.

## Member experience

Your Event Journey shows attendance count, enabled earned milestones and resources currently available to the signed-in account. Per-event resources and manual perks integrate with existing My Events. Public event pages expose only published public resources. No other member’s attendance, private audience list or finance receipt is projected into member responses.

## Tests

Baseline before implementation: 85 unit tests and typecheck passed. Added domain tests cover structured speakers, opt-in configuration, schedule/capacity boundaries, resource eligibility, finance exclusion, unsafe links, event-fact separation and badge validation.

Run `node --import tsx scripts/test-event-engagement.mts` against a fixed production build with `DATABASE_URL` set to an isolated local PostgreSQL administrator connection and `DATABASE_SSL=false`. The runner refuses hosted database hosts. It creates/drops only `tpa_engagement_test_<random>`; external transport secrets are removed, storage uses a localhost mock with synthetic credentials and provider sending is injected/mocked. The production application has no test-storage bypass. Evidence is written under `.local/event-engagement/`.

Final verification:

- Unit suite: 94 passed. Typecheck, lint and unified production build passed.
- Final production build: `nN1mjlYzqDsnXTtpOBGRs`. The only difference from the complete functional acceptance build `yQkiXXLezySV-FFJ20ZvI` is clearer milestone-badge wording in the member journey.
- Strict engagement acceptance: all six groups passed again on the final build, command exit 0. Evidence: [.local acceptance](../.local/event-engagement/2026-10-12T11-20-01.984Z/acceptance.json).
- Thirteen engagement screenshots: marked draft flyer plus flyer workspace, resource editor, resource panel and member journey at desktop 1440px, tablet 768px and phone 390px. No recorded JavaScript errors or horizontal overflow in tested journeys; keyboard focus passed. The browser completed a protected upload and signed promotion review/approval.
- Verified all resource eligibility modes, finance isolation, public anonymous file streaming, cancelled/pending attendee denial, unpublished/archived denial, stale resource versions, completion guards, HTTPS redirects and storage-failure compensation. Historical attendance, absent rows, disabled rules, raised thresholds and stale rule conflicts passed.
- Promotion checks passed for signed audience review/tampering/changed recipients, global pause, concurrent scheduling, duplicate prevention, registration exclusion, withdrawal of consent, membership expiry, suppression, booking close/cancellation, schedule/event version changes, retry and accepted-message preservation. Provider sending was mocked; no external emails or storage writes occurred.
- Preserved canvas acceptance passed 1/2/3/6 speakers, long supported text and decoded QR destinations: `.local/flyer-layout/2026-10-12T11-10-27.329Z`.
- Preserved full event acceptance passed all 13 groups on the functional acceptance build `yQkiXXLezySV-FFJ20ZvI`. Its four PDFs were rendered and individually inspected: one page each, 810×1012.5 points, rendered 1080×1350 at 96 DPI; no clipping or overlap and all QR destinations matched original PNGs. Evidence: [.local event acceptance](../.local/event-flow/2026-10-12T11-13-58.411Z/acceptance.json), [.local PDF checks](../.local/event-flow/2026-10-12T11-13-58.411Z/pdf-render-checks.json). Flyer/export code is identical on the final copy build.
- Coordinated operational acceptance passed 15 groups on that functional build, with zero recorded axe accessibility violations, page errors or viewport overflow: `.local/event-operational/2026-10-12T11-14-23.500Z/acceptance.json`. Affected browser journeys are independently rechecked by the coordinated acceptance chat after the final copy change.
- Preserved event browser acceptance passed all eight affected groups again on final build `nN1mjlYzqDsnXTtpOBGRs`, including member wording, responsive screens and PNG/PDF exports: `.local/event-flow/2026-10-12T11-19-53.089Z/acceptance.json`. Final unit/lint/typecheck logs are under `.local/event-operations-validation/2026-10-12-final/`.

Earlier discovery runs remain locally labelled failed and are superseded by these final strict runs. All disposable acceptance databases and web/storage servers were cleaned up by their runners. The shared local PostgreSQL test instance is managed and stopped by the coordinated acceptance chat.

## Future-ready decisions

Events own facts; variants own presentation; assets own event-specific access rules; attendance owns participation evidence. Structured snapshots can later link reusable speakers. Promotions reuse existing communication infrastructure without duplicating queues/providers. Resource entitlement is evaluated at access time rather than adding fields to a member record.

Apply migrations in sequence, including coordinated migration 032, before the new web/worker build. Keep `EVENT_PROMOTIONS_ENABLED=false` through rollout. Enabling hosted delivery requires reviewed sender/provider readiness and authorized recipients; real inbox receipt, physical-device acceptance and production release are not covered by synthetic local evidence. No deployment, hosted migration, real-recipient mail or production storage write is part of this change.
