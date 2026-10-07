# TPA hosting — 2026-10-06

The user approved incremental Railway app usage and managed hosting secrets.
The integrated Next.js frontend and backend are deployed as `tpa-web` in the
existing isolated `tpa-platform` project. No Vercel upgrade or unrelated service
change was performed. App limits are 1 GB memory / 1 vCPU, one replica; these are
resource limits, not a spending cap. Existing workspace spending limits were not
changed. Usage remains metered and depends on traffic.

Temporary origin: https://tpa-web-production.up.railway.app
Intended canonical origin: https://tpassociation.org
Staff: `/admin`; member: `/member`; login: `/login`; API base: `/api`.
Readiness: `/api/health` queries PostgreSQL and returns no credentials or records.

Managed settings contain a fresh independently generated Better Auth secret,
Railway's private PostgreSQL connection reference, database identity, CA certificate
and TLS identity. No original Cloudflare credential was copied. Local credentials,
handoffs, certificates and environment files are excluded from the Docker build.
The container runs as a non-root user.

Cloudflare storage is deliberately unconfigured on the deployed app. Its adapter
supports managed credentials, but enabling it needs an independent bucket-scoped
Object Read & Write credential. A new token is not technically required by S3;
it preserves the user's explicit original-secret restriction and limits runtime
access to TPA's bucket. Password recovery/email, Google OAuth, Razorpay, campaign
sending and membership activation remain separately gated. Resend DNS records
must come from the association's own Resend domain configuration.

## Hostinger DNS

The official MCP registration exists, but callable tools remained unavailable after
restart. Direct use of the saved OAuth could not be resolved. The user-opened,
signed-in Hostinger domain page was used as a fallback; no new API token is needed
for these completed DNS changes.

Original authoritative zone contained only A `@` -> `2.57.91.91` (TTL 50) and
CNAME `www` -> `tpassociation.org` (TTL 300). A local rollback snapshot was saved;
Hostinger's DNS history exposes restore snapshots. The parked A was replaced
with Hostinger's supported root ALIAS. No nameserver, mailbox or unrelated
domain settings were changed.

Current routing:

- ALIAS `@` -> `92qiqgno.up.railway.app`, TTL 300.
- CNAME `www` -> `7zgwmbqg.up.railway.app`, TTL 300.
- Railway-generated ownership TXT records at `_railway-verify` and
  `_railway-verify.www`, TTL 300.

Railway manages certificates. Do not bypass TLS checks while DNS/certificates
propagate. Update the auth canonical origin only after HTTPS succeeds.

## Verification and rollback

The first Railway deployment passed readiness, homepage rendering, anonymous
member/admin redirects, unauthorized staff API denial, existing administrator
login, staff routing, sign-out and revoked-session denial. Its verification login
was signed out; no fixture records, payment changes or messages were created.
Browser confirmed the rendered homepage and DNS record values.

For a failed app release, redeploy the last healthy Railway deployment. For a
failed domain cutover, restore the original website records through Hostinger DNS
history or recreate the two original records above; restore the temporary auth
origin when necessary. Keep PostgreSQL and its volume intact. Do not point the
public domain at a deployment that fails readiness or authentication checks.

This is an initial hosted rollout, not acceptance of all planned production
integrations, anti-abuse controls, recovery procedures or business policies.

## Canonical origin verification

Root-domain HTTPS and readiness passed. `BETTER_AUTH_URL` was updated to
`https://tpassociation.org` in managed settings and redeployed. Administrator
login, staff routing, sign-out and revoked-session denial passed again on this
domain. Browser confirmed its homepage. The `www` permanent redirect preserves
path/query and is implemented; both domains now have verified ownership and valid certificates. A live request to www/contact?source=verification returned 308 to the exact root-domain path and query.
Both CI runs passed on implementation commit `c2efd89` (26 unit, 4 PostgreSQL,
7 HTTP flows, lint, build and type checks). No messages or payment operations
were performed. The application deployment remains separate from a main-branch
merge; no automatic GitHub deployment source was connected.

Live runtime deployment: ac5d0d96-4c52-43fc-8d62-050644b7971e, implementation
commit c2efd89. Railway built and started the Docker image successfully. Browser
viewport observations exposed the public mobile menu and keyboard expansion;
the resized screenshot did not reliably match the reported viewport, so native
mobile visual acceptance remains separate.

## Current storage rollout — 7 October 2026

Hosted document, editorial-media, payment-QR and portrait uploads are enabled and verified.
The fresh account-wide Object Read & Write pair is held in Railway managed settings;
application bucket restrictions do not make the credential bucket-scoped. Production
file fallback is disabled. Public development access is disabled (live object-denial
probe passed); no custom domains are connected according to user confirmation.
Publication/review/payment states remain independent. See [R2_UPLOAD_ROLLOUT.md](R2_UPLOAD_ROLLOUT.md)
and [DELIVERY_CHECKLIST.md](DELIVERY_CHECKLIST.md) for evidence and retained dependencies.
Earlier missing-storage statements in this report describe their dated release state.
Resend remains deferred; report presets/XLSX are next independent work.
