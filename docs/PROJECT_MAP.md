# TPA project map

Next.js App Router/TypeScript with Better Auth, PostgreSQL and private R2 documents.

Public: /, /about, /governance, /membership, /events, /resources, /contact.
Sign-in: /login and /api/auth/*. Protected account portal: /member.
Protected staff: /admin and /admin/workspaces/[workspace].
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
