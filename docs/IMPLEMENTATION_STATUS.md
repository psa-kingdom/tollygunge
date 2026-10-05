# Implementation status

## Current slice — 2026-10-05

Public design foundation plus identity/private-document implementation. Better Auth
1.7.7 is pinned. PostgreSQL-backed sessions, separate profiles/consent, protected
member/staff routes, role authorization, audited private uploads/downloads and
checksummed identity migrations are implemented. No automatic administrator assignment.
Synthetic member review moved to /preview/admin; /join remains a design preview.

Private `tpa-private-documents` bucket and isolated Railway `tpa-platform` Postgres
service are created. Migrations applied and verified with TLS certificate validation.
Supplied Cloudflare credentials were not copied into the repository or configuration.
Local runtime reads their original file transiently. Deployed storage is disabled.

Official Cloudflare skills and five MCP registrations are installed. Docs needs no
OAuth; Builds/Observability are authorized. Main Cloudflare/Bindings consent is pending.

## Verified

Unit tests: role matrix, private-document access, file categories/size/signatures,
object namespaces, profile validation, explicit consent, bounded request bodies and
failed-upload compensation. PostgreSQL: repeatable migrations, wrong-target rejection,
identity foreign keys, unique profiles, no automatic staff roles and immediate session
revocation. HTTP: anonymous redirects/401s, own-profile writes and cross-member isolation,
all staff workspace permissions, invalid/oversized files, valid private image upload,
owner/reviewer downloads, 60-second links, reviewer audits and sign-out revocation.
Synthetic HTTP records/objects were cleaned up. Direct R2 smoke verified anonymous
access denial and object deletion. CI includes disposable PostgreSQL and production
HTTP checks; live cloud storage is tested locally only.

Lint, build and TypeScript passed. Browser verified desktop/mobile sign-in, synthetic
authenticated profile saving/consent, keyboard traversal, sign-out and protected-route
redirect after revocation. Mobile page width stayed within the viewport. The temporary
loopback fixture was removed afterward; this does not replace real Google OAuth verification.
Earlier foundation browser
checks covered desktop/mobile public routes, student application preview and synthetic
review interactions. See parent preview-evidence for screenshots outside Git.

## Remaining gates

Google OAuth client configuration, verified password-recovery email sender, two Cloudflare
OAuth consents and managed production secret storage. Real Google login cannot be
verified without its client configuration. No production application deployment yet.

Future slices: CMS; membership/payments; events/member history; CRM/communications;
flyers/news; reports/hardening. Placeholder workspaces are not completed modules.
Membership activation, payments, live email delivery and external CPE accreditation remain
outside this slice. Approved fees, eligibility, declarations, refund terms, learning-hour
rules, verified association copy and historical import mapping are still needed.

## Administrator password follow-up

The user-approved Gmail administrator is now provisioned with an explicit server-side
administrator role, a separate profile and an auditable operator-approved identity record.
Mailbox verification is not fabricated. Initial password is generated locally, handed off
through a Windows ACL-protected ignored file and stored only as a scrypt hash in PostgreSQL.
Password sign-in, authenticated password change, recovery request and reset screens are
implemented. Public password signup stays closed. Recovery email awaits a verified sender.

PostgreSQL tests verify successful/failed password login, disabled signup, current-password
checks, expired/single-use reset tokens, session revocation and no automatic staff grant.
The approved administrator's real local login, staff access, security route and sign-out
were verified without printing credentials. Lint, unit tests, build and TypeScript passed.
Browser verified the real administrator sign-in, protected security page, sign-out,
keyboard focus and mobile password/recovery layouts. HTTP checks verified operator
approval removal immediately blocks access. Password changes/reset actions are audited.
