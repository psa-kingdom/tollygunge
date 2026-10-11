# Public inquiries and follow-up — 2026-10-06

Visitors can submit on the homepage (`#connect`) or Contact page without signing in.
Required: name, email, topic, reply preference, subject, message and contact consent.
Optional: phone, company, role and city. Phone is required for a phone reply. No
identity documents, payment details or company registration documents are requested.
Only submitted fields are stored; visiting a page does not create a contact record.
This is contact permission for the particular inquiry, not newsletter consent.

`POST /api/inquiries` validates bounded JSON and the configured same origin. A
honeypot and serialized PostgreSQL quotas limit each supplied email to three public
submissions per day and total public intake to 100 per hour. This is a baseline,
not strong identity or bot verification: public addresses are sender-supplied.
Deployment needs trusted edge throttling/Turnstile and monitoring before launch.
Request IDs and payload hashes make network retries idempotent; changed retries
conflict. No account is created. An authenticated account is linked only if its
server-established email matches the supplied email; otherwise the contact remains
unlinked. Anonymous callers cannot list records or retrieve contact details.

Communications operators and administrators access Inquiries. Other staff and
ordinary accounts cannot read its contact details, tags, internal notes or change
history. Members retain access only to their own linked inquiry subject/message/status.

Staff can set New, Contacted or Closed; add up to eight normalized tags; assign an
eligible operator; set/clear a follow-up date; and add private notes. Each saved edit
uses a version check, records an immutable state-history entry and audit event.
Existing Open/In progress/Resolved statuses migrated to New/Contacted/Closed.
Search, status, tag and open/overdue/unassigned filters apply in PostgreSQL before
50-record pagination, so records beyond the first page remain discoverable.
Closed records retain their data and history and can be reopened.

History and consent are retained; no deletion or automatic messaging is exposed.
Automated delivery, inbound replies, privacy retention/export/delete administration
and production anti-abuse setup remain later work. Staff changes do not send mail.
