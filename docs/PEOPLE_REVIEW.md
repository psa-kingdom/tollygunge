# People, groups and profile review

This batch extends the working delivery checklist rather than replacing previous
delivery scope. See [DELIVERY_CHECKLIST.md](DELIVERY_CHECKLIST.md).

## Independent states

Authentication identifies the account. A person has a private working draft, a
review proposal, accepted details and an explicitly published snapshot. Email
verification, personal review, membership approval and publication are independent.
Saving never verifies, and approval never publishes. Pending/rejected edits leave
accepted details and existing publications unchanged. Changes to newsletter consent
and contact preferences take effect immediately.

Owners edit only personal fields. Membership reviewers can propose corrections;
content editors can edit public fields and assignments, with private phone details
redacted. Only administrators decide reviews or link accounts. An account's untouched
baseline can be linked to an association person; profiles with edits, portraits or
history must be retained and used instead. Identity matching is never inferred.

## Records and compatibility

Checksummed migrations 015 and 016 add people, private revisions/review requests,
groups, normalized accepted assignments and purpose-bound portraits. Original
governance tables/revisions remain intact. Existing publications keep their names,
roles, terms, order, biographies, portraits and committee labels without gaining an
invented verification badge. Existing account/member details are unverified baseline
records. One pending proposal is enforced by PostgreSQL; replacements supersede
older requests while retaining history. Person row locks and version checks protect
stale saves, decisions and publication. Approval applies a complete proposal atomically.

Groups allow roots and one subgroup level. Published names/order/placement change
only on explicit group publication. Published hierarchy is fixed: create a new
subgroup and reassign people when restructuring an existing published group. Groups
with active assignments or subgroups cannot be archived. Assignments carry their own
role, optional label, term and order. Navigation section anchors remain unchanged.

## Editing, preview and portraits

The shared Content editor, safe rich renderer, size presets and preview frame support
20,000 rendered biography characters, field counters and up to 12 labelled HTTPS
links. Only selected links are projected publicly. Phone/email stay private. Preview
uses unsaved in-memory edits and current published page content/rosters, with mobile
Edit/Preview tabs, desktop/tablet/phone widths and keyboard expansion/discard controls.
Preview neither saves nor publishes. Review compares fields, formatted biographies
and portraits and requires a reason for rejection.

Portraits accept static JPEG/PNG up to 5 MB, decoded and normalized to WebP with
metadata stripped. Their private object namespace is separate from editorial media
and member documents. Owner/authorized staff access is authenticated. Anonymous
retrieval requires an explicit published profile reference; replacement/public
withdrawal removes anonymous access to the former portrait. Upload persistence
failure compensates by deleting the object. Portraits never enter galleries/homepage
automatically. Hosted uploads remain disabled until independent scoped managed R2
credentials are configured. Original credentials remain only in their original file.

## Verification

Unit/domain checks cover limits, unsafe links and private/public projection. HTTP
flows cover ownership, role restrictions, supersession, conflicts, approval/rejection,
publication/withdrawal, groups and immediate preferences. The portrait HTTP suite
checks formats/sizes, authenticated reads, explicit publication, replacement and
withdrawal; it removes synthetic objects and verifies absence. CI tests the disabled
storage gate, while configured local verification tests actual private storage.
PostgreSQL checks cover repeatability, checksums, foreign keys and legacy labels.
Browser acceptance and hosted rollout evidence are recorded in the delivery checklist.

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
