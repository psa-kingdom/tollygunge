# TPA real-data rollout evidence

Working report, 11 October 2026. Production rollout is beginning after final acceptance.

## Source and safeguards

The original 211-row member workbook is unchanged. The source hash, original cells, normalized values, field errors, duplicate groups and row outcomes are stored in the restricted, ignored .local/real-data directory. No member contact information belongs in this report or the deployed bundle.

The source contains seven duplicate-email pairs. Every occurrence is held. Membership numbers are independent of email identity and retain text formatting. Updates and account provisioning default to off. The operational workflow explicitly requests no updates, accounts, invitations, passwords, verification, consent, membership plan or paid status.

The preliminary isolated candidate batch reconciled all 211 rows: 118 created, zero updated, zero skipped, 16 identity/duplicate conflicts and 77 validation failures. Field checks, uniqueness and repeated commit passed; accounts, mail jobs and invitations stayed unchanged. This candidate evidence is superseded: the user explicitly confirmed that missing districts must stay blank and affected rows must be held. The 118 identified isolated import fixtures were removed while preserving unrelated records and the prior restricted report. The final policy rehearsal below supersedes that candidate. The original workbook has no District column; verified postal lookup must not silently fill that missing source information in preservation imports.

Final policy rehearsal committed and independently reconciled all 211 rows on the corrected fixed build: zero created/updated/skipped, 134 held conflicts and 77 validation failures. Held conflicts comprise 118 missing-district rows, fourteen duplicate-email occurrences and two existing-identity conflicts. Every retained member address keeps its district blank. The persisted batch policy prevents updates, account provisioning and district derivation; the stored source hash matches the unchanged workbook. Accounts six, people eleven, memberships zero, mail jobs eight and invitations one remained unchanged. Repeated commit returned identical outcomes without changes. No source member has been imported into production.

The 77 validation failures comprise fifteen incomplete addresses, eleven ambiguous postal results and fifty-one unsupported/ambiguous cities. These rows need corrected authoritative information; the original workbook is preserved.

## Governance and payments

Eight supplied biographies, roles and confirmed photo associations are published in the isolated site. Originals are preserved; crops use only supplied pixels. An idempotent content rerun reused all eight records and portraits without creating duplicates. Photograph bytes match reviewed prepared-image hashes. Desktop, tablet and phone browser checks passed for images, full biography expansion, fallback avatars, responsive layout and sticky header.

Editorial approval preserves private member data and remains separate from professional verification. Its isolated HTTP test passed anonymous denial, stale review rejection, unchanged accepted private data and rejection of member changes through editorial approval.

Database/identity regression passed five checks, including repeatable migrations, wrong-target rejection, legacy profile preservation, private-document constraints, recovery and immediate session revocation. Baseline direct-profile governance tests require onboarding disabled; enabled-mode attempts to change authoritative application fields correctly returned conflicts. The backend workstream verifies the baseline disabled-mode suite separately.

Portrait HTTP regression passed owner/other-member isolation, private-before-publication access, explicit editorial approval/publication without professional verification, replacement privacy and withdrawal/object cleanup.

Bank-transfer support preserves account numbers as text and validates IFSC, bank and branch. Supplied bank instructions match exactly in the isolated member API. No invented UPI value is needed. Anonymous access is denied. Bank and existing UPI activation/privacy regression passed. Collection, settlement, reconciliation and refunds are not verified by displaying instructions.

## Recovery and pending verification

A restricted pre-import PostgreSQL backup was restored successfully into the isolated rehearsal database. Production backup freshness, database identity, migrations, deployment acceptance and independent production reconciliation remain required before completion.

The refreshed production snapshot restored successfully with six accounts, four people and one member profile, matching the unchanged source database. Its checksum and restore-database identifier are retained in the restricted backup evidence.

Bank browser acceptance passed on desktop, tablet and phone. Final no-district-inference reconciliation passed all counts, uniqueness, safe repeated commit and isolated single-member creation/edit/view/duplicate rejection. The final six-case bank/governance browser run passed on the corrected fixed build. The broader browser run passed thirty-four cases with eight intentional project skips; the focused follow-up passed twenty-two cases with two intentional matrix skips. Latest backend acceptance passed seventeen database/API checks plus one invitation enqueue failure-injection rollback check. The final visual matrix and header tests passed: five widths without overflow, header within 140 pixels and preview text contrast at least 4.5:1. The final six bank/governance cases also passed on that exact build (1.9 minutes). A scan of thirty-eight browser files found no configured secret values.

The first member commit request exceeded the client's five-minute header timeout while its server transaction continued. Recovery uses the same persisted batch ID, never a new batch. The operational client permits a bounded twenty-minute response. Slow import/proxy behavior remains a rollout consideration. Six identifiable payment-browser fixture accounts left by timed-out test teardown were removed only from the isolated database; the quiet restored account baseline is six. This test contamination must not be mistaken for import account creation.

[Railway request limits](https://docs.railway.com/networking/public-networking/specs-and-limits) close HTTP requests after five minutes of silence. A longer client timeout alone does not resolve that hosted edge limit. General hosted bulk-import responsiveness remains a release gate; an operational import can use the identical authenticated API on a loopback-only fixed-build executor connected to the explicitly verified hosted database, followed by independent database and hosted UI reconciliation.

The existing DELIVERY_CHECKLIST.md remains authoritative. Physical-device, broader accessibility/usability, outstanding recovery sign-in and exact legacy synthetic cleanup gates are retained. No full production-readiness claim is made.

Final narrow acceptance after the cached-policy and validation-link contrast fixes passed: two UI cases on the fixed build; two stale-policy rejections and two current-policy commits with identical replays. Isolated fixture cleanup passed. Production preflight still reports the expected database, four people and no normalized account-email collisions.
