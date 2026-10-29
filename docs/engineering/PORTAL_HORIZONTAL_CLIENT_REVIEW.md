# TPA horizontal portals — client review

This revision implements the approved horizontal Crazy Hands direction on
`feature/crazy-hands-portal-ux`, preserving the first checkpoint `bd7d0ef` in
Git history. Review both completed local portals before authorizing a merge or
deployment. Folder cleanup has its own exact-path approval gate.

## Reference and implementation ledger

Crazy Hands at `e799357fcfaba0631a71b9be51494ab2bb43d13b` remains the primary
reference and its checkout is read-only. TPA's blue/white identity, logo bytes,
font roles, light/dark/system preference and existing permissions remain TPA's.

| Crazy Hands source | TPA adaptation |
| --- | --- |
| `frontend/src/pages/Admin.jsx` horizontal rounded tabs and grouped settings | Two compact sticky rows; seven permission-filtered staff groups and contextual subsection pills beside the heading. Member destinations use five groups. |
| `frontend/src/pages/Dashboard.jsx` status and task hierarchy | Compact member verification progress and real event-journey counts; navigation-only service tiles and repeated portal labels removed. |
| `frontend/src/components/Header.jsx` delayed account panel | Hover/focus preview and click-pinned account controls, with appearance, security and sign-out retained. |
| `frontend/src/components/MemberExplorer.jsx` record explorer, contact copying and inspector | Authorized record summaries in anchored quick cards; stable full-detail inspector beside desktop lists and native modal sheet at smaller widths. |
| `frontend/src/pages/AdminLogin.jsx` split sign-in composition | Shared TPA authentication treatment across sign-in, signup, invitation, verification and password recovery. |

