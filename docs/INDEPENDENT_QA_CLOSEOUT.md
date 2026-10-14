# Independent QA closeout — 11 October 2026

## Final hosted acceptance — 11 October 2026, 06:23 UTC

**Published main commit:** `6532f3a9d8a58ae462a9902fce95fe01bce4d8a4`. **Railway deployment:** `7359d379-a8f7-468e-a9d7-a8568560cf21`, SUCCESS. Combined push/PR and main CI pass. All 29 applied migrations match archived source, allowing Git line-ending normalization. Existing CPU/memory/replica limits are unchanged.

Fresh hosted retests: 40 public states without overflow/errors, 66 light/dark rendered accessibility states with zero automated violations, protected-route and frontend-secret checks pass, and full authenticated runtime smoke passes. All 12 LCP samples meet 2500 ms (356–2004 ms); three cold-cache desktop homepage checks measure 1716/1632/1808 ms. This is browser/network scope, not field INP, mobile-device or concurrency acceptance. The original table-focus and homepage loading failures remain recorded with successful retests.

Final read-only reconciliation: 202 created / nine held source rows; 202 unreleased invitation holds; zero batch activation tokens, credentials and mail jobs. Existing identities and credential hashes remain preserved. No test/member-batch email or production import was executed. The import worker remains disabled; existing recovery/transactional email may continue.

Independent publication, deployment, automated hosted acceptance and local cleanup are **complete for their evidenced scope**. Required staging/write/capacity, explicitly authorized mailbox acceptance, source/policy/provider and human/device gates remain open. **Full launch remains NOT READY.** Detailed closeout and sanitized evidence: [FINAL_RELEASE_CLOSEOUT.md](../.local/main-publish/FINAL_RELEASE_CLOSEOUT.md).


## Main publication and launch acceptance — 11 October 2026

Validated baseline published through PR #1 to main `797e92d9af07a352fa7b9fa161d76bcf8c6756c5`, with successful push, PR and main CI. Deployment `6c1e7505-c9b1-4d03-af17-9c62b46294f6` succeeded. Controlled-invitation deployment `3d21483a-44f7-43ec-afff-ebf0954374e9` subsequently added only its 16 runtime files; migration 029 is applied. Combined source `822a048` preserves those controls and adds named keyboard focus/scrolling to the payment table and self-hosted existing fonts. PR #2 records combined CI and publication. Exact final commit/archive/deployment identities and sanitized outputs are retained in ignored `.local/main-publish`.

Fresh combined local checks: lint, typecheck, build, 81 unit tests; three invitation database cases; controlled-release HTTP checks plus two HTTP regressions; six held-account/payment-table browser cases across desktop/tablet/phone. Invitation tests use synthetic recipients and mail sinks, including 10/50/202 batches, replay, stale review, concurrent confirmation and rollback. No real email was sent. Original failed probes and successful retests are preserved: incomplete-build startup, stale queued-invitation expectation and omitted local synthetic session key were fixture/setup issues.

Hosted baseline acceptance: 40 public states without overflow/runtime/response/accessibility failures; authenticated dashboards/account previews; private-route denial and frontend-secret exclusion (430 source files, seven configured secret values, zero leaks); full runtime smoke retest passed after one transient document-request timeout. The 66-state authenticated accessibility audit found a reproducible empty mobile payment-table keyboard defect, repaired and locally retested. Baseline 12 performance samples included one LCP of 3068 ms; three cold homepage traces measured 2788/2536/2240 ms and implicated the external font chain. Fresh deployed retests must govern performance/accessibility; earlier failures are retained, not counted as passes. No field INP or physical-device result is claimed.

Read-only production reconciliation at 05:57 UTC: 208 accounts, 213 people, 202 memberships; 202 imported accounts linked to memberships and unreleased holds; zero batch activation tokens, credentials or mail jobs. The approved 211-row exception independently reconciles 202 created and nine held source rows. Existing identities/credential hashes match the preserved baseline. Strict 211-row source-resolution remains a separate open gate; synthetic success and the exception do not clear it.

Fresh backup with migration 029 restored to an isolated local database, counts/202 holds reconciled, source stable, no workers started, restoration database removed. Backup SHA-256 `49414d816ed216462e954c7241ef01fb8022dd1575fc9fa23ab7c079820f8464`. This establishes a local rehearsal; infrastructure recovery approval/RTO remains open.

