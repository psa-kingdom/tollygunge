# Final launch gate — 11 October 2026

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


**Decision: NOT READY.** Main baseline is deployed; the current publication evidence above supersedes historical source/deployment snapshots below. Hosted write journeys, capacity, mail acceptance, policy and human/device gates remain open.

Completed evidence: **73 unit tests, 27 backend/HTTP checks, 46 browser cases (11 explicit skips), three additional desktop/tablet/phone activation cases, 40 hosted public/accessibility states and 12 hosted performance samples pass.** Two demonstrated frontend defects were repaired. All QA databases were removed. No hosted load was run.

This decision concerns the **full invited-member product launch**. It does not report a production health failure: `/api/health` returned 200 and Railway deployments reported SUCCESS. Missing capacity and hosted member-journey evidence does not, by itself, prove an outage or invalidate a separately authorized, independently tested account-provisioning rollout that keeps invitations held. That newer batch's own evidence must govern its scoped rollout; it is not certified by this report.

## Independent implementation closeout — 11 October 2026

A newer frozen integrated source has independent local acceptance documented in [INDEPENDENT_QA_CLOSEOUT.md](INDEPENDENT_QA_CLOSEOUT.md). It includes migration 028, durable import transport, held-account checks and a fresh 500-record reconciliation. This supersedes the earlier local candidate scope only where fresh evidence is recorded. The 18-row scorecard below retains launch-level statuses; local completion does not establish current hosted acceptance or sustainable capacity. Production details below are the earlier recorded snapshot, not a refreshed deployment census.

## Tested releases and boundaries

- Repository base: `93d00250d42e81fb8c983a9f61d977f14d8ba42f`, with pre-existing uncommitted operational changes. A frozen candidate copy is under `.local/launch-gate/candidate`; source-file hashes are in `candidate-manifest.json` (SHA256 `608c61d9e6ade304d4e85195de8c03880e7b7a8368142b1663f2050efbe94370`). Later edits in the shared working tree are excluded from candidate acceptance.
- Repair validation uses a second frozen copy at `.local/launch-gate/repaired`, containing the original candidate plus the two verified frontend fixes and the scoped payment-browser assertion. Its final manifest SHA256 is `57304301a36bdd8533c0624e46b52138c4e73b1dbe6f10b91d3475bdc87c0868`, including the subsequent activation-coverage change. The initial manifest is retained separately. This copy does not include later approved-account/job changes made concurrently elsewhere.
- Railway lists **production only**, containing `tpa-web` and PostgreSQL. Web deployment `e09ffa3b-34c8-4961-a7ff-a8d87ecacdc0` and database deployment `c037356f-db74-4607-95ea-ce6fdbcc91a4` report SUCCESS. Web resource configuration is one replica, 1 CPU, 1,000,000,000-byte memory limit. Database resource limits were not returned. Deployment/source correspondence is documented as `8409aec` in TECHNICAL_RELEASE_CHECKS; this run did not independently establish that correspondence.
- Production checks were anonymous, low-volume and read-only. No production import, invitation, account write, event write, payment, deployment, capacity change or new hosted service was performed.
- Writes used PostgreSQL 18.4 on loopback port 55439, exact randomly named disposable databases, synthetic `example.invalid` recipients, mail sink and disabled external storage/providers. Migrations 001–027 applied. The bundled postal dataset was loaded for address tests. Application pool configuration is five connections per process; this is not a capacity estimate.

## Launch scorecard

Statuses apply to launch evidence, combining deployed and candidate checks. A local PASS does not establish an untested hosted workflow.

