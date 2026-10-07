# TPA delivery checklist — 7 October 2026

Current source of truth. Historical implementation, comparison and showcase reports
remain evidence. Statuses: Done (only the stated capability), Partial, Added,
Blocked, Deferred. Dependencies determine order; feedback adds work without removing
existing release gates. Resend remains deferred.

| Order | Capability | Status | Dependency / next action | Acceptance evidence |
| --- | --- | --- | --- | --- |
| 1 | Foundation, hosting, identity, permissions | Done for first draft | Retain deployment/access checks | HOSTING.md; CI and hosted login/revocation |
| 2 | Public responsive first draft | Done for first draft | Real content; broader devices/accessibility | SHOWCASE_READINESS.md; desktop/tablet/phone screenshots |
| 3 | Content, governance, media publication | Partial | Rich editing track below; hosted uploads need scoped R2 | CONTENT_EDITOR.md; MEDIA_PUBLICATION.md; publication HTTP flows |
| 4 | CRM, directory/contact preview | Done for current scope | Production anti-abuse; fuller usability checks | INQUIRIES.md; MEMBER_DIRECTORY.md; HTTP/browser checks |
| 5 | Rich editor/live preview | Partial | Implementation and local acceptance complete; CI/hosted verification next | CONTENT_EDITOR.md; evidence below |
| 6 | Report presets/XLSX, news preparation, release tooling | Added | After editor; independent work | Not implemented; Crazy Hands XLSX comparison |
| 7 | Hosted private/editorial uploads | Blocked | Independent scoped R2 credential | Local storage checks; production disabled |
| 8 | Membership decisions, activation, renewals, numbers/certificates, profile-change review | Partial / Blocked | Approved fees/eligibility/declaration/refund terms and verified transactions | Private drafts work; no submission/approval |
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
- [ ] Desktop/tablet/phone and keyboard browser verification; synthetic lifecycle cleanup.
- [ ] CI, hosted rollout, screenshots and final evidence.

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
- Synthetic browser draft lifecycle/cleanup and hosted checks remain next, with CI/deployment evidence to be recorded here.
