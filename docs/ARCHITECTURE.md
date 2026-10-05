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

## Operator-provisioned password identity

Authentication and mailbox verification remain distinct. Public password registration is
closed. Offline, user-authorized provisioning may grant a staff role and insert an explicit
operator-approved identity record; it does not mark emailVerified true. Business access
requires either verified email or that server-owned approval record. Role checks still run
on every request. Removing approval from an unverified identity immediately blocks its
business access. Password recovery is provider-gated, single-use, expires in 15 minutes
and revokes sessions; recovery never assigns privileges. Production uses managed secrets.

## Operational boundaries

CMS content has a mutable draft, a separate published snapshot and immutable revision
records. Every mutation checks its version and records an audit within the transaction.
Public pages read only published snapshots. Structured page sections preserve the brief's
submenu anchors; default site copy is shared with the editor rather than duplicated.
News is an attributed short summary and source link; collection/publishing are distinct.

Applications currently remain private drafts, with document references checked against
their owner. No submission, payment, approval or membership is inferred from saving.
Event capacity is serialized by an event-row lock shared by registration/cancellation
and check-in. Unique registrations/attendance prevent duplication. Attendance does not
award learning hours. Cancellation retains registration and attendance history.

CRM staff notes are never returned through the member inquiry endpoint. Assignments
require current communications/admin roles. Communication drafts cannot send messages;
Resend is deferred. Import preview does not create identities or merge ambiguous rows.
Reports only query authorized domains and CSV output escapes formula-leading strings.
Flyer exports render their own event/speaker content; no private application media is
published or fetched. Production providers, worker delivery/collection, approved business
rules and recovery verification remain release gates.
# Additional operational boundaries

Staff role replacements are administrator-only, reject self-access edits, compare
the observed role set and serialize under a transaction advisory lock. The acting
administrator's role is rechecked inside that lock. Each grant/removal is audited
and all affected sessions are revoked atomically. Identity verification or explicit
offline operator approval is required before a staff grant; roles never bootstrap
mailbox verification or association membership. Audit inspection is administrator-only
with keyset pagination and no private document contents.

Editorial media occupies `tpa.public_media` and `tpa/editorial/media/<uuid>` object
keys, separate from private application document records/keys. JPEG/PNG uploads
must pass signature and full decoding checks, bounded pixel count, static-image
validation and WebP re-encoding that removes original metadata. Only the normalized
image is stored. Staff explicitly publish saved description snapshots. Public reads
require a published media row and use no-store responses, allowing unpublication to
close future access. Authorized content editors can preview drafts. There is no
endpoint that converts a private application document to public media.
# Account and payment instruction boundaries

`/account` chooses the destination from server-owned roles. Staff sign-in goes to
`/admin`, ordinary approved identities go to `/member`, and anonymous visitors go
to login. Staff visiting `/member` redirect to their workspace; their own profile
is accessible through `/account/profile`. Account pages use a dedicated header.
Public pages remain public and personalize only their workspace/login action;
request headers make these renders dynamic rather than shared session output.

Payment instruction records are not payment/order/membership states. Draft saves
and explicit Active/Draft/Past transitions use record locks and versions. Active
snapshots stay stable across draft edits. Activation requires authorized finance
access and a payee confirmation. All revisions and state transitions are audited.
QR snapshots reference a separate private image table through generated foreign-key
columns, preserving historical file references. Member QR reads require a currently
Active snapshot; finance reads allow private previews. No public gallery or document
endpoint accepts a payment QR record. No scanning or screenshot authorizes payment.

Association editorial profiles are independent from authentication and member
profiles. Generated media foreign keys retain optional portrait references; only
published editorial portraits may be selected for publication. Public readers get
published snapshots only. Public inquiries allow nullable authentication ownership,
require contact/provenance/consent for web forms, and restrict anonymous audit actors
to the public-submission action; consequential staff audit actions still require
an authenticated actor. Staff status/tag/assignment edits retain versioned history.