| Area | Status | Evidence |
|---|---|---|
| Member import | PARTIAL | Local 500-record reconciliation and worker replay/resume/conflicts pass; production exception reconciles 202 created/nine held. Strict source-resolution remains open. |
| Member accounts | PARTIAL | Candidate reconciles 500 linked member accounts plus one synthetic administrator; representative invitation activation is single-use. All 500 accounts were not activated or logged in. Hosted candidate rollout is untested. |
| Invitations | PARTIAL | Controlled template/review/idempotent confirmation and synthetic activation pass locally; hosted read-only hold controls pass. All 202 production holds unreleased, zero batch mail/tokens/credentials; real delivery pending explicit command. |
| Login | PARTIAL | Real auth/database recovery, signup, session revocation and limits pass locally; hosted login/recovery pages return 200. No fresh authenticated hosted member sign-in in this gate. |
| Dashboard | PARTIAL | Local connected operations pass; hosted authenticated dashboard/202 holds/register previews pass. Hosted member write journeys remain blocked. |
| Profile | PARTIAL | Local persistence/privacy/address and verification lifecycle tests pass; broader browser result recorded below. Hosted candidate profile writes untested. |
| Membership | PARTIAL | 500 local membership records reconcile and remain independent from account activation/verification/payment. Real eligibility/approved membership status and end-to-end hosted membership operation remain open. |
| Payments | PARTIAL | Candidate supports manual event-payment verification: pending, reference/note-required paid confirmation, stale write rejection, member-visible update, cancellation history and manual refund recording. No gateway, actual funds movement or bank verification tested. This candidate is not deployed. |
| Events | PARTIAL | Candidate paid/free event creation/publication, registration windows, update notifications, privacy and cancellation pass operational checks. Hosted paid-event capability is not established. |
| Registration | PARTIAL | Candidate duplicate rejection, one-seat race (one 200/one 409), paid roster/audit and member confirmation pass. No hosted load or registration write performed. |
| Admin | PARTIAL | Candidate import, invitations, roster, payment review and activity are connected; permission/search checks cover staff roles. Full deployed candidate operation remains untested. |
| UI/UX | PARTIAL | 40 hosted public/auth states at four widths: zero overflow, response failures or runtime errors. Candidate dashboard/roster/payment/member screenshots reviewed. Human usability and all interactive controls are not exhaustively accepted. |
| Mobile | PARTIAL | Hosted 390px public/auth pages, candidate profile/admin layouts, and actual project-viewport activation/password sign-in pass on tablet/phone. Physical devices and hosted candidate activation remain untested. |
| Accessibility | PARTIAL | Public 40 states pass; 66 authenticated states exposed empty mobile payment-table focus defect, repaired and responsive keyboard retest passes locally. Fresh hosted retest and human/AT acceptance required. |
| Security | PARTIAL | Hosted anonymous private-route/API denial and three response headers pass. Browser bundle scan: 38 files, four configured secret values checked, zero leaks. Local permission/ownership, signed webhook and session checks pass; full deployed candidate security acceptance is untested. |
| Performance | PARTIAL | Initial hosted homepage LCP failure retained (3068 ms); traced external font chain repaired through self-hosting. Fresh deployed measurements determine acceptance; no concurrency/field INP claim. |
| Load | BLOCKED | No existing isolated staging deployment. No production load substitute. Sustainable concurrent capacity, request rate, error rate and database/CPU/memory behavior under load are unknown. |
| Regression | PARTIAL | Combined build/lint/typecheck/81 units, invitation database/HTTP and six responsive held-account/payment cases pass. Main/PR CI and hosted smoke retained; critical hosted writes/mail/human gates remain open. |

## Measured evidence

- Population: 500 linked people, 500 memberships, 500 invitations, 500 invitation jobs, 501 total accounts including the administrator. Two 250-row imports completed in 1315ms and 1240ms, including reviewed commit/replay calls. No duplicate person IDs across 20 directory pages.
- Local serial API samples: member actions n=500, p95=28ms, max=49ms; directory pages n=20, p95=47ms, max=64ms; import commits/replays n=22, p95=134ms, max=145ms. These figures include local test-client request time and exclude hosted/network capacity claims.
- Hosted browser samples: homepage/login/event listing at 1440/1280/768/390. LCP 480–2208ms and TTFB 273–637ms. All 12 samples meet the 2500ms LCP threshold on this desktop browser/network. Viewport emulation did not simulate mobile CPU/network or field traffic.
- Operational acceptance: 200-row import in eight chunks; selected invitations; activation; paid event publication; registration/pending payment; manual paid confirmation; roster/audit/member state; update notifications; price-change protection; member-only access; capacity race; cancellation and refund history. Screenshots include desktop/tablet/phone dashboard, final registration, payment review and phone member confirmation.
- No concurrent load measurements, query plans, N+1 profiling, pool-wait instrumentation, live CPU/memory measurements or database saturation measurements were obtained. Do not infer throughput from the serial response times.

