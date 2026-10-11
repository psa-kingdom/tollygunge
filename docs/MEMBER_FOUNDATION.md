# Member backend foundation

Person records (`tpa.people`) own individual contact/profile data. Membership records (`tpa.memberships`) own the supplied membership number and optional type/status/validity. A nullable person `user_id` links website access; accounts and imported memberships confer no professional badge, payment approval, public profile, newsletter consent, or staff role.

## API contract

- `GET /api/staff/members` preserves the account directory. `?view=register&q=...&id=PERSON_ID&offset=0` lists registered people including those without accounts, with person/membership versions, optional account verification, and membership facts. Member reviewers may read; administrators write.
- `POST /api/staff/members`: `{action:'create',member:{prefix,firstName,lastName,email,mobile,designation,organization,membershipNumber,addresses},provisionAccount:false}`. Updates use `action:'update',personId,personVersion,membershipVersion`; `membershipVersion:0` adds a membership to an existing account's person. Optional `membership:{type,status,validFrom,validUntil}` never defaults active/paid. The existing `source` object using spreadsheet column headings remains an adapter to the same validator.
- `addresses` has optional `office`, `residence`, `correspondence`, each containing `line1,line2,country,state,district,city,postalLocality,postalCode`. City and postal locality are separate. India/IN canonicalizes to IN; other countries use ISO two-letter codes. Unchanged legacy data survives; changed register addresses require line1/country/postalCode and a consistent hierarchy. Draft application fields retain the `officeAddressStructured`/`residenceAddressStructured` JSON-string contract.
- `GET /api/member/locations?pin=700001&state=West%20Bengal&district=Kolkata` requires authentication; `/api/locations` is a compatibility alias. Returns `{version,states,districts,cities,localities:[{pin,state,district,locality}],exactLocation:false}`. Missing reference data returns 503. No GPS APIs or coordinates.
- Validation returns HTTP400 `{error,code:'member_validation',fieldErrors}`. Identity/uniqueness/version conflicts return409 with stable codes. Existing error text remains available. No database/provider diagnostics are returned.

