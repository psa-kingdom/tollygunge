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
databases and provider sinks/mocks. Production is read-only. Never send real
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
| `6fa0a7d` — readable payment tables | Select relevant grant/worker-test plumbing where required. **Payment-table UI/CSS and historical table acceptance are retained on the old branch, not ported.** Current main responsive implementation remains the candidate baseline. |
| `752fde7` — nested HTTP restricted identities | Port restricted-runtime adapter and adapter regression coverage, with current CI wiring. |
| `0817e7b` — keyboard payment-table assertion | Retain historical table acceptance helper on security branch; no claim that this helper or its UI change was ported. |
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
