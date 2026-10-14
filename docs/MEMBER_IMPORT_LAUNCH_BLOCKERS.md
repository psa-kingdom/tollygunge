# Member source and durable import delivery

This is a strict create-only member pipeline. It preserves the distinction between people, memberships and optional accounts. No real strict member batch has been committed; production requires approval of the exact corrected preview. Technical acceptance does not establish launch readiness.

## Source inspection

Original source: 211 populated worksheet rows, 13 columns, physical rows 2–212. SHA256: `0031124b1557fcd3bce3a03201733aabda212ff95494adcd66ace3df607f1ecd`. The checksum and all physical row identifiers reconcile with the saved historical report. The source workbook was read only.

| Requested field | Strict source result |
|---|---:|
| SOURCE | 211 |
| VALID | 0 |
| CONFLICT | 134 |
| INVALID | 77 |
| IMPORTED | 0 |
| UPDATED | 0 |
| SKIPPED | 0 |
| FAILED | 0 operational failures; historical 77 are validation failures |
| DATABASE | Read-only census at 2026-10-11 04:37:11 UTC: 0 memberships, 11 people, 6 accounts |
| INVITATIONS | Sent by this workflow: 0 |

The database census is a timestamped inspection, not a current claim after other authorized workstreams; evidence is `.local/member-current-census.json`. The separately approved account-source exception has different policy and is excluded from these strict member outcomes.

Historical primary blockers: 118 missing district holds, 14 duplicate-email occurrences across seven pairs, 2 database identity conflicts, 51 unsupported/ambiguous city references, 15 incomplete addresses and 11 ambiguous postal results. These total 211. The independent diagnostic also finds secondary issues: missing district on 211 rows, unsupported city-reference context on 72 rows, address completeness on 15, duplicate email on 14, postal ambiguity on 11 and database identity conflict on 2. Secondary counts overlap. Unsupported reference coverage is not proof that a person's city is incorrect.

Restricted outputs remain outside tracked files: `.local/member-resolution/diagnosis.json` and `member-corrections.xlsx`. The workbook retains Originals, Issues, Summary and separate editable Corrections; missing facts remain blank. Read-only round-trip verification preserved 211 source row identifiers, membership formatting and the original checksum, with zero unsafe-cell errors. Corrected submissions require the parent preview and original hash. Duplicate occurrences remain held; no first-row-wins rule applies.

## Changed and database

Migration 028 adds durable jobs, row attempts/outcomes and worker heartbeat without rewriting historical batches. Administrator-only preview/enqueue/status/retry endpoints preserve authentication, ownership, same-origin protection and audits. Enqueue returns 202 without creating members. Immutable policy rejects accounts, invitations and selected updates. Five-row chunks commit person/membership writes with their outcomes; savepoints prevent orphans, uniqueness guards races, two-minute renewable leases and generations fence stale workers. Retry delays are 5/30/120 seconds, with explicit exhausted failures.

A separately supervised worker runs in the existing runtime without mail-provider credentials. It defaults disabled. Browser polling does not drive processing; persisted batch URLs restore progress. Runtime failure restarts only the importer and leaves login running. Correction XLSX uses an explicit reserved-sheet contract; ordinary uploads still require one worksheet.

## Executed verification

| Command | Result/evidence |
|---|---|
| `npm test` | 79 passed, 0 failed; `.local/member-jobs-unit-final.log` |
| `npm run typecheck` | Exit 0; `.local/member-jobs-typecheck-final.log` |
| `npm run lint` | Exit 0; `.local/member-jobs-lint-final.log` |
| `npm run build` | Shared final integrated build passed; build ID `Y9dBg5hznvIi4D1qwNXyu`; `.local/approved-account-build-final.log` |
| `node --env-file=.env.local --import tsx scripts/test-member-import-jobs.mts --quick` | Four database scenarios passed; 16 unique memberships independently verified, zero account links/invitations/mail; `.local/member-jobs-focused.log` |
| `node --env-file=.env.local --import tsx scripts/test-member-import-jobs.mts` | Four full scenarios passed, 0 failed; 10/50/250 creation and repeat passed; independent final census 324 memberships, 324 unique numbers/emails, zero linked accounts/invitations/mail; `.local/member-jobs-db.log` and `.local/member-job-independent-counts.json` |
| `TPA_JOB_BROWSER=true TPA_JOB_WORKER_BUNDLE=.next/member-import-worker.mjs node --env-file=.env.local --import tsx scripts/test-member-import-jobs.mts --http-only` | Compiled API/worker passed, 10 created, enqueue 2845 ms, client disconnect safe, actual worker termination/restart safe; desktop and phone browser tests both passed; `.local/member-jobs-http-browser-final.log` |
| `node --import tsx .local/verify-correction-workbook.mts` | 211 rows preserved, zero unsafe-cell errors, original source unchanged; `.local/member-correction-roundtrip.log` |
| `TPA_JOB_BROWSER=false TPA_JOB_WORKER_BUNDLE=.next/member-import-worker.mjs node --env-file=.env.local --import tsx scripts/test-member-import-jobs.mts --http-only` | Final-build CSV and four-sheet XLSX correction uploads passed, filtered original row 11 retained/skipped; 10 created, enqueue 2923 ms, disconnect/restart safe, zero invitations; `.local/member-jobs-xlsx-api-final.log` |

Database runners used random isolated PostgreSQL databases with delivery credentials disabled, tested migration on historical batches and repeated migration, and removed fixtures afterward. The focused scenarios cover mixed invalid/conflicting rows, physical row identity, post-person membership failure rollback, correction, simultaneous claims, stale fencing, exhausted transient failures/manual retry and individual creation racing a job. The browser tests cover preview, independent processing, reload/resume, correction download and retry on desktop/phone. The runtime unit test verifies importer restart and credential removal without stopping web login.

The first compiled-worker probe exposed an unwanted Next.js header dependency. Pure error/audit helpers removed that dependency; the final compiled worker subsequently passed restart and browser acceptance. A first browser attempt lacked a Playwright headless executable; installed Chrome was used for the successful fixed-build acceptance. Those failed probes are not counted as passed acceptance.

The full size scenario passed: 10, 50 and 250 synthetic members were created, then each repeated file skipped exactly 10, 50 and 250 rows with zero duplicates or invitations. The combined creation/repeat scenario took 1,795,002 ms against the remote isolated database; this is not a production throughput guarantee. Full-suite trailing recovery assertions also passed. An independent read-only observer verified 324 unique memberships, 324 unique member emails and zero linked accounts/invitations/mail before the fixture database was removed. Full-suite duration: 1,944,661 ms. No production strict-job execution is included in this report. Compiled worker chunk metrics were approximately 15–16 seconds per five synthetic rows against the remote isolated PostgreSQL service. Enqueue remained independent at under three seconds; statement/lock waits remain bounded. The solution does not raise HTTP timeouts.

## Remaining and rollout

Staff must supply authoritative district/address corrections and resolve duplicate/identity disputes. Each corrected preview must be fully revalidated and expressly reviewed before real commit. Production backup/preflight, migration application and worker enablement are operational steps; keep the worker disabled until the approved exact batch. Rollback stops processing without deleting committed members and leaves partial jobs resumable. Production count deltas, normalized uniqueness, relationships, addresses/mobiles and beginning/middle/end samples must be independently verified after an approved real batch.

Implementation and rollout details: [MEMBER_IMPORT_JOBS.md](MEMBER_IMPORT_JOBS.md).
