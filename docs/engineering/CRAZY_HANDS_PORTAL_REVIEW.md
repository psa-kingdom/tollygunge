> Historical first checkpoint. The approved horizontal revision and current client handoff are documented in [PORTAL_HORIZONTAL_CLIENT_REVIEW.md](PORTAL_HORIZONTAL_CLIENT_REVIEW.md).

# Crazy Hands portal adaptation — client review checkpoint

## Implementation brief

Adapt Crazy Hands' portal composition and interaction patterns to TPA's existing
membership workflows on `feature/crazy-hands-portal-ux`. Preserve the blue/white
portal palette, TPA logo and font roles, light/dark/system preferences, grouped
permission-aware navigation, routes, APIs and business rules. The landing page
and public shell are regression guardrails. No new business module, migration,
credential model, payment behavior or delivery automation is included.

First checkpoint: working shared sign-in, administrator members workspace and
member overview, with desktop/mobile and light/dark evidence. Expansion to the
remaining modules requires visual approval. Cleanup has a separate approval
after verified preservation and an exact per-path removal list. Merge and live
deployment require later explicit approval.

## Source and reference lock

- TPA baseline: `ed0c3b053d1f0805cdea810cf00182db633e3730` (GitHub main).
- Preserved local main: `14593468c72e81dc087d400382805930530ab931`.
- Crazy Hands: `e799357fcfaba0631a71b9be51494ab2bb43d13b`, clean local
  `test`; local/remote main and test agree. Crazy Hands is read-only.
- Primary reference: Crazy Hands `AdminLogin`, `Admin`, `Dashboard` and its UI
  primitives. Its live admin sign-in was inspected in the in-app browser.
- Supplemental references: [Open Collective Raise](https://opencollective.com)
  for legibility and [Hello Ivy member management](https://refero.design/pages/a73e30bf-2913-4ee1-904e-1bd067013a7e)
  for filter/table hierarchy. These do not replace the requested design source.

| Decision | Reference and bounded role | TPA adaptation |
| --- | --- | --- |
| Split sign-in composition | Crazy Hands admin login | Existing shared TPA authentication; blue identity panel, readable form, no separate admin credentials |
| Pill section controls | Crazy Hands admin tabs/member overview | Existing member-register/account-directory switch and real member shortcut links |
| Rounded flat panels | Crazy Hands dashboard/profile | Existing blue/white tokens, larger panel radius and grouped verification/profile content |
| Member identity header | Crazy Hands dashboard | Initials from the signed-in actor; no invented portrait, membership badge or status |
| Search, filters and record list | Crazy Hands MemberExplorer; Hello Ivy | Preserve server filters, totals, pagination, staff permissions and review controls |
| Typography and colors | TPA existing portal/theme | Jakarta portal typography; existing auth display font role; no Crazy Hands orange or green palette |
| Small-screen task order | Existing TPA accessibility behavior | Form first in DOM; wrapping controls and keyboard-scrollable tables |

## Preservation and evidence

Private archive results and restoration manifests are outside the repository at
`D:/Downloads/TPA-private-archive/20261029`. Do not attach its backups, credentials,
raw manifests or historical private payloads to a public review.

The local showcase uses loopback PostgreSQL and synthetic credentials only;
external transports and operational workers are disabled. Local preview setup,
credentials and logs belong in ignored `.local/portal-review/`. Browser images
and measured results belong in ignored `output/playwright/portal-review/`.

Current results and the review instructions are recorded in
`docs/engineering/PORTAL_REVIEW_CHECKPOINT.md` after validation. A screenshot is
visual evidence, not proof that a business transaction succeeded.
