# Controlled member invitations

Account creation and email release are separate operations. The existing source batch contains 202 created accounts/member records and nine held source rows; it must not be imported again. Read-only reconciliation at 2026-10-11 05:08 UTC verified 208 total accounts, 213 people, 202 memberships, 202 batch holds and zero batch credentials, activation tokens or mail jobs.

## Administrator workflow

1. Open **Communications → Member invitations**. Edit the subject and plain-text body using `{{member_name}}`, `{{association_name}}`, `{{setup_link}}` and `{{expiry}}`. Include exactly one setup link and the expiry in the body. Preview the rendered email, save the draft, preview the saved draft and explicitly approve it. Approval sends nothing. A new draft removes readiness until it is approved.
2. Open **Dashboard → Invitations held**. Select the intended members, including through the explicit “Select eligible accounts on this page” button. Selections remain across pagination. Nothing is selected automatically.
3. Click **Review invitations**. Inspect the exact named recipients, exclusions, approved email and review expiry. The example link cannot activate an account. The saved review survives reload through its URL.
4. Check **I verified the listed recipients and the approved email**, then click **Confirm and send invitations** for the displayed exact recipient count. The server revalidates identities, account/member/hold versions and template approval. Stale reviews return 409 and require a fresh review. Queueing creates one secure single-use 48-hour password-setup link per recipient; it does not generate a password.
5. Observe the saved review's delivery results: queued, leased, accepted, delivered, bounced or failed. Queued/accepted are not proof of receipt. Each recipient chooses an 8–128-character password through the existing activation flow. Account activation, profile verification, membership and payment remain distinct.

Real invitations remain held until the administrator configures and approves a template and confirms recipients. Verify a separately authorized test recipient's receipt, sender, rendering, link and actual login before recommending bulk release. Implementation QA must not send to the real member batch.

## Interfaces and safety

- Administrator-only `/api/staff/invitation-templates`: GET current revision/history/default draft; POST `preview`, `save` with expected `revision`, or `approve` with latest draft `id` and expected revision. Saved content is immutable; approval metadata identifies the approving administrator/time. The initial state is unapproved.
- Administrator-only `/api/staff/invitation-releases`: POST `review` with explicit `personIds`, GET actor-owned `?id=...`, POST `confirm` with persisted review ID and its idempotency key. Reviews expire after one hour. Limits are 1–1,000 selected records. Missing accounts, activated accounts, mismatched emails and queued/recent/uncertain delivery are excluded with reasons.
- Confirmation uses ordered row locks, batched reads/inserts and one transaction. Tokens, encrypted mail payloads, outcomes and hold release commit together. Any failure rolls them all back. Repeated confirmations return stored outcomes without duplicate tokens or mail; concurrent confirmations serialize.
- Historical member `invite`/`resend`/`release` actions and legacy import `reissue` return `409 invitation_review_required`. Existing delivery retries retain their safeguards; generating a replacement link requires a new recipient review.
- New optional account provisioning now creates invitation holds by default. Imports create no activation tokens or mail. Account-only imports require an explicit legitimate person/membership link before eligibility in this member-review workflow; do not invent missing register facts to make an unrelated account eligible.
- Migration 029 adds template state/versions and saved reviews, and backfills hold version 1. It preserves historical batches and all existing holds. Same-origin writes, administrator authorization, actor ownership, no-store responses and audit records apply.

## Rollout and rollback

Validate a fresh backup by restoring it to an isolated database. Apply additive migration 029 and deploy a frozen tested runtime to the existing service, without capacity changes or real invitation release. The initial unapproved template blocks confirmation. Reconcile all 202 holds and zero batch tokens/mail/credentials after deployment; inspect the hosted dashboard/filter/editor read-only.

If needed, stop new release confirmations and fix forward. Do not delete committed people/memberships/accounts or restore a database backup over later legitimate activity. Do not roll back to code that permits direct release or bypasses account holds. Already queued, explicitly confirmed mail retains its reviewed template snapshot.

Commands and exact executed evidence are recorded in the delivery section below. Broader capacity, physical-device/human accessibility and recovery gates remain separate from this invitation feature.

## Delivery evidence

Executed on 2026-10-11, using isolated PostgreSQL fixtures and mail sinks:

