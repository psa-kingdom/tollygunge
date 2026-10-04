# Provider setup

Railway and Vercel CLI access were verified on 2026-10-04. No existing TPA Railway
project was found. Do not reuse UMS, Crazy Hands or another project's database.
Dedicated resource provisioning remains awaiting the user's selection.

R2: use the user's existing distinct bucket. Exact bucket name and whether it is
exclusive to TPA are awaiting confirmation. Public development access and custom
domains must be disabled for a bucket holding membership evidence. If the proposed
bucket is already public or shared with a public project, resolve that conflict
before uploading private documents. Do not change a shared bucket's settings.

Set bucket-specific credentials only in ignored .env.local or deployment secrets.
Do not paste secrets in chat, log them, commit them or expose NEXT_PUBLIC variants.
The storage adapter uses R2's S3 endpoint and the tpa/private/documents namespace.
Downloads expire in 60 seconds. Browser uploads/CORS are not required for the planned
server-proxied upload path, which must validate size, category and file signature.

DATABASE_URL selects PostgreSQL. Set TPA_DATABASE_NAME to the exact database name
to guard migration targeting. DATABASE_SSL=true requires certificate verification;
never disable certificate verification to bypass connection errors.
Run npm run db:migrate only against the dedicated TPA database. Migrations are
transactional, checksummed and serialized with an advisory lock. The first migration
contains staff roles, private document metadata and audit records; provider-specific
auth tables and foreign keys follow once the authentication choice is confirmed.

Authentication decision: Auth.js now recommends Better Auth for new projects.
Better Auth is proposed, awaiting the user's answer. No login endpoint or automatic
staff privilege assignment has been enabled. Google OAuth registration and approved
staff identity are required before live sign-in. Email sign-in awaits email setup.

Current status: implementation helpers only. No bucket writes, live migrations,
cloud creation, authentication activation or production deployment have occurred.
