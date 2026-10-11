# Member foundation delivery

Status: backend implementation and database/API acceptance passed. Final frontend header/matrix acceptance is in progress in the coordinated UI chat. Production migrations, source imports and deployment are separate operational work.

## Changed

Shared normalization covers prefixes, names, private email, mobile, member writes, application/profile writes and imports. Register APIs support administrator creation/versioned updates and people without website accounts. Public/editorial serializers remove contact, address and membership fields. Password contracts are 8–128 across backend and frontend. New Student applications/policies/evidence uploads are blocked; historical records, requirements and evidence remain available to authorized users.

Parallel UI/editorial/payment work was coordinated in the shared checkout. Its files were preserved. The member workstream adds contract alignment and register/import adapters; broader presentation changes belong to those workstreams.

## Database

Additive migration 023 adds person contact indexes, memberships, postal versions/locations/city aliases and persisted import choices. Account deletion sets person account links null. Normalized email collisions abort before constraints/backfill, without merging or deleting records. Migration 024 publishes Professional labels without rewriting historical policy versions. Concurrent editorial migration 025 is included in combined acceptance.

Fresh and populated legacy rehearsals use disposable PostgreSQL databases. Fresh migrations 001–025 and repeat execution passed. Legacy collision-abort, deterministic backfill, historical Student evidence/policy preservation and repeat execution passed. Postal provisioning installs 156,940 tuples and 4 reviewed city aliases transactionally.

## Import

CSV/XLSX preserve physical source rows and leading-zero formats; unsafe formulas, dates, errors, unsafe numbers and unsupported numeric display formats are held. Preview includes normalized fields, field errors, duplicate/identity conflicts, proposed changes and versions. Server-side choices and commit locking/savepoints prevent partial identities or memberships; repeated commits return stored results. Canonical `members` mode supports selected updates and opt-in accounts/invitations. `existing-members` is preservation-only: exact matches skipped, differing records conflicted, updates/account provisioning prohibited. That source-import user's separate instruction also holds rows needing district derivation and keeps their district blank. General `members` mode retains the approved unambiguous postal derivation.

This workstream inspected the supplied workbook read-only and used synthetic fixtures for commits. The separate real-data chat owns its explicitly authorized isolated source rehearsal and any later operational rollout; those executions are not counted as this workstream's synthetic acceptance.

## Tests

Commands executed in this backend chat, from `app`:

| Command | Executed result |
| --- | --- |
| `npm test` | 72 passed, 0 failed, 0 skipped. |
| `npm run typecheck` | Exit 0; no TypeScript errors. |
| `npm run lint` | Exit 0; no ESLint errors. |
| `node --env-file=.env.local --import tsx scripts/test-member-migration.mts` | Fresh migrations 001–025, repeat execution and empty-table assertions passed; disposable database dropped. |
| `node --env-file=.env.local --import tsx scripts/test-member-foundation.mts` | Earlier full run: 3 member/geo/legacy tests passed, including 250 committed synthetic records; 5 baseline checks passed and 2 onboarding guards skipped because the first disposable database used the older name prefix. The runner prefix was corrected; later onboarding/auth/delivery runs had no skips. |
| `node --env-file=.env.local --import tsx scripts/test-member-foundation.mts --http-only --wait-build` | Latest fixed backend build: 4 targeted member/geo/legacy/preservation checks, 7 database/identity/auth/mail checks, 3 onboarding-enabled API checks and 3 legacy API checks passed (17 total, 0 failed/skipped). Server stopped and disposable database dropped. |
| `node --env-file=.env.local --import tsx .local/verify-invitation-rollback.mts` | 1 additional failure-injection test passed: failed invitation enqueue removed account/person/membership; following row succeeded. Transaction rolled back. This probe is a local orchestrator; its permanent test is in `tests/member-foundation.integration.ts` and included in future `--http-only` runs. |
| `node --env-file=.local/real-data/rehearsal.env --import tsx .local/verify-preview-policy.mts` | Final built API passed two stale-policy rejections (409), two current-policy empty commits (200) and their stored-result replays. Account/person/member/mail counts unchanged by commits. Synthetic administrator/session, four batches and audit events removed. Existing isolated rehearsal database and source batch preserved. Permanent old-policy assertion is in `tests/member-foundation-http.integration.ts`. |

