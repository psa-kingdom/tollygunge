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

Priority means sequencing, not permission to enable a feature or send messages.
P0 release gates come first; P1 operational acceptance follows; P2/P3 product work
requires separately agreed requirements.

| Priority | Remaining item | Acceptance / boundary |
|---|---|---|
| P0 | Container and exact candidate hosted acceptance | Restore Docker without resetting data; run non-root/container checks. Push/deployment requires separate authorization. |
| P0 | Preserve and deliberately release the real 202 when the administrator decides | Currently held, zero queued, no approved template. Administrator must review existing template/recipient safeguards; agent never sends the batch. |
| P1 | Provider/member activation and operational recovery | Verify approved mailbox journeys, restore drill, capacity and support procedures in their authorized environments. |
| P1 | Human usability/accessibility and supplied portraits | Physical devices, assistive technology and actual association content sign-off; automated emulation is partial evidence. |
| P2 | Membership/renewal, learning-award and certificate policy | Obtain authoritative business rules before adding automation; keep separate membership/profile/payment/publication states. |
| P2 | Google, WhatsApp and attributed news enablement | Provider/security/editorial decisions and isolated acceptance before activation. |
| P3 | Diagnostic dashboard, reusable speakers, additional themes and editor collaboration | Future backlog only; retain working current interfaces and engineering evidence first. |
| Deferred | Gateway, partial refunds/accounting and historical import commit | Explicitly outside current launch scope or intentionally inactive; no speculative implementation. |
| Deferred | Branch/worktree/evidence retirement | No cleanup until dependency and recovery review with applicable authorization. |

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
databases and provider sinks/mocks. Production validation is read-only except for
the single admin recovery email explicitly authorized later by the user below. Never send real
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

## Explicit admin recovery and invitation preservation

The user reiterated that the 202 real member invitations must remain under the
administrator's control, then explicitly authorized **one admin recovery email**.
The agent submitted that one request through the built-in browser. The provider
receipt has a delivery event; the user completed the password reset and signed
in themselves. The agent never entered a new password, inspected a token, reset
credentials directly, approved the invitation template or released member mail.

The production login failure was reproduced as HTTP 401 with sanitized provider
logs reporting Invalid password. Read-only account-state inspection established
an existing operator-approved administrator, a credential, and no invitation
hold. A browser-redacted-field diagnostic attempt is explicitly superseded; its
zero-match result supports no conclusion about the actual account.

Before and after the isolated 202-recipient test and after live traversal,
read-only transactions verified **202 unreleased membership invitation holds and
zero queued/leased invitation emails**. The live dashboard also shows 202 held.
No approved invitation template currently exists. Preserve the existing sequence:
the administrator saves/previews/approves a template, selects/reviews recipients,
then explicitly confirms one batch. Do not silently make this an automatic send.
The invitation/authentication business workflow files remain identical to main.

The built-in browser independently exercised the same sequence using 202 local
synthetic members: selection persisted across nine pages, review had 202 eligible
and zero exclusions, confirmation was disabled before acknowledgment, one
confirmation queued exactly 202 messages, and reload did not duplicate them.
No worker or external transport ran. The exact test database was removed after
aggregate evidence was captured; real member records were never fixtures.

After the user's recovery, the live authenticated browser traversed all 16 staff
workspaces, 18 views/subsections, five reports, eleven footer destinations, and
the administrator's own profile/security. No record save, publication, payment,
upload, invitation review/release or member-message send was invoked. The initial
new-person portrait warning cleared for an existing loaded profile; it is not
evidence of unavailable storage. The browser's responsive override was clamped
to 921px and reset; real 320/390/768 responsive evidence is from isolated Chromium.

## Actual preservation evidence and overlay dispositions

