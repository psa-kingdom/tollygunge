# Admin operational command center

The admin overview surfaces member totals, active memberships, outstanding membership facts, pending invitations, profile reviews, payment verification, upcoming events and registrations. Important actions include actor and timestamp in the existing audit history. Counts and workspaces respect staff permissions.

## Daily operation

1. Open **Members → Member register**. Search name, membership number, email or mobile; filter membership status. Open details to inspect membership, account, invitation, delivery and pending event payments. Administrators can edit contact/professional details and change membership status. Suspension affects membership eligibility, independently of account identity and profile review.
2. Use **Bulk onboarding → Existing members** for the 13-column CSV/XLSX template. Review errors before confirming. Import processing uses saved chunks of up to 25 rows and reports cumulative results. The worker-backed upload view exposes progress without holding the browser request open. Refresh/reopen the saved batch to resume an interrupted operation. Failed records can be previewed again; invalid source values require correction and a new upload. Importing member records sends no invitations.
3. Select individual members without accounts and click **Invite selected members**. Confirm the exact selection count. Progress updates after each member; each successful invitation persists independently. Existing invitations cannot be sent again with the invite action. Resend is blocked while queued, leased, recently sent, or awaiting uncertain-delivery reconciliation. Accepted invitations direct staff to account recovery.
4. Create an event draft with dates/times, venue or online instructions, booking window, capacity, visibility and fee. Zero fee means free registration. Publish the saved draft. Published edits notify active registrants; fee and visibility cannot change once registrations exist, and capacity cannot fall below active registrations. Cancellation preserves registration and payment history and queues event updates.
5. Inspect **Events → Registrations & attendance**. Counts distinguish total, confirmed, pending payment and cancelled. Search attendee name/email/mobile/membership number and filter registration status. Staff can cancel a registration; paid amounts remain recorded for refund review. Only confirmed registrations can be checked in.
6. Open **Payments → Registration payments**. Filter pending/paid/failed/refunded/cancelled. Verify against the actual bank/payment record, provide a reference and note, and confirm the change. A paid status confirms a registration only after manual verification. Refund status records a refund already performed; it does not execute a refund.

## Payment and booking rules

- Amounts are stored as integer INR paise and copied onto registrations. Existing free registrations remain `not_required`.
- An active paid booking reserves capacity while payment is pending. A free booking is confirmed immediately.
- Payment transitions: pending → paid/failed/cancelled; failed → pending/paid/cancelled; paid → refunded. Refunded and cancelled are terminal for the recorded payment. Recording either also cancels the booking and releases its place.
- Payment updates require the current registration version. Concurrent/stale updates return a conflict. Paid verification requires a bank/payment reference and a verification note.
- Members-only events require active membership with an unexpired end date. They are excluded from public event pages and previews. Booking windows and capacity are checked on the server while holding the event lock.
- Member records, login identity, membership, profile review and payment remain separate facts. No import infers paid or active membership from an account or email.

## Transactional communication

Invitations and recovery retain the existing encrypted transactional outbox. Registration/payment notifications and event updates use that same outbox, consistent association styling and deduplication keys. UI confirmation states **queued**, which is distinct from provider acceptance or delivery. Existing Email settings show delivery status. The existing sender/provider readiness controls still govern actual delivery.

## Validation and release

Run `node --env-file-if-exists=.env.local --import tsx scripts/test-operational-center.mts` after building. This creates a disposable database, applies all migrations, imports 200 synthetic members in eight resumable requests, invites ten, redeems one invitation, creates/publishes a paid event, registers a member, verifies payment and inspects final registration/audit state. It also checks duplicate invitation/booking prevention, single-use activation, payment authorization, missing payment references and stale verification. Browser checks cover dashboard desktop/tablet/phone, staff registration/payment views and member confirmation. No real messages are sent. The database is removed afterward; screenshots and evidence remain under `.local/operational-center/`.

`--quick` reruns the flow with 20 members for focused regression verification. It does not replace the 200-member scenario.

`--visual-only` seeds one synthetic member, then exercises event creation, registration, manual payment, staff/member browser views, published updates, cancellation/refund history, private visibility and concurrent capacity. It complements the full import/invitation/activation run.

Deployment requires migration **026_operational_center.sql** before serving the updated application. This change adds manual event payment recording; it does not introduce a payment provider or infer successful transfer. Real sender delivery, bank reconciliation and account recovery must still be exercised with the organization's approved production configuration.

### Local acceptance evidence — 2026-10-11

- Scenarios A–H passed through HTTP in an isolated database: 200 members imported in eight saved chunks; ten invitations queued; one account activated; paid event created/published; registration pending; payment manually confirmed; final member/registration/audit state reconciled. See `.local/operational-center/api-200.json`.
- On the frozen integrated build, the focused acceptance exited successfully. Chrome checks passed for desktop/tablet/phone dashboards, the confirmed-registration roster and filter, payment review with its bank reference, and member confirmation. The payment filter's stale-response race was corrected and rechecked.
- Additional HTTP checks passed for published-event notifications, immutable fees after registration, cancellation preserving paid history, manually recorded refunds, private-event access and serialized capacity (one accepted booking and one capacity conflict).
- Shared validation passed build, typecheck, lint and 77 unit tests. Screenshots and focused acceptance evidence are under `.local/operational-center/`.
- The new worker-backed upload/transport has separate coordinated backend QA. The direct import evidence above does not validate that transport. Production rollout and real sender/bank checks remain separate from these synthetic tests.

