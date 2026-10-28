# TPA testing handoff

Prepared 23 October 2026. Target: live website, with isolated technical tests. **All cases start Not run. No website tests have been executed by preparing this package.**

Use **TPA_TESTING_TRACKER.xlsx** as the results register. This guide supplies the execution rules and checklist. The tracker adds route/API/portal coverage, 12 full journeys, defects, upgrades and formula-based progress/sign-off checks.

## Start here

1. Record the exact deployed build, run ID, date/time in IST, tester, browser/device and enabled features. The local source candidate is not proof of live deployment.
2. Obtain individual test accounts for all six staff roles plus members A/B, unverified and invited states. Record aliases only. Keep credentials in the approved secret channel.
3. Confirm exact tagged synthetic fixtures, permitted publications/settings and approved recipient allowlist with the owner before live writes or sends. Missing approval/scope means Blocked.
4. Capture read-only baseline counts and current settings. Never edit the production database directly to manufacture states. Use supported UI/APIs and only approved QA records.
5. Run read-only smoke first, P0/P1 cases next, then complete E2E journeys, isolated technical checks, UX matrices, fixes/retests and cleanup reconciliation.
6. Record actual result, redacted evidence links, related IDs, tester/date/build and defect IDs. Reconcile UI, API, database, audit/jobs and actual provider/inbox outcomes where relevant.

**Stop immediately** for private-data exposure, wrong recipients, unrelated mutation or financial inconsistency. Record redacted evidence and notify the owner. Preserve audit/financial history.

## Application rules

- Account creation, email verification, profile verification, membership approval, payment status and public publication are independent.
- Payment references await authorized manual bank/UPI verification. QA requires no real transfer. A recorded refund does not move money.
- Queueing, provider acceptance, signed delivery events and actual inbox receipt are separate evidence. A mail sink cannot prove inbox receipt.
- Load, outage, malicious payload, migrations, backup restore, races and provider failures run only in isolation with external sending disabled or explicit QA allowlist.
- Global branding/homepage/requirements changes use an isolated clone by default. Live publication changes require exact approved test scope and restoration.
- Historical imports remain preview-only while commit is disabled. Do not assume online checkout, automatic refunds, automatic certificates, WhatsApp, OAuth or automated news collection are enabled.

## Workbook use

- **Start Here:** fill release/fixture/account details and explicit acceptance gates. Amber cells are editable.
- **Coverage Inventory:** review every page, API, subsection, database entity and integration. Static action/table extraction is partial: trace delegated services and add missing buttons/dialogs/actions. Add test IDs and data flow mapping. Set review to Reviewed only after reconciling live deployment.
- **Test Cases:** filter Module, Priority, Environment and Status. IDs are stable references. Each row has steps, preconditions, expected result, evidence type and cleanup. Scroll horizontally for results/evidence; identifying columns and headers stay frozen.
- **End-to-End Journeys:** execute each entire workflow and record independent outcome/evidence, not a guessed roll-up from unit cases.
- **Defects:** log reproducible expected/actual behavior, severity, build, owner, fix and retest. Critical/High exceptions never satisfy readiness.
- **UX and Upgrades:** record observed friction, frequency, proposed improvement, measurable benefit, effort and dependencies separately from defects.
- **Summary and Sign-off:** counts update from entered results. P0/P1 exclusions, unexplained statuses, missing evidence, unfinished coverage/journeys, open Critical/High defects and incomplete human gates prevent eligibility. Only owner sign-off can declare Ready. Do not count excluded/not-deployed cases as passes.

Statuses: **Not run, Pass, Fail, Blocked, Not deployed, Not applicable**. Blocked/Not deployed/Not applicable require actual-result explanation plus a reason. Pass requires actual result, evidence and tester/date/build. A retest result is recorded separately; update current case status only after the fix is verified and retain original failure evidence.

Priorities: **P0** privacy/permissions/identity/payment/integrity/recipients; **P1** core workflows/reliability; **P2** presentation/convenience. Defect severity: **Critical** leakage/corruption/escalation/financial or recipient errors; **High** blocked core flow/no practical workaround; **Medium** partial failure with workaround; **Low** cosmetic/minor issue.

Add new cases inside the TestCases table with unique IDs, copy the Evidence check formula and keep IDs attached to findings during sorting. Summary ranges support rows through 10000; extend them if needed. Defect/upgrade starter rows are blank templates, not discovered issues.

## Repeatable role and device matrices

Test administrator, membership_reviewer, content_editor, event_operator, communications_operator and finance_operator separately, then explicit combined permissions where required. Reviewer has member/document review; editor content; event operator events; communications operator communications; finance operator payments; administrator all. Reports and compound event operations still enforce action-specific requirements.

For each listed member/admin subsection inspect desktop 1440, tablet 768, phone 390 and narrow 320 widths, 200% zoom, long text and supported themes. Record actual browser versions; use available Chrome/Edge/Firefox/Safari and real Android/iPhone devices. Missing access/device is a blocker, not a pass. Check keyboard focus, dialog Escape/focus return, screen-reader labels/announcements, contrast, table scrolling, validation, loading/empty/error states and retained input.

## Technical execution and evidence

Use browser Network to obtain the exact current request schema. On an isolated app/database replay valid, missing/invalid and wrong-role/wrong-owner actions with synthetic IDs. Auth/token/publication endpoints have distinct policies; never assume every API should return 200 or every anonymous request 401. Inspect route and delegated services before asserting exact state/status.

Use read-only production queries to reconcile exact owned IDs and before/after state. Do not export real directories. Inspect foreign keys, unique constraints, ownership, integer paise, transitions and append-only history. Compare deployed migration ledger/checksums to deployed source; rehearse migration/restore separately. For files compare intended bytes and current eligibility, including direct URL denial. Record exact query text with parameters redacted and row counts/IDs, not sensitive row bodies.

