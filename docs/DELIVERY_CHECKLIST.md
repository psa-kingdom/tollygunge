# TPA delivery checklist — 9 October 2026

Current source of truth. Historical implementation, comparison and showcase reports
remain evidence. Statuses: Done (only the stated capability), Partial, Added,
Blocked, Deferred. Dependencies determine order; feedback adds work without removing
existing release gates. Resend transactional password recovery is enabled and hosted
verified. Durable campaigns/shared inbox and delivery logs are hosted verified; WhatsApp remains a separate provider gate.

## Resend activation batch — 8 October 2026

- [x] Add a gated transactional recovery adapter, retaining SMTP compatibility,
  bounded requests, opaque stable idempotency and suppressed provider diagnostics.
- [x] Full-access setup credentials supplied; updates.tpassociation.org verified.
  A separate sending-only runtime key is stored in managed Railway secrets.
  The old restricted key remains in the source file; revocation is not asserted.
- [x] Resend verifies existing sender DNS; no DNS changes were necessary.
- [x] Configure managed secrets and verify hosted test-recipient delivery, one-use
  reset, old-session revocation, replacement sign-in and desktop/phone controls.
  See RESEND_ROLLOUT.md; production deployment 2c26ad17-0213-465e-81c1-eec81fa2008a.
- [ ] Implement durable campaign jobs, consent rechecks, unsubscribe handling and
  verified delivery webhooks before enabling campaign sends.
- [ ] Configure shared inbox and WhatsApp separately. All other policy/provider
  dependencies and historical evidence below remain in force.

| Order | Capability | Status | Dependency / next action | Acceptance evidence |
| --- | --- | --- | --- | --- |
| 1 | Foundation, hosting, identity, permissions | Done for first draft | Retain deployment/access checks | HOSTING.md; CI and hosted login/revocation |
| 2 | Public responsive first draft | Done for first draft | Real content; broader devices/accessibility | SHOWCASE_READINESS.md; desktop/tablet/phone screenshots |
| 3 | Content, governance, media publication | Partial | Rich editing and hosted uploads done; broader editorial/release acceptance remains | CONTENT_EDITOR.md; MEDIA_PUBLICATION.md; publication HTTP flows |
| 4 | CRM, directory/contact preview | Done for current scope | Production anti-abuse; fuller usability checks | INQUIRIES.md; MEMBER_DIRECTORY.md; HTTP/browser checks |
| 5 | Rich editor/live preview | Done for this batch | Broader real-device/assistive-technology acceptance remains in release work | CONTENT_EDITOR.md; local, CI and hosted evidence below |
| 6 | Report presets/XLSX, news preparation, release tooling | Done for this batch | Actual news sources/schedule and full recovery remain gated | REPORTING_NEWS.md; RELEASE_RUNBOOK.md; CI 37727570318 and hosted/browser evidence below |
| 7 | Hosted document/editorial/QR/portrait uploads | Done | Future TPA-only credential rotation is hardening; full release remains open | R2_UPLOAD_ROLLOUT.md; four configured hosted HTTP suites; 1440/768/390 controls/previews; exact object cleanup |
| 8 | Membership decisions, activation, renewals, numbers/certificates, profile-change review | Partial / Blocked | Approved fees/eligibility/declaration/refund terms and verified transactions | Membership drafts only; personal profile review implemented separately |
| 9 | Collection, reconciliation, receipts, refunds/payment history | Partial / Blocked | UPI details/manual policy or Razorpay setup | Versioned instruction management only |
| 10 | Events, attendance, learning history | Partial | Paid events need payment; awards need learning policy | Free registrations/attendance HTTP checks |
| 11 | Historical import commit | Partial / Blocked | Approved mapping/provenance | Preview validation only |
| 12 | Communications/inbox/delivery logs | Done for email scope / Partial overall | Durable campaigns, shared inbox and delivery logs verified; WhatsApp remains gated | EMAIL_OPERATIONS_ROLLOUT.md; hosted signed events, explicit test delivery, consent withdrawal, responsive checks and exact cleanup |
| 13 | Google onboarding/emailed recovery | Partial | Recovery Done for test-recipient acceptance; Google OAuth client remains blocked | RESEND_ROLLOUT.md; hosted reset/revocation; real-mailbox acceptance remains |
| 14 | Scheduled attributed news | Blocked | Approved feeds/schedule | Editorial drafts only |
| 15 | Full production release | Partial | Staging, backup/restore, recovery, security/accessibility and integrations | First draft only; release acceptance pending |

