# Signup, verification and bulk onboarding acceptance

Implementation batch: 9 October 2026. This document distinguishes isolated acceptance from hosted and mailbox acceptance. Onboarding is enabled for controlled testing after schema/runtime and isolated acceptance. Actual mailbox/link acceptance and the polished release gates remain separate.

## Implemented

- Ordinary email/password signup, duplicate/rate-limit handling, unverified draft access, 24-hour email verification and explicit keep-signed-in sessions (member 7/30 days; staff 7 days). Password recovery retains 15-minute single-use tokens and revokes sessions.
- One authenticated five-step workflow at `/join` and `/member/application`, driven by versioned requirements. Autosave, explicit save, step restore, optimistic concurrency and account-scoped 24-hour IndexedDB recovery preserve incomplete text. Documents become saved only after storage and association succeed.
- The dashboard exposes email/profile status, missing requirements, review feedback and continuation. Name, organization and phone are edited through the verification form, then accepted into the authoritative person record; the public profile editor links to that workflow.
- Community → Verification supplies queue, requirements and history. Custom field configuration, pinned submissions, impact preview, version publication and reasoned review decisions preserve existing badges and accepted details. New mandatory requirements request updates without automatic revocation.
- Members → Bulk onboarding supplies CSV/XLSX templates, column mapping, row validation, explicit idempotent commit, invitation status, retries and expired-link reissue. Ordinary unverified accounts only; existing users are skipped. Hashed 48-hour links require explicit password setup.
- Encrypted durable welcome, verification, invitation and update jobs use the existing shared email worker/webhook, quotas, suppression and provider idempotency. Signed delivery/bounce events are deduplicated and tolerate arrival before acceptance persistence. Payloads are erased after acceptance.
- Administrator test-recipient settings start with `savagesnowboy@gmail.com`; test deliveries never silently redirect normal user mail.

The full printed source-field mapping is in DTPA_FIELD_MAPPING.md. Family/health/referral details start optional. Printed payment and office placeholders remain mapped to their respective future/staff workflows, not profile badge requirements.

## Integration decisions

Use the already verified sender `TPA <no-reply@updates.tpassociation.org>`. Preserve existing DNS/routing and managed keys. The proposed root sender has not been substituted without domain verification.

Production recovery remains synchronous, following the coordinated communications contract; only provider receipt metadata is persisted. Its isolated test sink is allowed only for synthetic local acceptance. Other onboarding transactional mail is durable. No additional worker or webhook is created.

Migrations 019 and 020 are additive, checksummed and preserve legacy form keys, auth identities, public snapshots and existing approvals. Migration 018 is owned by communications. Runtime schema must be migrated before deploying code that reads the new session columns, even with onboarding disabled.

## Recorded acceptance

- 50 unit tests passed, including field identity/type stability, conditional requirements, legacy-update impact, CSV/XLSX parity, formulas/limits, encrypted templates and empty required multiselect rejection.
- Seven isolated database/auth/worker tests passed across migrations 001–020, including signup roles, session duration, retries, worker restart leases, idempotency and signed-event ordering.
- Expanded HTTP onboarding lifecycle passed: resumable drafts, stale-version isolation, email gating, pinned review, requirement updates, badge preservation, corrections, rejection, approval/revocation, import duplicates/idempotency/status and invitation expiry/reissue/replay.
- Four browser journeys passed: signup/form/email verification/recovery/returning-session at desktop, tablet and phone, plus desktop failed saves/offline/local recovery/stale-tab isolation. Two redundant tablet/phone persistence runs were intentionally skipped. Screenshots and traces are generated under test-results and CI artifacts.
- An actual responsive account-header overlap was found and fixed; viewport tests assert the header stays above the main content.

Final integration lint/typecheck/build passed, as did all nine baseline HTTP regression suites with onboarding disabled. The final focused HTTP/desktop rerun passed the owner-profile restriction, conditional cross-tab recovery-buffer clear and dashboard-data screenshot waits. Browser screenshots must wait for dashboard data, not only its heading.

## Hosted rollout

Runtime c439895 deployed successfully as 3bc34024-1257-4d83-8e97-0202cb158f6c with onboarding disabled. After disposable-reviewer reads and public health checks passed, controlled onboarding was enabled in deployment c8195494-cf71-4b03-8348-1ace959817fc. CI 37915314579 and 37915309222 both pass, including the separate browser job.

Hosted signup, saved form text, successful photograph/certificate association, actual reviewer downloads, anonymous/other-member denial and idempotent one-row bulk commit pass. The shared worker accepted/delivered welcome, verification and invitation jobs once each, with signed outcomes. Requirements/bulk/navigation layouts pass at 1440/768/390; the member phone review shows saved documents and an email-gated submission. Provider outcomes are not claimed as actual inbox acceptance.

The main app checkout is synchronized to the tested commit; earlier uncommitted implementation copies are preserved in a Git stash named `Preserve pre-integration onboarding and communications work 2026-10-09`.

Final runtime d5b3d71 is healthy in deployment 960369cd-f060-4bd2-b0b8-c092d0ec0f31; CI 37917415433 and 37917407120 pass. Follow-up hosted checks confirm completed batches show results/delivery status without another commit button, and communication health labels/checkbox sizing pass at all three widths. Isolated databases and their servers were removed. The disposable reviewer's staff role/session is removed while mailbox confirmation is pending; the two ordinary mail-link accounts, their drafts and two synthetic R2 objects are retained only to finish those checks. Four synthetic sent provider messages are retained by Resend, including the synchronous recovery test. The signup account email is verified and its synthetic profile has passed live submission/administrator approval while remaining unpublished. Signed recovery delivery is recorded, but invitation redemption, password reset/new sign-in and human receipt confirmation remain pending. Temporary reviewer access was removed again after the approval test.

## Remaining live gates

- Actual welcome and invitation receipt in the designated inbox; user-followed email verification, password setup and recovery links. Provider accepted/delivered receipts alone do not establish mailbox acceptance.
- Exact cleanup of the identified live synthetic records and R2 objects after mailbox/link acceptance. Hosted private photo/evidence upload and reviewer downloads already pass.
- Broader real-user UI/UX and assistive-technology testing before a polished release.

No real administrator identity is used for onboarding acceptance. Test databases are randomly named `tpa_onboarding_test_*`, created explicitly and dropped by the runner. Only identified synthetic live records/objects may be cleaned.

## Run and rollback

`npm run build`, `npm run lint`, `npm run typecheck`, `npm test`, then `npm run test:onboarding` with local managed database access. The local runner creates a disposable database, applies migrations, exercises database/HTTP/browser suites, runs baseline HTTP tests with onboarding disabled and removes that database. It requires installed Chrome; CI installs Chromium and uses its own PostgreSQL service/mail sink.

Disable `ONBOARDING_ENABLED` to stop public signup and onboarding queue processing without deleting saved drafts, requirement versions, documents, accepted badges or queued jobs. Do not reverse data migrations or rotate the encryption/auth secret as a rollback. Redeploy the previous compatible runtime only after confirming its session schema compatibility. Keep the shared communications worker and unrelated email settings operational.
