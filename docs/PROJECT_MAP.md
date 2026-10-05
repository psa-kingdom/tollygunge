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
Membership activation, events, registrations, orders and payments will be separate records.

Database migrations: migrations/*.sql; checksummed runner: scripts/migrate.mjs.
Generated auth schema: 002_better_auth.sql; identity links: 003_identity_links.sql.
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