## Rich editing batch — dependency order

- [x] Central limits: title 160, introduction 3,000, heading 120, section 20,000, 12 sections, total 100,000. Preserve news limits.
- [x] Visible character limits/counters, informational words, restrictions and errors.
- [x] Versioned JSON, legacy plain-text compatibility and safe server validation.
- [x] Shared public/preview renderer; current published contextual inserts.
- [x] Rich formatting toolbar and controlled Small/Body/Large/Display sizes.
- [x] Isolated unsaved inline preview; desktop/tablet/phone widths and expansion.
- [x] Unsaved-change protection; saved-only explicit publication/conflicts retained.
- [x] Unit and HTTP compatibility/limits/security/publication tests; PostgreSQL checks.
- [x] Desktop/tablet/phone and keyboard browser verification; synthetic lifecycle cleanup.
- [x] CI, hosted rollout, screenshots and final evidence.

## Separate future improvements

Homepage/layout builder, global design controls and collaborative editing are not
part of this batch. Other priorities: approved payment/membership reporting, scheduled collection,
background delivery after provider setup, anti-abuse controls, fuller empty/error
states, approved imagery/copy and recovery exercises. No NGO-specific fields or
Crazy Hands migration are added. See REFERENCE_COMPARISON.md for read-only evidence.

## Editor acceptance evidence — 7 October 2026