| Work | Completion | Exact next action |
|---|---|---|
| Independent product implementation and local acceptance | Complete for evidenced scope | Retain CI/regression evidence; repair only demonstrated defects. |
| Main publication / existing-service deployment | Baseline complete; combined release tracked in PR #2 | Record final main SHA and deployment identity; repeat hosted read-only checks. |
| Imported-account safety | Complete read-only reconciliation | Keep all 202 holds; no direct release, source overwrite or automatic linking. |
| Hosted profile/event/payment writes and capacity | BLOCKED | Provide an existing verified isolated staging deployment and mail sink; then run writes, 500-member reconciliation and bounded ramp. Do not provision paid resources or load production. |
| Invitation delivery / mailbox activation and recovery acceptance | Pending explicit sending command | Approve template/recipients and explicitly authorize mail before delivery checks. Existing recovery/transactional mail may continue. |
| Source correction and membership/payment policy | Open | Obtain authoritative corrections for held rows and approved terms/verification policy. |
| OAuth/WhatsApp and human/device/assistive-technology acceptance | Open where required | Supply provider configuration and perform named human/device checks. |

**Full launch decision: NOT READY.** Required untested journeys and capacity remain blockers. No funds movement, member-batch mail, production import, resource increase or new provider was performed.


Independent implementation acceptance is complete for the workflows listed below. Full launch remains **NOT READY** because hosted capacity, current hosted authenticated journeys, policy and human/device gates are still open. No production writes, deployment or real messages were performed by this closeout.

## Tested source and isolation

Base commit: `93d00250d42e81fb8c983a9f61d977f14d8ba42f`. The source was frozen under `.local/independent-closeout/source`, preserving the shared working tree. Initial manifest SHA256: `CB7EF8FB9F48D69214190C458278783D554117615207AADA431C99E1BFCD9537`. After QA-only repairs and viewport coverage expansion, manifest SHA256: `773CB16A7B091C5A14FC5AADA3561DE5EC5091FA20D9D3064BE58AFC558EF62D`.

Disposable PostgreSQL uses loopback port 55439. Migrations 001–028 are tested. Recipients are synthetic `example.invalid`, mail is sink-only, and external provider/storage credentials are excluded or disabled. Source snapshots exclude `.env.local`. Later shared-tree edits are outside this acceptance.

## Capability closeout

| Capability | Status | Acceptance | Next external action |
|---|---|---|---|
| Identity, private profiles and staff boundaries | Complete locally | Database/HTTP/browser ownership, role, authentication and persistence journeys | Fresh hosted acceptance |
| Strict import and worker transport | Complete locally | Five integration cases; upload HTTP; desktop/tablet/phone browser; disconnected client, worker restart, fencing, replay and correction lineage | Correct original real-source rows before strict execution |
| Member/account population | Complete locally | Two 250-row imports; 500 distinct linked accounts, people, memberships and invitation jobs; 501 users including administrator | Hosted isolated staging acceptance |
| Held-account exception | Complete locally | Three integration cases: policy, rollback, hold/auth isolation; separate browser journey | Independent exact real-source reconciliation and authorized rollout |
| Invitations and activation | Complete locally | Explicit enqueue, duplicate/recent resend rejection, single-use activation and password sign-in | Fresh test-recipient hosted inbox acceptance |
| Event and manual payment operations | Complete locally | 200-member scenario, eight chunks, ten sink invitations, activation, pending-to-confirmed payment, stale writes, member update and audit | Approved real bank/payment verification and hosted acceptance |
| Cancellation, refund history and capacity integrity | Complete locally | Published update notifications, immutable pricing, private access, cancellation history and one-seat race | Hosted workload acceptance |
| Content/governance publication | Complete for tested local scope | Existing publication HTTP regressions; browser preview and administrative controls | Final editorial and hosted candidate acceptance |
| Responsive and keyboard regression | Complete for tested automated scope | Browser matrix at 1440, 1280, 768, 390 and 320; light/dark, zoom, focus and preview tabs | Human usability, physical devices and assistive technology |

“Complete locally” certifies the described workflow, not every possible control or full deployed product readiness. No gateway, new membership policy, learning awards, WhatsApp or OAuth configuration was implemented.

## Demonstrated repairs

- The member-job QA runner assumed `.local` existed. It now creates the directory before writing its restricted fixture environment. Clean-snapshot integration, HTTP and desktop/phone browser acceptance passed afterward.
- The operational QA runner had a fixed port that could reach another local service. `TPA_OPERATIONAL_TEST_PORT` now permits isolation; acceptance on port 3159 passed. The original 401 is retained as an invalid-environment run, not classified as a product authentication defect.
- The workspace permission assertion expected only Verification attention items for a membership reviewer. The implemented permission also permits Memberships. The assertion now allows both owned categories; the full role/ownership/hostile-query test passed afterward.

- Expanded the held-account browser journey from desktop to desktop/tablet/phone. Its broad member selector was ambiguous across retained viewport fixtures; the selector now targets the exact generated membership identity.

