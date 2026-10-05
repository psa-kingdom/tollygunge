# Architecture and decisions

Approved: one Next.js/TypeScript application, PostgreSQL, private object storage and
a background worker from the same codebase. Provider accounts and deployment roles
must be confirmed at each dependent phase. Dedicated Railway PostgreSQL and a private
Cloudflare R2 bucket are provisioned; the application is not deployed to production.

Product: Tollygunge Professional Association, broader than a CA-only forum.
Public website, member portal and focused admin workspaces share domain services.
Retain navy/gold identity; emphasize readability, restrained motion and simple workflows.

Membership: Patron/Annual/Life plans; professional/student categories. Fees and
eligibility are not yet supplied. Payment precedes review; only approval activates
membership and generates its number. Rejections queue staff-approved refunds.
Application, membership and payment states remain independent.

Attendance is physical/event participation, independent of registration. Learning
hours are TPA records, not an external accreditation claim. Approved learning-hour
rules and import mappings are required before that slice.

Email: shared inbox/replies, templates, opted-in campaigns and event logs. WhatsApp:
official business integration. Central adapters and durable background processing;
provider event verification and idempotency. News is collected into attributed drafts
for editorial approval. Flyers support one/two speakers, links/QR and PNG/PDF export.

Authorization will be enforced on the server: administrator, membership reviewer,
content editor, event operator, communications operator, finance operator and member.
Members access only their records; certificates and application photos remain private.
Audit consequential actions. Never use client-only role checks for real operations.

Better Auth establishes identity using PostgreSQL-backed sessions. Cookie caching is
disabled so server requests recheck revocation. Google OAuth is the first sign-in method;
provider configuration is pending. TPA services separately load stored staff roles and
authorize all operations. /member requires a verified identity; /admin also requires a
staff role. No signup or client payload grants roles. Profile records are unique per
identity; newsletter consent is separate from authentication. Authentication users are
referenced by foreign keys in profiles, staff roles, private documents and audit events.

The synthetic workspace lives at /preview/admin, explicitly labelled and excluded from
indexing. /admin contains protected operational shells. No preview action approves a
membership or changes real records. /join is still an application preview.

Private documents use bounded server uploads (5 MB files), category/MIME/signature
validation, opaque UUID object keys, own-record listings and owner/reviewer downloads.
Reviewer access and profile/consent changes are audited. Downloads use no-store responses
and 60-second attachment links. Failed writes compensate with object deletion; cleanup
failures create an audit event for reconciliation. Original Cloudflare credentials are
read transiently from their source file only during local development. Deployed storage
is disabled until a managed production secret mechanism is confirmed. File signatures
are format checks, not malware scanning; production hardening must consider scanning.
