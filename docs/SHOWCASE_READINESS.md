# First-draft showcase readiness — 6 October 2026

This is a reviewable first draft, not the full operational release. Resend remains deferred.

## Presentation delivered

The public site now uses a warm neutral background, stronger navy/gold typography,
a functional association guide in place of the decorative orbit graphic, quieter
editorial sections, rounded membership/form surfaces and a clearer mobile menu.
The contact form, published CMS/media bindings and identity-aware navigation are
preserved. No sample people, events, statistics or testimonials were added.

## Demonstrable workflows

Public inquiries reach permission-controlled CRM records with New/Contacted/Closed,
tags and follow-ups. Staff can manage content publication, governance, events,
attendance, member profiles, payment instruction versions, campaign drafts,
templates, flyer exports and CSV reports. Accounts remain separate from approved
memberships. Featured media reaches the homepage only after explicit publication;
draft edits do not change the published snapshot. See MEDIA_PUBLICATION.md.

## Deferred dependencies

| Dependency | Effect on showcase / release |
| --- | --- |
| Resend and verified sender domain | No email delivery, campaign send or functional emailed password recovery |
| Google OAuth client | Google sign-in unavailable; assigned password account works |
| Independent scoped R2 runtime credential | Hosted uploads disabled; original Cloudflare credentials remain in their original file |
| Membership fees, student eligibility, declaration and refund terms | Application preview/saved drafts only; no approval, activation, member numbers, renewal or certificates |
| UPI payment details and reconciliation policy / Razorpay configuration | Instruction management only; no confirmed payment collection or refund processing |
| WhatsApp business setup and shared mailbox | No real inbox, replies or official WhatsApp delivery |
| Learning-hour policy | No external CPE accreditation claim |
| Historical import mapping/provenance approval | Preview/validation only; no committed migration |
| Approved news sources and collection schedule | Editorial preparation; no scheduled collection |

## Remaining engineering and comparison gaps

Crazy Hands-inspired capabilities still incomplete include application decisions,
member numbers/certificates, contribution history, profile-change review, XLSX
exports and live communications/inbox/delivery logs. Association-specific policy
must determine their TPA equivalents; NGO identity fields do not transfer.

Next improvements: report presets and XLSX export; production anti-abuse controls;
background delivery jobs after provider setup; stronger empty/error state coverage;
approved real imagery and governance copy; news-source preparation; staging,
backup/restore exercises, recovery procedures and full release acceptance.

## Verification scope

Local production build, lint and TypeScript pass. Desktop visual inspection and
390 × 844 browser viewport checks covered homepage, native Menu keyboard toggle,
contact form, membership preview and sign-in. Those public phone layouts have no
horizontal document overflow. The application step strip intentionally scrolls.
The synthetic staff preview was inspected at phone width; it is not evidence of
complete authenticated staff/member mobile acceptance. Real-device Safari/Android,
all staff workspaces and full assistive-technology testing remain release checks.

Hosted verification and deployment evidence are appended after rollout.

Hosted rollout: deployment 69f2c58d-2398-4f11-88b9-2df010e8a713 passed Railway
readiness. The updated homepage was verified on tpassociation.org at desktop and
390-pixel phone widths, with keyboard opening/closing of the mobile menu. Tablet
layout was checked locally at 768 pixels. All 26 unit tests pass. Authenticated
hosted smoke verifies staff access, member-to-admin routing, sign-out and revoked
session denial. Screenshots are in the workspace's preview-evidence directory.

Additional hosted phone check: the real administrator signed in successfully;
Workspace navigation opened with Enter and traversed to Members. The directory
had no horizontal document overflow at 390 pixels, and sign-out completed.
This verifies the staff shell traversal, not every directory action or workspace.

Current work and feedback: [DELIVERY_CHECKLIST.md](DELIVERY_CHECKLIST.md).


7 October 2026: Rich content editing and isolated unsaved preview are deployed and verified. The [delivery checklist](DELIVERY_CHECKLIST.md) records 32 unit/4 PostgreSQL/7 HTTP tests, CI, hosted responsive acceptance and synthetic cleanup. Existing provider and business-policy gaps remain; Resend is deferred.

## People review batch — 7 October 2026

Richer people/groups, multiple assignments, owner/staff proposals and administrator
review are implemented with separate accepted/public snapshots. The current
[delivery checklist](DELIVERY_CHECKLIST.md) records acceptance and rollout status;
[PEOPLE_REVIEW.md](PEOPLE_REVIEW.md) explains permissions, legacy compatibility and
portrait privacy. Profile-change review is addressed; membership decisions/numbers/
certificates, verified payment history, XLSX and live inbox/delivery remain governed
by their existing gates. Hosted scoped R2 and deferred Resend remain unchanged.

This batch is hosted and verified: CI 37599494566, deployment
0cbc41c5-5601-4103-9d8d-1754d700b5f7. Desktop/tablet/phone and the synthetic
review/publication/withdrawal journey pass; fixtures are removed. Hosted portrait
upload remains blocked by scoped R2. See the checklist for evidence and retained gates.

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

## Reporting and source preparation — 8 October 2026

The next batch adds domain-permitted reports, account-directory filters, private/shared
presets, server CSV/XLSX exports and Content → Sources. Source approval prepares future
collection; it never fetches, schedules or publishes. Release tooling and recovery
procedures are recorded, with recovery still unverified. Acceptance evidence lives in
[REPORTING_NEWS.md](REPORTING_NEWS.md) and [RELEASE_RUNBOOK.md](RELEASE_RUNBOOK.md).
[DELIVERY_CHECKLIST.md](DELIVERY_CHECKLIST.md) remains the source of truth and retains
all provider/policy gates. Earlier statements about these gaps are dated historical evidence.
R2 documentation push/PR update succeeded on 8 October after GitHub recovered.