- Local lint, typecheck and production build pass; all 32 unit tests pass.
- PostgreSQL migration/identity checks: 4 tests pass, including checksums, foreign keys and revoked sessions.
- Operational HTTP flow passes: private drafts, permission-protected previews, stale-write/publication conflicts, rich save/publish/withdraw, derived text and a payload exceeding the former 96 KiB cap. Disposable HTTP fixtures are removed by the test.
- Browser checks at 1440, 768 and 390 pixels: formatting persists after save/reload; saved state enables publication; unsaved state disables it; mobile Edit/Preview tabs and expanded Escape dismissal work. A 20,001-character paste stays visible and prevents saving. A 12-column table scrolls inside its 350-pixel phone container; the preview remains 390 pixels wide.
- Unsafe HTML clipboard paste retains ordinary text/approved bold while scripts, image handlers and JavaScript links are removed; forged documents and unsafe URLs are also rejected server-side.
- [CI run 37582667107](https://github.com/psa-kingdom/tollygunge/actions/runs/37582667107) passes for code commit 1f2fb50: 32 unit, 4 PostgreSQL, 7 HTTP tests, lint/build/typecheck.
- Railway deployment bd6fbc55-2e0c-4cf5-bcf2-b0d09c373123 is SUCCESS at https://tpassociation.org. Hosted admin editor verifies unsaved inline preview, publication gate and keyboard mobile tabs at 1440/768/390 widths without page overflow. Shared public rendering preserves bold/underline/Large text and the 12-column table after synthetic publication; withdrawal returns 404. Authenticated preview works; anonymous and revoked sessions are denied.
- The exact synthetic browser record, cascading revisions and associated test audit records were removed after withdrawal. Test scripts clean their own fixtures. No existing content was published or rewritten by verification.
- Screenshots: preview-evidence/content-desktop-hosted.png and content-phone-hosted.png (synthetic verification before cleanup). Resend remains deferred; hosted R2, policy, payment, import, Google and production-release gates remain above.

## People, groups and profile review — added batch

Status: Done for people/groups/review, preview and hosted portrait upload. Dependencies: shared content renderer/editor and checked migrations complete. Hosted R2 rollout evidence is below; existing provider and membership/payment gates remain unchanged.

- [x] Preserve legacy snapshots/history and add people, groups, assignments and review records.
- [x] Owner drafts/submission; restricted staff edits; admin-only decisions with conflict checks and history.
- [x] Groups/subgroups, multiple assignments, optional rich biographies/links and private contacts.
- [x] Shared card/placement preview, mobile tabs, unsaved protection and explicit verified publication.
- [x] Purpose-bound portrait upload/replacement and publication-based retrieval; hosted storage accurately gated.
- [x] Directory review filters and admin queue; immediate consent/preferences remain independent.
- [x] Security/compatibility/HTTP/PostgreSQL/browser acceptance, synthetic cleanup, CI and hosted delivery.

## People acceptance evidence — 7 October 2026

- Model, permissions, safe rich biographies/links, groups, multiple assignments, owner drafts, administrator review and separate approved publication are implemented. See PEOPLE_REVIEW.md.
- Local lint/typecheck/build pass; 34 unit tests pass. Existing 7 HTTP suites pass, including supersession/conflicts, redacted content-editor contact access, immediate preferences and explicit publication/withdrawal.
- Private-storage portrait HTTP verification passes: invalid signature/oversize rejection, normalized upload, owner/staff read, anonymous denial until publication, replacement revocation and withdrawal. Both synthetic objects are deleted and their absence verified. Generic normalization and failed-persistence compensation unit tests pass.
- PostgreSQL checks pass for repeatability/checksums, wrong-database guard, constraints, recovery and session revocation. The added legacy-label/identity test passes; original records/history remain intact. No legacy governance edits occurred between migration and cutover.
- Local browser checks at 1440/768/390 widths confirm rich save, private section/card previews, submission, admin approval, explicit publication, public biography rendering and withdrawal. Keyboard tabs/expansion/Escape and unsaved-discard protection work. Phone/tablet document widths show no horizontal overflow. Synthetic browser record/revisions/audit records removed.
- Browser extension file upload is unavailable without the extension's file-URL permission; the same portrait endpoints were tested through HTTP without changing browser permissions. Browser extension-injected hydration warnings are present in development; no application rendering failure observed.
- Screenshots: preview-evidence/people-desktop-local.png and people-phone-local.png. CI and hosted evidence will be appended after rollout. Hosted scoped R2 remains Blocked; Resend and all prior payment/membership/import/Google/release gates remain unchanged.

## People hosted rollout evidence — 7 October 2026

- [CI run 37599494566](https://github.com/psa-kingdom/tollygunge/actions/runs/37599494566) passes for code commit 8a74aed: 34 unit tests, 5 PostgreSQL tests, 8 HTTP suites, lint/build/typecheck. The portrait suite verifies disabled storage in CI; configured local tests verify actual R2 objects.
- Railway deployment 0cbc41c5-5601-4103-9d8d-1754d700b5f7 is SUCCESS at https://tpassociation.org. Authenticated hosted draft, submission, explicit admin approval, publication, public rich biography and withdrawal passed. Anonymous personal/draft-preview endpoints return 401. The hosted administrator overview renders its review/publication queue correctly; private-only fields are excluded from publication comparisons (verified with a rolled-back synthetic database fixture).
- Hosted 1440/768/390 viewport checks show no horizontal document overflow. Mobile Edit/Preview tabs retain the draft; private biography expansion works while navigation/submissions remain disabled. Rich bold formatting survives shared public/private rendering. Portrait upload is disabled on the hosted saved profile while scoped runtime storage is missing.
- The exact hosted synthetic profile, its revisions/reviews and target audit events were removed after withdrawal. Public retrieval no longer contains it and the final attention queue has no synthetic items. Both local storage test objects were removed with absence checks. No real profiles were modified or published during verification.
- Screenshots: preview-evidence/people-desktop-hosted.png and people-phone-hosted.png, taken with the disposable profile before cleanup. Viewport reset; local development server retained. Original credentials remain uncopied; repository secret-boundary scan passes.
- Existing gates remain: scoped managed R2 for hosted uploads, deferred Resend, Google OAuth, approved membership/payment/refund/learning/import rules, providers/news sources and broader production recovery/accessibility acceptance. Report presets/XLSX and news-source preparation remain the next independent checklist batch.

## Hosted storage acceptance — 7 October 2026

- [x] Fresh account-wide R2 pair transferred through stdin into managed Railway settings; unrelated settings unchanged.
- [x] Dedicated bucket/namespace guards and production file-fallback denial; portrait compensation/reconciliation audit.
- [x] r2.dev anonymous object denial verified after disablement; no custom domains confirmed by user.
- [x] Four hosted upload/download/publication/withdrawal suites pass; ownership, staff permissions, image normalization and invalid-upload rejection.
- [x] Four upload controls enabled at desktop/tablet/phone widths; actual private media/portrait previews render without page overflow. Chrome file-URL selection limitation recorded.
- [x] Lint/typecheck/build, 36 unit tests, 5 PostgreSQL tests, 8 CI HTTP suites and hosted login/revocation pass.
- [x] Exact synthetic objects/records/revisions/audits removed; HeadObject/image retrieval 404 verified. Credential scans have zero matches.
- [x] Runtime e98180e deployed successfully as 9efdae03-9bb5-4b7d-97ef-764e43c9e277; test follow-up b0bb44a CI passes.

See [R2_UPLOAD_ROLLOUT.md](R2_UPLOAD_ROLLOUT.md) for detailed evidence, scope, browser limitations and rollback. Earlier reports above remain historical. Account-wide credentials are not bucket-scoped; future TPA-only rotation is retained as hardening. Report presets/XLSX remain next independent work. Resend, OAuth, membership/payment/refund/learning/import/news and full-release dependencies are unchanged.

## Documentation delivery status

Blocked at GitHub after hosted verification: repeated documentation pushes return
remote Internal Server Error; GraphQL and REST PR-description updates also fail.
The remote feature branch retains b0bb44a with passing CI, and the healthy deployed
runtime is e98180e. The full checklist/report is committed locally; push and PR refresh
remain pending provider recovery. Main is unchanged. No rollback is needed for this
documentation transport failure because hosted storage verification passed.

## Reporting, news preparation and release batch — 8 October 2026

- [x] R2 documentation commit 3a0b81a pushed; existing draft PR #1 description refreshed. The earlier GitHub outage is resolved.
- [x] Shared permission-filtered report queries, account-directory filters, India periods and compatible summaries.
- [x] Server CSV/XLSX exports with 10,000-row rejection, safe text and metadata; private/no-store, no R2 retention.
- [x] Owned private presets and administrator-managed shared presets; version conflicts and audit records.
- [x] Empty news-source catalogue, explicit admin approval/pause, edit-to-draft, revision history; no collection.
- [x] Read-only release checker and deployment/rollback/recovery runbook. Recovery remains unverified.
- [x] Unit/PostgreSQL/HTTP/CI and parsed workbook acceptance; exact fixture cleanup.
- [x] Desktop/tablet/phone, keyboard/error/download acceptance; hosted deployment and checks.

See [REPORTING_NEWS.md](REPORTING_NEWS.md) and [RELEASE_RUNBOOK.md](RELEASE_RUNBOOK.md).
All prior provider/policy gates remain. Scheduled news is not enabled by source approval.

## Reporting/source/release acceptance evidence — 8 October 2026

- Code da2abcb: lint/typecheck/build pass; 38 unit, 5 PostgreSQL and 9 HTTP suites pass
  in [CI 37727570318](https://github.com/psa-kingdom/tollygunge/actions/runs/37727570318)
  and [CI 37727574348](https://github.com/psa-kingdom/tollygunge/actions/runs/37727574348).
  Migration 017 repeatability/checksums and foreign keys use the existing runner.
- CI's isolated database verifies real 10,001-event exports reject both formats and
  explicitly mark the 200-row preview limit. No 10,001-row fixture was inserted in production.
- Railway deployment a70b29b3-7c4e-4731-b7fb-22cff8092bc5 is SUCCESS. Hosted report/source
  HTTP checks pass: all report role combinations, anonymous/member denial, accepted
  directory filters, parsed CSV/XLSX types/formula safety/metadata, empty reports,
  private/shared preset ownership and stale versions, admin-only source decisions,
  edit-to-draft, pause/history and live role/session revocation. Exact fixtures removed.
- Read-only release checker passes public/readiness/anonymous denial and optional
  administrator login/read/sign-out/revocation. R2 control enabled; Google and emailed
  recovery controls remain disabled as expected. Recovery exercise remains UNVERIFIED.
- Browser: report filters and India last-30-day dates, shared preset save/apply and
  source save → approve → edit-to-draft → reapprove → pause verified. Arrow-key view
  switching retains source edits; failed unsafe-URL saves retain input. Loading/disabled
  controls and errors are visible. Report and Sources layouts at 1440/768/390 widths
  show no horizontal page overflow; history/empty states and download feedback work.
- Actual Chrome CSV/XLSX files parsed: matching event headers, frozen XLSX header and
  applied-date metadata. Files removed from Downloads; all fixture accounts, the exact
  browser shared preset/source, five source revisions and fixture audit records removed.
  Browser download-event observation timed out but the actual local files and UI feedback
  confirmed delivery. An old local tab became unresponsive during dialog automation;
  fresh hosted tabs completed verification. Browser date-field automation did not reliably
  commit changes; server/HTTP calendar validation and retention logic are tested instead.
- Production dependency audit reports zero advisories after the scoped uuid override.
  Development-tool advisories remain a separate full-release hardening review. Original
  Cloudflare/admin credential values have zero matches in tracked/non-ignored repository
  files. No credentials are copied into this batch's source, documentation or fixtures.
- Screenshots in preview-evidence: reports-desktop/tablet/phone-hosted.png and
  sources-desktop/tablet/phone-hosted.png. Disposable records pictured are now removed.
  Browser viewport reset; user's existing authenticated sessions/local server retained.

Retained gates: deferred Resend, Google client, approved membership terms, verified
payment/refund rules, learning policy, import mappings and actual news sources/schedule.
No new cloud resources/services were created. Full production/recovery/accessibility
acceptance remains open; layout building/global style controls/collaboration remain future.

## Durable campaigns and shared inbox — 9 October 2026

- [x] Migration018, immutable saved campaign/recipient snapshots, 10,000-recipient cap and duplicate-dispatch protection.
- [x] Current consent/email/contact/suppression and operator authority checked again immediately before sends.
- [x] Leases, stable provider idempotency, bounded retries, expired-window reconciliation and daily/monthly quota pauses; 20 daily sends reserved from campaigns.
- [x] Signed raw-body webhook, persistent deduplicated events, separate delivery outcomes, permanent-bounce/complaint suppressions and explicit unsubscribe POST.
- [x] Shared inbox assignment/status/read/archive/search, private notes, optimistic saved reply drafts and explicit reply confirmation. Bodies are inert text; attachments are metadata only.
- [x] Isolated PostgreSQL and HTTP acceptance; 44 unit tests; production build; desktop/tablet/phone draft retention and keyboard tabs without page overflow.
- [x] One supervisor/webhook with gated onboarding handlers; no competing deployment/worker.
- [x] Hosted processing, provider-delivered incoming mail/reply and synthetic-only campaign acceptance.
- [x] CI, deployment evidence and exact hosted fixture cleanup.

The receiving/usage runtime credential uses Resend **full_access**, because Resend has no receiving-only permission. It is distinct from the sending-only key, stored only in managed secrets, and removed from the web child environment. Setup credentials remain in their original file. Worker/deployment/provider acceptance is documented in [EMAIL_OPERATIONS_ROLLOUT.md](EMAIL_OPERATIONS_ROLLOUT.md). Onboarding is a coordinated separate batch; its flag remains disabled pending its own acceptance. Retained gates: Google OAuth, WhatsApp, approved membership/payment/refund/learning/import/news policies, disposable backup restoration and full production/accessibility acceptance.

## Email acceptance evidence — 9 October 2026

- Runtime 8e0d36d, Railway deployment 1d1fe552-55e2-41ba-9929-88e0cc69db2b: SUCCESS. Paused first deployment proved signed endpoint and fresh disabled worker before activation. The enabled shared worker is healthy; onboarding remains off pending its separate batch.
- CI [37913418355](https://github.com/psa-kingdom/tollygunge/actions/runs/37913418355) and [37913411951](https://github.com/psa-kingdom/tollygunge/actions/runs/37913411951) pass lint, typecheck, build, 44 unit tests, existing domain/PostgreSQL/HTTP acceptance, durable-email suites and standalone worker handover.
- Hosted one-recipient synthetic campaign and confirmed reply accepted/delivered via actual signed provider events. Duplicate dispatch retained the same dispatch and one job; stale duplicate reply was blocked. Actual intended inbound mail fetched through the receiving API; assignment/status/note/draft checks pass. Received events appear as received, not awaiting an outbound event.
- GET unsubscribe did not alter consent; explicit one-click POST withdrew it. Mock-provider acceptance covers withdrawal immediately before send, quota rollover/reserve, suppression, retries/crashes, leases and uncertain-send reconciliation. No real-audience campaign was sent.
- Desktop/tablet/phone at 1440/768/390: no page overflow, retained edits across tabs, disabled unsaved send, navigation discard prompt, Escape and arrow-key tabs. Hosted screenshots: preview-evidence/communications-hosted-desktop.png, communications-hosted-phone.png and communications-hosted-delivery.png (disposable records pictured are removed).
- Secret scans: zero managed-secret matches in sampled private API responses, nine public JavaScript chunks and recent runtime logs. Exact application fixture identities/sessions, campaign/revisions/dispatch/jobs, messages/conversation/notes, events, tokens, consents and audits removed and absence verified. Resend retains three synthetic sent messages and one received record; provider deletion is not asserted.
- Read-only public/protected-route release checks pass. Full backup restoration, broader accessibility, Google OAuth, WhatsApp and membership/payment/refund/learning/import/news policy gates remain open. Account-wide R2/runtime full-access receiving credentials retain documented future scoping/rotation hardening.
