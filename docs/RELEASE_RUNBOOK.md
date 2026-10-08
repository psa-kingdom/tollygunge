# TPA release, rollback and recovery runbook — 8 October 2026

## Repeatable smoke checks

From the app directory run `npm run release:check` (production default), or append
`-- --url http://127.0.0.1:3000` for local checks. It reads readiness, public pages,
anonymous protected-route redirects/API denial and provider-gate signals. No business
records are written. Optional authenticated checks read transient `Email:`/`Password:`
fields from an existing local file via `--credential-file <absolute-path>`; an explicit
`--email` supplies the identifier if the file contains only Password. No credentials
are output/stored or placed in arguments; only file path/account identifier are options.
Pass `--expect-deferred` to assert Google and emailed recovery controls stay disabled.
Pass `--expect-storage` to require configured hosted editorial upload controls.

Authentication creates a temporary session and signs it out in `finally`; reused cookie
must then return 401. This does not sign out the user's independent browser session.
Use an administrator test identity for the optional reports/presets/sources checks;
permission tests for other roles remain in the integration suite. Missing Google/email
providers are recorded as gates, not readiness successes. Checks never submit forms,
create exports, send messages, approve content or touch DNS/settings. Nonzero exit
means investigate; do not treat failed login as a successful authenticated smoke.

## Delivery

1. Keep main deployable; commit on existing `feat/platform-foundation`, push and update
   draft PR #1. Do not merge or rewrite history. Review changes and preserve migrations.
2. Run lint, typecheck, unit, PostgreSQL, HTTP, build and CI against appropriate fixtures.
   CI uses disposable PostgreSQL and disabled external storage. Apply additive checksummed
   migrations through the existing runner; wrong database identity/checksum fails closed.
3. Record healthy deployment ID/current commit and managed configuration names (no values).
   The pre-batch healthy runtime is e98180e, deployment 9efdae03-9bb5-4b7d-97ef-764e43c9e277.
4. Deploy only committed source to existing Railway `tpa-web`. If cwd upload fails, use
   a clean `git archive HEAD` in an ignored `.local/release-<commit>` directory and deploy
   with `--path-as-root`; never include `.env`, Credential.md or other local files.
5. Verify Railway status/readiness; run smoke and configured new HTTP journeys. Check
   desktop/tablet/phone and keyboard workflows, parse exported workbooks, remove exact
   synthetic records/audits/downloads, record evidence in the checklist. Keep Resend gated.

## Application rollback

If readiness/authentication/new journeys fail, redeploy the last verified healthy
Railway application deployment. Preserve PostgreSQL, authentication secrets, DNS,
domain settings and R2. Additive migration 017 can remain: old application ignores its
new tables. Never undo migrations by dropping live data, and do not restore an old
PostgreSQL volume to fix an application error. Reverify readiness, login, sign-out,
revoked-session denial and public pages. Storage failures use the separate R2 rollback
procedure only when that storage-specific fault actually requires it.

## Backup and restore — UNVERIFIED

A written procedure is not a verified recovery capability. Current recovery acceptance
remains open until a disposable restore exercise demonstrates data and object recovery.
Do not restore over production, delete volumes or create a new paid service for this batch.

For the later exercise: inventory Railway backup availability/retention and R2 object
protection, record RPO/RTO and data boundaries with the owner, obtain a consistent encrypted
PostgreSQL logical snapshot or provider backup, and protect original private R2 objects
plus metadata references. Use a disposable isolated database and private test namespace,
with TLS, managed secrets and no outbound campaigns/payment jobs. Validate database identity
before restore. Restore roles/schema/data, run migration checksums, compare row counts and
foreign keys, test login with a disposable identity and verify ownership/publication object
access. Do not clone live sessions into an accessible staging application; revoke/omit them.
Record elapsed recovery time, object presence, errors and cleanup. Remove only exact
exercise resources after verification. Establish scheduled retention/access and repeat
restore drills before marking full recovery Done. Backup creation alone is insufficient.
