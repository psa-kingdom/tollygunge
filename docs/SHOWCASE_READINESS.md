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
