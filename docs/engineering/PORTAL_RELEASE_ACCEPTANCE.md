# TPA portal release acceptance

This is the final audit of `feature/crazy-hands-portal-ux`, based on
`e015e3c97cb69d62509cb2a3bcfbe302c96be487`. The user authorized a normal merge
and production release after validation. The earlier client review report is
historical evidence, not acceptance of this candidate.

## Product decisions

- Keep Crazy Hands' horizontal navigation and inspector hierarchy, adapted to
  TPA's membership, verification, events, publishing, communications and finance
  permissions. Preserve existing URLs and account-directory query parameters.
- Separate Verification tools (Profile reviews, Requirements, History) from
  record views (Applications, Verified profiles). Internal filter values remain
  compatible.
- Member overview uses the existing protected verification, event and activity
  data. Upcoming registrations take priority; event-payment references and
  verification are distinct from membership approval. Failed activity loading
  is explicitly unavailable, with no fabricated zero totals.
- Keep activity counts compact and render readable administrator audit labels.
  Preserve safeguards, consent and mandatory guidance.
- Preserve entered member-contact edits and focus across desktop inspector and
  mobile sheet changes. A nested discard confirmation handles Escape before the
  underlying inspector. Filtering and changing records protect unsaved edits.
- Account-menu Escape uses Floating UI's dismissal lifecycle, so restoring
  trigger focus after an appearance change does not reopen the panel.
- Explicit keyboard close on a member quick card remains dismissed until focus
  leaves and returns. Edge-position checks cover 1440, 390 and 320px with the
  record visible in the viewport.
- Retain TPA branding, blue primary actions, semantic status colors and both
  appearances. Public landing source and branding assets are unchanged.

## Repeatable acceptance

`tests/browser/portal-acceptance.spec.ts` now tracks the formerly local route
matrix and interaction checks. It measures the first task/status region as well
as the heading, at 320, 390, 768, 1024 and 1440px in both appearances. It also
covers all six staff roles, navigation/direct routes/protected APIs, authorized
preview controls, response races, filtering and unsaved inspector edits.

`tests/browser/portal-design.spec.ts` covers every workspace, nested tools,
clipboard success/failure, hover movement, pinning, touch dismissal, focus
restoration, reduced motion, theme contrast and public-page style isolation.
Existing member-platform tests cover long form values and enlarged text.

Fresh synthetic accounts and 32 held register records are provisioned by
`scripts/provision-launch-browser.mts` inside the disposable-data harness.
Account invitations remain held and all messages use the local mail sink.

Run the complete focused portal suite from a separately provisioned loopback
PostgreSQL maintenance database:

```powershell
$env:DATABASE_URL='postgresql://tpa_qa@127.0.0.1:55439/postgres'
$env:TPA_BROWSER_CHANNEL='chrome'
node scripts/verify-phase7b.mjs --only portal
```

The harness rejects hosted databases and strips inherited provider settings.
Tablet/phone duplicates of the five-width matrix and role/state tests are
explicitly skipped; the ordinary portal regressions run on all three projects.
Failures, retries and external-provider mocks must remain labelled in evidence.

## Client inspection

The local optimized demo and synthetic logins are documented in
[the client review guide](PORTAL_HORIZONTAL_CLIENT_REVIEW.md). The gallery at
`http://127.0.0.1:3186` retains before/after comparisons and complete workspace
captures under `output/playwright/portal-review`.

Review Members and its account directory, Verification's two levels of tools,
event booking/payment guidance, Communications draft/review safeguards, and
member profile/security. Check both appearances and a narrow phone. Copy a
contact value, pin a person, edit a field, resize, then dismiss the nested guard.

## Release boundaries and rollback

Preserve local main `14593468c72e81dc087d400382805930530ab931` as
`preservation/main-before-portal-release-20261029`. Keep `bd7d0ef` and `e015e3c`
in normal merge history. Local main must advance by fast-forward only.

The rollback runtime is Railway deployment
`e42ad569-6293-440a-a813-0d1c25a38330` at
`ed0c3b053d1f0805cdea810cf00182db633e3730`. Verify deployment metadata against
the merged revision; the service's source configuration previously exposed an
older SHA than the successful runtime.

Keep one CPU, 1 GB and one replica, and preserve operational delivery/import/
reminder settings. `TPA_DEPLOYMENT_ENV=production` changes presentation only.
Hosted acceptance is read-only using an authorized existing session. No
production test accounts, communications, approvals or payment reconciliation.
Real email/storage-provider behavior and money movement are not covered by local
mail/storage mocks. Folder cleanup remains separately gated.

## Final evidence

- Final source build: `2ND-hKygBPapsc7vkCSqB`; input digest
  `c1ce2e1a373669a417ffce5b9272d10aa290a8cf2c81487fe6394e45a399c00f`.
- Build, worker build, typecheck, lint, unit/runtime (142/142) and indexed
  structure checks pass after the final source changes. Evidence:
  `.local/launch-readiness/2026-10-29T16-45-25.505Z-d6791462/results.json`.
- The first audit run passed 66 portal browser cases and the 310-state matrix;
  12 duplicate matrix/role cases were explicitly skipped. That run preceded
  the final Escape correction and is retained as baseline evidence only.
- All three focused regressions pass against the final build: account-menu
  dismissal, unsaved inspector/sheet edits and quick-card keyboard close/edges.
- The broad local run passed 204 browser and 29 backend checks, with 50 explicit
  skips and one obsolete held-account selector failure. The corrected held-
  account workflow then passed all three responsive projects. CI on `d26ca1e`
  subsequently passed all four jobs, including 205 browser checks and 41
  backend/runtime checks in launch operations. These precede the final quick-
  card fix and remain baseline evidence; the final PR revision requires CI again.
- Real local auth, applications, member accounts/imports/invitations, inquiries,
  website/media controls, event booking, manual payment verification and exports
  passed in the isolated workflow run starting `2026-10-29T15:56:07.970Z`.
  Event engagement had a failed immediate scheduling assertion; a repeat passed.
  Its fixture now explicitly opens booking one minute earlier, avoiding a
  millisecond timing assumption between API approval and scheduler clocks.
- Complete final browser/integration acceptance, GitHub checks and hosted
  acceptance are additional release gates. Their exact commit/build/deployment
  identities and outcomes are recorded in the local delivery manifest
  `output/playwright/portal-review/release-acceptance.json` and the release PR.
  A successful local build is not a live-release claim.