These repairs change QA scripts and assertions only. No public API, application schema, business policy or product UI changed.

## Evidence and retained gates

Evidence is under `.local/independent-closeout/`: `build.log`, `unit.log`, `lint.log`, `typecheck.log`, `isolated.log`, `workspace-retest.log`, `repair-lint.log`, `jobs.log`, `jobs-retest.log`, `accounts.log`, `population.log`, `operations.log`, and `operations-retest.log`. Original failures remain visible alongside successful retests. Screenshots and structured results live inside the frozen source's ignored `.local` and `test-results` directories. Do not publish fixture environment files or browser traces without sanitizing them.

The strict source-correction workflow and the separately approved 211-row held-account exception remain independent. Synthetic acceptance clears neither source conflicts nor the exact real-source rollout gate.

Hosted concurrency remains BLOCKED without existing isolated staging. Google and WhatsApp require configuration; membership and learning policies require approval. Real-recipient recovery, current hosted member journeys, physical-device and assistive-technology acceptance remain explicit. No full launch-ready claim is made.

## Fresh acceptance results

| Check | Result |
|---|---|
| Production build, lint and typecheck | PASS; changed QA files lint and repaired typecheck also pass |
| Unit suite | 79 passed; zero failures/skips |
| Backend, member foundation, onboarding and legacy HTTP | 27 final passing outcomes; one obsolete attention assertion initially failed and passed its focused retest |
| Import-job integration | Five passed; synthetic sizes 10/50/250, concurrency, restart and rollback |
| Held-account integration | Three passed; policy and hold/auth boundaries |
| Main browser suite | 49 passed; 14 explicitly skipped; no browser failures |
| Worker-specific browser | Three passed: desktop, tablet and phone |
| Held-account browser | Three passed: desktop, tablet and phone; zero skips on final run |
| Local public/auth automated accessibility | 40 states; zero overflow, failed responses, runtime errors or WCAG A/AA violations |
| Operational center | HTTP scenarios A–H and browser acceptance passed; 200 records and eight chunks |
| Population reconciliation | 500 linked accounts, 500 memberships, 500 invitation jobs; 501 users including administrator |

The initial overall isolated runner correctly returned nonzero for the obsolete HTTP assertion; `full-isolated-results.json` preserves this. Its focused role/security retest passed in `workspace-retest.log`. Original failed runs are not overwritten or reported as clean first runs.

The 14 main-suite skips reconcile exactly: three worker tests require their dedicated job database (all three widths passed separately); two held-account viewport exclusions were removed and all three widths passed on a fresh rerun; three supplied committee-content checks require a populated rehearsal; two repeats of the full five-width visual matrix, two viewport-independent session checks and two repeats of desktop offline/stale-tab checks are intentional duplicates. The three supplied-content checks remain untested in this clean rehearsal and are not inferred as passes.

Serial local timings, measured during overlapping QA processes: member directory reads n=20, p95 37ms, p99 46ms; invitation actions n=500, p95 44ms, p99 77ms; import commits/replays n=22, p95 226ms, p99 249ms. Two 250-row imports completed in 2.03s and 2.59s. These are synthetic serial samples, not hosted concurrency or infrastructure capacity evidence.

Desktop payment review and the 390px administrator dashboard screenshots were visually inspected. Keyboard/contrast/zoom coverage is scoped to the browser journeys; automated accessibility leaves human review items and does not certify screen-reader behavior.

- Worker browser coverage now explicitly runs tablet alongside desktop and phone. Fresh worker HTTP/restart acceptance and all three browser cases passed.
- The expanded held-account run initially failed on ambiguous retained-fixture selectors. `held-all-widths.log` preserves that failure; `held-all-widths-retest.log` and `held-final-results.json` record the successful clean three-width rerun.
- Cleanup independently verified zero `tpa_onboarding_test_*` / `tpa_operations_test_*` databases; provider/storage writes were disabled and zero storage objects were created. The exact synthetic fixture environment file was removed. All closeout servers and the local PostgreSQL process stopped. See `cleanup.json`.

Review evidence: [unit results](../.local/independent-closeout/unit.log), [main regression results](../.local/independent-closeout/full-isolated-results.json), [role retest](../.local/independent-closeout/workspace-retest.log), [worker acceptance](../.local/independent-closeout/worker-all-widths.log), [held-account acceptance](../.local/independent-closeout/held-all-widths-retest.log), [population reconciliation](../.local/independent-closeout/source/.local/launch-gate/population.json), [public accessibility results](../.local/independent-closeout/source/.local/launch-gate/public/results.json), and [cleanup](../.local/independent-closeout/cleanup.json).
