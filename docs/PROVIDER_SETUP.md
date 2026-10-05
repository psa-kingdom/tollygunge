# Provider setup

## Created and verified on 2026-10-05

Cloudflare: dedicated `tpa-private-documents` R2 bucket. Managed public access is
disabled and custom domains are absent. Synthetic upload, signed download,
anonymous-access denial and deletion verification passed. Original supplied
credentials remain only in their original file. Local storage reads that file
transiently via CLOUDFLARE_CREDENTIAL_FILE. Never paste its contents into configuration.
The object namespace is tpa/private/documents; download links expire in 60 seconds.

Railway: dedicated `tpa-platform` project with one Postgres service and persistent
volume, isolated from other projects. Pricing was checked before creation; no plan
upgrade or billing-approval step was required. Compute/storage and public TCP egress
incur usage charges. The TCP proxy provides local development access; deployed
services should use Railway private networking where possible.

DATABASE_URL and a newly generated BETTER_AUTH_SECRET live in ignored .env.local.
They are not the supplied Cloudflare credentials. The PostgreSQL root certificate
was retrieved through authenticated Railway SSH and saved in ignored .postgres-ca.pem.
DATABASE_SSL=true validates that CA and the configured certificate identity
postgres.railway.internal when connecting through the public TCP proxy.
Certificate renewal needs a refreshed CA if Railway rotates its issuing certificate.
Never disable TLS verification. A dedicated local SSH key is registered with Railway.

## Authentication configuration

Better Auth and its schema CLI (`auth`) are pinned to 1.7.7. Generate SQL against an
empty dedicated database using `node --env-file=.env.local node_modules/auth/dist/index.mjs
generate --config scripts/auth-schema.ts --output <new-migration>.sql --yes`.
Review the SQL, then apply through `npm run db:migrate`; do not use the auth CLI's
direct migrate command. Existing applied migrations must not be edited.
The runner verifies TPA_DATABASE_NAME and serializes checksummed transactional changes.

Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET locally without sharing secrets in chat.
Register a Google web OAuth client with local origin http://127.0.0.1:3000 and redirect
URI http://127.0.0.1:3000/api/auth/callback/google. A production origin and callback must
be configured before deployment. Google sign-in stays disabled until configuration is complete.
Password sign-in is enabled for explicitly provisioned accounts; public password signup
is disabled. Passkeys remain deferred. Ordinary identities require verified email for
business access. The user's explicitly approved first administrator is provisioned by
an offline script and an auditable `operator_approved_identities` record; its emailVerified
flag remains false until mailbox ownership is actually proven. No signup, login or email
comparison automatically grants a staff role.

The approved first administrator is tollygungecacpestudycircle@gmail.com. Its initial
password was generated with 192 bits of randomness and hashed with Better Auth's scrypt.
The local handoff is `.local/first-admin-password.txt` in an ignored directory with Windows
ACLs restricted to the current Windows user and SYSTEM. Read it locally, save the password
in a password manager, change it at `/member/security`, then delete the handoff file.
Never paste it into chat, logs or Git. `scripts/provision-first-admin.mts` requires explicit
approval, checks the target database and refuses existing identities/administrators;
rerunning does not rotate credentials or silently grant roles.

Configure SMTP_HOST, SMTP_PORT (465 or 587), SMTP_USER, SMTP_PASSWORD and AUTH_EMAIL_FROM
using a verified transactional sender in secret storage. SMTP certificate validation and
TLS are mandatory; provider diagnostics are not logged. No sender is configured yet,
so `/forgot-password` accurately displays recovery as unavailable. Reset links carry the
token in a URL fragment (not a server request URL), expire in 15 minutes, work once and
revoke all sessions after reset. `/member/security` changes an existing password with
current-password verification and revokes other sessions. Recovery never grants roles,
membership or mailbox verification. Replacing a password via email is not tested against
the real administrator until delivery is configured.

## Production gate

Storage refuses operations when NODE_ENV=production. Local credential-file access
is not a production secret mechanism. Resolve least-privilege TPA bucket credentials
and managed production secret storage before enabling deployed uploads. No deployment,
DNS changes, email provider, payment integration or membership activation occurred.

## Cloudflare agent setup

Official Cloudflare skills are installed and five MCP servers are registered:
cloudflare, cloudflare-docs, cloudflare-bindings, cloudflare-builds and
cloudflare-observability. Docs requires no OAuth; Builds and Observability completed
OAuth. Main Cloudflare and Bindings require user consent (previous flows timed out).
Use `codex mcp login cloudflare` / `codex mcp login cloudflare-bindings` and complete
the account consent page. Restart Codex if necessary to expose newly configured tools.
Unrelated MCP settings were preserved. Optional beta Cloudflare CLI was skipped.