International addresses validate ISO countries and safe postal characters; US, Canada and GB additionally enforce their national postal shapes, while partial drafts can retain incomplete codes. These are format checks, not delivery verification. References: [USPS ZIP formats](https://faq.usps.com/articles/Knowledge/ZIP-Code-The-Basics), [Canada Post postal codes](https://www.canadapost-postescanada.ca/cpc/en/support/articles/addressing-guidelines/postal-codes.page), [ONS postal geography](https://www.ons.gov.uk/methodology/geography/ukgeographies/postalgeography). Additional national formats can be added from reviewed postal authority references.

## Imports

Upload multipart `file` plus `mode:'members'` to `/api/staff/onboarding-import`. The 13-column template is available through `?template=xlsx&mode=members` or CSV. Account-only imports retain their existing contract. The legacy `existing-members` alias is preservation-only: differing existing records are conflicts, exact matches skipped, and updates/account provisioning forbidden. Rows needing district derivation are held and the district remains blank, following the separate source-import user's explicit no-inference instruction. This policy is persisted/audited with the preview and checked again at commit. Canonical `members` mode retains the foundation plan's unambiguous postal derivation, explicitly reviewed updates and opt-in access.

Preview returns `{id,version,mode,rows}`. Each row retains `sourceRow`, original `source`, name/email/membershipNumber, normalized `member`, fieldErrors, warnings, normalizations (including postal derivations), match IDs/versions, proposedChanges, status and reason. `created` in preview means eligible, not committed. All duplicate email/number groups are held. Shared mobiles warn without merging people. Formula/date/error/unsafe-number cells are reported by source row; zero-only number formats preserve leading zeros. Completely blank records are ignored without shifting subsequent row numbers.

Default: no updates and no accounts. Persist choices with `{action:'choices',id,version,updateRows:[SOURCE_ROW],provisionAccounts:false}`. Only unambiguous email+membership-number matches are updateable. Blank optional fields do not clear stored values. Commit using `{action:'commit',id,version}`; the unchanged original preview also accepts legacy commit without version. Revalidate and lock at commit. Each row uses a savepoint within the batch transaction; failures leave no orphan identities or memberships. Results classify created/updated/skipped/conflict/failed with reasons and totals. Repeated commits return stored results. Existing credentials/roles never change and invitations are queued only for explicit account provisioning.

An existing email account requires an explicit administrator update/link to its existing person, never automatic merging. Pending profile reviews block register updates until resolved. Membership numbers preserve formatting while comparing trimmed, whitespace-normalized, case-insensitive keys.

## Migration and postal provisioning

Run `node --env-file-if-exists=.env.local --import tsx scripts/member-preflight.mts` before `npm run db:migrate`. Preflight reports account IDs/counts for normalized email collisions without printing email values. Migration023 aborts on collisions, adds normalized constraints/indexes, backfills only known account emails and recognizable mobiles, changes the person/account FK to SET NULL, and adds memberships/postal/batch metadata. It does not split legacy names, guess addresses, create memberships, or delete records. Migrations023/024 publish successor Professional policies and keep historical policies/evidence. New Student drafts/uploads/policies are blocked; legacy applications may be saved as Professional without losing answers/documents.

Provision the local postal reference after migration:

```
node --env-file-if-exists=.env.local --import tsx scripts/provision-postal.mts
```

The snapshot contains 156,940 postal tuples from the pinned republish documented in `data/postal/provenance.json`; direct government acquisition was unavailable. It is a versioned reference, not live delivery verification. The installed artifact checksum is stored. Default reviewed city aliases cover Kolkata/Calcutta and Howrah/Haora only in their documented districts; other city names require reviewed aliases. No city is inferred from a post office. Provision a reviewed CSV with `--aliases PATH` (state,district,alias,city). Unknown/ambiguous geographic combinations remain held.

Refresh from a reviewed official CSV with `scripts/refresh-postal.mts --file PATH --version NEW_VERSION --source OFFICIAL_URL --sha256 EXPECTED_HASH`. It preserves the old snapshot, requires nationwide coverage, strips coordinates, and writes a new gzip/provenance pair. Provision with `--file NEW_GZIP --provenance NEW_PROVENANCE --aliases REVIEWED_CSV`. Activation is transactional; old reference versions remain available. Roll back postal activation by selecting a previous provisioned version through the same script.

Before production migration/import, take and restore-test a database backup, run preflight, rehearse on that restored database, and review every held row and derived value. Do not edit applied migration checksums. Rollback a deployment without dropping additive tables/columns or deleting new members; if data restoration is necessary, use the verified backup with an explicit operational plan and preserve later writes first. This backend workstream does not run production migrations/imports/deployment.

## Acceptance

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

`node --env-file-if-exists=.env.local --import tsx scripts/test-member-foundation.mts --http` creates a random isolated database, proves collision-abort and legacy migration behavior, provisions postal data, runs member/database/identity/onboarding/API suites with mail sinks, and drops the database. It never sends real mail or commits supplied members. Frontend acceptance uses `scripts/verify-member-ui.mts` with a separate isolated database and built server.

`--http-only` reruns the concurrency and database/auth/mail/API suites without repeating the long 250-record transaction suite. `scripts/test-member-migration.mts` separately rehearses all migrations on a fresh empty database and repeats them. HTTP acceptance runs onboarding-enabled suites first, then restarts with onboarding disabled for legacy account/profile contracts. `--wait-build` is a local coordination option that waits for a freshly written `.local/member-http-build-ready` marker before starting HTTP tests.

Real workbook parsing/preview reports must stay in ignored private local directories; never check member fixtures, tokens, database URLs or backup contents into Git.

Old uncommitted member previews without current district-policy metadata return HTTP 409 with code stale_batch_policy. Create a fresh preview; committed batches retain stored-result replay behavior.
