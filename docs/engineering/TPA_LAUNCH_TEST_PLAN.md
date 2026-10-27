# TPA launch validation plan

This candidate uses `testing/launch-readiness`, initially based on remote `main`
`295c74a65f32171a003bd754f29493bfe59aebd9`, in a dedicated worktree. The health
report records the actual run, exact tested revision and remaining blockers.
Preparing an inventory does not execute any case or establish launch readiness.

## Coverage and existing acceptance guidance

- [Feature inventory](TPA_LAUNCH_FEATURE_INVENTORY.json) discovers every current
  page/handler, concrete public information page, staff workspace and worker entry
  point. Business-feature rows cover cross-route behavior. Planned rows preserve
  explicit deferred contracts instead of silently implementing new workflows.
- [Three-column register](TPA_LAUNCH_TEST_REGISTER.md) is generated from that
  inventory. Each row retains stable IDs, source references, mapped acceptance
  cases, result, evidence, environment, tested SHA and limitations. Static literal
  action extraction is partial: review delegated services and every tab/dialog.
- [Existing handoff](../TPA_TESTING_HANDOFF.md) is copied unchanged from the
  protected source checkout. Its 270 written cases and 12 end-to-end journeys are
  included. [Companion tracker](../TPA_TESTING_TRACKER.xlsx) is also copied
  byte-for-byte; its 591 detailed cases remain historical **Not run** until
  somebody actually executes and records them. This task does not rewrite it.
- Reconcile the handoff with current newsletter/footer additions and current
  source. Older reports saying email/inbox/report exports are deferred describe
  older slices; current source implements them. Historical evidence is a pointer,
  not a result for this candidate.

## Execution order and environments

1. Record branches, worktrees, stash/recovery refs, staged/unstaged/untracked work,
   relevant ignored evidence, hashes and candidate identity before editing.
   Preserve the original checkouts; perform no branch/worktree/data cleanup.
2. Reproduce login with isolated synthetic administrator/member accounts and the
   actual request/session path. Trace validation, account/hold state, credentials,
   same-origin/trusted origins, cookie/session creation and redirects. Fix only
   confirmed causes and add failing-then-passing regression evidence. A prompt
   saying login fails is not itself reproduction evidence.
3. Run existing structure, unit/runtime, lint, typecheck, production web/worker
   builds and migration consistency checks. Audit runners before invocation:
   several load `.env.local`; inherit only explicit safe values. Reuse the
   existing Node test runner, PostgreSQL suites and Playwright framework.
4. Run isolated database/API and complete browser journeys using unique synthetic
   identities, a disposable loopback database, mail sink/mocks and local object
   storage mocks where supported. Test all six staff roles and members A/B,
   verification/inactive/held states, wrong ownership, revoked sessions and stale
   versions. Never use real members as fixtures.
5. Execute E2E-01 through E2E-12 from the handoff with this isolation override:
   new-member review, imported activation, free event, paid/manual event,
   cancellation/refund record, reminder revisions, campaign/unsubscribe,
   inquiry closure, publication lifecycle, entitlements, staff revocation and
   worker/recovery failure. Do not stop independent public/static testing when
   authentication blocks dependent journeys.
6. Review public/member/staff surfaces at 320/390/768/1440 widths, supported
   light/dark/system appearance and 200% zoom. Check keyboard/dialog behavior,
   labels, touch targets, tables, images/QR, loading/empty/error states, runtime
   errors and failed requests. Retain traces/screenshots labelled by run,
   viewport/theme, feature ID, environment and source/build identity.
7. Verify production only through read-only health/public/protected-denial checks
   and available provider identity/logs. Preview/hosted write journeys, actual
   inbox receipt, physical devices, full recovery and capacity are separate
   acceptance boundaries. Missing infrastructure is BLOCKED, never PASS.

## Safe result recording and repeatable generation

Run `node scripts/build-launch-inventory.mjs` from the candidate root to refresh
source discovery and regenerate the register. Existing results are retained by
stable ID. `QA-*` and `E2E-*` IDs retain their original identity; `LR-*` IDs are
deterministic hashes of kind/key and survive file ordering changes.

Attach actual results with `node scripts/build-launch-inventory.mjs --results
.local/<run>/feature-results.json`. The input is an array; one element is:

```json
[
  {
    "id": "QA-0032",
    "status": "NOT TESTED",
    "summary": "Replace with an actual, case-specific outcome after execution.",
    "evidence": [],
    "environment": null,
    "testedSha": null,
    "limitation": "No executed evidence attached."
  }
]
```

Select the real ID from the inventory; the sample is not a test result. Evidence
paths are repository-relative or HTTPS report URLs; retain the original command
and assertion evidence. For PASS/FAIL/FIXED AND RETESTED, the generator requires
evidence, environment and testedSha. FIXED AND RETESTED additionally requires
`regressionEvidence`. BLOCKED/DEFERRED require a limitation. Unknown or duplicate
IDs and invalid statuses abort generation before either output is written.

An aggregate suite pass supports only the assertions it actually executes.
Do not mark every related route/QA/journey PASS based on a unit suite, HTTP 200,
screenshot, or source mapping. Uncovered subcases remain NOT TESTED; a feature
can record partial evidence while retaining its incomplete disposition.

## Acceptance and evidence retention

The coordinator owns `TPA_LAUNCH_HEALTH_REPORT.md`: exact branch/commit and dirty
overlay identity, run time in IST, commands, assertion counts, pass/fail/skipped/
blocked/not-run counts, fixes/retests and remaining human/provider gates. Separate
local synthetic, preview, production read-only and human acceptance results.

No critical authentication, authorization, private-data integrity or payment-state
failure permits READY. READY WITH ACCEPTED RISKS requires explicitly accepted,
noncritical risks; silence is not acceptance. A fixed issue without a passing
targeted regression remains incomplete. Keep sanitized logs, browser traces,
screenshots and reports under existing ignored `.local/<run>` or
`output/playwright/<run>` destinations; never commit secrets or private records.

Only current-run owned synthetic fixtures may be cleaned up within the isolated
environment after evidence is preserved. Existing files, original worktrees,
stashes, recovery bundles/tags, historical outputs and source documents remain.