| Command | Result |
|---|---|
| `npm test` | 81 passed, zero failed/skipped |
| `npm run typecheck` | Exit 0 |
| `npm run lint` | Exit 0 |
| `npm run build` | Exit 0; web and both worker bundles built |
| `node --env-file=.env.local --import tsx scripts/test-invitation-release.mts` | 3 passed; fresh/legacy migration and repeated migration verified; synthetic 10/50/202 recipient batches, repeat/concurrent confirmation, stale review and atomic rollback |
| `node --env-file=.env.local --import tsx scripts/test-invitation-release.mts --http` | Controlled-release API assertions passed; affected onboarding/workspace suites 2 passed; authentication/roles/origin/idempotency exercised |
| `TPA_ACCOUNT_TEST_FILES=tests/identity.integration.ts,tests/onboarding-auth.integration.ts,tests/onboarding-delivery.integration.ts node --env-file=.env.local --import tsx scripts/test-approved-accounts.mts` | 4 passed; credentials, recovery, activation/session and delivery safeguards |
| `TPA_ACCOUNT_TEST_FILES=tests/member-foundation.integration.ts node --env-file=.env.local --import tsx .local/foundation-hold-runner.mts --test-name-pattern="invitation hold failure"` | Focused hold-insert failure: 1 passed; no orphan account/person/membership |
| `TPA_UI_TEST_FILES=tests/browser/held-account.spec.ts node --env-file=.env.local --import tsx scripts/verify-member-ui.mts` | Desktop/tablet/phone: 3 passed in 5.1 minutes; review/reload/confirmation, activation/login, profile/address save; isolated database removed |
| `node --env-file=.env.local --import tsx .local/verify-held-metric.mts` | Isolated count/filter scope check passed, excluding unrelated account-only/released holds |

Environment assignments above are shown in portable notation; PowerShell execution used `$env:...`. Private logs live under ignored `.local/controlled-invitation-*.log`. Failed earlier browser probes exposed form/confirmation issues that were fixed; those attempts are not counted as passed acceptance. A transient migration connection reset occurred before one browser attempt executed; its fixture was removed.

Private pre-rollout backup was restored and checked in an isolated database, then the restoration database removed. Backup SHA-256: `0cded5583d0aa77e7539c623e194924de10b6e8c7dc06c221e4ae7bdbc91e0eb`. Account/person counts remained stable during backup. Backup and restricted reconciliation evidence are excluded from Git and accessible only to the local user/system/administrators.

Production migration command `node --env-file=.env.local scripts/migrate.mjs` applied **029_controlled_invitations.sql** only. Read-only pre-deploy reconciliation at **2026-10-11 05:47 UTC** confirmed 211 outcomes (202 previously created, nine held), 202 memberships/held batch accounts, and zero batch tokens, mail jobs or credentials. Nothing was reimported or provisioned by this release.

Frozen runtime manifest: 271 files, SHA-256 `c58d7a897009a4d95788f5a203478775f6c72e60b658e7130f06847a5c5096cf`. The snapshot excludes a concurrent payment-component edit and private evidence. Comparison against the superseded main commit `797e92d9af07a352fa7b9fa161d76bcf8c6756c5`, ignoring CRLF/LF differences, verified only this feature's nine changed and seven added runtime files.

Deployment **`3d21483a-44f7-43ec-afff-ebf0954374e9`** reached **SUCCESS** in the existing `tpa-web` production service. No resources, capacity limits or providers were added. Executed upload:

```text
node C:/Users/savag/AppData/Roaming/npm/node_modules/@railway/cli/bin/railway.js up .local/account-batch/release-1791697633051 --path-as-root --no-gitignore --service tpa-web --environment production --project 1f2b5099-790f-48c3-96e9-e62b142157fb --detach --json --message "Controlled invitation review; all real invitations held"
```

`node --env-file=.env.local --import tsx scripts/verify-controlled-invitations-hosted.mts` passed at **1440/768/390 pixels** at **05:49 UTC**: dashboard count 202, held register count 202, zero selection/disabled confirmation, editable initial template, approval disabled and no approved/saved template. Screenshots were inspected locally; no horizontal overflow. This was read-only hosted inspection, with no template save/approval or release POST. Health/login returned 200; anonymous template/release API requests returned 401.

`node --env-file=.env.local --import tsx scripts/reconcile-held-members.mts` at **05:50 UTC**, after deployment, verified **208 total accounts, 213 people, 202 memberships; 202 batch accounts/member relationships and unreleased holds; zero batch credentials, tokens and mail jobs**. The 211 historical source outcomes still reconcile to 202 previously created and nine held. **Provisioned this rollout: 0; queued real invitations: 0; sent real invitations: 0; updated member records: 0.**

Cleanup check verified all eight recorded invitation/browser/backup fixtures removed and both test web ports stopped. Hosted import processing remains disabled (the enable flag is absent, and the worker processes jobs only when it equals `true`).

Remaining: administrator template configuration/approval, separately authorized test-recipient delivery with actual inbox/link/login inspection, explicit recipient release, and authoritative resolution of nine held source rows. Broader recovery/capacity/physical-device acceptance remains separate. No launch-readiness claim follows from these checks.
