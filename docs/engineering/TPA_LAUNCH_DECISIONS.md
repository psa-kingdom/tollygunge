# TPA launch validation decisions

## Candidate and preservation

- Base: verified remote `main` at
  `295c74a65f32171a003bd754f29493bfe59aebd9`; dedicated local branch
  `testing/launch-readiness` in `D:\Downloads\Workspace\TPA\launch-readiness`.
  Refresh the health report with the actual tested/final candidate SHA.
- The original `app` checkout has unrelated uncommitted work and an older local
  `main`. Existing worktrees, stash, recovery refs/bundles, ignored evidence and
  supplied assets remain preserved. No reset, clean, forced checkout/history
  rewrite, stash deletion, branch deletion or worktree removal is part of this
  execution. The desired two-branch inventory is deferred for preservation.
- Local candidate commits are authorized after verified diffs and meaningful
  checks; workers do not independently commit. No push, merge into `main`,
  deployment/promotion, remote deletion or live configuration change is
  authorized by this work.
- Review useful security/provenance/dirty-overlay changes individually; do not
  blindly merge old branches or import unrelated design experiments. The current
  approved Paper v3 design, supplied logo bytes and password compatibility
  contract remain the baseline.

## Feature and behavior boundaries

- Cover implemented behavior, documented intended capabilities and newly
  discovered defects. Source discovery and QA mapping establish inventory, not
  execution or release acceptance. Do not invent missing workflows from disabled
  screens or stale documentation.
- New credentials follow the existing 6–12 character contract; existing-password
  inputs permit the established compatibility maximum. Confirm these from current
  code/tests when changing authentication, without replacing valid credentials.
- Account creation, email verification, profile verification, membership approval,
  payment state and public publication remain independent. Imports never imply
  invitation delivery, verified status, paid status or credential replacement.
- Preserve held invitations and worker/promotion/reminder enablement. Test
  supported behavior in isolated fixtures; do not enable operational features on
  production to make tests pass.
- Manual bank/UPI instructions, reference submission, authorized paid/full-refund
  recording and immutable history are supported. No live Razorpay checkout,
  automatic transfer/refund, partial refunds or new accounting engine.
- Historical attendance imports stay preview-only. Membership/renewal/numbering,
  learning awards/certificates, Google/WhatsApp/news provider/policy dependencies,
  reusable speaker library and additional themes retain documented gates.
- Reuse current test frameworks and CI. Prefer minimal confirmed fixes and
  regression additions over refactors, dependency changes, layout rewrites or
  unrelated schema work. Never edit an applied migration to manufacture success.

## Safe additions and deferred backlog

| Addition | Disposition |
|---|---|
| Repeatable source inventory, stable feature/QA/journey mapping | In scope; new engineering script and evidence-backed three-column register |
| Targeted regression gaps and isolated fixture guards | In scope where needed for confirmed defects or critical journeys |
| Current-run CI health/artifact reporting | In scope using existing workflow and tests; no production secrets required |
| Noncritical UX/accessibility defects | Fix only after critical flows and with scoped verification; record remaining cases |
| Admin diagnostic dashboard | DEFERRED; report first; no command execution/internal-secret exposure |
| New business workflows, automated certificates, live gateway, broader redesign | DEFERRED pending separate requirements and authorization |
| Two-branch cleanup or retirement of old worktrees/evidence | DEFERRED; preservation wins over branch count |

## Evidence and external effects

All mutation-heavy testing uses unique synthetic identities, disposable local
databases and provider sinks/mocks. Production is read-only. Never send real
member email, release invitations, publish QA events to real users, change payment
instructions, create production accounts or mutate production data. Provider
acceptance, signed delivery and actual inbox receipt are separate outcomes.

The handoff and workbook are copied byte-for-byte from the original checkout;
their original files remain untouched. The workbook's historical 591 cases are
initially Not run, not launch evidence. Current source includes newsletter/footer
additions that must be reconciled beyond that older checklist.

Record VERIFIED for demonstrated evidence, INFERRED for reasoned interpretation,
and UNKNOWN/BLOCKED where access or execution is missing. Use the required result
statuses in the register; attach evidence only to assertions actually executed.
The coordinator decides the final recommendation from current candidate results.