### Regression execution notes

The first broad runs exposed test-environment problems: an occupied local port; missing postal data; a Server Component import requiring `--conditions=react-server`; legacy HTTP tests run with onboarding enabled; and an HTTP test that published an extra mandatory verification field before browser fixtures. These runs are diagnostic evidence, not final product-failure claims. The corrected runner uses a separate port, loads postal references, runs member tests with the required condition, restores baseline policy before browser fixtures and separates onboarding from legacy mode.

The event browser fixture's exact-label match failed because the wrapping label also contains select-option text. The frozen test copy uses a non-exact label match; no production component was changed for that issue.

Final corrected regression results are recorded in `.local/launch-gate/corrected-isolated.log` and the candidate's `.local/launch-gate/isolated-results.json`. Earlier logs are retained to make the fixture corrections reviewable.

Correctly configured backend checks passed 9/9, member-foundation checks 6/6, onboarding/role-search HTTP checks 2/2, and legacy HTTP checks 10/10. The original browser run was stopped after diagnosing reproducible defects rather than continuing repeated failures. Its interrupted exit is not a passing full-browser result.

### Defects repaired

- **Account search links opened the wrong tab:** `MembersWorkspace` defaulted to the register even for account-ID links. It now opens the account directory for an ID, remounts the preview when the ID changes, and retains the register default and explicit tab selection for ordinary navigation.
- **Mobile application steps lost descriptive accessible names:** responsive CSS hides step text and exposed only numeric names such as `3.`. Explicit `aria-label` values now retain the full step number/title across widths, allowing tablet/phone navigation and screen-reader identification.
- **Payment browser assertion was ambiguous:** the added registration-payment panel introduces another status region. The bank-instructions test now selects the status containing its expected draft/activation result rather than requiring one status region on the entire page. This is a test repair, not a payment behavior change.

The repaired candidate production build passes. The full repaired run passed 9 backend, 6 member-foundation, 2 onboarding/search HTTP and 10 legacy HTTP checks; browser acceptance passed 46 cases with 11 explicit skips and zero failures. Skips comprise three supplied-content rehearsal cases, two repetitions of the viewport matrix, four repetitions of viewport-independent session checks and two repetitions of desktop offline/stale-tab checks. These are not counted as passes.

The existing invitation test used a separate default-size browser context and skipped tablet/phone. It now uses the project context and runs at all three widths, asserting no activation overflow and saving screenshots. A fresh isolated focused run passed desktop, tablet and phone (3/3), including switching from a staff session to actual invited-member password sign-in. Full repaired evidence is in `.local/launch-gate/repaired-browser.log` and `.local/launch-gate/repaired-full-results.json`; focused evidence is in `activation-all-widths.log` and `activation-results.json`. Original failures remain in the original logs/traces where available. No shared-root build or hosted deployment was performed for these repairs.

All runs removed their exact disposable databases. Final local catalog reconciliation found **zero remaining QA databases** (`cleanup.json`). External storage was disabled, so this gate created no R2 objects to remove; previously existing hosted synthetic records were not touched.

## Launch blockers

1. **Hosted capacity unknown:** staging does not exist. The registered population requirement has local evidence, but sustainable concurrency has none.
2. **Candidate/deployment mismatch:** manual event payment, operational import/account workflows and later shared-tree changes require one committed candidate and hosted acceptance. No deployment was authorized or performed in this gate.
3. **Real roster rollout incomplete in this gate:** the historical 211-row preservation batch yielded zero created members/accounts. A separately coordinated approved-account flow is being developed; its changing implementation is not covered by this frozen snapshot. Do not infer its real-source eligibility, provisioning, mail holds or success from synthetic import acceptance.
4. **Current-candidate inbox and member access acceptance missing:** synthetic mail queue/activation checks do not prove real receipt, correct current sender/links or a fresh hosted member sign-in.
5. **Recovery and human acceptance remain open:** broader restore/recovery, physical devices and manual accessibility/usability are not completed by this run.

