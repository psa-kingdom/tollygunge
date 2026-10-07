# TPA delivery checklist — 7 October 2026

Current source of truth. Historical implementation, comparison and showcase reports
remain evidence. Statuses: Done (only the stated capability), Partial, Added,
Blocked, Deferred. Dependencies determine order; feedback adds work without removing
existing release gates. Resend remains deferred.

| Order | Capability | Status | Dependency / next action | Acceptance evidence |
| --- | --- | --- | --- | --- |
| 1 | Foundation, hosting, identity, permissions | Done for first draft | Retain deployment/access checks | HOSTING.md; CI and hosted login/revocation |
| 2 | Public responsive first draft | Done for first draft | Real content; broader devices/accessibility | SHOWCASE_READINESS.md; desktop/tablet/phone screenshots |
| 3 | Content, governance, media publication | Partial | Rich editing and hosted uploads done; broader editorial/release acceptance remains | CONTENT_EDITOR.md; MEDIA_PUBLICATION.md; publication HTTP flows |
| 4 | CRM, directory/contact preview | Done for current scope | Production anti-abuse; fuller usability checks | INQUIRIES.md; MEMBER_DIRECTORY.md; HTTP/browser checks |
| 5 | Rich editor/live preview | Done for this batch | Broader real-device/assistive-technology acceptance remains in release work | CONTENT_EDITOR.md; local, CI and hosted evidence below |
| 6 | Report presets/XLSX, news preparation, release tooling | Added | After editor; independent work | Not implemented; Crazy Hands XLSX comparison |
| 7 | Hosted document/editorial/QR/portrait uploads | Done | Future TPA-only credential rotation is hardening; full release remains open | R2_UPLOAD_ROLLOUT.md; four configured hosted HTTP suites; 1440/768/390 controls/previews; exact object cleanup |
| 8 | Membership decisions, activation, renewals, numbers/certificates, profile-change review | Partial / Blocked | Approved fees/eligibility/declaration/refund terms and verified transactions | Membership drafts only; personal profile review implemented separately |
| 9 | Collection, reconciliation, receipts, refunds/payment history | Partial / Blocked | UPI details/manual policy or Razorpay setup | Versioned instruction management only |
| 10 | Events, attendance, learning history | Partial | Paid events need payment; awards need learning policy | Free registrations/attendance HTTP checks |
| 11 | Historical import commit | Partial / Blocked | Approved mapping/provenance | Preview validation only |
| 12 | Communications/inbox/delivery logs | Partial / Deferred | Resend deferred; WhatsApp/shared mailbox setup | Drafts/templates/audiences work; sending disabled |
| 13 | Google onboarding/emailed recovery | Blocked / Deferred | OAuth client; verified email delivery | Assigned password account works |
| 14 | Scheduled attributed news | Blocked | Approved feeds/schedule | Editorial drafts only |
| 15 | Full production release | Added | Staging, backup/restore, recovery, security/accessibility and integrations | First draft only; release acceptance pending |

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
part of this batch. Other priorities: report presets/XLSX, news preparation,
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
