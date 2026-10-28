# TPA launch health report

Runs: 27–28 October 2026, Asia/Calcutta. **Production release recommendation: NOT READY.**
The listed local critical workflows pass; the testing candidate has not been pushed,
merged or deployed. Remaining acceptance boundaries below are explicit, not waived.

## Candidate and preservation

- Branch: `testing/launch-readiness`, worktree `D:/Downloads/Workspace/TPA/launch-readiness`.
- Production reference/base: `295c74a65f32171a003bd754f29493bfe59aebd9`.
- Runtime fixes are in `a001c09657944abc36ec58a20257031f6bd27b2c`;
  diagnostic/preview and evidence integration is in `a38f9814d6bbef80d397c31bbe145ac9f7408063`.
  Final static results and final report commit are recorded in the local final-candidate identity artifact.
- Build identity checks compare the exact build ID and SHA-256 manifest of 347 build
  inputs. Documentation/test-only commits do not imply a different runtime; a changed
  build input refuses integration until web and worker builds succeed together.
- All eight original worktrees, old branch/stash/tag identities, source/untracked
  payloads and 1,845 existing evidence files are preserved. Private recovery storage:
  `D:/Downloads/Workspace/TPA/.launch-recovery/20261027-launch`.
  Git bundle and 120-entry payload archive verify; final source/evidence comparison
  reports eight original trees, zero differences. No branch/worktree/stash cleanup.

## Actual validation

Counts below are assertion executions or explicitly labelled scenario groups.
Repeated suites are not summed into a misleading unique-feature total.
[Executed-result index](TPA_LAUNCH_EXECUTED_RESULTS.json) retains scoped commands,
revisions, initial failures and subsequent regression results.

| Check | Actual outcome and evidence |
|---|---|
| Static/build | Lint, indexed structure, 119 unit tests, 9 runtime tests, web/worker builds and typecheck pass on the recorded runs. Final clean implementation run at `a38f981` passed all seven selected phases, 128/128 Node assertions, zero skips/failures; evidence: `.local/launch-readiness/2026-10-28T04-00-22.306Z-db620151/results.json`. |
| Broad restricted core | 29 Node tests passed; browser run had 98 passes, 7 new-test selector failures, 36 skips. Both effective HTTP privacy regressions passed. Original nonzero result retained at `.local/launch-readiness/2026-10-27T12-13-40.705Z-72101376/`. |
| Auth regression | Corrected only the ambiguous error selector. 29 Node tests and 8 browser cases pass; 4 deliberate viewport duplicates skipped. Admin/member form login, wrong password, persistence, 7/30-day sessions, logout, expiry, holds, approval and authorization exercised. Evidence: `.local/launch-readiness/2026-10-27T12-28-13.347Z-b364fab4/results.json`. |
| Public interactions | Approved Paper v3 checker passes 12 states: five widths in light/dark plus two JavaScript-disabled states; fonts/images, links, focus, overflow, runtime errors and automated accessibility checked; zero submissions. The obsolete atlas selector failure is retained. |
| Member lifecycle | Initial invalid-email fixture failure corrected; 19/19 database/HTTP tests pass. Evidence: `.local/launch-readiness/2026-10-27T12-22-47.704Z-a66cc20f/results.json`. |
| Newsletter/accounts/invitations | Newsletter 12/12; account preservation 3/3; invitation transactions 3/3 including 202 recipients; invitation HTTP 2/2. Restricted newsletter rerun also 12/12 with the limited email identity and exact cleanup. No real member email. |
| Import jobs | 5 Node tests and 3 browser viewport cases pass; independent synthetic database counts, resumable jobs, worker restart, correction lineage and zero invitations checked. Evidence: `.local/launch-readiness/2026-10-27T12-30-10.942Z-606ddcc3/results.json`. |
| Website/CMS | Six scenario groups pass including actual admin save/reload/publish, draft privacy, resources, pagination, replacement preservation and three viewport/accessibility checks. Missing historical axe path was repaired to use the already locked package; original failure retained. |
| Event flow | 14 scenario groups pass: additive migrations, last-seat concurrency, manual payments/refund history, reminders/retries/webhooks, real UI registration/verification, PNG/PDF/QR exports and attendance. Final run: `.local/launch-readiness/2026-10-27T12-37-04.911Z-91a77a1a/results.json`. |
| Engagement/operations | Six engagement scenario groups and the full event-operations browser workflow pass: reviewed promotion, reminders, expenses, attendance/completion, protected resources/perks and mocked storage compensation. Evidence: `.local/launch-readiness/2026-10-27T12-32-06.636Z-86cd31b6/results.json` and retained engagement run. |
| Database identities | Fresh and upgrade runs pass 3,906 table privilege comparisons and six denied migration attempts. Exact test database/role cleanup verified. Evidence: `.local/launch-readiness/security-role-run/role-acceptance.json`. |
| In-built browser 202 rehearsal | Synthetic admin login; 202 selections across nine pages; 202 eligible/0 excluded; acknowledgment required; one confirmation queues exactly 202; reload does not duplicate; one existing credential remains. No worker/transport, real emails or real records; exact own database removed. Evidence: `.local/launch-readiness/interactive-browser-evidence.json` and `interactive-202-34a43262-4b52-4359-b659-131c1c823d02/results.json`. |
| Linux container | BLOCKED: Docker daemon startup failed on a locked local socket. Portable PostgreSQL 17.6 provided separate loopback QA; no Docker reset was attempted. `.local/launch-readiness/container-acceptance.json` has no executed container checks. |