### Actual delivery staging acceptance

Run `node --env-file-if-exists=.env.local --import tsx scripts/operational-mail-preflight.mts` to inspect the saved approved inbox list, existing managed sender, quota and worker readiness. It outputs readiness only, never provider secrets. It does not change managed configuration.

The explicit delivery runner is `node --env-file-if-exists=.env.local --import tsx scripts/test-operational-delivery.mts --send-approved-tests`. It requires the coordinated fixed build and creates a disposable database with all ordered migrations. It uploads 200 synthetic members through the browser's worker-backed workflow, checks saved progress/reload/idempotency, controlled transient retry and source correction, and selects ten invitations through the member register. One invitation uses the first saved approved inbox; the other nine use controlled provider fixtures and never reach the real provider. The runner also checks activation/sign-in/recovery, registration, explicitly simulated manual payment verification, final roster/member views, event updates and payment edge states. Recovery preserves the existing synchronous sending contract.

Real messages are limited to the approved inbox: invitation, recovery, pending registration, payment confirmation and event update. Evidence distinguishes queueing, provider acceptance, provider-delivered status, signature-verified events observed at the existing hosted endpoint, and actual recipient mailbox confirmation. The isolated endpoint separately verifies authenticated replay of normalized observed events; this is not described as original provider delivery to a new staging webhook. A forged webhook is rejected. Provider metadata retrieval follows the [Resend sent-email contract](https://resend.com/docs/api-reference/emails/retrieve-email).

Timestamped JSON and browser screenshots are stored under `.local/operational-delivery/`. Link tokens, passwords, provider keys and raw message bodies are excluded. Staging fixtures and only the exact test-message webhook projections are removed; provider message records remain. `passed` stays false until actual mailbox receipt is verified, even when automated acceptance passes. The finalizer accepts explicit recipient confirmation, or a separate `mailbox-receipt.json` from authenticated browser inspection with `--browser-observed-all-five`. These checks establish staging operational acceptance, not real bank settlement or production deployment acceptance.

### Completed staged acceptance — 11 October 2026

**Complete for fixed build `Y9dBg5hznvIi4D1qwNXyu`.** Scenarios A–H passed: 200 members uploaded through the browser and processed independently with saved progress/reload; controlled transient retry and source correction without duplicates; ten selected invitations (one real approved inbox and nine controlled fixtures); delivered invitation activation and password sign-in; delivered recovery, single-use reset, old-password rejection and session revocation; event publication, registration pending, explicitly simulated admin payment confirmation, final registration/member views and actor/timestamp audit. Payment cancellation/refund history, failed-to-pending retry, stale writes, permissions and duplicate notifications also passed. Desktop/tablet/phone dashboard checks and visual inspection passed.

All five required message types were provider-delivered with signature-verified hosted events and directly observed in the authenticated approved Gmail **Inbox**: invitation, recovery, pending registration, payment confirmation and updated event venue/date. Recovery used the existing synchronous sender; the other messages used the actual shared worker against the disposable database. No bank transfer, charge or refund occurred.

Final evidence: `.local/operational-delivery/2026-10-11T05-01-57.882Z/acceptance.json` (`passed=true`, `mailboxReceipt=browser-observed-all-five`), its `mailbox-receipt.json`, and screenshots. The completed 200-row phase and invitation/activation/recovery phase are referenced from their original runs. Later harness-only failures (a missing name prefix and a queue/worker timing assumption) remain recorded; verified phases were resumed using synthetic fixtures on the same fixed build, without resending invitation/recovery. The queue check now follows messages through accepted/delivered states. An ordinary-member fixture incorrectly attempted a staff-role insertion during resume; that fixture-only setup error was removed before any send in that attempt.

Six real test messages remain at the provider: the five required messages plus one additional pending acknowledgment from the timing diagnostic. All were addressed only to the saved approved inbox. All disposable databases, sessions, accounts, registrations and queued test jobs were removed; independent verification found zero remaining delivery-test databases and zero hosted projections for the six exact provider IDs. Port 3139 is closed. No real member invitations or payment records were changed. The new acceptance scripts pass lint and strict TypeScript checks; the coordinated candidate also passed 79 unit tests, held-account browser acceptance and worker restart/repeated-import checks.

For a harness-only failure, `--reuse-import=<completed-phase-acceptance.json>` and `--reuse-account=<completed-phase-acceptance.json>` preserve references to independently passed phases while restoring only synthetic fixtures. They require matching build/recipient and verified phase results; they never turn an entire failed attempt into a pass. Subsequent controlled-invitation-release changes require acceptance against their own new build.
