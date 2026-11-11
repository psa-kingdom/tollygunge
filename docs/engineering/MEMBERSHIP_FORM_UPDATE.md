# Membership form and event updates

The application uses Recent photograph in Personal details, a Gender choice (Male,
Female, Transgender), document previews and bold review labels. Submission requires
an uploaded signature image or signed declaration PDF. The drawing pad uses pointer
events for mouse, pen and touch; upload remains available without drawing. Drawings
use the existing private-document upload, ownership checks and file-size limits.
The download contains the entered application fields and a declaration/signing area.

Event registrations have a Transactions view, including recorded receipt/refund date,
amount, method, reference, review status and proof. It uses the existing member-owned
registration query. Public events accept inclusive `from` and `to` date filters in
India time and show the full matching range. The existing month query remains valid.

New membership assignments/imports offer Life and Patron. Historical Annual records
remain readable and may be retained during unrelated member edits; they are not
silently converted into a lifetime membership. Existing drafts retain assigned plans.

## Release

Apply `041_membership_form.sql` using the existing migration runner before releasing
these application changes. It publishes a successor verification policy, hides the
old title and typed-signature fields, and adds gender and a required signature
document. It updates the policy draft while retaining other custom fields. Earlier
policy versions, submission snapshots and answers remain intact. Existing verified
members are not automatically asked to resubmit.

Migration 041 was applied to production on 11 November 2026. The checkout's
`.env.local` connects to that same database; do not treat it as an isolated test database.
Deploy the accompanying application commit to activate signature drawing and the
updated event and transaction screens.

## Design references and validation

The existing TPA portal is the primary visual reference. Preserve its navy/blue and
gold roles, typography, borders and responsive form layout. Refero live research was
unavailable (inactive subscription); its bundled Craft Details guidance supplied
checkbox hit-target alignment, fixed image dimensions and touch input guidance.
User requirements determine field placement, review emphasis and signature choices.

Validation uses unit tests for gender, required signature and inclusive date ranges,
and synthetic desktop/phone browser fixtures for form steps, previews, signature
capture, submission gating and declaration download. No live member submissions or
payments are created during these checks.
