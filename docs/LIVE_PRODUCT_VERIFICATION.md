Updated release scope: 13 October website controls are **IMPLEMENTED BUT NOT DEPLOYED**. The historical evidence below describes the 12 October hosted check; current source/schema/build and control inventory are in WEBSITE_ADMIN_CONTROL.md and the replacement release manifest. Schema 033 is rehearsed locally; hosted schema remains 029. Live QA-record archival remains pending deployment.

# Live product verification — 12 October 2026 (IST)

**Decision: IMPLEMENTED BUT NOT DEPLOYED for the event upgrade and fixes. Existing CMS text/publication journeys are LIVE AND VERIFIED within the scope below. Full product acceptance remains BLOCKED.** No deployment, production migration, funds transfer, external test email or invitation release occurred.

## Deployment reality

| Component | Local | Git | Hosted | Same? |
|---|---|---|---|---|
| Frontend | Modified `feat/platform-foundation`, HEAD `93d00250`; final build `L_itehYY3QxS2E-YDr0Ev` | Remote main `6532f3a9`; remote foundation `db0ddae0` | Railway `7359d379-a8f7-468e-a9d7-a8568560cf21`, SUCCESS, release message identifies main `6532f3a9` | No |
| Backend | Event operations, canonical CMS and people APIs | Upgrade not on main | Same Next.js service as frontend; old event editor visibly live | No |
| Worker | Compiled email/reminder/promotion worker and import worker | Upgrade not on main | Bundled with the same Railway web deployment; no separate worker service | No; exact running worker artifact independently unverified |
| DB schema | 032 | Main through 029 | Exactly 29 applied migrations; all checksums match local historical files | No; 030–032 pending |
| Storage | R2 integration; operational acceptance uses mock storage | Existing integration retained | R2 credentials/bucket configured; original eight portraits render | Configuration verified; new upload/replace unverified |

Railway has only `production`. No paid staging or production load test was provisioned. The deployed commit is evidenced by release metadata and archived release history, not by a runtime commit endpoint.

Hosted configuration: onboarding and email operations enabled, verified Resend domain, sending/receiving/webhook credentials present. Event reminder/promotion switches unset; the new worker defaults reminders on. Explicitly disable both event switches before release as described in the runbook. Secrets were not printed.

## Real browser and canonical data evidence

- **Content:** persisted entries were initially zero. Public website pages use `sitePages` defaults until an admin-published `tpa.content_entries` snapshot overrides them. This is an explicit fallback, not an external CMS or background synchronization system. Admin save/publish/withdraw APIs and public readers use the same database. Files/images have their separate media/storage workflow; arbitrary attachments are not supported by the rich-text editor.
- **Live insight:** created through the authenticated website, saved, published, viewed publicly, edited, saved privately, checked unchanged publicly, republished, checked updated publicly, withdrawn and checked the public 404. The next navigation and database audit history agree. The test remains an unpublished private draft.
- **People & Committee:** canonical `tpa.people`, `profile_groups`, assignment/publication snapshots and `profile_portraits`; public projection derives from published snapshots and group ordering. Eight existing people and portraits appeared on the public committee page, with no broken images in the checked desktop view.
- **Live person:** created with synthetic name, designation, organisation, biography and committee assignment; saved, submitted, approved, published publicly, edited privately and withdrawn. Public absence after withdrawal was verified. No account, membership, role or email was created for this person. It remains private.
- **Evidence limit:** UI operations, resulting public states and persisted audit actions were observed. Raw browser request/response traces were not captured by the available browser interface; this is not a full transport-level click-to-database trace claim.

Test ledger:

| Record | Identifier | Final disposition |
|---|---|---|
| Insight | `aaa5c0bd-8255-440b-bebc-05b866155b5b`, `/resources/tpa-live-qa-20261012` | Unpublished; URL shows 404 |
| Person | `4cbdf017-d842-48a1-8815-5459f7227d58`, TPA QA Temporary Person 20261012 | Public profile withdrawn; private draft retained |

There is no supported archive/delete control for these record types. They were withdrawn rather than deleted. Their retained drafts add two staff publication alerts; these are identifiable QA records, not unresolved real content.

## Repairs and validation

