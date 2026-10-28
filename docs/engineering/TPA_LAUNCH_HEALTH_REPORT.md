# TPA launch health report

Runs: 27–28 October 2026, Asia/Calcutta. **Production release recommendation: NOT READY.**
The executed local critical workflows pass after the scoped repairs below. The testing
candidate has not been pushed, merged into main or deployed by this task. Remaining
acceptance gates are explicit; an inventory or local pass is not release approval.

## Candidate and preservation

- Branch/worktree: `testing/launch-readiness`, `D:/Downloads/Workspace/TPA/launch-readiness`.
- Original verified remote main/base: `295c74a65f32171a003bd754f29493bfe59aebd9`.
  Main advanced during execution to `77d84f7f54b8feb7d039886817bca78f8fed4cb4`.
  All eight intervening commits were reviewed and integrated locally in `2d90ed3`;
  the individual dispositions and single payment-markup conflict are in decisions.
- Final engineering implementation checkpoint: `0c56e13236804b5065a8a1f68d77637070449ce4`.
  Final report commit/check results are recorded in `.local/launch-readiness/final-candidate.json`.
  Build identity compares the exact Next BUILD_ID and **355 build-input hashes**;
  source digest: `6989db3dbb21bf74555ef359aa7f8584963ca9c5fe0242801a45c0e250623c57`.
  Report/test-tool changes do not imply a different runtime. Changed inputs reject integration.
- All eight original worktrees, original branch/stash/tag identities, changed source/
  untracked payloads and 1,845 existing evidence files remain preserved. Recovery:
  `D:/Downloads/Workspace/TPA/.launch-recovery/20261027-launch`. Git bundle and
  120-entry payload archive verify. Final original-tree comparison is recorded in
  `preservation-check.json` there. No original checkout/reset/clean/retirement occurred.
  Main's deliberate removal of three loading boundaries was integrated only into the
  candidate; original files remain in their checkouts, recovery payloads and Git history.

## Actual validation

[Executed-result index](TPA_LAUNCH_EXECUTED_RESULTS.json) records exact commands,
revisions, counts, original failures and focused regressions. Counts are executions
or explicitly labelled scenario groups; repeated assertions are not unique features.

| Check | Current evidence and scope |
|---|---|
| Static/build | Integrated 124 unit + 9 runtime assertions passed, alongside lint, structure, web/worker builds and typecheck. Final full static checks run against the committed report SHA; see the final-candidate artifact. |
| Integrated full restricted core | 29 Node assertions pass; 148 browser cases pass, 2 theme-transition measurements fail, 36 skip. Both HTTP privacy regressions and actual six-role/ownership/revocation boundaries pass. Original result remains nonzero at `.local/launch-readiness/2026-10-28T04-15-28.357Z-7b46cc13/results.json`. |
| Portal regression | **45/45 pass, zero skips** at `c0788f9`: all permitted staff/member destinations, desktop/tablet/phone, collapse, mobile focus, session isolation, slow-navigation retention, completion states, applicant alerts and public-style isolation. Theme checks await actual animation completion; 4.5 contrast threshold is unchanged. Nested evidence: `2026-10-28T04-33-02.962Z-46402741/security/restricted-2026-10-28T04-34-26.347Z-fc13b121/portal.log` beneath `.local/launch-readiness/`. |
| Authentication | Real synthetic admin/member form sign-in, wrong password, logout, persistence, expiry, hold/approval and session isolation exercised. Earlier focused auth run: 29 Node + 8 browser pass, 4 intentional viewport duplicates skip; integrated core/portal rechecks retained. Live admin recovery and current authenticated traversal are separate below. |
| Public interactions | Integrated checker passes 12 states: five widths/light-dark and two JavaScript-disabled states, fonts/images, navigation, focus, overflow, runtime errors and automated accessibility. Zero submissions. |
| Member/accounts/newsletter | Integrated member lifecycle 19/19, account preservation 3/3, newsletter 12/12 pass. Isolated mail sink, synthetic credentials; no real member mail. |
| Import jobs/invitations | Integrated imports 5 Node + 3 browser pass; invitation transactions 3/3 including 202 recipients, HTTP 2/2 pass. Resume/restart, correction lineage, hold/idempotency and credential preservation checked. |
| Website/CMS | Six scenario groups pass at `0c56e13`: actual synthetic admin save/reload/publication, private drafts, resource bytes/replacement preservation, pagination, three viewport/accessibility checks. Final retest `.local/launch-readiness/2026-10-28T04-38-15.867Z-b9422ace/results.json`. Prior Copy/hidden-section selector failures retained. |
| Events/payments | 14 groups pass on integrated portal: last-seat races, manual verification/refund history, immutable payee snapshots, reminder/retry/webhook rules, actual UI booking/verification, PNG/PDF/QR exports and attendance. Six payment-table states at 320/390/768/light-dark pass with readable actions, actual keyboard scroll, no page overflow, axe zero and cancelled confirmation causing zero writes. |
| Engagement/operations | Six engagement groups and full operational journey pass: promotions, controlled reminders, expenses, ownership, private resources/perks, attendance, completion/reopening/badges, storage-failure compensation. Integrated retests: `.local/launch-readiness/2026-10-28T04-33-02.962Z-46402741/results.json`. Storage is mocked. |
| Database/runtime identities | Fresh/upgrade runs: 3,906 privilege comparisons and six denied migration attempts pass; exact fixture/role cleanup verified. Integrated core/email runtime uses restricted identities. No migration/schema files changed in the intervening main commits; role evidence stays scoped to its original run. |
| Built-in browser 202 rehearsal | Repeated on integrated portal: select 25/50/.../200/202 across nine pages, review 202 eligible/0 excluded, acknowledgment required, queue exactly 202, reload without duplicates. Database confirms one retained credential and 202 memberships. No email worker/provider. `.local/launch-readiness/interactive-browser-integrated.json`; exact owned database removed after verified snapshot. |
| Linux container | **BLOCKED**: Docker daemon startup failed on a locked local socket. Portable PostgreSQL 17.6 provides separate loopback QA. No Docker reset; container report has zero executed checks. |