Supplemental references supply implementation and accessibility rules only:
[Floating UI popovers](https://floating-ui.com/docs/popover),
[Vercel interface guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md),
and [Playwright user-visible testing](https://playwright.dev/docs/best-practices).
The installed Refero design, React performance and browser skills support this
workflow; no additional connector or alternative visual direction was added.

## Local showcase

- Working application: <http://127.0.0.1:3185/login>
- Before/after gallery: <http://127.0.0.1:3186>
- Administrator: `portal-admin@example.invalid`
- Member: `portal-member@example.invalid`
- Synthetic password: `Launch!1234`
- Restricted staff logins follow `portal-ROLE@example.invalid`, where ROLE is
  `membership_reviewer`, `content_editor`, `event_operator`,
  `communications_operator`, or `finance_operator`.

These are disposable local accounts, not production credentials. The environment
is explicitly marked testing. Messages are captured in a local mail sink;
provider delivery is neither enabled nor claimed. Local storage is isolated.

The existing review environment can be restarted from the canonical app:

```powershell
node .local/portal-review/start-production.mjs
node .local/portal-review/serve-gallery.mjs
```

The environment and owned-process metadata live privately under
`.local/portal-review`. They are intentionally untracked. Restart only this
registered loopback database and these owned servers; never inherit production
environment files. The PostgreSQL server uses port 55439. Review evidence is
under `output/playwright/portal-review`, also untracked.

## Review guide

1. Sign in as administrator. Move through every top group and its subsections.
   Account directory preserves `view=accounts` and existing account deep links.
   Restricted staff see only their permitted destinations.
2. Open Members. Hover or focus a name, move into the quick card, copy a contact
   value, then open full details. A clicked record stays pinned when another row
   is hovered. Escape and close restore the originating trigger. On phones the
   inspector becomes a focus-trapped sheet.
3. Search/filter the register and directory; inspect empty and error recovery,
   paging, invitation review safeguards and existing editing controls.
4. Sign in as member. Review verification progress, real association activity,
   membership details, events, inquiries, profile and security. Top navigation
   scrolls as one row on small screens.
5. Switch appearance through the account panel. Check both appearances on a
   phone and a desktop, including long values and keyboard focus.
6. Inspect signup, invitation, email verification and password recovery states.
   Entered values, existing credential rules and shared role routing remain in
   the original authentication components.

## Operational boundaries

`TPA_DEPLOYMENT_ENV=local|testing|production` is optional server configuration.
Unknown or absent values show no environment badge. `NODE_ENV` is never used to
claim production. Mail-sink state is shown separately in Communications and
Email settings, with no sending-mode switch or behavior change.

No endpoint, database migration, permission grant, payment rule, live email send,
merge, push or deployment is part of this revision. Public landing source and
branding assets are unchanged. The cleanup inventory remains in
`TPA_CLEANUP_REVIEW.md` and no original checkout is retired here.

## Verification record

All results below are **local/synthetic**, using the optimized Next.js build,
loopback PostgreSQL, isolated storage fixtures and mail sinks. There is no
hosted or production acceptance claim.

| Check | Result and evidence |
| --- | --- |
| Optimized app, worker and TypeScript | PASS; `.local/launch-readiness/2026-10-29T08-44-54.297Z-7df366b9/results.json`. The recorded build ID and input digest are checked against the final source. |
| Lint, unit tests and structure | PASS; 130 unit tests, no skips. The structure checker includes staged additions. Generated browser-report bundles are explicitly excluded from source linting. |
| Portal regression suite | 60/60 PASS across desktop, tablet and phone. Preserved report: `output/playwright/portal-review/full-portal-report`. |
| Final copy/inspector presentation | 9/9 focused browser cases PASS after the last presentation correction; register layout, copy failure, preview pinning and dismissal in all three browser projects. |
| Responsive routes | 310 checks: 18 admin states, seven member destinations and six authentication routes at 320/390/768/1024/1440 in both appearances. No document-wide horizontal overflow; desktop header/navigation is 102px and every portal title begins within 200px. Evidence: `output/playwright/portal-review/horizontal-verification-matrix/results.json`. |
| New shared interactions and roles | Six groups PASS: hover-to-card movement, successful clipboard writing, clipboard-denial fallback, stable inspector/sheet focus restoration, delayed-response selection safety, filtering, account panel pinning, all six staff roles, 96 direct-workspace checks and 42 protected API checks. Evidence: `output/playwright/portal-review/horizontal-verification/results.json`. |
| Profile and application workflows | Real profile save/retry and professional application submission PASS (two desktop cases). Submission also exercises a deliberately mocked 503 before the real successful request. Synthetic document metadata is used; no production documents. |
| Signup, verification and password recovery | One complete real browser journey PASS against the local mail sink. Two additional desktop/phone dashboard-state cases PASS with explicitly mocked verification states. |
| Profile reflow and enlarged view | PASS at 1440/1280/768/390/320, light/dark, long fields and 200% CSS zoom; `output/playwright/portal-review/profile-reflow`. |
| Authentication/security integration | PASS; `.local/launch-readiness/restricted-2026-10-29T07-49-07.281Z-8f1a5281`. Actual admin/member sign-in, redirects, sign-out, expired/revoked session boundaries and backend operations. Eight browser cases pass; four tablet/phone duplicates are intentionally skipped because destructive session/role fixtures run once on desktop. |
| Member foundation and review boundaries | PASS; `.local/launch-readiness/restricted-2026-10-29T07-21-26.015Z-68b24b17/member-foundation.log`. Real disposable-database tests cover ownership, private pending details, administrator review decisions, registrations and CRM isolation. |
| Content, media and website controls | PASS; `.local/website-control/2026-10-29T07-35-06.575Z`: real editor save/reload/preview/publish/withdraw, media description/publication, scoped permissions, and desktop/tablet/phone accessibility. Object storage uses an isolated local test endpoint. |
| Events, payments and exports | PASS; `.local/event-flow/2026-10-29T07-51-29.451Z`: real reservation, payment-reference/manual verification, mail-sink delivery, attendance and PNG/PDF flyer exports. Payment-table keyboard scrolling, six width/appearance combinations, Axe, empty state and cancelled-confirmation focus also pass. |
| Event operations | PASS; `.local/event-operational/2026-10-29T07-43-43.696Z`: staff creates/configures/publishes, member books/submits reference, staff verifies, attendance/expenses/resources/completion and member history. Promotion delivery uses mocked transport and storage uses a local mock service. |
| Inquiry reporting | 9/9 PASS; `.local/launch-readiness/restricted-2026-10-29T07-31-31.710Z-61402b91/v1.log`, covering public/member issue reports, CRM tracking and safe context consent. |
| Visual review | Chrome and the in-app browser exercised the optimized application. Gallery includes baseline comparisons for the first three screens and 25 complete portal captures. |

Earlier failed runs are retained as diagnostic evidence. They identified obsolete
sidebar/shortcut assertions, a missing compact-search accessible name, duplicate
expired-link headings and a horizontal-navigation focus race; these were fixed
and retested. A network-change interruption and one payment-table confirmation
timeout passed on subsequent complete/targeted runs. Failed attempts are not
counted as passes above.

**Not verified externally:** real email delivery, live object-storage providers,
production payment reconciliation, hosted deployment/health and production user
data. No money was transferred. The demo's explicit testing badge and mail-sink
notice must not be interpreted as production readiness approval.

For repeatable portal checks in this existing disposable environment:

```powershell
node .local/portal-review/run.mjs node_modules/@playwright/test/cli.js test tests/browser/portal-design.spec.ts
node --import tsx .local/portal-review/check-horizontal.mjs --matrix-only
node --import tsx .local/portal-review/check-horizontal.mjs --interactions-only
```

The client approval decision is the appearance and usability of the completed
portals. Merge, push and production release still need separate explicit
authorization, followed by hosted verification.
