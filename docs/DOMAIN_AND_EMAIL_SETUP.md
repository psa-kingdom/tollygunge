# Domain and email setup

## Verified 2026-10-06

Purchased domain: `tpassociation.org`. Public DNS returns Hostinger nameservers
`artemis.dns-parking.com` / `hermes.dns-parking.com`, apex A `2.57.91.91`,
and `www` CNAME to the apex. No MX/TXT answer was observed at the apex;
`_dmarc` returned NXDOMAIN. Recheck the authenticated zone before any changes.
These are public observations, not proof of account ownership or hosting readiness.

Official Hostinger remote MCP is registered at `https://mcp.hostinger.com`.
OAuth consent is pending. No DNS changes were made. Existing unrelated MCP
configuration was preserved; no token was written into configuration.

Vercel CLI authentication succeeds, but there is no TPA project in the current
scope. Dedicated Railway `tpa-platform` contains only PostgreSQL; there is no
public application deployment. Do not describe intended URLs as live services.

## Links

- Current frontend: http://127.0.0.1:3000/
- Current login: http://127.0.0.1:3000/login
- Current staff workspace: http://127.0.0.1:3000/admin
- Current member workspace: http://127.0.0.1:3000/member
- Current backend API base: http://127.0.0.1:3000/api
- Railway project: https://railway.com/project/1f2b5099-790f-48c3-96e9-e62b142157fb
- Source: https://github.com/psa-kingdom/tollygunge
- Draft implementation PR: https://github.com/psa-kingdom/tollygunge/pull/1

Intended canonical public origin: `https://tpassociation.org` with `www`
redirecting there. Frontend, member/admin routes and backend APIs share one
Next.js deployment. PostgreSQL and R2 are private dependencies, not public
backend dashboards. Never distribute database connection URLs.

## Deployment sequence

1. Complete Hostinger OAuth and snapshot the current authoritative zone.
2. Choose deployment roles and inspect hosting cost before resource creation.
   Vercel is available for the integrated app, Railway for PostgreSQL and a later
   worker, R2 for private storage. Hostinger remains registrar/DNS provider.
3. Resolve managed runtime secrets. Generate an independent auth secret;
   configure database identity and verified TLS, canonical Better Auth origin,
   and a separate scoped R2 credential. Original Cloudflare credential values
   must remain only in their original file. Production storage currently refuses
   local credential-file loading and needs an explicit production adapter.
4. Deploy and verify a staging origin before routing the purchased domain.
   Obtain the hosting provider's exact DNS targets and verification records;
   preserve existing MX/TXT/CAA and export a rollback snapshot.
5. Verify HTTPS, canonical redirect, authentication/session revocation, server
   permissions, private documents, inquiries, backups and recovery. Public signup,
   paid memberships and deliveries remain gated by their own configuration.

## Resend preparation

Proposed transactional domain: `notifications.tpassociation.org`; proposed sender
`TPA <no-reply@notifications.tpassociation.org>`. These are proposals, not verified
addresses. Keep campaign sending disabled until queues, retry/idempotency,
delivery webhooks, consent rechecks and unsubscribe behavior are implemented.

Create the domain in the association's Resend account, retrieve the exact DNS
records it generates and add only those records through authenticated Hostinger
DNS. Preserve existing mailbox routing. Resend sending verification does not
establish a shared mailbox or incoming-reply workflow.

Existing password recovery uses TLS SMTP and can use Resend's documented
`smtp.resend.com`, port `465`, username `resend`, with its API key held only in
managed secret storage as `SMTP_PASSWORD`; set the verified `AUTH_EMAIL_FROM`.
Enable it only after DNS verification and a controlled recovery test. Do not
place live API keys in this file, Git, chat or command output. Transactional
tracking should stay disabled for recovery messages.

Sources: [Hostinger MCP](https://www.hostinger.com/support/11079316-hostinger-api-mcp-server/),
[Resend domains](https://resend.com/docs/dashboard/domains/introduction),
[Resend SMTP](https://resend.com/docs/send-with-smtp).