The original 36 skips comprise 30 viewport duplicates, three imports subsequently
run separately, and three supplied-photo acceptance cases not executed. The initial
pre-integration 98-pass/7-selector-failure browser run is also retained. Neither broad
run is relabelled green: corrected selectors and transition measurements have explicit
passing regressions. The new portal stage initially had null outer assertion counts;
its nested log contains 45 passes. The result index reconciles this transparently;
`0c56e13` corrects future nested count extraction/artifact retention. No retry hides a failure.

## Confirmed fixes and preserved behavior

- Scoped private/token response headers prevent the catch-all policy overriding
  `no-referrer`; actual HTTP regressions pass and newsletter headers remain intact.
- The 320px payment action originally collapsed to 44.609375px. The table-specific
  minimum-width/nowrap fix is retained alongside main's loaded/empty panel states
  and keyboard-focusable scroll region. Integrated six-state regression passes.
- Test repairs cover invalid synthetic email/password fixtures, stale axe/atlas paths,
  missing helper, actual current panel/select/disclosure controls, source/build identity,
  accurate counts, first-failure retention and isolated portal credentials.
- Theme failure was a 140ms background-transition sample at contrast 4.4308.
  Awaiting animation completion passes all 45 portal cases with the existing 4.5
  threshold and palette. No speculative visual change or relaxed assertion.
- Current portal design, newsletter, public footer/branding, password compatibility,
  invitation holds and separate email/profile/membership/payment/publication states
  are retained. No new business workflow, applied migration or live role/config change.

## Production and actual browser traversal

The earlier live deployment `9fc00623-28c1-49e0-8768-3a8bd4ea6e8a` was replaced
outside this task during execution. Final provider read-only status shows Railway
`tpa-platform` / `tpa-web`, **`f2665e96-5ee1-4aeb-ae98-3e9cc447f2c4` SUCCESS**,
no pending work. Provider metadata exposes no source SHA; do not equate that deployment
with this testing candidate. Evidence: `.local/launch-readiness/production-status-final.json`.
Earlier anonymous homepage/login/health were 200/ready; protected probes 401.

The actual admin failure was reproduced as HTTP 401 / Invalid password. Read-only
state showed an existing operator-approved administrator and credential, without an
invitation hold. The user expressly approved **one recovery email**; provider receipt
and delivery event confirm the request. The user set the password and signed in.
No agent credential change, auth bypass or additional recovery send occurred. The
redacted-input diagnostic was superseded and never establishes an absent account.

After reloading the **current deployment**, the built-in browser traversed **all 16
staff workspaces, 18 views/subsections and all five report previews**. Session persisted.
Report rows: account directory 200-preview limit, events 0, inquiries 1, content 1,
newsletter 1. No exports, preset saves or operational writes. Earlier traversal also
resolved 11 footer destinations and own profile/security. Existing-profile portrait
upload is enabled; the unsaved-new-profile warning is not a storage outage. Existing
QA-labelled records/drafts were preserved. Evidence:
`.local/launch-readiness/live-browser-current-deployment.json` and earlier traversal.
The in-app responsive override was clamped to 921px and reset; actual mobile/tablet
geometry evidence comes from isolated Chromium, not that override.

**All 202 real invitations remain held/unreleased; zero invitation emails queued or
leased. No approved invitation template currently exists.** Exact dashboard-metric
READ ONLY counts after the deployment change: `.local/launch-readiness/invitation-preservation-2026-10-28T04-17-52.552Z/results.json`.
Admin controls remain the existing template save/preview/approve and recipient review/
confirmation sequence. Synthetic batch proof does not authorize releasing the real batch.
The live dashboard still has 202 membership records needing status review; account
activation and membership approval remain separate, with no auto-promotion.

## Remaining gates and recommendation

- Docker/non-root container acceptance is blocked. Exact testing-candidate hosted/CI
  acceptance is not executed: no push/deployment authorization was given for this task.
- Real member/provider-mailbox acceptance, supplied portraits, physical devices,
  assistive technology, capacity and full backup/restore operational acceptance remain
  separately blocked/not tested. Local mocks/emulation do not close those gates.
- The register inventories **458 entries**: 71 PASS, 2 FIXED AND RETESTED, 11 BLOCKED,
  362 NOT TESTED/partial and 12 DEFERRED. Existing 591-case workbook remains untouched.
  Every source route/workspace/API/worker is inventoried; these dispositions do not
  claim every mapped QA edge case was executed or constitute a pass percentage.
- No member send, push, main merge, deployment, billing change, production migration
  or destructive cleanup was performed by this task. The single approved recovery
  request is the explicit live-effect exception. Concurrent external changes are labelled.

**NOT READY for production release until remaining acceptance/release gates are
closed or explicitly resolved.** The testing branch and retained evidence are reviewable.
See the exact three-column [register](TPA_LAUNCH_TEST_REGISTER.md),
[plan](TPA_LAUNCH_TEST_PLAN.md), [decisions](TPA_LAUNCH_DECISIONS.md), and
[executed-result index](TPA_LAUNCH_EXECUTED_RESULTS.json). Raw timestamps remain
unchanged across tools; interpret each result with its recorded environment and scope.
