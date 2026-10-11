# TPA real-data rollout evidence

Initial rollout completed 11 October 2026 with source snapshot `7cb9fee` in Railway release `4628fde7-7847-45b4-afa0-3d487c2dfde7`. Hosted health and scoped acceptance passed. The subsequent accessibility/header fixes and current deployment are recorded in [TECHNICAL_RELEASE_CHECKS.md](TECHNICAL_RELEASE_CHECKS.md); member outcomes are unchanged. This does not establish full production readiness.

## Member outcomes

| Outcome | Production rows |
| --- | ---: |
| Created | 0 |
| Updated | 0 |
| Skipped | 0 |
| Held conflict | 134 |
| Failed validation | 77 |
| Total | 211 |

No source member was imported. The user explicitly required missing districts to stay blank and affected rows to be held. The workbook has no District column. Held conflicts comprise 118 missing-district rows, fourteen occurrences in seven duplicate-email pairs and two differing existing identities. The 77 validation failures comprise fifteen incomplete addresses, eleven ambiguous postal results and fifty-one unsupported/ambiguous cities.

Every source row has a persisted outcome. Names, organizations, membership-number text and leading zeros are preserved; every normalization and source-field error is recorded in the restricted row-level report. Production normalized fields and row outcomes independently match the exact isolated rehearsal for all 211 rows, including physical source rows 2, 107 and 212. Original workbook SHA256 remains `0031124b1557fcd3bce3a03201733aabda212ff95494adcd66ace3df607f1ecd`.

Preservation imports prohibit updates, account provisioning and district derivation. Cached previews with missing/incompatible policies return 409 and require a new preview. Conflicts are rechecked at commit; uniqueness and persisted results prevent duplicate identities or retries. The repeated production commit returned identical results. Accounts six, people eleven, memberships zero, mail jobs eight and invitations one stayed unchanged during the import. No invitations, passwords, automatic verification, consent, paid status or membership plan were created for source rows.

The earlier candidate rehearsal that created 118 isolated members is superseded. Those exact fixtures were removed before the final no-derivation rehearsal; its private historical report remains archived.

## People, photographs and payments

All eight supplied committee profiles, roles, complete biographies and confirmed photographs are published. `P S.jpeg` maps to CA Prem Suman. Seven editorial people were created and one existing person reused. All four original people, private accepted/draft fields, account links and historical verification values were independently compared against the restored pre-rollout snapshot and preserved. Original account identities and credential hashes are unchanged. Editorial approval conferred no professional verification.

Original files are preserved. Responsive crops use only supplied pixels; every published photograph matches its reviewed prepared-image hash. Hosted desktop, tablet and phone checks passed image loading, expandable biographies, sticky headers and overflow checks; photo associations/crops were visually checked. Isolated acceptance also passed fallback avatars and photograph access before publication, replacement and withdrawal. Unsupported new organization/term fields remain empty.

Bank-transfer instructions are active and match `Payments.txt` exactly. Account numbers remain text; bank, branch, account holder and IFSC are supported. Existing UPI support passed regression and no UPI value was invented. Hosted member display passed at desktop, tablet and phone widths; anonymous access returns 401. Collection remains disabled. Display acceptance does not establish payment collection, settlement, reconciliation or refunds.

## Verification

| Area | Actual evidence |
| --- | --- |
| Unit/static/build | 72 unit tests; lint, typecheck and final frontend/worker build passed. |
| Database/backend | Earlier 250-record synthetic transaction suite; latest seventeen database/API checks; invitation-enqueue failure rollback; two stale-policy rejections and two current-policy commits/replays passed. Fresh, legacy and repeated migrations passed. |
| Onboarding/integration | Enabled and legacy-mode HTTP suites passed; editorial/private-field and portrait regressions passed. Authorization, recovery/session revocation, independent email/membership identity and concurrent duplicate rejection were exercised. |
| Frontend | Broad 34-pass run with eight intentional project skips; focused 22-pass run with two intentional matrix skips; final two visual/header cases passed. Five widths, 140-pixel mobile-header cap, at least 4.5:1 tested text/link contrast, light/dark modes and zoom were checked. |
| Real content | Final six governance/bank browser cases passed on the corrected fixed build; hosted governance and bank display passed all three widths. |
| Data | Exact isolated and hosted 211-row batches independently reconciled; all source normalized fields matched; original people/accounts/credentials preserved; repeated production commit was safe. |
| Protection | Thirty-eight local browser files had no configured secret matches. Eleven hosted JavaScript files and sampled pages had no matches for seven hosted secret values. Anonymous private staff/member endpoints returned 401. |

Individual member creation/edit/view and duplicate membership-number/email rejection passed in the isolated rehearsal; no synthetic production member was created for that check. Existing verified badges and historical Student evidence/policy remain preserved while new Professional flows use the current foundation. See the coordinated [backend delivery](MEMBER_FOUNDATION_DELIVERY.md) for detailed contracts and test scope.

## Recovery and cleanup

Production database/project identity and normalized-email preflight passed. A fresh pre-rollout PostgreSQL backup restored successfully with six accounts, four people and one member profile before migrations 023–025. Postal provisioning installed 156,940 tuples and four reviewed aliases. Backup checksum, restore database, source batch ID, seven created editorial identifiers, portrait/payment identifiers and the reused person's prior snapshots are retained in restricted ignored `.local/real-data` reports; no member was created by this batch.

Only identified workstream artifacts were removed: the 118 superseded isolated import fixtures, exact synthetic test fixtures, eight rehearsal portrait objects proven absent from production references, and four explicitly identified rehearsal/older-backup databases. The latest restored recovery database and backup SQL remain. Zero production records were removed; unrelated production records remain intact.

## Remaining work and release gates

Authoritative districts, address corrections and identity-conflict resolution are needed before source members can become eligible. Preserve the original workbook and revalidate a corrected authoritative batch; do not infer districts or overwrite conflicts.

Large synchronous imports remain a general transport gate: an earlier 250-record remote-PostgreSQL test took approximately 21 minutes. The zero-eligible hosted source batch completed and safely replayed, which does not prove large creation batches survive hosted timeouts. [Railway request limits](https://docs.railway.com/networking/public-networking/specs-and-limits) include a five-minute silent-request limit; a longer client timeout alone does not resolve it.

The pinned postal snapshot is a republish of Department of Posts data; direct government acquisition was unavailable. Provenance/checksums are retained and aliases are limited to reviewed contexts.

All outstanding gates in [DELIVERY_CHECKLIST.md](DELIVERY_CHECKLIST.md) remain: physical devices, broader accessibility/usability, outstanding human recovery sign-in and exact legacy synthetic cleanup; provider, consent, Google/WhatsApp and membership/payment/refund/learning/news policy gates. No blanket production-readiness claim is made.
