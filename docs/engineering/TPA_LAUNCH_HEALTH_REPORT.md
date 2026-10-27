# TPA launch health report

27 October 2026, Asia/Calcutta. **NOT READY — validation in progress.**

Candidate branch: `testing/launch-readiness`; base `295c74a65f32171a003bd754f29493bfe59aebd9`.
The coordinator will record the tested implementation SHA and final evidence below.

## Verified baseline

- All eight original worktrees preserved. Changed payload copies and full Git bundle verified in private recovery storage `D:/Downloads/Workspace/TPA/.launch-recovery/20261027-launch`; 1,845 existing evidence files hashed. Final preservation comparison pending.
- Production Railway project `tpa-platform`, service `tpa-web`, deployment `9fc00623-28c1-49e0-8768-3a8bd4ea6e8a` reports SUCCESS; no staged work. Provider metadata does not independently expose a source commit; historical release evidence associates it with base `295c74a`.
- Fresh anonymous GETs: homepage/login/health 200, health ready with background workers running; member/staff/private-document APIs 401. Evidence: `.local/launch-readiness/production-readonly-2026-10-27T12-10-34.607Z/results.json`. These checks do not validate login or deploy the candidate.
- Docker startup failed on a locked local socket. A new portable PostgreSQL 17.6 cluster under candidate `.local/launch-postgres` is bound to `127.0.0.1:55439`; no pre-existing database or Docker data was reset.

## Validation status

Initial static run: lint, structure, 116 unit tests, runtime and worker build passed; build/typecheck failed on newly added fixture typing. Fixture typing corrected; targeted typecheck passes. Initial evidence is retained at `.local/launch-readiness/2026-10-27T12-07-41.719Z-4c3e87c0/results.json`; full rebuild/retest pending.

Fresh and upgrade restricted-role checks passed, including 3,906 table privilege comparisons, six denied migration attempts, and catalog-verified removal of exact test databases/roles. Evidence: `.local/launch-readiness/security-role-run/role-acceptance.json`.

Authentication browser journeys, complete integration acceptance, visual journeys, external-provider delivery and human acceptance are **NOT TESTED** on the implementation commit until their results are recorded. No confirmed current login failure has yet been reproduced; do not label authentication fixed merely from a passing unit check.

The three-column [register](TPA_LAUNCH_TEST_REGISTER.md), [plan](TPA_LAUNCH_TEST_PLAN.md), [decisions](TPA_LAUNCH_DECISIONS.md) and [source inventory](TPA_LAUNCH_FEATURE_INVENTORY.json) distinguish inventory, test results and planned/deferred capabilities.

## Release boundary

No push, main merge, deployment, production database mutation, real notification, invitation release or financial operation is authorized or performed. Provider inbox acceptance, HTTPS session-cookie behavior, human/device acceptance and capacity/recovery tests require appropriate isolated environments or separately approved operations. Existing worker holds remain unchanged.
