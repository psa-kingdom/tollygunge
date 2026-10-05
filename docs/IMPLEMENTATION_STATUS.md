# Implementation status — 2026-10-06

## Working locally

- Role-based sign-in/entry, staff redirection away from `/member`, separate signed-in
  account navigation and an own-profile route for staff. Public navigation substitutes
  workspace actions for login/join when signed in. See `ACCOUNT_VISIBILITY.md`.
- Multiple editable UPI payment instruction records with payee/UPI/contact/QR,
  Draft/Active/Past states, immutable revisions, stale-save protection, explicit
  activation confirmation and active snapshots. Private QR upload/read paths retain
  historical image references. No transactions are marked paid. See `PAYMENT_DETAILS.md`.

- Public navy/gold website and responsive navigation.
- PostgreSQL-backed Better Auth sessions, approved first administrator, password
  login/change and protected member/staff routes. Recovery delivery is deferred.
- Private R2 documents with format/size checks, ownership, audited reviewer access
  and short-lived links. Production storage remains disabled pending secret setup.
- Structured CMS page, insight and attributed-news drafts, private previews,
  versioned revisions, explicit publish/unpublish and public published snapshots.
  Website submenu section order is enforced. Editing a draft does not change its
  publication; stale edits/publications return a conflict.
- Private, resumable professional/student application drafts linked to an account
  and its own documents. No application submission, payment or approval is implied.
- Free events with draft/publish/cancel, serialized capacity checks, idempotent
  registration, cancellation, staff attendance and private member history.
  Published event details are immutable; cancellation preserves history.
- CRM inquiries, staff assignment, private notes, follow-up dates and overdue queue.
  Signed-in inquiries are limited to three per day. Public anonymous submission
  remains closed until abuse protection and public onboarding are configured.
- Saved plain-text communication templates, previews and current consent counts.
  Sending is explicitly disabled. No inbox, campaign or WhatsApp delivery is claimed.
- Saved one/two-speaker flyer templates, event links/QR, PNG and PDF export.
- Administrator-only account lookup and staff role assignment, conflict checks,
  verified/operator-approved identity requirement, session revocation, self-access
  protection and paginated administrative action history.
- Separate editorial media uploads, accessible descriptions, image decoding and
  re-encoding, draft/published snapshots and public resource gallery. The bucket
  remains private; application document keys never enter public media endpoints.
- Permission-scoped event/attendance, content, inquiry and consent reports with CSV
  export. Staff overview shows publication drafts, unassigned inquiries and overdue
  follow-ups instead of decorative dashboard statistics.
- Historical attendance CSV preview, header/date validation, existing-identity/event
  matching, ambiguous-person errors and duplicate detection. Nothing is committed.

Migrations 001–009 use the checksummed, database-identity-checked transactional runner.
Dedicated Railway `tpa-platform` PostgreSQL and private R2 `tpa-private-documents`
remain separate from other projects. Original Cloudflare credential values remain in
only their supplied file; local operations read them transiently. No production app
is deployed. Official Cloudflare skills/MCP setup persists; Main/Bindings consent is
pending, while Docs, Builds and Observability are available as previously verified.

## Verification

17 unit tests cover permissions, file boundaries/cleanup, image decoding/metadata removal, payment instruction validation, input validation, protected
sitemap sections, attributed news restrictions, unapproved payment/hour rejection and
CSV parsing/duplicates. PostgreSQL tests cover repeatable migrations, foreign keys,
password/reset token behavior, audits and session revocation. HTTP tests cover all
staff permissions and member isolation, publication snapshots/conflicts, private
application drafts/document ownership, concurrent last-seat registration, duplicate
check-ins, cancellation history, CRM note privacy, disabled delivery and import commit.
Synthetic records and any earlier storage objects are removed after tests.
The payment/navigation HTTP flow verifies ordinary/staff landing routes, account
headers, anonymous/non-finance denials, active-snapshot isolation during edits,
activation confirmation, stale revision rejection, Past/Draft visibility and QR
ownership boundaries. A synthetic UPI QR uploaded to private R2 decoded correctly
after lossless normalization; the object, instruction revisions and test identities
were removed. Migrations 008–009 were applied and repeatability checked.
Browser verified administrator `/member` redirection, staff profile navigation,
ordinary-account navigation, repeated payment draft edits and moving a draft to Past.
The temporary ordinary-account proxy rendered navigation but its client data remained
loading; ordinary-account data behavior was verified by HTTP instead. No real payment
instructions or funds were changed. The named synthetic UI record was removed.
Additional HTTP checks cover staff identity eligibility, stale role replacements,
no-op session preservation, immediate revocation, audit visibility and concurrent
administrator removals. Editorial media tests cover private draft denial, separate
published descriptions, conflicts, unknown/private document IDs, corrupt image
rejection and local R2 upload/read/unpublish with cleanup. Production storage remains
disabled and CI verifies that gate. Production dependencies have no known audit findings.
Browser checks cover CMS draft save/private preview, event creation/publication with
native keyboard date controls, one/two-speaker PNG generation and actual PDF download.
Both exported PNG QR codes were decoded and matched the intended published event URL.
Browser checks also verified staff self-access restrictions and audit history;
editorial upload, private preview, explicit publication, loaded public image and
gallery withdrawal after unpublication. All temporary media records/objects were
removed; the editorial R2 prefix was empty afterward. The latest responsive check
could not be completed: the browser viewport override retained 1280px and its
screenshots failed until reset. Earlier application mobile verification remains valid;
the new workspaces still need a device-sized browser check before release.

## Explicit remaining gates

Resend is selected; the user requested configuration later. Continue other work without
email delivery. Google OAuth credentials are still needed for public Google onboarding.
The approved administrator uses operator-approved password access; mailbox verification
is not fabricated and no login or signup automatically grants roles.

Razorpay is selected. Its test credentials plus approved plan/student fees, eligibility,
declarations and rejection/refund terms are required for checkout, paid application
review, activation/numbering, renewals, receipts and refunds. Payment states must remain
independent from approval and attendance; redirects cannot authorize payment completion.
Learning-hour rules and historical mapping/provenance require confirmation before awards
or imports can be committed. No external CPE accreditation is claimed.

The user is not ready to approve membership fees or terms; these remain unset and
applications remain drafts. The read-only Crazy Hands comparison is recorded in
`REFERENCE_COMPARISON.md`, including the pending member directory, profile-change
review, dedicated committee records and XLSX export workflows.
Razorpay setup is deferred; the user intends to supply a UPI payment QR first.
The QR/payee and verified-transaction workflow are pending. QR display or proof
upload cannot authorize payment completion. Google OAuth is not set up; the exact
development/production setup is documented in `GOOGLE_SIGN_IN_SETUP.md`.

Scheduled source collection, background delivery jobs,
shared inbox/replies, WhatsApp, membership/payment reports and production release remain
incomplete. News can currently be entered as an attributed editorial draft. Approved
source feeds and collection schedule are needed for collection; private application media
must never become public CMS assets. Production deployment needs provider configuration,
managed secrets, backup/recovery and end-to-end staging verification.