The private baseline is retained at
`D:\Downloads\Workspace\TPA\.launch-recovery\20261027-launch\baseline.json`.
Its eight original worktree manifests all record `payloadVerified: true`; its
evidence lists contain **1,845 retained files**. The coordinator verified the
copied payload/bundle and original-file hashes. This preservation record is
separate from application acceptance and does not authorize deleting originals.
The all-refs bundle's freshly rechecked SHA-256 is
`1d57ba6c141342a529878f787a3e1f8c777c655bc871dc1c8959d340bfaef8d7`.

| Original worktree | Recorded HEAD | Evidence files | Disposition |
|---|---|---:|---|
| `app` | `476fec4` | 1,118 | Dirty source and documents preserved; no switching/resetting |
| `app/.local/main-launch-release` | `6532f3a` | 70 | Detached historical checkout retained |
| `blue-gold-preview` | `1cdd5e3` | 0 | Distinct visual work and recovery history retained |
| `email-delivery` | `af75929` | 0 | Historical checkout retained |
| `onboarding-release` | `666650b` | 9 | Historical checkout retained |
| `paper-v3-preview` | `476fec4` | 318 | Overlay compared below; original and evidence retained |
| `paper-v3-release` | `295c74a` | 210 | Clean production-reference source retained |
| `phase7b-security` | `9001466` | 120 | Useful security changes selected individually; history retained |

Fresh comparisons below compare file bytes, then CRLF-normalized text, against
the verified `origin/main` base, not against the older checkout HEAD. They do
not modify those files. A matching file does not make its worktree disposable.

| Dirty `app` path/group | Comparison and candidate disposition |
|---|---|
| `.dockerignore` | Byte-identical to current main; already included |
| `.gitignore` | Line-ending difference only; current main policy retained |
| `AGENTS.md` | Byte-identical to current main; already included |
| `eslint.config.mjs` | Line-ending difference only; current main policy retained |
| `.github/workflows/ci.yml` | Main already adds newsletter testing beyond the older overlay; retain main and layer current launch CI changes |
| `package.json` | Main already adds `test:newsletter`; retain main and add current launch commands rather than copying the older manifest |
| `src/app/icon.svg` deletion | Already absent in current main; PNG icons remain canonical |
| `src/components/fallback-screen.tsx` | Byte-identical to current main; already included |
| `src/components/site-shell.tsx` | Older distinct shell/footer implementation; retain the approved main Paper v3 footer, preserve original overlay |
| `src/components/website-control.tsx` | Older distinct website/footer controls; retain current main controls, preserve original overlay |
| `public/design/tpa-logo.png` | Byte-distinct preserved original file; no overwrite of current approved main asset |
| `tests/browser/logo.spec.ts` | Older distinct screenshot/navigation sequencing; retain main's later settled-resource regression, preserve original spec |
| `src/app/apple-icon.png`, `src/app/icon.png`, `src/components/tpa-logo.module.css`, `src/components/tpa-logo.tsx` | Byte-identical to main; already included |
| `scripts/check-repository-structure.mjs`, `tests/repository-structure.test.ts`, `docs/engineering/REPOSITORY_STRUCTURE.md` | Byte-identical to main; already included |
| `docs/TPA_TESTING_HANDOFF.md`, `docs/TPA_TESTING_TRACKER.xlsx` | Copied byte-for-byte into candidate; original files and historical Not run state retained |
| `docs/PHASE7A_LIVE_HEALTH_AUDIT.md` and six Phase 8/pre-testing engineering reports | Distinct historical evidence retained in original checkout/recovery payload; not re-labelled as candidate acceptance |

For `paper-v3-preview`, the status-expanded comparison covered **450 paths**:
375 byte-identical to current main, 64 different only in CRLF line endings, one
icon already absent in main, and ten distinct retained files. Its runtime/source
overlay is therefore already represented in current main after line-ending
normalization; no runtime merge is needed. The ten distinct files are the logo
asset, `docs/PHASE7A_LIVE_HEALTH_AUDIT.md`, six Phase 8/pre-testing reports
(`PHASE8A`, `PHASE8B`, `PHASE8C`, `PHASE8E`, `PHASE8F`,
`PRE_TESTING_READINESS`), and two Paper v3 landing/correction reviews. They
remain in the original/recovery payload.
Counts describe the current Git status expansion, not the baseline's differently
grouped dirty entries. No original overlay was staged, rewritten or cleaned.