## Non-blockers

- Google onboarding and gateway payment automation are outside the tested supported manual-payment model; no automation is claimed.
- The five development-tool advisory entries in the existing technical-release report are distinct from its reported zero production advisories; no new dependency audit result is asserted here.
- No cosmetic changes were made. Browser emulation and automated accessibility results have the explicit limits above.

## Exact next actions

1. Finish concurrent operational/approved-account work, capture one immutable committed release and repeat affected regression suites. Preserve missing districts, existing identities and invitation holds as explicitly approved in that separate workflow; do not send a real batch during QA.
2. Provide an existing isolated staging deployment, or separately approve a capped temporary staging proposal. Verify its database, object namespace and recipient restrictions before writes. No paid resources are provisioned by these scripts.
3. On that fixed staging release, follow test inbox receipt through activation, actual password login, profile save, membership/payment views, paid/free registration and administrator confirmation. Reconcile exact records and mail outcomes.
4. Run 5/10/25/50/100/200/500 active-user stages for five minutes each with 3–8-second think time; stop at the first failing level, then sustain the highest passing level for 20 minutes. Preserve rate limits and represent independent client sources. Pass thresholds: unexpected errors <1%, read p95 <1s, login/write p95 <2s, LCP ≤2.5s, zero integrity violations. Stop immediately on leakage/corruption; stop after one minute of errors >2% or p95 >5s, sustained CPU/memory >85% or DB connection saturation >80%. Capture all requested telemetry before stating capacity.
5. Complete manual keyboard/screen-reader, physical-device and recovery acceptance. Clean only exact tagged fixtures and verify removal. Reissue this scorecard for the deployed candidate; missing critical evidence prevents READY FOR LAUNCH.

## Artifacts and repeatability

Evidence is under `.local/launch-gate` (ignored, synthetic/sanitized evidence; no production credentials). Principal files: `deployment.json`, `candidate-manifest.json`, `repaired-manifest.json`, `hosted-smoke.log`, `client-secrets.log`, `public/results.json`, `performance/results.json`, `population.log`, `operational-final.log`, `repaired-browser.log`, `repaired-full-results.json`, `activation-all-widths.log`, `activation-results.json` and `cleanup.json`. Candidate operational screenshots and population reconciliation are under its `.local` directory. Full repaired browser screenshots are preserved in `browser-evidence`; focused activation screenshots are in the repaired copy's `test-results`.

Added scripts:

- `scripts/verify-launch-population.mts`: rejects non-loopback databases and ports other than 55439; exercises two 250-row imports and 500 explicit account invitations with an environment allowlist, reconciles counts, then removes its exact database.
- `scripts/verify-launch-isolated.mjs`: same local guard and external-provider isolation; migrates, seeds postal references, runs backend/member/onboarding/browser/legacy HTTP checks, then verifies exact database removal. Requires a production build and bundled postal data. `--skip-browser` is an explicit backend-only diagnostic option; `--browser-only` runs browser acceptance with fresh fixtures; `--browser-grep 'invitation activation'` selects that focused journey. Failed browser scenarios are rerun once; the original failure remains in the recorded results.
- `scripts/verify-launch-public.mts`: read-only hosted public/auth browser checks, four viewport widths, screenshots and automated accessibility; `--performance` samples homepage/login/events with an LCP observer. Requires installed Chrome and `.local/technical-qa/node_modules/axe-core/axe.min.js`.

Use the disposable loopback PostgreSQL URL through the process environment, **without** loading `.env.local`, for both local write scripts. The two client behavior repairs above introduce no public API, database schema or permission-policy changes.
