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
| CMS chapters and executive profiles | TPA governance copy is editable through structured pages. Dedicated committee/person records and sanctioned portraits remain incomplete. Do not import NGO chapters by default. |
| CMS gallery title/category/photo | Added separate editorial media records, accessibility descriptions, decoded/re-encoded images, private drafts, explicit publication/unpublication and a public resource gallery. Private application media is excluded. |
| CMS insights | TPA supports attributed news/insight drafts, saved previews, published snapshots and revisions. Scheduled collection awaits approved sources and schedule. |
| Upcoming/past events and draft control | TPA supports actual draft/publish/cancel, free registrations, capacity checks, unique attendance, member history and flyer exports. Paid registration and learning awards remain gated. A visible reference draft control is labelled placeholder. |
| Email studio, test recipient, compose, delivery logs and diagnostics | TPA has saved templates and consent counts. Resend is explicitly deferred. Provider-backed sandbox routing, queue/retry, incoming replies and actual delivery diagnostics remain incomplete. Visible reference metrics are not evidence of working delivery. |
| Staff responsibilities and audit visibility | Added an administrator-only Access workspace, existing-account lookup, exact role replacement, conflict protection, identity eligibility check, session revocation and paginated administrative actions. Self-access changes require another administrator. |

The highest-priority dependencies are Razorpay test configuration, approved
membership terms and Google onboarding. Resend remains deferred by user decision.
Learning policy, historical import mapping, news feeds, WhatsApp and production
secrets are separate later gates. No Crazy Hands data migration is authorized.