Copied handoff SHA-256:
`ddf4d60dc409f54eb2ffe26c61ceb3ae88fc4201cda6c0bffd37a8b414765059`.
Copied workbook SHA-256:
`10c1b91abfab548db5680d2e3475d140aebd528a4dbbacc29ed97adfd465179e`.
Both match the original checkout files. No workbook cells were edited.

## Individual security-branch commit dispositions

The security branch has 13 commits not in current main. This is a selective port
onto the newer Paper v3 base, not a merge/cherry-pick of the whole old tree.
"Ported" below describes candidate code selection, not passing acceptance;
current run results belong in the health report/register.

| Commit | Selected or retained disposition |
|---|---|
| `bcd6941` — scoped database roles/worker credentials | Port runtime credential isolation, scoped-role/grant/rehearsal tooling and tests; adapt isolated runner, engagement/flow worker pools, email integration and member HTTP adapter. Preserve newer main CI and add required current launch checks. Do not copy historical environment values or provider configuration. |
| `6fa0a7d` — readable payment tables | Initially select grant/worker-test plumbing only. Later targeted reproduction showed the current main payment action collapsing to 44.609375px at 320px/light. Selectively port the registration table class and six scoped min-width/nowrap CSS lines; preserve current footer CSS and design tokens. Rebuilt candidate `a001c09` passes the six-state focused regression with readable 131.453125px actions. |
| `752fde7` — nested HTTP restricted identities | Port restricted-runtime adapter and adapter regression coverage, with current CI wiring. |
| `0817e7b` — keyboard payment-table assertion | Later port the focused table helper after reproducing the action-width defect; repair its local axe dependency path. The helper checks real keyboard scroll, long content, readable actions, dialog focus/cancellation, empty state and automated accessibility at 320/390/768 in light/dark. Rebuilt six-state acceptance passes; retain the original failing screenshot/log. |
| `362ac79` — Phase 7B security report | Retain historical report/source evidence; current decisions/health report document the new candidate. |
| `1571f0f` — private document referrer protection | Port privacy header configuration, isolated runner support and private-download regression. |
| `de3feae` — scoped hosted/provider acceptance | Retain historical Phase 7C evidence; do not represent prior hosted acceptance as this candidate's run. |
| `d666047` — token/event resource referrer protection | Port the additional scoped headers and their regression coverage without changing auth/payment workflow contracts. |
| `599a77e` — per-run public acceptance artifacts | Retain old Phase 7B orchestrator; current launch runner supplies its own run-specific retained evidence. |
| `aee5db9` — historical source-document labels | Retain old documentation history; candidate documentation explicitly distinguishes historical and current evidence. |
| `fbb5b9b` — exact verification-link contracts | Port private-download/verification regression and `verify-http-ci` integration adapted to current main. |
| `5193400` — invalid token/browser confirmation distinctions | Port the refined regression assertions; preserve the distinction between server rejection, browser result and provider delivery. |
| `9001466` — Phase 7D release-candidate report | Retain the historical report and blocker evidence; no carry-forward of old PASS/readiness claims. |

No branch, stash, recovery tag, worktree, original file, retained screenshot or
source document is removed to satisfy the two-branch target. Any future retirement
requires a fresh dependency/preservation review and applicable authorization.

## Reproduced payment-table defect and design reference lock

