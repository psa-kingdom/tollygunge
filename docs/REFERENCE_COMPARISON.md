# Crazy Hands workflow comparison — 2026-10-05

Read-only inspection of the user-opened, authenticated admin portal. No records,
settings, approvals, rejections or communications were changed. No member data
was exported or migrated. This compares visible workflows, not backend correctness.

| Reference workflow | TPA state and next step |
| --- | --- |
| Application approve/reject queues | Private application drafts exist. Paid application review awaits approved terms and Razorpay test configuration. Payment success must not imply approval. |
| Searchable member directory and saved filters | TPA now has a staff-only account directory with multi-field search, verification/phone filters, stable pagination, temporary recent searches/views, and quick contact previews/copy. Approved-member plan/status and member-number filters await activation; accounts are not approved members. |
| Profile update request review | Not implemented. TPA currently permits own contact/preference, profession, job title and city updates. Add review only for membership eligibility or identity fields when the rules are approved; avoid requiring staff review for newsletter consent. |
| Rejection history | Not implemented before application submission. Preserve rejection reasons separately from refunds and show applicants their own status. |
| CSV/Excel export center | TPA offers permission-scoped CSV reports. XLSX, saved report presets and member exports remain future work; exports must respect role scope and spreadsheet formula safety. |
| CMS chapters and executive profiles | TPA now has dedicated executive/sub-committee/founding profiles, drafts, published snapshots, revisions, ordering and optional published editorial portraits. No staff access or membership is granted. NGO chapters are not imported. |
| CMS gallery title/category/photo | Added separate editorial media records, accessibility descriptions, decoded/re-encoded images, private drafts, explicit publication/unpublication and a public resource gallery and explicit homepage placement. Publishing updates the public snapshot; draft edits stay private. Private application media is excluded. |
| CMS insights | TPA supports attributed news/insight drafts, saved previews, published snapshots and revisions. Scheduled collection awaits approved sources and schedule. |
| Upcoming/past events and draft control | TPA supports actual draft/publish/cancel, free registrations, capacity checks, unique attendance, member history and flyer exports. Paid registration and learning awards remain gated. A visible reference draft control is labelled placeholder. |
| Email studio, test recipient, compose, delivery logs and diagnostics | TPA has saved templates, campaign drafts, template reuse, live consent/preference audience previews, archive/restore and immutable revisions. Resend is explicitly deferred. Provider-backed sandbox routing, queue/retry, incoming replies and actual delivery diagnostics remain incomplete. Visible reference metrics are not evidence of working delivery. |
| Staff responsibilities and audit visibility | Added an administrator-only Access workspace, existing-account lookup, exact role replacement, conflict protection, identity eligibility check, session revocation and paginated administrative actions. Self-access changes require another administrator. |

The highest-priority dependencies are Razorpay test configuration, approved
membership terms and Google onboarding. Resend remains deferred by user decision.
Learning policy, historical import mapping, news feeds, WhatsApp and production
secrets are separate later gates. No Crazy Hands data migration is authorized.

## Member and administrator follow-up inspection — 2026-10-06

The user-opened member dashboard and administrator tabs were inspected read-only.
No records or personal identifiers were copied into this report; no reference
records, settings or communications were changed. Visible metrics and empty lists
are not proof that a provider or backend workflow functions correctly.

| Visible reference | TPA conclusion |
| --- | --- |
| Member overview: approved status/number, certificate download, contribution history | TPA separates account access from approved membership. Approval history, membership numbers, certificates, renewals and verified payment history belong to the gated membership slice. NGO donation actions do not transfer to TPA. |
| Profile: professional/contact details, photo/avatar, reviewed identity fields | TPA has private phone, organization, profession, job title, city, preferences and documents. Review of eligibility-sensitive changes remains a later requirement. NGO government ID/blood-group collection is excluded from this comparison's recommendations. |
| Admin applications, members, profile updates and rejections | Keep review/activation/refund states separate. Directory and review queues depend on approved membership terms and verified transactions. Existing private drafts are not submitted applications. |
| CSR inquiry tab (empty) | TPA now provides a general public inquiry form and real CRM persistence, statuses, tags, search, assignment and history. CSR/NGO terminology is not adopted. |
| Upcoming/past events with a draft placeholder | TPA already has persisted event drafts/publication/cancellation, capacity-controlled registration, attendance and member history. Learning-hour awards and paid events remain gated. |
| CMS chapters/executives/gallery/insights | TPA content/editorial media and dedicated committee/person records exist. Profiles require confirmation before publishing; only published editorial portraits can be selected. NGO chapter structure is not assumed. |
| Communication center with studio, sandbox, logs and diagnostics | Provider-backed delivery jobs, test-recipient routing, retries, incoming replies and truthful delivery logs remain pending Resend and official WhatsApp setup. No reference test sends were performed. |
| Top-level admin tabs | TPA now retains a permission-filtered, grouped sidebar across all staff pages, with a current-page indicator and responsive collapsible control. |

Professional account details and the staff account directory are now implemented. Next comes
membership directory/review/certificates after business-policy approval; then
provider-backed communications and real payment reconciliation. Production release
still requires Google/provider setup, private managed secrets and recovery checks.


## Current gap refresh and campaign preparation — 2026-10-06

A fresh read-only administrator view still exposes application, profile-update and
rejection queues and XLSX exports. Visible controls remain a workflow reference,
not proof of backend/provider correctness. No reference records were modified.
TPA now has account-directory contact previews and explicitly featured public media.
Campaign preparation adds drafts, saved-template reuse, eligible-recipient preview,
archive/restore and revisions; actual send/schedule/queue operations remain disabled.
Remaining independent work includes XLSX/report presets, news-source preparation,
background delivery infrastructure and release/recovery tooling. Membership review,
certificates, renewals and transaction reconciliation require approved rules and
payment verification; inbox/email/WhatsApp need provider configuration. Historical
commit and learning awards still require mapping/provenance and learning policies.

First-draft presentation refresh (2026-10-06): see SHOWCASE_READINESS.md for the
remaining comparison gaps, explicit deferrals and release validation limits.

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

Reporting/source-preparation batch is delivered: runtime da2abcb, healthy Railway
release a70b29b3-7c4e-4731-b7fb-22cff8092bc5; CI 37727570318/37727574348 pass. Hosted
HTTP/smoke, actual parsed downloads, preset/source review and responsive/keyboard checks
pass with exact fixture cleanup. See DELIVERY_CHECKLIST.md for evidence and automation
limits. Scheduled collection and backup restoration remain unverified/gated.

## Durable communications delivery — 9 October 2026

Campaign dispatch, consent-safe queued sending, signed delivery/suppression events, explicit unsubscribe and shared inbox/replies are hosted verified. This closes the email inbox/delivery-log comparison gap for the approved scope; attachments remain metadata only and WhatsApp is still gated. See [EMAIL_OPERATIONS_ROLLOUT.md](EMAIL_OPERATIONS_ROLLOUT.md) and the authoritative [DELIVERY_CHECKLIST.md](DELIVERY_CHECKLIST.md) for CI, browser/provider acceptance, exact cleanup and remaining dependencies. Earlier Resend-deferred statements describe their dated release state. Onboarding is a coordinated separate batch and remains disabled pending its own acceptance. Full release/restore/accessibility and other policy gates remain open.
