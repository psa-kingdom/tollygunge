# Final production release and recovery

This runbook supersedes the older snapshot-specific release instructions. Deployment is conditionally authorized by the owner only after all mandatory gates pass. Do not deploy the old `.local/live-product` tarball or use its historical deployment identity as current evidence.

## Candidate and evidence

Start from clean published `main`. Record its exact SHA, CI run, Windows build ID, Linux container identity, migration checksums, source archive hash and Railway deployment identity in the private release manifest. Evidence for the 15 October review is under `.local/final-release-20261015`; earlier Phase 5/6 evidence remains separate. Never package evidence, backups, credentials, `.env` files or test fixtures. A rebuild is a distinct artifact: record its new build/digest and verify provenance; do not describe source equivalence as byte-for-byte artifact equivalence.

The approved homepage, artwork, fonts and atlas are protected. The focused follow-up adds HTTPS transport policy, cold/warm invitation acceptance with token-free response timing, read-only CI permissions, and Linux container verification. It introduces no API, business-rule, dependency or migration change.

## Mandatory gates

- Recheck production identity and readiness. Read live migration checksums in a read-only transaction and compare against unchanged source. Stop for mismatch or an unexpected deployment.
- Make a fresh private production backup; restrict access and prove local restoration. Only recovery/migration verification may use the restored real records. Use separate synthetic databases with sinks/mocks for all business journeys. Never use `backup-real-data.mts` to restore onto the production database service.
- Rehearse pending migrations through 033, compare original columns/rows, prove idempotence and remove only the exact disposable database. Recheck backup freshness before release.
- Require production build, lint, typecheck, unit, database/HTTP, full browser/route, workflow and worker acceptance. Keep failures, retries, skips and manual screenshot review distinct. Diagnose persistent failures rather than extending timeouts or weakening assertions.
- Require green CI for the exact published candidate, including `runtime-container`. The container check builds the existing Dockerfile on Linux/Node 24, verifies non-root execution, assets, response headers, absence of private files/development lint packages, and recovery of both workers while web remains available.
- Record security findings and mitigations. No unmitigated Critical/High finding may remain. The existing development-only braces advisory has no patched release at review time; production exclusion must be verified in the actual runtime, not inferred from package classification. CI runs with read-only repository permissions; lint patterns are repository-controlled. Do not force an incompatible framework/lint downgrade.
- Inspect current canonical auth URL, stable auth secret presence, TLS/database/storage/provider configuration, worker leases and in-flight/queued work without exposing credentials, recipients or tokens. Read-only provider probes do not establish inbox delivery or storage write acceptance.
- Confirm Railway can recover the recorded previous web/worker artifact and that it is compatible with the upgraded schema. Preserve the writable OS-temp worker health path and worker crash isolation.

## Coordinated release

1. Refresh live identity, backup/preservation evidence, queue state and remote `main`. Confirm no unrelated source changes. Retain the previous artifact and flag values privately.
2. Set `EVENT_REMINDERS_ENABLED=false`, `EVENT_PROMOTIONS_ENABLED=false` and `MEMBER_IMPORT_WORKER_ENABLED=false` for this rollout, without a premature redeploy. Preserve normal onboarding/recovery mail and invitation holds. Reject test sinks, mock storage and inherited local credentials in hosted runtime.
3. Apply only pending, checksum-verified migrations with `scripts/migrate.mjs --through 033` using the guarded production connection. The migrator verifies database identity, obtains an advisory lock and commits each migration separately. Stop after any error; inspect applied state before retrying. Never edit applied migrations.
4. Upload only a clean, manifest-verified candidate source archive through the inspected Railway deployment path. Build and deploy web and compiled workers together. Record the resulting build/artifact separately from the local/CI artifacts and verify it is derived from the accepted source.
5. Require Railway success plus actual readiness, expected security headers, assets, public routes, anonymous protection boundaries, worker heartbeat and private-resource boundaries. Use `node scripts/verify-release.mjs --url https://tpassociation.org --expect-hardened-headers` without credential flags for read-only smoke checks.
6. Observe for 30 minutes. Record health, worker/provider state, queues, unexpected processing and errors. Do not enable bulk imports, event scheduling or promotions automatically. Do not submit memberships, invitations, payments, recovery requests or other production business writes as test fixtures.

## Stop and recovery

Stop for migration mismatch/failure, changed original records, auth/availability regression, private-resource exposure, unexpected delivery or incompatible workers. Prevent new scheduling; inspect in-flight/provider-accepted work without replaying it. Recover web and workers together to the verified compatible prior Railway deployment, then verify readiness, login boundaries, assets and worker state.

Keep additive schema and subsequent records. Never drop migrations, truncate queues or restore an old volume to undo presentation changes. A destructive database restore requires a separate disaster-recovery decision. An older CMS artifact may reject new customized headings: suspend CMS writes while recovering rather than resetting published content.

## Honest acceptance

Final evidence must identify the tested and deployed source/artifacts, executed counts, failures, skips, retries, preservation checks and remaining limits. Hosted inbox delivery, storage writes, physical devices, assistive technology and capacity require their own evidence; local or read-only checks do not prove them. A failed or materially unknown mandatory gate means **BLOCKED**, with production unchanged except any explicitly recorded release actions already completed.
