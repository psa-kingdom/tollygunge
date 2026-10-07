# Hosted R2 upload rollout — 7 October 2026

Status: Done for the four existing storage workflows. Full production acceptance remains open.

## Configuration and boundaries

The fresh account-wide Object Read & Write pair was read transiently from the original
Credential.md and transferred directly to Railway managed settings through stdin.
Only R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY changed. Their values
were not written to arguments, repository/local environment files, documentation or
logs. Existing bucket, PostgreSQL, authentication, domains and service limits remained
unchanged. Production credential-file fallback is disabled.

The application permits only `tpa-private-documents`; document, editorial-media,
payment-QR and validated portrait namespaces remain separate. This application
restriction does not narrow the credential itself: its scope is account-wide.
Rotation to a TPA-only pair is a future hardening improvement, not a completed claim.
See [Cloudflare token permissions](https://developers.cloudflare.com/r2/api/tokens/).

The user confirmed no custom domains. During verification the user temporarily enabled
r2.dev, then disabled it before hosted deployment. A disposable object was readable
through authenticated S3 while its exact r2.dev URL denied anonymous access. Deletion
and HeadObject 404 verified cleanup. Anonymous S3 access also failed. Object-only
credentials cannot inspect REST bucket settings; the custom-domain state is based on
user confirmation, not an invented REST configuration check. Keep both public access
mechanisms disabled. Published images use application endpoints.

## Code and release

- Wrong bucket configuration fails closed in managed and local-file modes.
- Portrait keys validate UUIDs; metadata failures compensate by deleting the object.
  Failed deletion records `portrait.cleanup_required`, with generic client errors and
  suppressed provider diagnostics, consistent with the other upload endpoints.
- The homepage explicitly renders at request time. Railway builds without database
  settings had allowed it to be prerendered; current published homepage media now
  appears after publication and subsequent page loads.
- Runtime code: e98180e. Test-only follow-up: b0bb44a. Draft PR #1 remains unmerged.
- Railway deployment `9efdae03-9bb5-4b7d-97ef-764e43c9e277` is SUCCESS.
  Two working-directory uploads failed before build with provider HTTP 500. Deployment
  succeeded using a clean `git archive` of committed source, excluding local credentials.
- [Code CI 37641108841](https://github.com/psa-kingdom/tollygunge/actions/runs/37641108841)
  and [owner-access CI 37641589986](https://github.com/psa-kingdom/tollygunge/actions/runs/37641589986)
  pass: lint/typecheck/build, 36 unit tests, 5 PostgreSQL tests and 8 HTTP suites.

## Acceptance evidence

- Fresh-pair synthetic S3 upload/download/delete passes; short signed download works,
  anonymous retrieval fails, and exact object absence is checked.
- All four configured hosted HTTP suites pass at https://tpassociation.org:
  document ownership, reviewer audit and 60-second download; editorial private draft,
  normalization, explicit homepage/Resources publication and withdrawal; QR role/status
  access without transaction verification; portrait owner/other-member/staff boundaries,
  private review, explicit approval/publication, replacement and withdrawal.
- Signature/format/size rejection, normalization/metadata removal and namespace checks
  pass. Shared unit tests exercise failed storage/persistence and cleanup failure;
  production provider failures were not deliberately induced.
- All four hosted file controls are enabled at 1440/768/390 widths. Actual normalized
  private editorial and portrait images render in browser previews. Phone/tablet/desktop
  have no horizontal document overflow. Preview tabs and resized media forms retain edits.
- Chrome automated file selection is blocked by the extension's file-URL permission.
  That permission was not changed; actual uploads were verified through HTTP, with
  browser checks covering controls, loading state, responsive layout and image rendering.
  Full browser file-selection/error interaction remains a broader acceptance limitation.
- Credential scan: zero matches in three public HTML responses, ten browser JS bundles,
  500-line build/runtime log samples and tracked/nonignored repository files.
  This is sampled verification, not a guarantee about every future log or response.
- Hosted administrator login/routing, sign-out and revoked-session denial pass.
- Every test suite removes exact synthetic records/objects and checks object absence.
  Two additional browser fixtures were removed with revisions/audit records; both
  object HeadObject checks return 404 and anonymous image endpoints return 404.
  No real profiles, content, payment instructions or transactions were changed.
- Screenshots before cleanup: `preview-evidence/r2-media-desktop-hosted.png`,
  `r2-media-phone-hosted.png`, `r2-portrait-phone-hosted.png`. Viewport reset;
  existing development server retained.

## Retained dependencies and rollback

Resend stays deferred. Google OAuth, approved membership fees/eligibility/declaration,
payment verification/refunds, learning policy, import mappings and news sources remain
separate gates. Report presets/XLSX are the next independent batch. Backups/restore,
security/accessibility and staging/provider acceptance remain required for full release.

If a subsequent storage release fails verification, remove only the three new R2
runtime settings, then redeploy the last healthy application version. Do not roll back
PostgreSQL, authentication, DNS or user data. Reverify login and readiness afterward.

The source of truth is [DELIVERY_CHECKLIST.md](DELIVERY_CHECKLIST.md). Earlier hosting,
media, people and comparison reports are preserved as dated historical evidence.

## Documentation delivery status

Blocked at GitHub after hosted verification: repeated documentation pushes return
remote Internal Server Error; GraphQL and REST PR-description updates also fail.
The remote feature branch retains b0bb44a with passing CI, and the healthy deployed
runtime is e98180e. The full checklist/report is committed locally; push and PR refresh
remain pending provider recovery. Main is unchanged. No rollback is needed for this
documentation transport failure because hosted storage verification passed.
