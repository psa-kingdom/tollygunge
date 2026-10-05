# Implementation status — 2026-10-05

## Working locally

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
- Permission-scoped event/attendance, content, inquiry and consent reports with CSV
  export. Staff overview shows publication drafts, unassigned inquiries and overdue
  follow-ups instead of decorative dashboard statistics.
- Historical attendance CSV preview, header/date validation, existing-identity/event
  matching, ambiguous-person errors and duplicate detection. Nothing is committed.

Migrations 001–006 use the checksummed, database-identity-checked transactional runner.
Dedicated Railway `tpa-platform` PostgreSQL and private R2 `tpa-private-documents`
remain separate from other projects. Original Cloudflare credential values remain in
only their supplied file; local operations read them transiently. No production app
is deployed. Official Cloudflare skills/MCP setup persists; Main/Bindings consent is
pending, while Docs, Builds and Observability are available as previously verified.

## Verification

14 unit tests cover permissions, file boundaries/cleanup, input validation, protected
sitemap sections, attributed news restrictions, unapproved payment/hour rejection and
CSV parsing/duplicates. PostgreSQL tests cover repeatable migrations, foreign keys,
password/reset token behavior, audits and session revocation. HTTP tests cover all
staff permissions and member isolation, publication snapshots/conflicts, private
application drafts/document ownership, concurrent last-seat registration, duplicate
check-ins, cancellation history, CRM note privacy, disabled delivery and import commit.
Synthetic records and any earlier storage objects are removed after tests.
Browser checks cover CMS draft save/private preview, event creation/publication with
native keyboard date controls, one/two-speaker PNG generation and actual PDF download.
Both exported PNG QR codes were decoded and matched the intended published event URL.

## Explicit remaining gates

Resend is selected; the user requested configuration later. Continue other work without
email delivery. Google OAuth credentials are still needed for public Google onboarding.
The approved administrator uses operator-approved password access; mailbox verification
is not fabricated and no login or signup automatically grants roles.

Payment gateway credentials/test mode plus approved plan/student fees, eligibility,
declarations and rejection/refund terms are required for checkout, paid application
review, activation/numbering, renewals, receipts and refunds. Payment states must remain
independent from approval and attendance; redirects cannot authorize payment completion.
Learning-hour rules and historical mapping/provenance require confirmation before awards
or imports can be committed. No external CPE accreditation is claimed.

CMS public-media management, scheduled source collection, background delivery jobs,
shared inbox/replies, WhatsApp, membership/payment reports and production release remain
incomplete. News can currently be entered as an attributed editorial draft. Approved
source feeds and collection schedule are needed for collection; private application media
must never become public CMS assets. Production deployment needs provider configuration,
managed secrets, backup/recovery and end-to-end staging verification.
