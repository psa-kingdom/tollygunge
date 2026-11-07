# Finance approvals rollout

Implementation uses the existing portal theme and routes. Finance is event-based; overall expenses sum approved event expense sheets. Amounts are stored in paise. Existing data is migrated as legacy approved, including inferred original receipt baselines for historical refunds.

## Deployment order

1. Back up the target database using the established procedure. Apply migration 038 using migration credentials, never edit earlier migrations.
2. Apply the reviewed runtime grants in `scripts/security/web-permissions.json` and `database-permissions.mjs`: finance entries need SELECT/INSERT/UPDATE, proofs and history need SELECT/INSERT, and the history identity sequence needs USAGE. Do not grant DELETE on the ledger or proof tables.
3. Explicitly choose a verified existing account and run `node --env-file-if-exists=.env.local --import tsx scripts/setup-super-admin.mts --email VERIFIED_EMAIL --database EXPECTED_DATABASE`. This is never automatic. It creates no credentials and revokes affected sessions.
4. Deploy the application after migration and setup. Admin-created financial submissions stay blocked until super admin exists. Verify private object storage is configured before accepting proof uploads; unavailable storage fails visibly without saving a receipt.
5. Sign in again and verify an admin can submit and the super admin can review. Confirm historical balances and export parity before opening the workflow to members.

## Responsibilities

Admin and finance operator: enter receipts/refunds, draft event expense sheets, and review member payment proof. Super admin: review admin submissions and manage staff roles. Super admin cannot author financial entries or verify member receipts, including when the account also has the Admin role.

Member proof is mandatory (JPEG/PNG/PDF, 5 MB maximum). Admin receipt attachments are optional. Member submissions count only after admin approval; admin entries count only after super-admin approval. Refunds represent full refunds already made outside this application, and approval updates the registration status. No instalments or payment processing are introduced.

Each event has one currently approved expense sheet. Revisions include the complete replacement sheet. Pending edits leave the previous approved balance intact. Voiding a sheet or other-funds receipt creates a zero-value replacement with a reason. Participant receipt reversals use the full-refund workflow; participant receipt/refund metadata corrections retain the original amount. Closed events require reopening before corrections.

## Super-admin replacement

Use the same setup command with `--replace-email CURRENT_SUPER_ADMIN_EMAIL`. It validates the current holder, serializes against staff changes, demotes the previous holder to Admin, grants the new holder, records the operation, and revokes both accounts' sessions in one transaction. The unique partial index prevents concurrent multiple holders. Ordinary staff access editing cannot assign or remove the super-admin role.

## Verification

Run structure checking, typecheck, lint, unit tests, the isolated finance acceptance runner, finance browser specifications, and production build. Use synthetic local fixtures only. Finance exports use the same filtered projection as the screen; expense ranges apply to expense dates rather than approval dates. Consolidated exports contain summary, approved details, and separate pending sections, with no proof content or private storage URLs.

## Local acceptance command

Provide a dedicated synthetic PostgreSQL server on 127.0.0.1:55449 (override credentials through TPA_FINANCE_QA_DATABASE_URL). Run `node --import tsx scripts/test-finance.mts` after `npm run build`. The runner creates and removes its own database, mocks object storage, disables external HTTPS, and uses installed Edge (or TPA_BROWSER_CHANNEL) for desktop/mobile checks. Synthetic report and screenshot evidence is written under ignored `.local/finance/acceptance`.

## Verification record — 5 November 2026

Production build and TypeScript checks passed. All 147 unit tests and 9 participant-navigation browser tests passed. The isolated finance acceptance run passed migrations, historical balance preservation, proof ownership and upload, member rejection/resubmission, admin verification, concurrent approval protection, expense-sheet revisions and voids, refunds, date preservation, numeric Excel/PDF parity, member UI, desktop/mobile rendering, closed-event checks, and explicit super-admin replacement. The PDF was rendered and inspected across the first and continuation pages. New finance code passes lint. Repository-wide lint remains blocked by the pre-existing synchronous effect state update in `src/components/member-register.tsx:92` and existing unused-import warnings. Production migration, production role setup, and deployment were not performed.

## Platform admin setup

Existing Admin accounts can open Staff access, search for a verified account, select it, and choose **Make this account super admin**. This is a one-time initial assignment; the button disappears after assignment. Assignment is serialized, audited, and enforced by the singleton database index. Ordinary role changes remain restricted to super admin. The offline command remains available for recovery/replacement.

## Finance navigation — event-first layout

Finance has only Overview and Approvals at the workspace level. Overview shows lifetime approved collections, expenses, refunds, and net balance, followed by event cards with date, title, venue, and active participant count. Cards open a bookmarkable event finance page with Expenses and Participant collections tabs. Expense sheets are drafted and submitted inside the event; participant collections show expected fees, approved collections/refunds, and pending approval separately. Add fee collection is available from Overview and each event; the overview form requires choosing an event before selecting its participant. Selecting an event in this form does not filter the lifetime totals. The former Event accounts, Receipts, and Collection instructions workspace tabs are removed. Existing accounting approvals, private member proof, and exports are preserved. This navigation change requires no new database migration.

## Finance layout refinements

Overview supports Card view and List view, both showing each event's approved total collected and total spent. Add fee collection is aligned to the top right. Event export controls appear only on event pages. Event pages put the three-field collected/expenses/net summary beside the event name, outside both tab panels. Add Expense, Add fee collection, Export PDF, and Export Excel share the tab row. Refresh controls and redundant expense-sheet headings, author introductions, explanatory prose, and the duplicate event-result block are removed. Table column labels, submission status, and audited review access remain available.

Collection-account instructions are managed under Settings → Collection accounts. Finance retains only Overview and Approvals.