The original 36 browser skips comprise 30 intentional viewport duplicates,
three import cases subsequently executed separately, and three supplied-photo
acceptance cases not executed. The first broad suite is **not** relabelled green;
its seven fixture failures have an explicit focused passing retest. The scoped
payment CSS change was rebuilt and exercised with the complete event flow and
six table states rather than rerunning unrelated browser cases.

## Confirmed fixes

- Next catch-all headers overrode private/token `no-referrer`. Scoped overrides
  preserve shared headers and existing newsletter behavior; real HTTP regressions pass.
- At 320px, long payment data squeezed Review payment to 44.609375px. One table
  class and six scoped CSS rules preserve readable 131.453125px by 44px actions.
  All six 320/390/768 light/dark states pass: keyboard scroll is positive, page
  overflow false, axe violations zero, empty state works, dismissed confirmation
  causes zero payment writes. Before/after evidence is retained under `.local/event-flow/`.
- Test infrastructure repairs cover strict fixture typing, invalid synthetic email,
  new-password fixture boundaries, missing test helper, stale atlas/axe paths,
  browser channel selection, first-failure retention, accurate Node/Playwright/phase
  counts, artifact provenance and fail-closed source/build correspondence.
- No business workflow, applied migration, production role/grant, password policy,
  member state, payment instruction or approved branding was replaced.

## Production and actual browser traversal

Production remains Railway `tpa-platform` / `tpa-web`, deployment
`9fc00623-28c1-49e0-8768-3a8bd4ea6e8a`, provider SUCCESS. Historical release evidence
associates it with main `295c74a`; provider metadata itself does not expose a SHA.
Anonymous homepage/login/health returned 200; health ready/workers running;
protected member/staff/private-document probes returned 401.

The live admin failure was reproduced as HTTP 401 and provider Invalid password.
Read-only state showed an existing operator-approved admin, a password credential,
and no invitation hold. The user expressly authorized one recovery email; provider
receipt and delivery event confirm that one request. **The user set the password
and signed in themselves.** No agent credential change or auth bypass occurred.
The earlier redacted-field diagnostic is explicitly superseded and is not evidence
that an account was absent.

After login, the built-in browser traversed **all 16 live staff workspaces,
18 views/subsections, all five reports, 11 footer destinations, and the admin's
own profile/security**. Session persisted after reload. Reports and directories
loaded; existing-profile portrait upload is enabled. The initial unsaved-new-profile
warning cleared and is not a storage outage. Existing QA-labelled records/drafts
were observed and preserved, never cleaned. No real record save, publication,
payment, upload, invitation review/approval/release or member send was invoked.
Evidence: `.local/launch-readiness/live-browser-traversal.json`.
The in-app responsive override was clamped to 921px and reset; actual mobile/tablet
geometry evidence comes from isolated Chromium, not that browser override.

**All 202 real member invitation holds remain present and unreleased; zero member
invitation emails are queued/leased.** This was verified before/after the local
rehearsal and live traversal with the dashboard's exact metric in READ ONLY
transactions. Latest evidence:
`.local/launch-readiness/invitation-preservation-2026-10-28T03-55-10.154Z/results.json`.
There is currently **no approved invitation template**. Keep the existing admin-only
save/preview/approve, recipient-review and confirm-send sequence. Synthetic tests
prove a 202-recipient batch; they do not authorize releasing the real batch.

## Remaining gates and final recommendation

- Testing candidate is not deployed; GitHub CI configuration was extended but its
  hosted runs were not triggered because push is not authorized. A merge/local pass
  is not live release evidence. Candidate-hosted validation follows separate approval.
- Linux/non-root container acceptance remains blocked by Docker. Real member
  activation/provider mailbox acceptance, supplied-photo sign-off, physical mobile
  devices, assistive technology, capacity and full backup/restore acceptance remain
  blocked or not tested at their individually recorded scopes.
- The live dashboard has 202 membership statuses needing review; invitation/account
  activation is separate from membership approval. No status was auto-promoted.
- The register inventories every source route/workspace/API/worker and intended
  capability, but does not claim every mapped QA edge case was executed. Its current
  455 entries are **68 PASS, 2 FIXED AND RETESTED, 11 BLOCKED, 362 NOT TESTED/partial,
  12 DEFERRED**. These are dispositions, not an assertion pass percentage.
- No real member send, main merge, push, deployment, billing change, production
  migration or destructive cleanup occurred. The only agent live side effect was
  the separately approved single admin recovery request.

**NOT READY for production release until the outstanding release/acceptance gates
are closed or explicitly resolved.** The testing branch is reviewable with repeatable
commands, preserved evidence and honest limitations. See the three-column
[register](TPA_LAUNCH_TEST_REGISTER.md), [plan](TPA_LAUNCH_TEST_PLAN.md) and
[decisions](TPA_LAUNCH_DECISIONS.md). Raw timestamps are retained across tools;
use their recorded environment/scope rather than inferring a single continuous run.
