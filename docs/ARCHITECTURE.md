# Architecture and decisions

Approved: one Next.js/TypeScript application, PostgreSQL, private object storage and
a background worker from the same codebase. Provider accounts and deployment roles
must be confirmed at each dependent phase; no production resources provisioned yet.

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

Current /admin is a public synthetic design preview, explicitly labeled and excluded
from indexing. It must be replaced with authenticated server-backed operations before
loading any real data. No client state here is evidence of actual approval or payment.
