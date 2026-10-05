# Crazy Hands workflow comparison — 2026-10-05

Read-only inspection of the user-opened, authenticated admin portal. No records,
settings, approvals, rejections or communications were changed. No member data
was exported or migrated. This compares visible workflows, not backend correctness.

| Reference workflow | TPA state and next step |
| --- | --- |
| Application approve/reject queues | Private application drafts exist. Paid application review awaits approved terms and Razorpay test configuration. Payment success must not imply approval. |
| Searchable member directory and saved filters | TPA has private profiles and histories, but no approved member directory yet. Add directory, plan/status filters and member-number search with the membership activation slice. Do not label every account an approved member. |
| Profile update request review | Not implemented. TPA currently permits own contact/preference updates. Add review only for membership eligibility or identity fields when the rules are approved; avoid requiring staff review for newsletter consent. |
| Rejection history | Not implemented before application submission. Preserve rejection reasons separately from refunds and show applicants their own status. |
| CSV/Excel export center | TPA offers permission-scoped CSV reports. XLSX, saved report presets and member exports remain future work; exports must respect role scope and spreadsheet formula safety. |
| CMS chapters and executive profiles | TPA now has dedicated executive/sub-committee/founding profiles, drafts, published snapshots, revisions, ordering and optional published editorial portraits. No staff access or membership is granted. NGO chapters are not imported. |
| CMS gallery title/category/photo | Added separate editorial media records, accessibility descriptions, decoded/re-encoded images, private drafts, explicit publication/unpublication and a public resource gallery. Private application media is excluded. |
| CMS insights | TPA supports attributed news/insight drafts, saved previews, published snapshots and revisions. Scheduled collection awaits approved sources and schedule. |
| Upcoming/past events and draft control | TPA supports actual draft/publish/cancel, free registrations, capacity checks, unique attendance, member history and flyer exports. Paid registration and learning awards remain gated. A visible reference draft control is labelled placeholder. |
| Email studio, test recipient, compose, delivery logs and diagnostics | TPA has saved templates and consent counts. Resend is explicitly deferred. Provider-backed sandbox routing, queue/retry, incoming replies and actual delivery diagnostics remain incomplete. Visible reference metrics are not evidence of working delivery. |
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
| Profile: professional/contact details, photo/avatar, reviewed identity fields | TPA has own phone, organization, preferences and private documents. Rich professional profiles and configurable review of eligibility-sensitive changes are useful later. NGO government ID/blood-group collection is excluded from this comparison's recommendations. |
| Admin applications, members, profile updates and rejections | Keep review/activation/refund states separate. Directory and review queues depend on approved membership terms and verified transactions. Existing private drafts are not submitted applications. |
| CSR inquiry tab (empty) | TPA now provides a general public inquiry form and real CRM persistence, statuses, tags, search, assignment and history. CSR/NGO terminology is not adopted. |
| Upcoming/past events with a draft placeholder | TPA already has persisted event drafts/publication/cancellation, capacity-controlled registration, attendance and member history. Learning-hour awards and paid events remain gated. |
| CMS chapters/executives/gallery/insights | TPA content/editorial media and dedicated committee/person records exist. Profiles require confirmation before publishing; only published editorial portraits can be selected. NGO chapter structure is not assumed. |
| Communication center with studio, sandbox, logs and diagnostics | Provider-backed delivery jobs, test-recipient routing, retries, incoming replies and truthful delivery logs remain pending Resend and official WhatsApp setup. No reference test sends were performed. |
| Top-level admin tabs | TPA now retains a permission-filtered, grouped sidebar across all staff pages, with a current-page indicator and responsive collapsible control. |

Priority after this delivery: professional profile improvements;
then membership directory/review/certificates after business-policy approval; then
provider-backed communications and real payment reconciliation. Production release
still requires Google/provider setup, private managed secrets and recovery checks.
