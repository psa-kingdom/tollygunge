# Main release acceptance — 11 October 2026

## Release scope

Publish the validated member operations, strict import worker, held-account protection and QA fixes to main, then deploy the exact main source to existing Railway `tpa-web`. Preserve all 202 imported-account holds. This acceptance does not authorize invitation release or test mail. Existing recovery and transactional email remain enabled.

The validated baseline is the independent closeout source manifest `773CB16A7B091C5A14FC5AADA3561DE5EC5091FA20D9D3064BE58AFC558EF62D`. Newer shared-tree invitation-template/bulk-release work and migration 029 are outside this release; they remain preserved in the original checkout. CI fixture preparation now provisions postal data, restores baseline verification policy after HTTP lifecycle checks, and executes isolated member-foundation, held-account and import-worker acceptance.

## Before deployment

- Production read-only reconciliation: 208 accounts, 213 people, 202 members; approved 211-row batch reconciles 202 created and nine held source rows.
- All 202 account holds remain unreleased; batch tokens, mail jobs and credentials are zero.
- Existing accounts, private people and credential hashes independently match preserved pre-batch values.
- Authenticated hosted browser acceptance confirms member/account counts, held invitation state and incomplete address state without member writes.
- Local release build, lint, typecheck and 79 unit tests pass. The member-foundation runner passes six member integration cases and seven authentication/delivery cases with disposable fixtures.
- Staged secret scan: 87 changed files, two configured credential values, zero leaks or restricted paths. Private evidence remains ignored.

## Operational boundaries

Railway inspection found production only, no isolated staging and no connected Git source. Deploy by uploading an archive of the verified main commit to the existing project/service; do not create resources or change capacity. The strict member-import worker remains disabled. Migrations 026–028 are already applied in production; no new schema mutation is planned.

Fresh hosted results, CI URLs, commit/deployment identities and sanitized reconciliation are recorded under ignored `.local/main-publish`. Release reports will receive a dated final outcome after acceptance. Original test failures and successful retests remain preserved in the independent closeout.

## Remaining launch gates

Hosted write journeys and concurrency are BLOCKED without isolated staging. Invitation delivery, current mailbox acceptance and mail-dependent activation/recovery checks await explicit sending authorization. Membership/payment policies, real-source corrections, required providers, physical-device usability and assistive-technology acceptance remain explicit. The full product is not declared ready solely because main and deployment are healthy.
