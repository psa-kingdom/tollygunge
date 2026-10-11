# Member account import RCA — 11 October 2026

## Outcome

The 211-row import completed with zero created members and zero created portal accounts. This is not a frontend display or synchronization failure: persisted production results show account counts unchanged at six and memberships unchanged at zero. These are recorded rollout counts, not a new live database census.

## Evidence and causes

The restricted `production-member-results.json` contains 211 independently reconciled results. Grouping actual result reasons yields:

| Blocking reason | Rows |
| --- | ---: |
| Missing district; explicitly held without inference | 118 |
| Unsupported or ambiguous city | 51 |
| Missing address line 1, country or postal code | 15 |
| Duplicate emails in seven source pairs | 14 |
| Ambiguous postal result | 11 |
| Existing email/membership identity mismatch | 2 |
| Total | 211 |

1. Source completeness and reference matching prevented every row from becoming eligible. The workbook contains no district column. The user's earlier instruction expressly requires missing districts to stay blank and affected rows to be held.
2. The batch uses `preserveExisting: true` and `allowDistrictDerivation: false`. In `src/lib/member-import.ts`, preservation imports reject account provisioning and updates. Address corrections alone therefore cannot create login accounts through this batch mode.
3. Member/person registration and portal access are distinct operations. `saveMember` calls `provisionMemberAccount` only with an explicit true provisioning option. Existing accounts require administrator identity linking; email matching alone cannot grant access.
4. A committed batch replays its stored results. Retrying the original committed batch cannot apply corrected source values or change its policy; a new reviewed preview is necessary.
5. Whole-batch synchronous processing remains a transport limitation for large creation batches. The successful zero-eligible batch does not establish that 211 account creations will complete within hosted request limits.

The engineering/process gap is a mismatch between a preservation-only import and the desired outcome of login accounts. A successful deployment/import request was insufficient evidence for successful account creation. Acceptance must explicitly count created or linked accounts and their working access.

## Fix path

First settle whether complete addresses are prerequisites for accounts or can be collected during onboarding. This is an explicit change from the earlier hold policy and must not be inferred. Missing districts remain blank under either approach.

If complete addresses remain mandatory, obtain authoritative corrections for the 195 address-blocked rows. Resolve the fourteen duplicate-email rows and two existing-identity conflicts before provisioning. The row counts describe current primary blockers; corrected rows can reveal additional validation failures.

If incomplete addresses may be completed after invitation, separate account eligibility from professional address verification. Preserve original address values and missing districts, require valid unique identity/email, retain incomplete verification status, and collect structured addresses in the existing verification workflow. Do not invent districts, approve verification or mark memberships paid. Introduce explicit independent no-overwrite/no-district-inference/provisioning policies rather than turning off preservation and accidentally enabling inference.

For either path, create a new reviewed batch with explicit account provisioning, preserve existing identities, and resolve account linking manually. Use bounded resumable work with idempotent per-row outcomes for large account creation batches. Invitations are external communications and require explicit authorization before sending.

## Acceptance

- Isolated tests cover blank districts, duplicate email, existing identity/account collisions, unchanged private data, independent verification, retries and interrupted batches.
- Preview distinguishes source rows, unique eligible identities, existing linked accounts, new accounts and blocked rows. The target cannot be assumed to be 211 distinct accounts because the source has seven duplicate-email pairs.
- Provisioning counts reconcile against database account/person links; failures leave no partial identities or mail jobs.
- After an authorized live run, authenticate representative newly activated accounts and verify member portal access, profile save/reload and pending verification state. Report actual created/linked/held counts rather than treating HTTP success as completion.

No production data or import policy was changed during this RCA. No invitations were sent.