1. **Missing admin committee profiles:** the governance API selected only the newest 200 people before client-side filtering. Seven of eight original published profiles were missing from the default staff list, while public rendering still showed all eight. Removed that pre-filter truncation and kept deterministic ordering. A regression creates 201 newer people and proves an older profile remains returned. This approach fits the current directory scale; future large-directory pagination must preserve server-side filtering and counts.
2. **Article metadata:** a live published insight retained the homepage browser title. Published resource title/description now supply metadata; an isolated HTTP assertion verifies both.
3. **Flyer wording:** event selection/loading now accurately includes drafts. Canonical shared flyers join current event data; preview/export rejects changed event or variant revisions. Existing downloaded files remain static and timestamped; no historical files were rewritten.
4. **Attendance compatibility:** restored `attendance.checked_in` for legacy callers without an outcome; newer outcome-based operations retain their audit actions. Updated isolated fixture cleanup for booking/payment/history relationships introduced by migration 032.

Validation:

| Check | Result / evidence |
|---|---|
| Unit tests | 94 passed, `.local/live-product/unit.log` |
| Build/typecheck/lint | Passed; final source build above; final logs in `.local/live-product` |
| Event Flow | 13 groups, `.local/event-flow/2026-10-12T13-35-14.417Z/acceptance.json` |
| Engagement | 6 groups, `.local/event-engagement/2026-10-12T13-35-48.165Z/acceptance.json` |
| Final event operational browser suite | 16 groups, `.local/event-operational/2026-10-12T13-41-14.808Z/acceptance.json`; zero external emails, disposable DB cleanup |
| Governance + legacy operations + article metadata | Passed, `.local/live-product/product-local-final.log` |
| Exact review package | Independent build `S4bmx9clX3KtgwPe6g-DS`; package build/product/operational logs in `.local/live-product` |
| Backup and migration rehearsal | Fresh production dump restored locally, migrated through 032, account/member/hold counts preserved; `migration-rehearsal.json` |
| Original data preservation | All original accounts, credential rows, people, memberships, holds, portraits and payment details matched the pre-write backup; `preservation-final.json` |

Event suites use synthetic users, mock storage/transport and controlled time. They prove local behavior, including payment snapshots, attendance correction, badge/resource revocation, financial close, exports and QR. They do not prove hosted payment reconciliation, actual inbox delivery or physical-device operation.

Desktop screenshots cover dashboard, Events, Flyers, Members, Content, People and public committees. Chrome accepted viewport override commands but `innerWidth` stayed 1864px; screenshot filename widths are requested widths only. `browser-views.json` explicitly invalidates mobile/tablet claims. Local event suites independently verify actual 1440/768/390px widths and automated accessibility. Hosted performance instrumentation was unavailable in the browser's read-only evaluation scope; no speculative optimization or field Core Web Vitals claim is made.

## Data safety and genuine blockers

Final counts: 208 accounts, 214 people (213 original + one QA person), 202 memberships, eight published people, one unpublished QA content entry, zero events, 202 unreleased holds and zero campaign email jobs. Original rows and credential hashes are unchanged. No fixture runner touched production.

- **Deployment approval:** event command center, live payment/attendance/resources/badges/promotions and fixes await the reviewed release. Production migrations remain through 029.
- **Real member:** exact `savagesnowboy@gmail.com` account does not exist. Per the brief, it was not created or substituted. A synthetic member lifecycle passed locally; approved hosted member access remains required.
- **New file/photo uploads:** browser extension rejects file selection until its file-URL access is enabled. Actual hosted upload, replacement, invalid/oversized upload and storage lifecycle remain BLOCKED. Existing public portraits passed desktop rendering.
- **Real inbox:** recipient authorization is recorded, but no event test mail was sent before deployment/member prerequisites. Inbox receipt, links, cancellation/reminder/promotion branding remain unverified.
- **Devices/accessibility/performance:** hosted tablet/mobile override is ineffective, physical devices unavailable, and complete hosted assistive-technology/performance acceptance remains unverified.
- **Human acceptance:** actual administrator/member acceptance remains required; automated browser operation is not human acceptance.

See [release runbook](LIVE_PRODUCT_RELEASE_RUNBOOK.md) and the ignored `.local/live-product/release-manifest.json` / `release.patch` for the concrete release contents. Do not describe the complete product as launch-ready.