The dedicated `--payment-table` regression failed on the current main-derived
candidate even though the older broad event suite passed. Original evidence:
`.local/launch-readiness/2026-10-27T12-33-37.366Z-47ff6d39/event-flow.log` and
`.local/event-flow/2026-10-27T12-33-39.425Z/payment-table-320-light-initial.png`.
The actual Review payment button width was **44.609375px** against the focused
minimum 110px assertion. This is a confirmed readable-action layout defect, not
an authentication/payment-state root cause.

Keep the approved TPA visual tokens, navigation, semantic table/region and existing
horizontal scrolling. The minimal fix adds a table-specific class and scoped
minimum widths/nowrap for key content/actions. Current footer styles remain
unchanged. Refero Raise/Stripe style references and Acctual table screens provide
composition/readability sanity checks only; no reference colors/fonts are copied.
Vercel interface guidance informs long-content handling and visible keyboard focus.
No page redesign or change to payment authorization, amounts or state transitions
is part of this fix. Mark FIXED AND RETESTED only after the rebuilt six-state
table regression passes; preserve the original failure regardless of retest.

The rebuilt focused run is now verified at exact candidate
`a001c09657944abc36ec58a20257031f6bd27b2c`:
`.local/launch-readiness/2026-10-27T12-37-04.911Z-91a77a1a/results.json` and
`.local/event-flow/2026-10-27T12-37-07.152Z/payment-table.json`.
All six viewport/mode states retain **131.453125px wide, 44px high** actions,
positive actual keyboard scroll, no page overflow, no automated axe violations,
and dismissed confirmations with zero payment writes. The empty state passes.
The complete event-flow run passes 14 scenario groups. These are local synthetic
browser results, separate from human/physical-device and hosted acceptance.

The final preservation recheck at
`D:\Downloads\Workspace\TPA\.launch-recovery\20261027-launch\preservation-check.json`
reports eight original worktrees, zero failures and `preserved: true`.

## Main advanced during execution: preserved local integration

The final remote recheck found main at `77d84f7f54b8feb7d039886817bca78f8fed4cb4`,
eight commits beyond the originally verified `295c74a` base. Objects were fetched
without writing FETCH_HEAD or updating an existing local/remote ref. No original
checkout was switched or changed. The intervening commits are preserved as the
second parent of local merge `2d90ed3`; all eight remain individually identifiable:

| Commit | Reviewed scope / integration disposition |
|---|---|
| `c74af8f` | Shared portal shell, scoped UI, workflow presentation and GSAP dependencies; integrated existing main changes, preserving business endpoints and current candidate safeguards. |
| `90aabba` | Navigation pending feedback and request-scoped actor/public-content render deduplication; require session-isolation and loading acceptance. |
| `c912255` | Required-field progress, missing-step links and permission-scoped recent-applicant alerts; require policy/progress and HTTP permissions regression. |
| `c3a9b50` | Applicant-alert HTTP acceptance; included in restricted core. |
| `6c89f78` | Role-navigation expectations adapted to portal shell; included. |
| `59695d2` | Member portal and next-step browser expectations; included. |
| `fc05852` | Readable payment headers, empty/populated state and keyboard-region checks; included. |
| `77d84f7` | Profile-progress dashboard fixtures; included. |

The single merge conflict was the payment-table opening markup: retain main's
WorkspacePanel, loaded/empty states and keyboard-focusable scroll region, plus
the candidate's scoped registration-payments-table class/readable-action fix.
The focused regression now targets that scroll region and main's empty heading.
Main intentionally removes three route loading boundaries to retain current content
during navigation; those files remain recoverable in Git and all original checkouts.
No other source deletion or cleanup was introduced to resolve the merge.

New portal tests require explicitly supplied synthetic admin/member credentials.
The isolated harness now provisions exactly two credentials in its freshly created
UUID-named loopback fixture (strict port, database-name and identity checks), so
the suite is exercised rather than silently skipped. It cannot target production.
No live account or real invitation is used. These integrated changes need new
build/browser evidence; previous runs remain valid only at their recorded scope.