Build/browser commands were executed in coordinated chats; output logs were inspected here. `npm run build` passed (58 routes). With `TPA_UI_TEST_FILES='tests/browser/member-platform.spec.ts,tests/browser/onboarding.spec.ts'`, `node --env-file-if-exists=.env.local --import tsx scripts/verify-member-ui.mts` passed 34 tests with 8 deliberate project skips. A focused rerun using `TPA_UI_TEST_FILES='tests/browser/member-platform.spec.ts,tests/browser/workspace-ux.spec.ts'` and `TPA_UI_TEST_GREP='profile uses|address cascading|published preview|password requirements|responsive|appearance|staff header|verification reasons'` passed 22 tests with 2 deliberate project skips. Both disposable databases were dropped. The final CSS contrast/header matrix is pending in the real-data chat after the UI chat lost its connection.

The long 250-record suite ran earlier; after the final legacy/alias/provisioning fixes, targeted PostgreSQL/API and failure-injection suites were rerun instead of repeating that long suite. Initial runs found invalid legacy fixture assumptions, an invitation assertion that counted unrelated fixtures, and browser selector/save-timing/shared-artifact problems. Those were corrected; the final passing results above replace the failed/interrupted attempts. One API run was deliberately stopped to rebuild newly added legacy guards; its isolated server/database were cleaned up.

Logs are kept in ignored `.local` directories: `member-unit-tests.log`, `member-typecheck.log`, `member-lint.log`, `member-fresh-migration.log`, `member-db-tests.log`, `member-acceptance-complete.log`, `member-invitation-rollback.log`, `member-preview-policy.log`, `member-ui-browser-final.log` and `member-ui-postfix-verified.log`. Final unit tests again passed 72/72, typecheck and lint exited 0, and `git diff --check` exited 0 (line-ending notices only). Initial narrow-policy probes returned 401 because the synthetic staff identity was unverified; correcting the fixture produced the passing policy result without changing authentication code. Source member reports remain private. No implementation tests were executed during planning; the results here are implementation-stage execution evidence.

## Verified

The synthetic transaction suite with 250 records passed creation, repeated imports/commits, reviewed updates, stale previews, optional invitations, account deletion preservation and injected savepoint failure. Final API checks prove account-free retrieval, administrator-only writes, same-origin rejection, stable validation/conflict responses, prefixed display names, unchanged legacy mobile/addresses in complete resubmitted bodies, strict preservation imports versus canonical derivation, optional account provisioning and invitation idempotence. The additional enqueue-failure test proves rollback after an account and invitation have already been created. PostgreSQL race, postal hierarchy/PIN ambiguity/parent changes and legacy Student preservation passed. Complete desktop/tablet/phone member/onboarding functional journeys passed; the UI chat's final CSS matrix rerun remains pending.

Inspection is distinct from execution: the source workbook was parsed/previewed read-only in this backend workstream. The separate real-data chat reports its explicitly authorized preservation-mode source rehearsal as 211 outcomes: 0 created/updated/skipped, 134 conflicts and 77 validation failures, with districts blank and account/member/mail counts unchanged. That real-data execution is not part of this workstream's synthetic test count. Postal provenance is inspected from the pinned snapshot metadata; direct government acquisition was unavailable.

## Remaining

Bulk commits are synchronous and slow against remote PostgreSQL: the test with 250 records took approximately 21 minutes. Hosted HTTP/proxy timeout behavior must be addressed or validated before a large browser import rollout. Functional acceptance does not establish production import transport readiness. Long-running operational clients must recover the existing persisted batch rather than create a replacement batch after a timeout.

The postal snapshot is a pinned republish of Department of Posts data because direct government acquisition was unavailable; provenance/checksums and refresh instructions are documented. City aliases currently cover only reviewed Kolkata/Calcutta and Howrah/Haora contexts. Unsupported/ambiguous source addresses remain held for correction or reviewed reference updates. Other international countries receive ISO/character-format checks; country-specific shapes are additionally provided for US/Canada/GB.

Production backup/preflight, postal provisioning, migration execution, reviewed real imports and deployment remain operational steps. See `MEMBER_FOUNDATION.md` for API contracts, migration preflight and rollback instructions.
