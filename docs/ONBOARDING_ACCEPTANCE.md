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

- 54 unit tests passed, including field identity/type stability, conditional requirements, legacy-update impact, CSV/XLSX parity, formulas/limits, encrypted templates, empty required multiselect rejection and authenticated email-verification confirmations.
- Seven isolated database/auth/worker tests passed across migrations 001–020, including signup roles, session duration, retries, worker restart leases, idempotency and signed-event ordering.
- Expanded HTTP onboarding lifecycle passed: resumable drafts, stale-version isolation, email gating, pinned review, requirement updates, badge preservation, corrections, rejection, approval/revocation, import duplicates/idempotency/status and invitation expiry/reissue/replay.
- Four browser journeys passed: signup/form/email verification/recovery/returning-session at desktop, tablet and phone, plus desktop failed saves/offline/local recovery/stale-tab isolation. Two redundant tablet/phone persistence runs were intentionally skipped. Screenshots and traces are generated under test-results and CI artifacts.
- An actual responsive account-header overlap was found and fixed; viewport tests assert the header stays above the main content.

Final integration lint/typecheck/build passed, as did all nine baseline HTTP regression suites with onboarding disabled. The final focused HTTP/desktop rerun passed the owner-profile restriction, conditional cross-tab recovery-buffer clear and dashboard-data screenshot waits. Browser screenshots must wait for dashboard data, not only its heading.

## Hosted rollout

Runtime c439895 deployed successfully as 3bc34024-1257-4d83-8e97-0202cb158f6c with onboarding disabled. After disposable-reviewer reads and public health checks passed, controlled onboarding was enabled in deployment c8195494-cf71-4b03-8348-1ace959817fc. CI 37915314579 and 37915309222 both pass, including the separate browser job.

Hosted signup, saved form text, successful photograph/certificate association, actual reviewer downloads, anonymous/other-member denial and idempotent one-row bulk commit pass. The shared worker accepted/delivered welcome, verification and invitation jobs once each, with signed outcomes. Requirements/bulk/navigation layouts pass at 1440/768/390; the member phone review shows saved documents and an email-gated submission. Provider outcomes are not claimed as actual inbox acceptance.

The main app checkout is synchronized to the tested commit; earlier uncommitted implementation copies are preserved in a Git stash named `Preserve pre-integration onboarding and communications work 2026-10-09`.

Earlier runtime d5b3d71 passed hosted checks in deployment 960369cd-f060-4bd2-b0b8-c092d0ec0f31; CI 37917415433 and 37917407120 pass. Completed batches show results/delivery status without another commit button, and communication health labels/checkbox sizing pass at all three widths. Isolated databases and their servers were removed. The disposable reviewer's staff role/session is removed; the two ordinary mail-link accounts, their drafts and two synthetic R2 objects are retained only to finish recovery/new sign-in. The signup account email is verified and its synthetic profile has passed live submission/administrator approval while remaining unpublished. Temporary reviewer access was removed again after the approval test. Subsequent mailbox and invitation checks are recorded below.

## Remaining live gates

### Email-link investigation, 9 October

Chrome inspection confirms that the welcome, verification and invitation messages reached the designated inbox. The original verification email used `callbackURL=/`, so a successful click returned to the homepage without a result; the existing staff session remained active. Database checks confirm both synthetic emails are verified and the invitation was redeemed. The invitation password setup therefore persisted even though the user did not save the password in Incognito's password manager.

Browser verification links now pass through Better Auth and land on `/email-verification` with a short-lived, signed, HttpOnly result cookie. Success identifies the token's email independently of the active account; a different signed-in account is shown explicitly with private-window/sign-out instructions. Invalid/expired links show errors, and URL query parameters cannot forge a success. Previously sent links receive the same behavior. JSON API callers and Better Auth's distinct email-change flow retain their existing contract. No identity or migration is replaced.

The dedicated isolated browser regression passes signed-out success, repeat verification under an unrelated staff session, unchanged staff identity, actual expired tokens and invalid links. All five local browser journeys pass (four redundant viewport cases skipped), including desktop/tablet/phone signup/recovery/returning sessions and desktop persistence. Lint, typecheck, production build and 54 unit tests pass. The first CI browser run correctly hit the production signup limit because fast synthetic journeys shared a loopback bucket; browser fixtures now clear only the isolated test database's limiter between cases, while keeping rate limiting enabled.

Email-link runtime 03621ef passed in deployment c94986f7-5f20-4fb5-b090-bad7d32b2ad3. Retrying the original verification message in the user's Chrome shows the verified synthetic email and identifies the different current staff account without switching it. CI 37923029536 and 37923023957 pass both verify and onboarding jobs after fixture isolation. Five synthetic provider messages are retained by Resend, including a fresh recovery email received and opened in Gmail. The user entered the new password directly; `identity.password_reset` confirms recovery succeeded for the synthetic signup account.

Recovery exposed a second navigation problem: its successful redirect to `/login` immediately opened the current staff account. Recovery now retains a visible Password saved confirmation. Invitation activation also retains its success state, and both link to `/login?switch=1`. This explicit sign-in mode identifies the active account, allows entering another account's credentials and preserves the default returning-user redirect for ordinary `/login` visits. Verification offers the same path with the verified email prefilled. Browser regression coverage includes reset under another staff session, explicit ordinary-member sign-in, invitation activation under staff and new-password sign-in at all three widths.

- Final new sign-in using the user-chosen recovery password remains pending. Welcome, verification, invitation and recovery mailbox receipt, email verification, invitation redemption and the user-followed password reset are confirmed.
- Exact cleanup of the identified live synthetic records and R2 objects after mailbox/link acceptance. Hosted private photo/evidence upload and reviewer downloads already pass.
- Broader real-user UI/UX and assistive-technology testing before a polished release.

No real administrator account is modified or used as an onboarding subject. Chrome link checks preserve the existing administrator session; test review/import actions use a disposable reviewer. Test databases are randomly named `tpa_onboarding_test_*`, created explicitly and dropped by the runner. Browser limiter cleanup checks the actual database name against the isolated environment before deleting its synthetic buckets. Only identified synthetic live records/objects may be cleaned.

## Run and rollback

`npm run build`, `npm run lint`, `npm run typecheck`, `npm test`, then `npm run test:onboarding` with local managed database access. The local runner creates a disposable database, applies migrations, exercises database/HTTP/browser suites, runs baseline HTTP tests with onboarding disabled and removes that database. It requires installed Chrome; CI installs Chromium and uses its own PostgreSQL service/mail sink.

Disable `ONBOARDING_ENABLED` to stop public signup and onboarding queue processing without deleting saved drafts, requirement versions, documents, accepted badges or queued jobs. Do not reverse data migrations or rotate the encryption/auth secret as a rollback. Redeploy the previous compatible runtime only after confirming its session schema compatibility. Keep the shared communications worker and unrelated email settings operational.
