# Strict member import jobs and source corrections

This pipeline imports people and memberships only. It never provisions accounts, creates invitation tokens or queues mail. Missing Indian districts remain held; no postal suggestion supplies that personal fact. The separately approved account-source exception is a different workflow and cannot enqueue these jobs.

## Correction workflow

Read-only diagnosis:

```powershell
node --conditions=react-server --env-file=.env.local --import tsx scripts/diagnose-member-source.mts
```

It checks the workbook SHA256 and all original worksheet row numbers against the persisted 211-row report, reads current identities and local postal references inside `BEGIN READ ONLY`, and writes restricted ignored `.local/member-resolution/diagnosis.json`. Standard output contains aggregates only. All independently checkable issues are recorded. Blocked dependent checks are distinct from errors, and unsupported city coverage does not prove the source city is wrong. Summary classification prioritizes duplicate/database identity conflicts, then validation/dependent errors, then missing-district holds. Issue counts overlap; they are not added together.

The current original source reconciles to 0 valid, 134 conflicts and 77 invalid. Secondary checks show missing districts on all 211 rows, 72 unsupported city-reference contexts, 15 incomplete addresses, 14 duplicate-email occurrences, 11 ambiguous postal results and 2 database identity conflicts. These are inspected source/database results, not new import execution.

Use the bundled workspace dependency loader's Node packages to generate the correction workbook:

```powershell
$env:TPA_ARTIFACT_RUNTIME_MODULES='<bundled node_modules path returned by the dependency loader>'
$env:TPA_WORKSPACE_PYTHON='<bundled Python executable returned by the dependency loader>'
node scripts/build-member-correction-workbook.mjs
```

Run the spreadsheet artifact-operation marker once before authoring. The workbook contains `Corrections`, `Summary`, `Issues` and `Originals`; the first sheet is deliberately importable. Identifiers remain text. Corrected values start from safe normalization while original source values remain separate. Missing facts are blank. Staff must provide authoritative corrections; do not invent district/city data or delete a duplicate occurrence.

The export adapter changes only OOXML namespace serialization for ExcelJS compatibility. The correction endpoint explicitly accepts these four reserved worksheets and imports `Corrections`; ordinary uploads still require one worksheet. Read-only round-trip verification preserved all 211 original row identifiers, membership-number formatting and the unchanged source checksum.

The web workspace also downloads a CSV correction template. Original imports use 13 columns. The extended contract adds `District` and `Postal Locality`; correction round-trips additionally include `Original Source Row` and `Original Source Hash`. All expected headers are required. Upload a correction from its original saved preview, so the server can validate its parent batch, original hash and row identity. A filtered correction retains physical source rows rather than being renumbered. Corrected submissions always create fresh previews. Original previews and outcomes are retained.

## API and processing

Administrator-only `/api/staff/member-import-jobs` supports:

- Multipart POST with `file` and optional `parentBatchId`: strict preview plus full diagnostic, HTTP 200.
- JSON POST `{action:'enqueue',batchId,version}`: queues immutable work, HTTP 202 with `id` and `statusUrl`. Enqueue performs no member writes. The same batch/version returns the same job.
- GET `?id=JOB_ID` or `?batchId=BATCH_ID`: saved progress, row outcomes, totals and worker heartbeat. GET without parameters lists the actor's jobs.
- GET `?correctionBatchId=BATCH_ID`: original-value correction table with lineage metadata.
- JSON POST `{action:'retry',id}`: requeues only exhausted transient failures, HTTP 202. Invalid/conflicting source rows require a corrected preview.

Authentication, administrator authorization, actor ownership, same-origin writes and audits apply. Account provisioning, invitations, selected updates, approved-account policies and non-preservation previews are rejected. A batch owned by a durable job cannot also be processed or edited by the old synchronous action.

Migration 028 adds jobs, per-row outcomes and worker state without rewriting old batches. One active job across workers is claimed using PostgreSQL locking and `SKIP LOCKED`. Workers process chunks of five with row savepoints. Person/membership writes and row results commit together; generation and live-lease checks fence stale workers. Leases renew every ten seconds and expire after two minutes. Worker restart resumes persisted pending rows. Database statements are bounded to ten seconds and lock waits to three seconds.

Transient failures have three automatic retries after the first attempt, delayed by 5/30/120 seconds. Exhausted failures are explicitly reported and can be manually retried. Non-transient creation failures are reported without exposing database diagnostics. Validation and identity conflicts do not retry automatically. Uniqueness constraints and identity revalidation protect repeated files, jobs and retries. Exact existing records are skipped; differing records are held for the existing explicit administrator correction/link workflow.

The browser polls every five seconds and stores the batch in its URL. Closing or reloading the page does not drive or cancel processing. Worker health, last progress, counts and retry state remain visible.

## Runtime and rollout

The container bundles a separate `member-import-worker.mjs`. The runtime supervisor removes mail/provider/storage credentials from its environment and restarts only the importer when it exits; importer failure does not stop web login. No broker or new hosted service is needed.

`MEMBER_IMPORT_WORKER_ENABLED` defaults to disabled. Apply migration 028 only after identity preflight and a restorable backup, deploy the worker disabled, inspect health/heartbeat, and enable it only for an approved exact batch. Disabling/stopping the worker leaves completed members intact and pending work resumable. Never roll back by deleting committed memberships. Old committed batches remain historical evidence.

Production source corrections and an exact reviewed preview are still required. This implementation's source inspection and synthetic tests do not authorize a real batch commit or establish launch readiness.

## Verification commands

```powershell
npm test
npm run typecheck
npm run lint
npm run build
node --env-file=.env.local --import tsx scripts/test-member-import-jobs.mts
$env:TPA_JOB_BROWSER='true'
node --env-file=.env.local --import tsx scripts/test-member-import-jobs.mts --http-only
```

The runner creates random disposable PostgreSQL databases, tests migration on existing historical batches and repeat execution, and drops its databases. The full database suite covers 10/50/250 synthetic imports and repeated files, failure rollback, mixed malformed/duplicate rows, source-row preservation, competing workers, lease fencing, restart recovery, retry exhaustion and manual retry. HTTP/browser acceptance uses a fixed build and an independent worker with provider credentials disabled. API enqueue disconnect, authorization, correction lineage, reload/progress and retry are tested independently of synchronous import evidence from other workstreams.
