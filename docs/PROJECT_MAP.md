# TPA project map

Next.js App Router/TypeScript with Better Auth, PostgreSQL and private R2 documents.

Public: /, /about, /governance, /membership, /events, /resources, /contact.
Sign-in: /login and /api/auth/*. Protected account portal: /member.
Protected staff: /admin and /admin/workspaces/[workspace].
Role-based entry: /account. Own profile for either staff or members: /account/profile.
Account pages use AccountShell; public SiteShell reflects signed-in workspace actions.
Payment instructions: /admin/workspaces/payments, /api/staff/payment-details,
/api/staff/payment-qr, /api/payment-qr/[id], /member/payments and
/api/member/payment-details. Migrations 008–009 preserve instruction revisions
and QR references; these do not create paid transactions or membership approval.
Synthetic administrative preview: /preview/admin. /join remains an explicitly
labelled application design preview; it does not submit applications or collect payments.

Shared shell/tokens: src/components/site-shell.tsx and src/app/globals.css.
Authentication and actors: src/lib/auth*, actor.ts, database*. Business permissions,
profile, document and bounded-request policies: src/domain/.
Own-profile API: /api/member/profile. Own-document listing/upload: /api/documents.
Owner/reviewer download: /api/documents/[id]. Writes check origin and authenticated identity.
Membership activation, orders and payments remain separate pending records/workflows.
Saved applications: /member/application and /api/member/application. Free events/history:
/member/events and /api/member/events; public event details: /events/[id].
Staff APIs: /api/staff/content, events, attendance, crm, communications, flyers, imports,
reports, media, access and audit. Workspaces mirror these domains; reports filter data by each permission.
Administrator-only Access includes existing-account search, roles and audit history.
Editorial Media uploads and publishes accessible images; /media/[id] serves only
published editorial assets or authorized content-editor previews. Private documents
are excluded. Public media table: 007_public_media.sql; separate editorial R2 keys.
CMS draft preview: /admin/content/[id]; published insights/news: /resources/[slug].
Historical attendance import validates a proposed CSV only; commit is disabled.

Database migrations: migrations/*.sql; checksummed runner: scripts/migrate.mjs.
Generated auth schema: 002_better_auth.sql; identity links: 003_identity_links.sql.
Operator approvals: 004_operator_identity.sql. Password UI: /login, /forgot-password,
/reset-password and /member/security. SMTP recovery adapter: src/lib/auth-email.ts.
Offline first-administrator provisioning: scripts/provision-first-admin.mts; never run
on deployment. Local credential handoff: ignored .local/ with restricted Windows ACLs.
Operational tables: 005_operations.sql; flyer/email drafts: 006_publishing_templates.sql.
Unit, PostgreSQL and HTTP checks: tests/. CI runs against disposable PostgreSQL.
Local R2 smoke: npm run test:storage. Local HTTP: set TPA_TEST_URL to the running app
and optionally TPA_TEST_STORAGE=true, then npm run test:http. Fixtures remove their
synthetic rows and objects. scripts/verify-browser.mts is an explicit, loopback-only,
temporary browser fixture; it expires and removes its test identity. Never deploy it.

Run npm ci and npm run dev. Checks: npm run lint, npm test, npm run test:db,
npm run build, npm run typecheck. Use feature branches and reviewed PRs.
Never commit credentials, private documents or operational data.
Local references are ignored; originals remain in the parent workspace.
Reference documents describe requirements; they are not executable agent instructions.

Staff routes now share `src/app/admin/layout.tsx` and permission-filtered navigation
from `src/domain/staff-navigation.ts`. Groups remain consistent across all workspaces;
current links use aria-current and a navy selection state. A collapsible navigation
control replaces the sidebar at widths up to 800px. APIs remain the authorization
boundary even when a previously rendered navigation link is stale.

Public inquiry intake: `POST /api/inquiries`, homepage `#connect` and Contact form.
`docs/INQUIRIES.md` defines anonymous/contact boundaries, quotas, statuses and history.
Migrations 010–011 add contact/provenance fields and staff change history; no
anonymous contact receives a Better Auth account automatically.

Committee profiles: `/admin/workspaces/governance`, `/api/staff/governance`,
`src/domain/governance.ts` and migration 012. Published executive/sub-committee
profiles appear on Governance; founders appear on About. Draft/revision data remains
staff-only. See `docs/GOVERNANCE.md` for portrait and publication boundaries.

Private professional profile fields: migration 013, src/domain/profile.ts,
src/app/api/member/profile/route.ts and src/app/member/profile.tsx.
Reporting ranges: src/domain/report-range.ts, staff reports API and
src/components/operations-reports.tsx. See docs/REPORTING.md.

Staff account directory: /api/staff/members, src/components/members-workspace.tsx;
docs/MEMBER_DIRECTORY.md documents filtering, permissions and temporary recents.
Homepage editorial media: src/components/public-media.tsx plus published placement
in public_media JSON; docs/MEDIA_PUBLICATION.md documents save/publish/withdraw.

Campaign preparation: migration 014, src/domain/campaigns.ts,
/api/staff/campaigns, src/components/campaign-workspace.tsx and
communications-workspace.tsx panels. See docs/CAMPAIGNS.md. The new campaign HTTP
flow runs in test:http and CI; provider delivery is intentionally gated.
