# Approved account batch — production delivery, 11 October 2026

## Outcome

Production created **202 linked accounts and member records**, held **9 source rows**, and failed **0 rows**. Seven held rows are later duplicate-email occurrences (physical rows 67, 76, 90, 146, 166, 207 and 208); two are existing identity conflicts (rows 111 and 162). No later duplicate was promoted. The original committed preservation batch remains audit history.

The authenticated staff portal shows **202 members** and **208 accounts** (six pre-existing accounts). Database totals independently reconcile: accounts 6 → 208, people 11 → 213, memberships 0 → 202. Invitation rows remain 1 and mail rows remain 8: **zero new invitation tokens, mail jobs or passwords**. All 202 account holds remain unreleased. Existing accounts, credential hashes and private people are unchanged.

## Policy and implementation

The exception applies only to the original 211-row workbook, SHA256 `0031124b1557fcd3bce3a03201733aabda212ff95494adcd66ace3df607f1ecd`. Normal registration, strict imports and verification remain strict. Immutable batch choices permit incomplete addresses, prohibit district derivation and existing-record updates, reserve emails for their earliest physical row, provision accounts, and hold delivery.

Source address text/structured values are retained without postal correction or guessed locations. Missing districts remain blank. Identity validation, malformed values and unsafe cells still block. Savepoints and transactional account/member creation prevent partial identities; persisted 25-row outcomes serialize concurrent requests and make interrupted processing/replay idempotent.

New accounts are email-unverified and private, without verification, publication, consent, membership plan or paid approval. Recovery, verification and sign-in cannot bypass an invitation hold. A separately authorized release generates a fresh setup token and mail. Staff can see linked accounts, held invitations and address-completion status; no real invitation was released here.

## Deployment and recovery

Existing Railway production project/service were verified before execution. Additive migrations 026–028 were applied. Deployment **930144fd-229b-4fa9-8d00-7f5c4bb312ef** succeeded on the existing `tpa-web` service, without capacity changes. The immutable 264-file runtime snapshot manifest is `6be451b849786f91660612844bb02d114acf7ca4081ba5d1bdb7f19958030345`; runtime matched the final local build inputs. Strict member-import worker remains disabled.

New approved production batch: `cc390059-7f6e-444b-a821-577948f03b49`. Production preview matched the verified 202/9 rehearsal before writes. Processing all 211 rows, committed replay and independent database/API reconciliation passed. Completed at `2026-10-11T04:39:44.883Z`.

A fresh 18,980,344-byte recovery backup was restored and validated before changes, SHA256 `1f6239fd92ab02ee99b9c21058b9e093bd183db357d6964d3523af8681bc55d4`. Private backup, source-row reports and browser screenshots remain ignored under `.local/account-batch`. They contain personal data and must not be published. After account creation, do not blindly restore the full backup or roll back to authentication lacking hold guards: retain held access and use a reviewed batch-specific recovery or fix forward.

## Tests and observed behavior

Commands ran from `app`:

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: **79 passed**, zero failures/skips.
- `npm run build`: passed; local Build ID `Y9dBg5hznvIi4D1qwNXyu`.
- `node --env-file-if-exists=.env.local --import tsx scripts/test-approved-accounts.mts`: focused isolated database runs covered the two provisioning/concurrency cases (**2 passed**, 137 seconds) and held-authentication case (**1 passed**, 15 seconds). These exercised source/hash/policy rejection, first-email precedence, incomplete Indian/international addresses, blank districts, replay, collision rollback, concurrency and zero credentials/tokens/mail. Test databases removed.
- With `TPA_ACCOUNT_TEST_FILES=tests/identity.integration.ts,tests/onboarding-auth.integration.ts`, the same isolated runner passed **3 normal authentication regression cases** in 53.7 seconds; database removed.
- With `TPA_UI_TEST_PROJECT=desktop` and `TPA_UI_TEST_FILES=tests/browser/held-account.spec.ts`, `node --env-file-if-exists=.env.local --import tsx scripts/verify-member-ui.mts`: **1 Chromium case passed**, 1.2 minutes. Observed held status, recovery suppression, synthetic release/activation/sign-in, profile save/reload and international address completion/save/reload. Test database removed. Real recipient delivery was not exercised by this account workstream.
- `TPA_ACCOUNT_BATCH_URL=https://tpassociation.org TPA_EXECUTE_APPROVED_ACCOUNT_BATCH=true node --env-file-if-exists=.env.local --import tsx scripts/process-approved-account-batch.mts`: **202 created / 9 held / 0 failed**, verified. Equivalent environment variables were set in PowerShell. Rehearsal used the same runner against the isolated restored database, including interrupted resume and final-build replay.
- `node --env-file-if-exists=.env.local scripts/migrate.mjs`: production migrations 026, 027 and 028 applied successfully.
- `railway up .local/account-batch/release-1791693144858 --path-as-root --no-gitignore --service tpa-web --environment production --project 1f2b5099-790f-48c3-96e9-e62b142157fb --detach --json --message "Approved source batch account provisioning; invitations held"`: deployment succeeded. CLI was invoked through its installed Node wrapper.
- `node --env-file-if-exists=.env.local --import tsx scripts/verify-approved-account-hosted.mts`: **passed** read-only authenticated production Chromium acceptance at 1440px. Observed 202 member register count, linked member details, invitation held, address completion required, and 208 account-directory count. Both screenshots were captured privately; member-register screenshot visually inspected. No real member mutations. The initial exact-text assertion omitted the rendered delivery suffix; corrected locator passed without changing product code.
- Hosted `/api/health`, `/` and `/login`: HTTP 200; anonymous `/api/staff/members?view=register`: HTTP 401.

Coordinated strict-job owner independently passed four database cases including 10/50/250-row creation and repeated-file jobs, mixed rollback/correction, concurrent lease fencing/recovery and diagnostics: 324 unique memberships, zero accounts/invitations/mail. Final compiled XLSX API and desktop/phone browser acceptance also passed. See [strict-job evidence](MEMBER_IMPORT_LAUNCH_BLOCKERS.md). Operational owner separately verified its 200-member synthetic API/browser workflows; those do not count as real batch invitations.

## Remaining

The nine held rows need explicit human resolution; no identities were overwritten. Real invitations remain held and these new users cannot sign in until a separately authorized release. Users complete missing addresses through the existing verification workflow after activation.

This task verified actual stored production accounts and their staff-portal display. Full-launch capacity, physical-device and real-recipient acceptance remain separate gates; this delivery does not claim full launch readiness. No new full responsive matrix was run for this account-import scope: production visual observation was desktop, with synthetic desktop/phone coverage supplied by coordinated workstreams.