Relevant existing commands include `npm run check:structure`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:events`, `npm run test:onboarding` and browser/database suites. **Do not blindly run integration commands against live configuration.** Some scripts load `.env.local`; inspect guards and target first, use a disposable database and provider-disabled environment. Preparing this handoff does not run those suites.

Performance review targets are provisional until confirmed: LCP <=2.5s, CLS <=0.1 and INP <=200ms where measurable. Distinguish lab samples from field data. For isolated load, confirm capped budget/telemetry first; start at 5/10/25/50 active users and stop at first failed stage. Proposed pass: <1% unexpected errors, read p95<1s, login/write p95<2s, zero integrity violations. Stop immediately for leakage/corruption or after sustained >2% errors/p95>5s, CPU/memory >85% or database saturation >80%. Record duration, mix, think time and tested ceiling; never infer capacity from serial samples.

Recovery must restore to an isolated environment with live external credentials/sending disabled. Reconcile schema, accounts, memberships, bookings, payments, files and queued jobs, then measure recovery time/data loss against owner-approved RTO/RPO. Missing targets/evidence remain visible blockers.

## Mandatory complete journeys

### E2E-01 — New member to reviewed profile

- [ ] **Live - tagged fixture**. Signup; receive verification in actual inbox; follow link; complete application/evidence; submit; reviewer requests correction; member resubmits; reviewer approves.
- Expected: Correct identity and saved evidence; explicit review history; email/profile/membership/payment/publication states remain separate.
- Evidence: linked IDs, UI/API/DB/audit/jobs and applicable actual inbox/file proof for the same build.

### E2E-02 — Imported member activation

- [ ] **Live - tagged fixture**. Preview small QA batch; review commit; reconcile links and invitation holds; review exact QA recipient; approved release; inbox link; set password; fresh login.
- Expected: Only intended identities/jobs; no duplicate records or credential replacement; intended recipient only.
- Evidence: linked IDs, UI/API/DB/audit/jobs and applicable actual inbox/file proof for the same build.

### E2E-03 — Free event lifecycle

- [ ] **Live - tagged fixture**. Draft/publish free QA event; member registers; open confirmation inbox; mark attendance; finalize/complete after prerequisites; inspect member history.
- Expected: One booking, correct mail, evidenced attendance and accurate event history/badge.
- Evidence: linked IDs, UI/API/DB/audit/jobs and applicable actual inbox/file proof for the same build.

### E2E-04 — Paid event and confirmation

- [ ] **Live - tagged fixture**. Create paid QA event; publish; book; inspect instructions; submit synthetic reference; finance manually confirms tagged test booking; inspect inbox and member history.
- Expected: Correct fee/payee; no auto-paid state; one authorized transition and immutable history; no actual transfer required.
- Evidence: linked IDs, UI/API/DB/audit/jobs and applicable actual inbox/file proof for the same build.

### E2E-05 — Cancellation and recorded refund

- [ ] **Live - tagged fixture**. Cancel paid tagged booking; review refund need; authorized staff record synthetic refund; compare history and independently reconcile totals.
- Expected: Cancellation, recorded refund and external transfer remain distinct; receipt/refund history retained.
- Evidence: linked IDs, UI/API/DB/audit/jobs and applicable actual inbox/file proof for the same build.

### E2E-06 — Reminder eligibility changes

- [ ] **Isolated only**. Configure offsets; book and alter booking/payment/event revision; advance isolated clock; inspect eligible and skipped jobs and sink messages.
- Expected: Only currently eligible recipient/revision receives valid reminder; obsolete jobs skipped once.
- Evidence: linked IDs, UI/API/DB/audit/jobs and applicable actual inbox/file proof for the same build.

### E2E-07 — Campaign and unsubscribe

- [ ] **Live - tagged fixture**. Create draft; independently reconcile QA audience; review exact allowlist; dispatch once; inspect actual inbox; unsubscribe; preview subsequent eligible audience.
- Expected: One intended message per recipient; actual receipt distinguished from acceptance; unsubscribe respected.
- Evidence: linked IDs, UI/API/DB/audit/jobs and applicable actual inbox/file proof for the same build.

### E2E-08 — Inquiry to closure

- [ ] **Live - tagged fixture**. Submit tagged inquiry; assign; note follow-up; use supported inbox linkage/reply if available to approved correspondent; close; inspect report/history.
- Expected: Correct CRM history and supported communication; unsupported linkage explicitly noted.
- Evidence: linked IDs, UI/API/DB/audit/jobs and applicable actual inbox/file proof for the same build.

### E2E-09 — Editorial publication lifecycle

- [ ] **Live - tagged fixture**. Create QA content/media/profile drafts; review/preview; publish approved test records; edit without publish; withdraw/archive; verify public access at every stage.
- Expected: Published snapshots/private assets preserved and removal reflected correctly.
- Evidence: linked IDs, UI/API/DB/audit/jobs and applicable actual inbox/file proof for the same build.

### E2E-10 — Event benefits and access

- [ ] **Live - tagged fixture**. Configure resources; register A/B; mark A present B absent; finalize/complete with required roles; inspect badges/perks/resource direct access; revoke test perk.
- Expected: Only eligible current member gets appropriate resources/badge/perk; B denied where ineligible.
- Evidence: linked IDs, UI/API/DB/audit/jobs and applicable actual inbox/file proof for the same build.

### E2E-11 — Revoked staff authorization

- [ ] **Live - tagged fixture**. Open owned QA staff session and report; revoke its role; repeat action/direct API/export with stale UI; restore intended test role after evidence.
- Expected: Revocation enforced on server and data/export access; no stale privilege bypass.
- Evidence: linked IDs, UI/API/DB/audit/jobs and applicable actual inbox/file proof for the same build.

### E2E-12 — Failure and recovery

- [ ] **Isolated only**. Induce isolated failure during transaction/worker job; retry/restart; reconcile rows/jobs/objects; restore isolated backup with external sending disabled.
- Expected: No lost/duplicate committed work; usable restored data and recovery timing evidence; no live sends.
- Evidence: linked IDs, UI/API/DB/audit/jobs and applicable actual inbox/file proof for the same build.

## Categorised execution checklist

Each item below maps to the same stable ID in Test Cases. Detailed route/API and per-portal UX matrices continue in the workbook.

### A. Preparation and inventory

Entry points: `All routes / Start Here`

- [ ] **QA-0001 — Release identity** (P1; Live - read-only)
  - Steps: Record live URL, build/commit, deployment date, enabled features and tester browser/device in Start Here. Compare against the agreed candidate.
  - Expected: Release identity is known; candidate-only features are labelled Not deployed, with evidence.
- [ ] **QA-0002 — Approved fixture scope** (P1; Live - read-only)
  - Steps: List exact QA accounts, event/content IDs, recipient allowlist and permitted shared-setting changes before writes.
  - Expected: Each live write/send has a defined test scope; missing scope is Blocked.
- [ ] **QA-0003 — Test account matrix** (P1; Live - read-only)
  - Steps: Obtain six separate staff-role accounts, members A/B, an unverified account and held invitation account. Record aliases only.
  - Expected: Accounts reflect intended roles and lifecycle states; no credentials appear in tracker.
- [ ] **QA-0004 — Baseline and cleanup register** (P1; Live - read-only)
  - Steps: Capture affected entity counts and current shared settings using read-only queries; list owned fixtures and restoration steps.
  - Expected: Before/after reconciliation is possible without deleting audit or financial records.
- [ ] **QA-0005 — Inventory reconciliation** (P1; Live - read-only)
  - Steps: Compare Coverage Inventory to navigation and visible live tabs, controls and dialogs. Add missing rows and link tests.
  - Expected: Every discovered surface has test IDs; implementation and live discrepancies remain explicit.
- [ ] **QA-0006 — Evidence hygiene** (P1; Live - read-only)
  - Steps: Create run folders named by build/date/case ID; redact emails where necessary, tokens, headers and private documents.
  - Expected: Shareable evidence links identify test, environment and build without exposing secrets.

### B. Public website

Entry points: `/ /about /governance /membership /events /resources /contact`

- [ ] **QA-0007 — Published page copy** (P1; Live - read-only)
  - Steps: Open each public page and compare with saved published snapshots and approved content.
  - Expected: Headings, sections, copy and listings match current publication, with no draft leakage.
- [ ] **QA-0008 — Header navigation** (P1; Live - read-only)
  - Steps: Open every top-level menu and submenu by mouse, touch and keyboard; follow each destination.
  - Expected: Correct destinations and section anchors; visible active state and accessible menus.
- [ ] **QA-0009 — Footer and contact links** (P1; Live - read-only)
  - Steps: Follow footer, email, phone, external links and primary calls to action.
  - Expected: Destinations and contact details are correct; external links behave safely.
- [ ] **QA-0010 — Direct detail links** (P1; Live - read-only)
  - Steps: Open published event, article, flyer, media and download links in an anonymous fresh window.
  - Expected: Correct item and bytes display; no accidental dependency on prior navigation.
- [ ] **QA-0011 — Draft privacy** (P1; Live - read-only)
  - Steps: Try known QA draft and withdrawn item URLs without signing in.
  - Expected: Unpublished items expose no private content and receive intended denial/fallback.
- [ ] **QA-0012 — Restricted event privacy** (P1; Live - read-only)
  - Steps: Open a member-only QA event/resource as anonymous and member B without entitlement.
  - Expected: Access follows configured visibility; no private attendee or finance data leaks.
- [ ] **QA-0013 — Missing item recovery** (P1; Live - read-only)
  - Steps: Open nonexistent item IDs/slugs and an invalid page URL.
  - Expected: Useful 404/unavailable state and working recovery navigation; no stack trace.
- [ ] **QA-0014 — Empty listings** (P1; Live - read-only)
  - Steps: Use isolated empty fixtures or existing empty sections without deleting live data.
  - Expected: Meaningful empty state and appropriate next action, with no broken layout.
- [ ] **QA-0015 — Metadata and indexing** (P1; Live - read-only)
  - Steps: Inspect title, description, configured sharing metadata and robots for public/private routes.
  - Expected: Published metadata is accurate; private routes are not offered for indexing.
- [ ] **QA-0016 — Demo boundary** (P1; Live - read-only)
  - Steps: Open /join and /preview/admin, including direct preview workspace links.
  - Expected: Demonstrations are clearly labelled and cannot imply a real application/payment completion.

### C. Authentication

Entry points: `/signup /login /invitation /email-verification /forgot-password /reset-password`

- [ ] **QA-0017 — Valid signup** (P0; Live - tagged fixture)
  - Steps: Create one uniquely named QA account, then inspect account/profile/membership state.
  - Expected: One account with ordinary access; no automatic staff role or membership approval.
- [ ] **QA-0018 — Required signup fields** (P0; Live - tagged fixture)
  - Steps: Submit with each required field missing, one at a time.
  - Expected: Field-level guidance and no incomplete account creation.
- [ ] **QA-0019 — Invalid signup email** (P0; Live - tagged fixture)
  - Steps: Submit malformed email variants and leading/trailing whitespace.
  - Expected: Validation/normalization follows contract; no unintended identity created.
- [ ] **QA-0020 — Password boundaries** (P0; Live - tagged fixture)
  - Steps: Try below-minimum, boundary-valid and invalid-policy passwords using test accounts.
  - Expected: Server and UI enforce the same policy; errors retain safe input.
- [ ] **QA-0021 — Duplicate signup** (P0; Live - tagged fixture)
  - Steps: Repeat signup for a QA email with case/whitespace variants.
  - Expected: Existing identity is protected; no duplicate identity or credential replacement.
- [ ] **QA-0022 — Verification receipt** (P0; Live - tagged fixture)
  - Steps: Trigger verification once and open actual approved inbox, including junk folder.
  - Expected: Message arrives for intended account; record queue/provider/inbox outcomes separately.
- [ ] **QA-0023 — Verification completion** (P0; Live - tagged fixture)
  - Steps: Open the exact verification link and sign in as its recipient.
  - Expected: Email becomes verified once; profile/membership/publication states remain independent.
- [ ] **QA-0024 — Verification resend** (P0; Live - tagged fixture)
  - Steps: Resend for the QA account and inspect UI, jobs and received mail.
  - Expected: Correct recipient, bounded resend behavior and no unintended repeated sends.
- [ ] **QA-0025 — Expired verification link** (P0; Isolated only)
  - Steps: Create an expired token fixture and open its link.
  - Expected: Clear expiration and safe resend path; account stays unverified.
- [ ] **QA-0026 — Reused verification link** (P0; Live - tagged fixture)
  - Steps: Open the already-consumed QA link again.
  - Expected: No unintended account change or token reuse; outcome matches link contract.
- [ ] **QA-0027 — Malformed verification link** (P0; Live - tagged fixture)
  - Steps: Open missing/invalid token variants without brute force.
  - Expected: Safe error; no sensitive token/account detail exposed.
- [ ] **QA-0028 — Invitation activation** (P0; Live - tagged fixture)
  - Steps: Use one approved held QA invitation, set a valid password and perform a fresh login.
  - Expected: Invited identity is activated once; related records are preserved.
- [ ] **QA-0029 — Expired invitation** (P0; Isolated only)
  - Steps: Open a deliberately expired isolated invitation.
  - Expected: Activation denied with recovery path; no credential creation.
- [ ] **QA-0030 — Reused invitation** (P0; Live - tagged fixture)
  - Steps: Repeat activation using the consumed QA link.
  - Expected: No credential replacement, duplicate identity or extra activation send.
- [ ] **QA-0031 — Wrong signed-in verification identity** (P0; Live - tagged fixture)
  - Steps: Open member A verification link while signed in as member B.
  - Expected: Target identity is explicit; no silent verification of B or unintended session crossover.
- [ ] **QA-0032 — Wrong signed-in invitation identity** (P0; Live - tagged fixture)
  - Steps: Open member A invitation while signed in as member B.
  - Expected: Explicit target and account-switch behavior; B remains protected.
- [ ] **QA-0033 — Wrong signed-in reset identity** (P0; Live - tagged fixture)
  - Steps: Open member A reset while signed in as member B.
  - Expected: Password reset applies only to A; no disclosure or change to B.
- [ ] **QA-0034 — Successful login** (P0; Live - tagged fixture)
  - Steps: Sign in using each assigned staff account and member A.
  - Expected: Correct role-aware destination and accessible permitted workspaces.
- [ ] **QA-0035 — Incorrect login** (P0; Live - tagged fixture)
  - Steps: Use incorrect password and unknown synthetic email once each.
  - Expected: Safe error; no account enumeration beyond documented contract.
- [ ] **QA-0036 — Account switching** (P0; Live - tagged fixture)
  - Steps: Use explicit switch-account navigation from an existing test session.
  - Expected: Correct new identity and no stale prior-account data.
- [ ] **QA-0037 — Persistent login** (P0; Live - tagged fixture)
  - Steps: Compare selected/unselected keep-signed-in behavior in a test browser restart.
  - Expected: Session lifetime follows configuration; no accidental cross-account persistence.
- [ ] **QA-0038 — Session expiry** (P0; Isolated only)
  - Steps: Expire an isolated session, then use a stale page and API request.
  - Expected: Reauthentication required; failed mutation does not persist.
- [ ] **QA-0039 — Logout and Back** (P0; Live - tagged fixture)
  - Steps: Logout, use browser Back and reload protected pages/direct APIs.
  - Expected: No usable private content or authenticated action survives logout.
- [ ] **QA-0040 — Forgot password delivery** (P0; Live - tagged fixture)
  - Steps: Request reset for QA account and inspect actual approved inbox.
  - Expected: Correct recipient and destination; no reset secrets in logs/tracker.
- [ ] **QA-0041 — Reset completion** (P0; Live - tagged fixture)
  - Steps: Reset QA password, test old/new login and session policy.
  - Expected: New credential works; old credential fails; sessions follow documented revocation policy.
- [ ] **QA-0042 — Expired password reset** (P0; Isolated only)
  - Steps: Open an expired isolated reset token.
  - Expected: Reset rejected without changing credentials.
- [ ] **QA-0043 — Reused password reset** (P0; Live - tagged fixture)
  - Steps: Reuse consumed QA reset link.
  - Expected: No second credential change.
- [ ] **QA-0044 — Change password** (P0; Live - tagged fixture)
  - Steps: Change password using correct and incorrect current password.
  - Expected: Correct change persists; incorrect current password cannot authorize change.
- [ ] **QA-0045 — Authentication error hygiene** (P0; Live - tagged fixture)
  - Steps: Inspect UI, response bodies and browser console during failed QA actions.
  - Expected: No raw secrets, SQL errors, internal stack traces or unnecessary identity data.
- [ ] **QA-0046 — Optional provider sign-in** (P0; Live - tagged fixture)
  - Steps: If enabled, complete provider sign-in with approved QA identity and cancellation path.
  - Expected: Correct account linking/redirect; disabled capability is explicitly recorded.

### D. Application and verification

Entry points: `/member/application /admin/workspaces/verification`

- [ ] **QA-0047 — Professional application** (P1; Live - tagged fixture)
  - Steps: Complete every application step with valid professional fixture.
  - Expected: All applicable fields persist and review summary matches saved data.
- [ ] **QA-0048 — Student application** (P1; Live - tagged fixture)
  - Steps: Complete the supported student branch with synthetic details.
  - Expected: Only applicable requirements are enforced; no professional-only blocker.
- [ ] **QA-0049 — Required and conditional fields** (P1; Live - tagged fixture)
  - Steps: Omit each mandatory/conditional field and attempt next/submit.
  - Expected: Clear field guidance; server rejects incomplete application.
- [ ] **QA-0050 — Field format boundaries** (P1; Live - tagged fixture)
  - Steps: Try long text, Unicode, invalid contact formats and exact supported limits.
  - Expected: Correct validation without truncation or silent data loss.
- [ ] **QA-0051 — Postal selection** (P1; Live - tagged fixture)
  - Steps: Select state/district/city/postal values and change parent selections.
  - Expected: Dependent values stay valid; unavailable location data has clear handling.
- [ ] **QA-0052 — Save and reload** (P1; Live - tagged fixture)
  - Steps: Enter a partial application, wait for save confirmation, reload.
  - Expected: Saved values match and no submission is implied.
- [ ] **QA-0053 — Leave and resume** (P1; Live - tagged fixture)
  - Steps: Leave the application, sign out/in or use another approved device, resume.
  - Expected: Saved progress and owned evidence remain accessible.
- [ ] **QA-0054 — Offline save recovery** (P1; Isolated only)
  - Steps: Disconnect isolated browser during autosave; edit and reconnect.
  - Expected: Unsaved state is visible; retry preserves input without false saved status.
- [ ] **QA-0055 — Rapid edit ordering** (P1; Isolated only)
  - Steps: Make rapid isolated edits with delayed responses.
  - Expected: Latest intended data persists; old responses do not overwrite it.
- [ ] **QA-0056 — Two-tab conflict** (P1; Live - tagged fixture)
  - Steps: Edit the same QA application from two sessions/tabs.
  - Expected: Stale save is rejected or reconciled explicitly; no silent overwrite.
- [ ] **QA-0057 — Photo upload** (P1; Live - tagged fixture)
  - Steps: Upload a supported synthetic portrait and revisit application.
  - Expected: Correct owned file and preview persist.
- [ ] **QA-0058 — Evidence upload** (P1; Live - tagged fixture)
  - Steps: Upload each supported synthetic evidence format and inspect reviewer download.
  - Expected: Correct file bytes, MIME and ownership are preserved.
- [ ] **QA-0059 — Upload replacement** (P1; Live - tagged fixture)
  - Steps: Replace QA evidence/photo and verify current reference and retained history.
  - Expected: Intended replacement appears; unrelated files remain unchanged.
- [ ] **QA-0060 — Upload removal** (P1; Live - tagged fixture)
  - Steps: Remove a removable owned QA file and inspect application state.
  - Expected: References and required-field validation update correctly.
- [ ] **QA-0061 — Invalid upload** (P1; Isolated only)
  - Steps: Try wrong type, renamed invalid file, empty file and size boundary in isolation.
  - Expected: Server validates type/content/size and leaves no broken active reference.
- [ ] **QA-0062 — Submission email gate** (P1; Live - tagged fixture)
  - Steps: Attempt submission with a complete but unverified QA account.
  - Expected: Submission follows verification prerequisite; no false success.
- [ ] **QA-0063 — Valid submission** (P1; Live - tagged fixture)
  - Steps: Submit a complete verified QA application once and retry.
  - Expected: One review submission with accurate member/staff state.
- [ ] **QA-0064 — Request correction** (P1; Live - tagged fixture)
  - Steps: Reviewer inspects owned QA evidence and requests specific corrections.
  - Expected: Member sees actionable feedback; review history identifies actor/time.
- [ ] **QA-0065 — Correct and resubmit** (P1; Live - tagged fixture)
  - Steps: Member edits requested details and resubmits.
  - Expected: New proposal/version is reviewed; prior history remains intact.
- [ ] **QA-0066 — Approve review** (P1; Live - tagged fixture)
  - Steps: Reviewer approves the QA proposal.
  - Expected: Correct accepted profile/verification state; no unrelated payment/membership/publication grant.
- [ ] **QA-0067 — Reject review** (P1; Live - tagged fixture)
  - Steps: Reviewer rejects a separate QA proposal with a reason.
  - Expected: Accurate rejected state and feedback; no accepted data overwritten improperly.
- [ ] **QA-0068 — Review stale version** (P1; Live - tagged fixture)
  - Steps: Two reviewers act on the same QA version.
  - Expected: Only valid current action succeeds; conflicting decision is visible.
- [ ] **QA-0069 — Requirements versioning** (P1; Isolated only)
  - Steps: Publish an isolated mandatory requirement after existing profile verification.
  - Expected: Existing badge and update-needed behavior follow versioned contract; data preserved.
- [ ] **QA-0070 — Evidence privacy** (P0; Live - tagged fixture)
  - Steps: Member B and anonymous user open member A evidence/list URLs.
  - Expected: No private bytes, names or listing leak; reviewer access is appropriately authorized/audited.

### E. Member portal

Entry points: `/member /account/profile /member/events /member/payments /member/inquiries /member/security`

- [ ] **QA-0071 — Dashboard states** (P1; Live - tagged fixture)
  - Steps: Visit dashboard with incomplete, submitted and verified QA profiles.
  - Expected: Cards, status labels and next actions reflect each state accurately.
- [ ] **QA-0072 — Profile editing** (P1; Live - tagged fixture)
  - Steps: Edit permitted profile fields and reload; inspect downstream accepted/proposed usage.
  - Expected: Changes persist through intended review path; no public bypass.
- [ ] **QA-0073 — Communication preferences** (P1; Live - tagged fixture)
  - Steps: Toggle optional contact/newsletter preferences on a QA member.
  - Expected: UI, database and campaign eligibility agree.
- [ ] **QA-0074 — Portrait review** (P1; Live - tagged fixture)
  - Steps: Replace QA portrait through member flow and inspect public/accepted states.
  - Expected: Review/publication boundaries and private evidence remain distinct.
- [ ] **QA-0075 — Member navigation** (P1; Live - tagged fixture)
  - Steps: Follow every member section and return path, including account/security.
  - Expected: No dead ends or stale selected section; correct identity remains visible.
- [ ] **QA-0076 — Own event history** (P1; Live - tagged fixture)
  - Steps: Compare upcoming/past events and selected-event continuation with QA registration records.
  - Expected: Correct ordering, status and booking details for current member.
- [ ] **QA-0077 — Own payment history** (P1; Live - tagged fixture)
  - Steps: Compare displayed payments/refunds with append-only QA transitions.
  - Expected: Amounts and states match; no unsupported transfer claim.
- [ ] **QA-0078 — Own inquiries** (P1; Live - tagged fixture)
  - Steps: Create/view QA inquiry and compare with CRM record.
  - Expected: Only own inquiry data appears with permitted status details.
- [ ] **QA-0079 — Cross-member access** (P0; Live - tagged fixture)
  - Steps: Attempt A-owned event journey, inquiry, payment and document requests as B.
  - Expected: No other-account records or private resources are exposed.
- [ ] **QA-0080 — Badge and perk projection** (P1; Live - tagged fixture)
  - Steps: Compare member journey to recorded attendance and active entitlements.
  - Expected: Only evidenced eligible milestones/perks appear.
- [ ] **QA-0081 — Membership and renewal policy** (P1; Live - tagged fixture)
  - Steps: Compare displayed plan/renewal/benefit actions against approved enabled policy.
  - Expected: No invented entitlement or successful renewal; unavailable policy is Blocked/Not applicable with reason.

### F. CRM and inquiries

Entry points: `/contact /member/inquiries /admin/workspaces/crm`

- [ ] **QA-0082 — Public inquiry intake** (P1; Live - tagged fixture)
  - Steps: Submit one tagged contact inquiry with chosen consent options.
  - Expected: Correct contact/provenance stored; clear receipt without account/subscription creation.
- [ ] **QA-0083 — Member inquiry intake** (P1; Live - tagged fixture)
  - Steps: Submit a tagged inquiry while signed in.
  - Expected: Correct account linkage and private staff/member views.
- [ ] **QA-0084 — Inquiry validation** (P1; Live - tagged fixture)
  - Steps: Submit missing consent/required details and invalid contact data using fixtures.
  - Expected: Clear validation; no malformed inquiry accepted.
- [ ] **QA-0085 — Inquiry retry** (P1; Live - tagged fixture)
  - Steps: Retry one identical tagged submission after uncertain response.
  - Expected: Idempotency follows contract; no unintended duplicates.
- [ ] **QA-0086 — Anti-abuse intake** (P1; Isolated only)
  - Steps: Exercise honeypot, quotas and request boundaries in isolation.
  - Expected: Rejected abusive requests do not create records or affect legitimate identities.
- [ ] **QA-0087 — Inquiry search** (P1; Live - tagged fixture)
  - Steps: Search exact/partial QA contact/name text and clear filters.
  - Expected: Correct matching records and reset behavior.
- [ ] **QA-0088 — Inquiry filters and pagination** (P1; Live - tagged fixture)
  - Steps: Combine status/tag/follow-up filters over multi-page fixtures.
  - Expected: Filter-before-pagination behavior, stable ordering and accurate totals.
- [ ] **QA-0089 — Assignment** (P1; Live - tagged fixture)
  - Steps: Assign and reassign tagged inquiry to allowed staff.
  - Expected: Current assignee and immutable history match.
- [ ] **QA-0090 — Notes and tags** (P1; Live - tagged fixture)
  - Steps: Add/edit supported note/tag actions on QA inquiry.
  - Expected: Saved text is safe; private details stay staff-only.
- [ ] **QA-0091 — Follow-up dates** (P1; Live - tagged fixture)
  - Steps: Set today, past and future follow-ups around IST midnight.
  - Expected: Overdue/current labels match India-date rules.
- [ ] **QA-0092 — Status transitions** (P1; Live - tagged fixture)
  - Steps: Move QA inquiry through New, Contacted and Closed; test supported reopening.
  - Expected: State, timestamps and audit remain consistent.
- [ ] **QA-0093 — Concurrent CRM edit** (P1; Live - tagged fixture)
  - Steps: Edit same QA inquiry from two tabs.
  - Expected: Stale update is surfaced; notes/history not silently lost.
- [ ] **QA-0094 — CRM permissions** (P1; Live - tagged fixture)
  - Steps: Read and mutate QA inquiry as unrelated staff role/member/anonymous.
  - Expected: Server denial with no private data or mutation.

### G. Register and onboarding

Entry points: `/admin/workspaces/members /admin/workspaces/onboarding`

- [ ] **QA-0095 — Identity boundaries** (P1; Live - tagged fixture)
  - Steps: Follow QA Person, Membership and User Account links by exact ID.
  - Expected: Separate entities link correctly; counts/statuses are not conflated.
- [ ] **QA-0096 — Directory search** (P1; Live - tagged fixture)
  - Steps: Search QA records using each supported identifier and direct ID link.
  - Expected: Correct record across pagination; no same-name accidental selection.
- [ ] **QA-0097 — Directory filtering** (P1; Live - tagged fixture)
  - Steps: Combine supported verification/contact/review filters and compare database query.
  - Expected: Matching rows and totals agree with reports.
- [ ] **QA-0098 — Accepted versus proposed details** (P1; Live - tagged fixture)
  - Steps: Submit pending QA profile change and inspect directory/reviewer views.
  - Expected: Accepted details remain identifiable; proposals are labelled.
- [ ] **QA-0099 — CSV import preview** (P1; Live - tagged fixture)
  - Steps: Preview synthetic CSV with explicit mapping and inspect all rows.
  - Expected: Mapping, row counts and validation are understandable; no commit/send occurs.
- [ ] **QA-0100 — XLSX import preview** (P1; Live - tagged fixture)
  - Steps: Preview equivalent synthetic workbook and compare parsed values/types.
  - Expected: Equivalent records preserve intended data without formula execution.
- [ ] **QA-0101 — Import invalid rows** (P1; Live - tagged fixture)
  - Steps: Preview missing columns, malformed fields, duplicate IDs/emails and ambiguous existing identities.
  - Expected: Row-level errors prevent unintended provisioning/merge.
- [ ] **QA-0102 — Reviewed import commit** (P1; Live - tagged fixture)
  - Steps: Commit a small approved QA-only reviewed batch once.
  - Expected: Only reviewed eligible rows create intended links; counts reconcile.
- [ ] **QA-0103 — Import replay and retry** (P1; Isolated only)
  - Steps: Replay commit after simulated lost response.
  - Expected: Same logical result; no duplicate person/membership/account/invitation.
- [ ] **QA-0104 — Stale import review** (P1; Isolated only)
  - Steps: Change mapping/source/version after review and attempt commit.
  - Expected: Stale authorization rejected and fresh review required.
- [ ] **QA-0105 — Interrupted import job** (P1; Isolated only)
  - Steps: Stop/restart isolated import processing mid-batch.
  - Expected: Job resumes or reports precise partial outcome without duplicates.
- [ ] **QA-0106 — Invitation hold** (P1; Live - tagged fixture)
  - Steps: Inspect imported QA held identity and mail/token tables before release.
  - Expected: No activation token/job/send exists until permitted release action.
- [ ] **QA-0107 — Controlled invitation release** (P1; Live - tagged fixture)
  - Steps: Review exact QA recipients then explicitly confirm approved test release.
  - Expected: Only reviewed recipients get one invitation; activation/login completes.
- [ ] **QA-0108 — Credential preservation** (P1; Live - tagged fixture)
  - Steps: Compare existing QA identity links and credential hashes before/after supported import.
  - Expected: No silent account merge, password overwrite or unrelated identity change.

### H. Event creation and booking

Entry points: `/admin/workspaces/events /events/[id] /member/events`

- [ ] **QA-0109 — Free event draft** (P1; Live - tagged fixture)
  - Steps: Create tagged free event with venue, valid IST dates, capacity and booking window.
  - Expected: Draft persists; no public publication or payment requirement.
- [ ] **QA-0110 — Paid event draft** (P1; Live - tagged fixture)
  - Steps: Create tagged paid event with fee, selected payment account and joining details.
  - Expected: Amounts/instructions saved correctly; publication remains explicit.
- [ ] **QA-0111 — Invalid event dates** (P1; Live - tagged fixture)
  - Steps: Try end before start, invalid booking order and unsupported date values.
  - Expected: Server validation rejects invalid event state.
- [ ] **QA-0112 — Fee and capacity boundaries** (P1; Isolated only)
  - Steps: Test permitted minimum/maximum values and invalid values in isolated fixtures.
  - Expected: Integer/precision/capacity rules enforced consistently.
- [ ] **QA-0113 — Speaker add** (P1; Live - tagged fixture)
  - Steps: Add supported speaker records with names/credentials.
  - Expected: Canonical event speaker list persists and is reused in views/flyers.
- [ ] **QA-0114 — Speaker edit remove reorder** (P1; Live - tagged fixture)
  - Steps: Change speaker text/order and remove a QA speaker.
  - Expected: Ordered list stays consistent across previews and exports.
- [ ] **QA-0115 — Speaker count and long text** (P1; Live - tagged fixture)
  - Steps: Exercise 1/2/3/6 speakers, maximum text and unsupported extra speaker.
  - Expected: Supported layouts remain readable; unsupported input is clearly rejected.
- [ ] **QA-0116 — Publish event** (P1; Live - tagged fixture)
  - Steps: Preview and explicitly publish a saved tagged event.
  - Expected: Correct visibility and canonical facts appear on intended listing/detail pages.
- [ ] **QA-0117 — Member-only continuation** (P1; Live - tagged fixture)
  - Steps: Open restricted event link signed out, sign in/signup as QA account.
  - Expected: Selected event continues correctly without granting unrelated access.
- [ ] **QA-0118 — Single registration** (P1; Live - tagged fixture)
  - Steps: Register QA member for a published available event.
  - Expected: One active booking with correct fee/payment state and confirmation job.
- [ ] **QA-0119 — Duplicate registration retry** (P1; Live - tagged fixture)
  - Steps: Double-click and repeat same QA registration after refresh.
  - Expected: One logical booking and no duplicate confirmation.
- [ ] **QA-0120 — Booking before open** (P1; Live - tagged fixture)
  - Steps: Attempt booking on a QA event whose window has not opened.
  - Expected: No booking; accurate availability message.
- [ ] **QA-0121 — Booking after close** (P1; Live - tagged fixture)
  - Steps: Attempt booking on closed QA event.
  - Expected: No booking despite stale page/direct request.
- [ ] **QA-0122 — Full capacity booking** (P1; Live - tagged fixture)
  - Steps: Attempt booking on a full controlled fixture.
  - Expected: Capacity protected; no false success.
- [ ] **QA-0123 — Cancelled event booking** (P1; Live - tagged fixture)
  - Steps: Attempt booking on cancelled QA event.
  - Expected: No new booking and clear cancellation state.
- [ ] **QA-0124 — Last-seat race** (P1; Isolated only)
  - Steps: Submit two concurrent isolated registrations for one remaining seat.
  - Expected: At most one succeeds; active count never exceeds capacity.
- [ ] **QA-0125 — Member cancellation** (P1; Live - tagged fixture)
  - Steps: Cancel tagged registration and repeat request.
  - Expected: Capacity/history/mail update once; payment/refund states remain accurate.
- [ ] **QA-0126 — Rebooking** (P1; Live - tagged fixture)
  - Steps: Rebook eligible cancelled QA registration.
  - Expected: New booking revision invalidates obsolete jobs; correct current state.
- [ ] **QA-0127 — Published fact changes** (P1; Live - tagged fixture)
  - Steps: Change only permitted event fields and compare existing booking/payment snapshots.
  - Expected: Historical obligations preserved and current publication follows policy.

### I. Payments and financials

Entry points: `/admin/workspaces/payments /admin/workspaces/events /member/payments`

- [ ] **QA-0128 — Payment instruction display** (P0; Live - tagged fixture)
  - Steps: Compare QA booking amount/payee/UPI/bank/QR/reference to selected snapshot.
  - Expected: All details match intended payment revision and member booking.
- [ ] **QA-0129 — Submit payment reference** (P0; Live - tagged fixture)
  - Steps: Submit synthetic reference on approved tagged booking.
  - Expected: Pending/manual-review state only; no automatic paid status.
- [ ] **QA-0130 — Manual payment confirmation** (P0; Live - tagged fixture)
  - Steps: Finance confirms a designated synthetic QA booking through UI.
  - Expected: Correct paid transition, actor/time/history and applicable confirmation mail; no actual transfer implied.
- [ ] **QA-0131 — Payment rejection** (P0; Live - tagged fixture)
  - Steps: Reject a separate pending QA reference with reason.
  - Expected: Accurate status and feedback; no falsely paid record.
- [ ] **QA-0132 — Repeated payment confirmation** (P0; Live - tagged fixture)
  - Steps: Repeat confirmed QA transition and inspect jobs/history.
  - Expected: No duplicated financial movement or notification.
- [ ] **QA-0133 — Invalid payment transition** (P0; Live - tagged fixture)
  - Steps: Attempt unsupported status change on controlled fixture.
  - Expected: Server rejects; prior state/history preserved.
- [ ] **QA-0134 — Payment stale update** (P0; Live - tagged fixture)
  - Steps: Two finance sessions update same QA payment version.
  - Expected: Conflict prevents overwrite or contradictory confirmation.
- [ ] **QA-0135 — Reference corrections** (P0; Live - tagged fixture)
  - Steps: Correct QA reference/note through supported action.
  - Expected: Old and new values remain in append-only history.
- [ ] **QA-0136 — Payment account revision** (P0; Live - tagged fixture)
  - Steps: Edit QA payment account and activate supported revision; inspect prior booking.
  - Expected: Prior booking retains applicable historical instruction; active display updates intentionally.
- [ ] **QA-0137 — Paid cancellation** (P0; Live - tagged fixture)
  - Steps: Cancel paid tagged registration.
  - Expected: Receipt remains evidenced; cancellation does not fabricate refund.
- [ ] **QA-0138 — Record refund** (P0; Live - tagged fixture)
  - Steps: Record synthetic QA refund through authorized workflow.
  - Expected: History and financial totals update once; UI does not claim application transferred money.
- [ ] **QA-0139 — Expense create** (P0; Live - tagged fixture)
  - Steps: Add tagged expense in integer paise with permitted category/date/account.
  - Expected: Accurate amount and finance-only receipt/audit.
- [ ] **QA-0140 — Expense edit** (P0; Live - tagged fixture)
  - Steps: Edit tagged expense and inspect previous version/history.
  - Expected: Correct revised totals with retained audit.
- [ ] **QA-0141 — Expense void** (P0; Live - tagged fixture)
  - Steps: Void tagged expense and repeat request.
  - Expected: Expense excluded once from applicable totals; history retained.
- [ ] **QA-0142 — Financial reconciliation** (P0; Live - tagged fixture)
  - Steps: Independently sum QA receipts/refunds/non-voided expenses/pending bookings.
  - Expected: Net collected=receipts-refunds; net result=net collected-expenses; pending not counted as receipts.
- [ ] **QA-0143 — Money boundaries** (P0; Isolated only)
  - Steps: Test paise conversion, zero where permitted, negatives, fractions and limits in isolation.
  - Expected: No precision loss, unauthorized negative amount or silent rounding.
- [ ] **QA-0144 — Finance permission boundary** (P0; Live - tagged fixture)
  - Steps: Open financial/receipt API as event_operator without finance role.
  - Expected: Finance details/history/receipt bytes remain inaccessible.

### J. Event operations

Entry points: `/admin/workspaces/events /member/events`

- [ ] **QA-0145 — Event lifecycle stages** (P1; Isolated only)
  - Steps: Use isolated timed fixtures for Draft, Scheduled, Open, Closed, Live, Past, Cancelled, Completed and Archived.
  - Expected: Stage labels/actions follow dates and operational state.
- [ ] **QA-0146 — Attendance present** (P1; Live - tagged fixture)
  - Steps: Mark QA registrant present with supported evidence/time.
  - Expected: One correct attendance outcome and history.
- [ ] **QA-0147 — Attendance absent** (P1; Live - tagged fixture)
  - Steps: Mark another QA registrant absent/unmarked.
  - Expected: No attendance benefit is awarded.
- [ ] **QA-0148 — Attendance corrections** (P1; Live - tagged fixture)
  - Steps: Correct QA attendance with reason/version.
  - Expected: Current outcome and history agree; stale edit rejected.
- [ ] **QA-0149 — Bulk attendance** (P1; Live - tagged fixture)
  - Steps: Apply supported bulk action to explicit QA selection.
  - Expected: Only intended rows change; conflict/partial failure is visible.
- [ ] **QA-0150 — No registration credit** (P1; Live - tagged fixture)
  - Steps: Inspect registered-but-absent QA member journey.
  - Expected: Registration does not automatically award attendance/learning credit.
- [ ] **QA-0151 — Milestone badges** (P1; Live - tagged fixture)
  - Steps: Enable isolated attendance milestone rule and compare eligible/absent members.
  - Expected: Only actual eligible attendance contributes; rule changes project correctly.
- [ ] **QA-0152 — Completion badge** (P1; Live - tagged fixture)
  - Steps: Complete eligible QA event and inspect badge eligibility.
  - Expected: Event completion badge follows its separate payment/attendance rule.
- [ ] **QA-0153 — Public resource** (P1; Live - tagged fixture)
  - Steps: Publish synthetic event resource with public eligibility.
  - Expected: Anonymous can access only intended published resource.
- [ ] **QA-0154 — Member resource** (P1; Live - tagged fixture)
  - Steps: Publish QA resource with configured member eligibility.
  - Expected: Eligible member permitted; anonymous/unentitled user denied.
- [ ] **QA-0155 — Registration resource** (P1; Live - tagged fixture)
  - Steps: Test resource eligibility with registered/cancelled/member-B fixtures.
  - Expected: Access evaluates current configured entitlement.
- [ ] **QA-0156 — Attendance resource** (P1; Live - tagged fixture)
  - Steps: Test resource with present/absent attendees.
  - Expected: Only configured attendance entitlement grants access.
- [ ] **QA-0157 — Resource eligibility revoked** (P1; Live - tagged fixture)
  - Steps: Change eligibility/cancel entitlement and retry direct file URL.
  - Expected: Server rechecks current access; no stale entitlement leak.
- [ ] **QA-0158 — Manual perk grant** (P1; Live - tagged fixture)
  - Steps: Grant perk to specific QA registration.
  - Expected: Only intended member sees active entitlement and history.
- [ ] **QA-0159 — Manual perk revoke** (P1; Live - tagged fixture)
  - Steps: Revoke same perk and retry member access.
  - Expected: Revocation reflected without erasing audit.
- [ ] **QA-0160 — Announcement review** (P1; Live - tagged fixture)
  - Steps: Create/review announcement with explicit QA audience.
  - Expected: Canonical event facts and audience are correct; no implicit send.
- [ ] **QA-0161 — Promotion dispatch** (P1; Live - tagged fixture)
  - Steps: Review and confirm promotion to approved test recipients only.
  - Expected: One correct dispatch using existing communications controls.
- [ ] **QA-0162 — Complete event prerequisites** (P1; Isolated only)
  - Steps: Attempt completion before end/final attendance/financial review using isolated fixture.
  - Expected: Completion rejected until all prerequisites; unresolved amounts remain explicit.
- [ ] **QA-0163 — Archive and reopen** (P1; Live - tagged fixture)
  - Steps: Complete/archive QA event; attempt edits; reopen with reason where supported.
  - Expected: Frozen actions rejected; authorized reopening is audited and private history retained.
- [ ] **QA-0164 — Historical import preview** (P1; Live - tagged fixture)
  - Steps: Preview synthetic historical attendance CSV.
  - Expected: Validation only; no attendance or learning credit committed.
- [ ] **QA-0165 — Historical import commit block** (P1; Isolated only)
  - Steps: Attempt unsupported commit in isolation.
  - Expected: Explicit disabled/409 outcome and no data mutation.

### K. Transactional email

Entry points: `Approved QA inbox / event delivery view`

- [ ] **QA-0166 — Mail content and links** (P1; Live - tagged fixture)
  - Steps: For each transactional kind, compare recipient/sender/reply-to/subject/IST time/fee/IDs and follow links.
  - Expected: Message facts and targets match canonical record and intended recipient.
- [ ] **QA-0167 — Actual inbox evidence** (P1; Live - tagged fixture)
  - Steps: Open approved inbox after a triggered QA message and complete link action on desktop.
  - Expected: Receipt and usable link proven separately from provider status.
- [ ] **QA-0168 — Mobile inbox link** (P1; Live - tagged fixture)
  - Steps: Open representative account and event links from real phone email client.
  - Expected: Correct secure destination and continuation on physical device.
- [ ] **QA-0169 — Delivery state projection** (P1; Live - tagged fixture)
  - Steps: Compare queue, provider events and UI states for QA messages.
  - Expected: Queued/accepted/delivered/delayed/failed/bounced/received are not conflated.
- [ ] **QA-0170 — Reminder configuration** (P1; Live - tagged fixture)
  - Steps: Configure supported offsets and pending-payment option on tagged event.
  - Expected: Validated settings persist and displayed schedules are correct.
- [ ] **QA-0171 — Obsolete reminder suppression** (P1; Isolated only)
  - Steps: Change booking/payment/event/schedule before due time.
  - Expected: Ineligible obsolete job skipped with reason; no outdated mail.
- [ ] **QA-0172 — Reminder due boundaries** (P1; Isolated only)
  - Steps: Test earliest/latest offsets, catch-up expiry and after-event timing.
  - Expected: Only permitted due/catch-up jobs send; no after-start reminder.
- [ ] **QA-0173 — Worker retry and uncertainty** (P1; Isolated only)
  - Steps: Simulate transient provider failure/uncertain acceptance and restart.
  - Expected: Stable idempotency, bounded retries and reconciliation state prevent duplicate send.
- [ ] **QA-0174 — Cancellation reminder invalidation** (P1; Isolated only)
  - Steps: Cancel/rebook isolated member and advance due time.
  - Expected: Old booking jobs suppressed; only valid current revision can send.
- [ ] **QA-0175 — Delivery failure visibility** (P1; Live - tagged fixture)
  - Steps: Inspect failed/skipped QA messages in staff delivery view.
  - Expected: Accurate reason/time/registration and clear next action without token leakage.

### L. Campaigns and inbox

Entry points: `/admin/workspaces/communications`

- [ ] **QA-0176 — Template save and preview** (P1; Live - tagged fixture)
  - Steps: Create/edit QA template and switch workspace tabs.
  - Expected: Saved content/version and unsaved input retention are correct.
- [ ] **QA-0177 — Campaign draft** (P1; Live - tagged fixture)
  - Steps: Create named QA campaign with subject/body/audience and reload.
  - Expected: Saved draft is exact; no dispatch implicit in save.
- [ ] **QA-0178 — Template snapshot** (P1; Live - tagged fixture)
  - Steps: Copy template into draft, change template and reload campaign.
  - Expected: Campaign retains copied snapshot.
- [ ] **QA-0179 — Campaign archive restore** (P1; Live - tagged fixture)
  - Steps: Archive draft, try edit, restore and inspect revisions.
  - Expected: Archived edit rejected; restore permits edit with preserved history.
- [ ] **QA-0180 — Audience calculation** (P1; Live - tagged fixture)
  - Steps: Compare filtered audience preview with read-only query of QA eligible identities.
  - Expected: Counts/sample agree; consent/verification/preferences/suppression exclusions explicit.
- [ ] **QA-0181 — Audience freshness** (P1; Live - tagged fixture)
  - Steps: Change QA consent or filter after review and attempt dispatch.
  - Expected: Stale review rejected or current eligibility rechecked as contract requires.
- [ ] **QA-0182 — Dispatch confirmation** (P1; Live - tagged fixture)
  - Steps: Review exact allowlisted audience and confirm one QA dispatch.
  - Expected: Only approved recipient snapshot creates jobs; unreviewed send rejected.
- [ ] **QA-0183 — Duplicate dispatch** (P1; Live - tagged fixture)
  - Steps: Repeat confirmation of same reviewed QA dispatch.
  - Expected: Same logical dispatch/jobs returned without duplicates.
- [ ] **QA-0184 — Dispatch cancellation** (P1; Isolated only)
  - Steps: Cancel isolated dispatch before send and during partial processing.
  - Expected: Pending jobs cancelled; accepted history preserved.
- [ ] **QA-0185 — Authority revoked before send** (P1; Isolated only)
  - Steps: Revoke isolated sender role between review/queue/provider call.
  - Expected: Unauthorized pending action does not send.
- [ ] **QA-0186 — Consent revoked before send** (P1; Isolated only)
  - Steps: Withdraw isolated QA consent after queueing.
  - Expected: Optional campaign eligibility rechecked and recipient skipped.
- [ ] **QA-0187 — Quota and priority** (P1; Isolated only)
  - Steps: Simulate daily/monthly quota limits and transactional backlog.
  - Expected: Queue respects configured limits/reserve and transactional priority; no plan upgrade.
- [ ] **QA-0188 — Unsubscribe GET** (P1; Live - tagged fixture)
  - Steps: Open QA unsubscribe link without confirming destructive action.
  - Expected: GET behavior follows safe contract; no unintended consent change.
- [ ] **QA-0189 — Unsubscribe completion** (P1; Live - tagged fixture)
  - Steps: Complete supported unsubscribe then repeat request and preview next audience.
  - Expected: Consent/suppression update idempotently; future optional campaign excludes recipient.
- [ ] **QA-0190 — Inbound receipt** (P1; Live - tagged fixture)
  - Steps: Send one approved QA message to configured inbox.
  - Expected: Correct recipient/identity and safe body ingestion; no unrelated mail.
- [ ] **QA-0191 — Inbound threading** (P1; Live - tagged fixture)
  - Steps: Reply with known references; separately use same subject without references.
  - Expected: Threading follows reference/correspondent rules, not subject-only guess.
- [ ] **QA-0192 — Inbound attachments** (P1; Live - tagged fixture)
  - Steps: Send harmless QA attachment and inspect metadata handling.
  - Expected: Only supported safe metadata shown; no unsolicited remote fetch/execute.
- [ ] **QA-0193 — Reply draft and assignment** (P1; Live - tagged fixture)
  - Steps: Save reply/notes/assignment, switch tabs and reload.
  - Expected: Correct private persistence and stale-edit protection.
- [ ] **QA-0194 — Approved test reply** (P1; Live - tagged fixture)
  - Steps: Confirm reply to approved QA correspondent and inspect actual inbox.
  - Expected: One correct reply; stale replay blocked; separate delivery/receipt evidence.
- [ ] **QA-0195 — Unsupported channel** (P1; Isolated only)
  - Steps: Attempt unsupported schedule/channel/attachment action in isolation.
  - Expected: Clear disabled/rejected outcome; no false send or queued side effect.

### M. CMS and settings

Entry points: `/admin/workspaces/content /admin/workspaces/website`

- [ ] **QA-0196 — Rich content draft** (P1; Live - tagged fixture)
  - Steps: Create QA article/page with supported headings, links, image and table.
  - Expected: Editor saves/renders equivalent safe content.
- [ ] **QA-0197 — Draft publication isolation** (P1; Live - tagged fixture)
  - Steps: Edit saved QA published item without publishing again.
  - Expected: Public snapshot remains unchanged.
- [ ] **QA-0198 — Preview publish** (P1; Live - tagged fixture)
  - Steps: Preview saved QA version, explicitly publish and open anonymous detail.
  - Expected: Published snapshot matches reviewed version.
- [ ] **QA-0199 — Withdraw archive** (P1; Live - tagged fixture)
  - Steps: Withdraw/archive QA content via supported action and retry URL.
  - Expected: Removed from intended public surface; history preserved.
- [ ] **QA-0200 — Stale editorial action** (P1; Live - tagged fixture)
  - Steps: Edit/publish same QA version from two tabs.
  - Expected: Conflict blocks stale overwrite/publication.
- [ ] **QA-0201 — Section order and anchors** (P1; Live - tagged fixture)
  - Steps: Change permitted QA page headings/copy and follow submenu anchors.
  - Expected: Required structural order/count/anchors remain correct.
- [ ] **QA-0202 — Homepage controls** (P1; Isolated only)
  - Steps: Use isolated clone for homepage heading/cards/CTA/guide settings.
  - Expected: Preview/save/publication updates intended slots only.
- [ ] **QA-0203 — Branding header footer** (P1; Isolated only)
  - Steps: Use isolated clone to edit brand/logo/menu/footer/contact settings.
  - Expected: All shared shells update consistently; identity/artwork proportions preserved.
- [ ] **QA-0204 — Metadata controls** (P1; Isolated only)
  - Steps: Change isolated shared title/description and inspect route-specific pages.
  - Expected: Defaults apply appropriately without overriding protected page-specific behavior.
- [ ] **QA-0205 — Important links** (P1; Live - tagged fixture)
  - Steps: Create ordered QA link, publish, edit and withdraw.
  - Expected: Only published current link visible; HTTPS validation enforced.
- [ ] **QA-0206 — Download publication** (P1; Live - tagged fixture)
  - Steps: Upload synthetic supported PDF to QA record, preview and publish.
  - Expected: Correct metadata/bytes and publication-aware access.
- [ ] **QA-0207 — Download replacement** (P1; Live - tagged fixture)
  - Steps: Replace QA PDF without publishing, then publish new version.
  - Expected: Old public bytes remain until explicit publication; history/reference retained.
- [ ] **QA-0208 — Download validation** (P1; Isolated only)
  - Steps: Test empty, wrong type, renamed file and >5MB in isolation.
  - Expected: Invalid bytes/size rejected without broken public record.
- [ ] **QA-0209 — News source workflow** (P1; Live - tagged fixture)
  - Steps: Create QA source, approve as admin, edit, reapprove and pause.
  - Expected: Correct version/history/roles; edit returns to draft; no automatic fetch/publish implied.
- [ ] **QA-0210 — Page fallback** (P1; Isolated only)
  - Steps: Withdraw QA page override in isolated clone and inspect route.
  - Expected: Documented default fallback appears; article withdrawal remains inaccessible.

### N. People media flyers

Entry points: `/admin/workspaces/governance /media /flyers`

- [ ] **QA-0211 — People and groups** (P1; Live - tagged fixture)
  - Steps: Create QA person/group/committee assignments with roles, term and ordering.
  - Expected: Correct identities, hierarchy and intended public placement.
- [ ] **QA-0212 — Profile proposal review** (P1; Live - tagged fixture)
  - Steps: Submit QA owner/staff proposal and inspect accepted/public snapshots.
  - Expected: Proposal never bypasses review/publication.
- [ ] **QA-0213 — Person publish withdraw** (P1; Live - tagged fixture)
  - Steps: Publish then withdraw QA profile.
  - Expected: Intended public appearance/removal; retained Person/account/membership/history.
- [ ] **QA-0214 — Person archive restore** (P1; Live - tagged fixture)
  - Steps: Archive and restore QA profile.
  - Expected: Restore does not silently republish or remove linked records.
- [ ] **QA-0215 — Editorial role distinction** (P1; Live - tagged fixture)
  - Steps: Give QA person a committee title without staff grant.
  - Expected: No authentication permission is created.
- [ ] **QA-0216 — Media upload metadata** (P1; Live - tagged fixture)
  - Steps: Upload supported synthetic editorial image with title, alt text and category.
  - Expected: Correct stored bytes, descriptive metadata and preview.
- [ ] **QA-0217 — Media placement order** (P1; Live - tagged fixture)
  - Steps: Select QA image placement/featured state/order and publish.
  - Expected: Correct eligible public placement and order.
- [ ] **QA-0218 — Media withdraw** (P1; Live - tagged fixture)
  - Steps: Withdraw QA editorial media used by a QA profile.
  - Expected: Public rendering respects withdrawal; private/history references preserved.
- [ ] **QA-0219 — Private asset separation** (P1; Isolated only)
  - Steps: Attempt attach owned private evidence as public editorial media in isolation.
  - Expected: Rejected; no private bytes become publicly available.
- [ ] **QA-0220 — Flyer canonical facts** (P1; Live - tagged fixture)
  - Steps: Create variant for QA free/paid events and change presentation controls.
  - Expected: Event facts/speakers/fee/visibility remain canonical; variant only alters presentation.
- [ ] **QA-0221 — Flyer PNG export** (P1; Live - tagged fixture)
  - Steps: Export QA flyer at supported speaker counts/long text.
  - Expected: Readable image without clipping/overlap; correct facts.
- [ ] **QA-0222 — Flyer PDF export** (P1; Live - tagged fixture)
  - Steps: Export same QA flyer and visually inspect all pages at normal zoom.
  - Expected: Correct page geometry, readable text and no clipping.
- [ ] **QA-0223 — QR scan** (P1; Live - tagged fixture)
  - Steps: Scan QA public and member flyer QR with physical phone.
  - Expected: Correct event-specific destination and sign-in continuation.
- [ ] **QA-0224 — Export freshness** (P1; Live - tagged fixture)
  - Steps: Edit relevant QA facts after export and inspect freshness/version messaging.
  - Expected: Stale static export is not falsely presented as current.

### O. Reports and audit

Entry points: `/admin/workspaces/reports /api/staff/search /api/staff/audit`

- [ ] **QA-0225 — Permitted datasets** (P1; Live - tagged fixture)
  - Steps: Open reports/catalog/search as each staff role.
  - Expected: Only datasets/results permitted by current domain grants appear.
- [ ] **QA-0226 — Report reconciliation** (P1; Live - tagged fixture)
  - Steps: Compare filtered QA report rows/totals with directory and read-only database query.
  - Expected: Same filters yield matching source records; accounts not mislabeled as memberships.
- [ ] **QA-0227 — Date boundaries** (P1; Isolated only)
  - Steps: Test custom inclusive dates, month end, year end and April-March financial year in isolation.
  - Expected: India-date bounds and UTC row timestamp labels are correct.
- [ ] **QA-0228 — CSV export** (P1; Live - tagged fixture)
  - Steps: Download QA filtered CSV and inspect columns/counts/quotes/Unicode.
  - Expected: Exact intended rows and safe types/escaping; no private caching.
- [ ] **QA-0229 — XLSX export** (P1; Live - tagged fixture)
  - Steps: Download same QA XLSX and compare parsed rows/types/headers/metadata.
  - Expected: Numeric/boolean types preserved; filters/frozen header and counts correct.
- [ ] **QA-0230 — Empty export** (P1; Live - tagged fixture)
  - Steps: Export a filter with zero QA matches.
  - Expected: Headers/metadata remain, with no fabricated data.
- [ ] **QA-0231 — Preview and export limits** (P1; Isolated only)
  - Steps: Use isolated fixtures above preview limit and export maximum.
  - Expected: Preview explicitly limited; >10000 export rejected without silent truncation.
- [ ] **QA-0232 — Formula-like export text** (P1; Isolated only)
  - Steps: Export isolated values beginning =,+,-,@ in CSV/XLSX.
  - Expected: Text remains non-executable; no spreadsheet formula injection.
- [ ] **QA-0233 — Private preset ownership** (P1; Live - tagged fixture)
  - Steps: Save/apply/edit/delete QA private preset using owner and another account.
  - Expected: Only owner manages it, including against another administrator.
- [ ] **QA-0234 — Shared preset** (P1; Live - tagged fixture)
  - Steps: Admin creates/edits QA shared preset; other roles apply only allowed datasets.
  - Expected: Shared management remains admin-only; permissions rechecked.
- [ ] **QA-0235 — Preset conflict and revocation** (P1; Live - tagged fixture)
  - Steps: Change QA version/role before save/apply/export.
  - Expected: Stale/unauthorized operation rejected.
- [ ] **QA-0236 — Audit accuracy** (P1; Live - tagged fixture)
  - Steps: Inspect QA operation audits against UI/API actions.
  - Expected: Actor/time/action/version correct; no secret bodies/tokens/private document contents.

### P. Security

Entry points: `Protected routes and APIs`

- [ ] **QA-0237 — Six-role permission matrix** (P0; Live - tagged fixture)
  - Steps: Test all seven domain permissions against each single-role QA account using UI and direct API.
  - Expected: Administrator all; reviewer members/documents; editor content; event operator events; communications operator communications; finance payments. Combined actions may require multiple grants.
- [ ] **QA-0238 — Role revocation** (P0; Live - tagged fixture)
  - Steps: Remove role only from owned QA staff session then retry stale UI/direct API.
  - Expected: Server denies revoked action even if old navigation remains rendered.
- [ ] **QA-0239 — Owner authorization** (P0; Live - tagged fixture)
  - Steps: Swap A-owned fixture ID for B-owned ID on private record/file request.
  - Expected: No cross-owner data or mutation.
- [ ] **QA-0240 — Origin enforcement** (P0; Live - tagged fixture)
  - Steps: Send isolated authenticated write with absent/foreign Origin per endpoint policy.
  - Expected: Unauthorized cross-origin mutation rejected.
- [ ] **QA-0241 — Private response caching** (P0; Live - tagged fixture)
  - Steps: Inspect cache headers and shared browser behavior for private APIs/files.
  - Expected: No public caching or token/private body leak.
- [ ] **QA-0242 — Signed file links** (P0; Live - tagged fixture)
  - Steps: Use valid QA signed download then expired/modified isolated link.
  - Expected: Only authorized timely access succeeds; referrer protections preserved.
- [ ] **QA-0243 — Script and unsafe URL injection** (P0; Isolated only)
  - Steps: Submit isolated harmless script markers/unsafe URLs to rendered content and links.
  - Expected: Escaping/sanitization rejects execution and unsafe redirects.
- [ ] **QA-0244 — SQL injection attempts** (P0; Isolated only)
  - Steps: Send bounded isolated SQL-shaped strings to filter/ID fields.
  - Expected: Parameterized queries/validation prevent execution or data leakage.
- [ ] **QA-0245 — Webhook forgery replay** (P0; Isolated only)
  - Steps: Send forged, old and duplicate signed isolated webhook fixtures.
  - Expected: Signature/time/idempotency rules enforced; no duplicate side effects.
- [ ] **QA-0246 — Rate limit behavior** (P0; Isolated only)
  - Steps: Exercise isolated signup/login/inquiry/email limits with bounded test traffic.
  - Expected: Configured protections work without blocking unrelated identities or bypassing integrity.
- [ ] **QA-0247 — Secret exposure review** (P0; Live - tagged fixture)
  - Steps: Inspect browser bundles/responses/log samples with approved secret scanner; redact evidence.
  - Expected: No server credentials, auth tokens, private documents or operational secrets in public output.

### Q. Database and operations

Entry points: `PostgreSQL / storage / workers / health`

- [ ] **QA-0248 — Cross-layer reconciliation** (P0; Live - tagged fixture)
  - Steps: For each E2E case record IDs, inspect UI/API/database/audit/jobs/provider outcomes using read-only queries.
  - Expected: One coherent state and traceable evidence across layers; no success inferred from UI alone.
- [ ] **QA-0249 — Schema integrity** (P0; Live - tagged fixture)
  - Steps: Read deployed schema constraints and inspect owned QA linkage/unique/state/precision rules.
  - Expected: Foreign keys, ownership, uniqueness and valid transitions preserve invariants.
- [ ] **QA-0250 — Transaction rollback** (P0; Isolated only)
  - Steps: Inject controlled failure between isolated multi-table writes.
  - Expected: No partial committed business state or orphaned active references.
- [ ] **QA-0251 — Concurrent integrity** (P0; Isolated only)
  - Steps: Race isolated bookings/payments/reviews/import commits.
  - Expected: Locks/version checks prevent duplicates, lost updates and inconsistent totals.
- [ ] **QA-0252 — Migration identity** (P0; Live - tagged fixture)
  - Steps: Read deployed migration ledger and compare ordered checksums with exact deployed source.
  - Expected: Missing/mismatched migrations explicitly block candidate acceptance; no migration executed live.
- [ ] **QA-0253 — Migration rehearsal** (P0; Isolated only)
  - Steps: Apply candidate migrations to disposable database/approved isolated restore.
  - Expected: Ordered checksums and preserved data verified; never rewrite applied identities.
- [ ] **QA-0254 — Restricted database roles** (P0; Isolated only)
  - Steps: Run web/worker action suites under intended restricted isolated database credentials.
  - Expected: Required actions succeed; unnecessary schema/data privileges denied.
- [ ] **QA-0255 — Storage consistency** (P0; Live - tagged fixture)
  - Steps: Compare owned QA upload/download/replacement references and bytes with object store.
  - Expected: No missing intended objects or public/private namespace crossover.
- [ ] **QA-0256 — Worker crash isolation** (P0; Isolated only)
  - Steps: Stop isolated email/import child and inspect web/health/restart behavior.
  - Expected: Web behavior and health accurate; owned worker restarts without duplicate work.
- [ ] **QA-0257 — Lease and deadlock recovery** (P0; Isolated only)
  - Steps: Run isolated multiple workers and conflicting transactions with telemetry.
  - Expected: One logical job execution; bounded recovery and visible errors.
- [ ] **QA-0258 — Backup restore** (P0; Isolated only)
  - Steps: Restore approved backup into isolated restricted environment and reconcile rows/files.
  - Expected: Restore is usable; measured recovery time/data loss recorded against owner targets.
- [ ] **QA-0259 — Restore communication hold** (P0; Isolated only)
  - Steps: Inspect restored queue with all external providers disabled before worker start.
  - Expected: No live recipient send or live external write occurs during recovery.
- [ ] **QA-0260 — Cleanup reconciliation** (P0; Live - tagged fixture)
  - Steps: Withdraw/archive owned QA publications, restore shared settings, reconcile exact records/jobs/objects.
  - Expected: No unrelated changes; retained audit/financial history documented; owner confirms completion.

### R. UX and efficiency

Entry points: `All public/member/admin sections`

- [ ] **QA-0261 — Physical device matrix** (P1; Live - read-only)
  - Steps: Run representative P0/P1 journeys on real Android Chrome and iPhone Safari where available.
  - Expected: Real-device findings separated from desktop viewport emulation; unavailable device is Blocked.
- [ ] **QA-0262 — Browser matrix** (P1; Live - read-only)
  - Steps: Run core journeys on current available Chrome, Edge, Firefox and Safari with recorded versions.
  - Expected: Core behavior works across supported browsers; unsupported browsers explicitly agreed.
- [ ] **QA-0263 — Screen-reader flow** (P1; Live - read-only)
  - Steps: Complete signup/application/event booking and admin dialog using available screen reader.
  - Expected: Meaningful labels, reading order and announced validation/state changes.
- [ ] **QA-0264 — Console and network** (P1; Live - read-only)
  - Steps: Inspect console/failed requests during each core journey.
  - Expected: No unexplained runtime/hydration errors, broken requests or repetitive polling.
- [ ] **QA-0265 — Measured performance** (P1; Live - read-only)
  - Steps: Record device/network/cache condition and repeat key public/member/admin loading and interaction samples.
  - Expected: Compare with agreed targets; report distribution, not a single fast sample. Default review targets: LCP <=2.5s, CLS <=0.1, INP <=200ms where measurable; lab is not field proof.
- [ ] **QA-0266 — Concurrent capacity** (P1; Isolated only)
  - Steps: On isolated deployment run capped 5/10/25/50-user stages with representative mix, telemetry and owner budget.
  - Expected: Record sustainable tested level; stop on leakage/corruption or sustained >2% errors/p95>5s. Proposed pass: <1% unexpected errors, read p95<1s/write p95<2s; owner confirms targets before run.
- [ ] **QA-0267 — Database performance** (P1; Isolated only)
  - Steps: Measure isolated query plans/N+1/pool wait/connections under representative load.
  - Expected: Bottlenecks linked to queries and observed user impact, with no capacity claim from serial timing.
- [ ] **QA-0268 — Worker backlog performance** (P1; Isolated only)
  - Steps: Measure isolated campaign/import backlog drain and transactional latency.
  - Expected: Backlog/retry metrics and transactional priority meet owner-approved targets.
- [ ] **QA-0269 — Task efficiency** (P1; Live - read-only)
  - Steps: Time signup/application/review/event setup/payment verification/campaign/export and count clicks/re-entry.
  - Expected: Record observed friction, frequency and workaround, not assumed upgrades.
- [ ] **QA-0270 — Upgrade assessment** (P1; Live - read-only)
  - Steps: For observed friction add UX and Upgrades entry with evidence, benefit, effort and dependencies.
  - Expected: Recommendation is separate from defect and tied to measurable improvement.

## Closeout and owner decision

Retest each fixed defect on the identified build, retaining original evidence. Every inventory item needs an explicit live review and mapped test IDs; every test/journey needs an explicit outcome. P0/P1 and all applicable E2E flows must pass. No unresolved Critical/High defect is acceptable. Lower-severity exceptions require named owner acceptance. Missing/not-deployed critical features remain visible and prevent blanket launch readiness.

Restore permitted shared settings, withdraw/archive owned test publications and reconcile exact fixtures, objects, jobs and approved provider-retained messages. Do not delete financial/audit evidence or unrelated real data. Submit completed workbook, evidence folder, defect list, upgrade backlog and Ready/Not ready recommendation for named owner sign-off.

## Source and coverage limitations

This package uses the approved checklist and the current local route/navigation/access/migration inventory. Source references are in Coverage Inventory. Runtime feature flags, provider configuration, actual delivery, production data state and deployed commit were not verified while creating it. Static equality-action and table extraction cannot discover every delegated operation, conditional UI control or dynamically constructed query. The inventory review and per-action expansion are required before claiming exhaustive executed coverage. No application APIs, business logic, migrations or live records were changed to create the handoff.
