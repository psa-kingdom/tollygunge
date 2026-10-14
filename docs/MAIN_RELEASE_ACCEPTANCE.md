# Main release acceptance — 11 October 2026

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

