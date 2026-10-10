# Payment instruction management — 2026-10-06

Administrators and finance operators can create multiple payment-detail records,
each containing a label, payee name, UPI ID, optional payment contact number and
optional uploaded QR photo. These are instructions, separate from orders,
transaction verification, receipts, refunds and membership approval.

New records start as Draft. Saves create immutable revisions and increment a
version. Stale requests fail rather than overwrite newer work. Saving edits to an
Active record preserves its current active snapshot; explicit activation publishes
the saved revision after a staff payee/UPI/QR confirmation. Unsaved edits cannot be
activated through the UI. The server requires confirmation independently.

Draft and Past records are not returned to ordinary accounts. Active snapshots are
visible only to signed-in, authorized TPA accounts. Multiple records can be active.
Moving a record to Past preserves its snapshots and revisions; it can later be
revised or returned to Draft/Active. No deletion endpoint exists.

QR uploads accept bounded JPEG/PNG input, decode under a pixel limit and re-encode
as lossless PNG without original metadata. QR image records/keys are separate from
application documents and public editorial media. Database foreign keys preserve
QR references across draft/active/revision snapshots. Replaced images are retained
for history. Unattached uploads remain private metadata-tracked assets. Failed
uploads compensate with deletion; failed cleanup creates a reconciliation audit.

Anonymous QR access is denied. Finance operators can preview stored QR images;
ordinary accounts can retrieve only images referenced by an Active snapshot.
Responses use no-store. No QR is published through the public media gallery.

Scanning a QR or activating instructions never marks a transaction paid. The member
screen states that fees and verification are not enabled and asks users to wait for
a confirmed purpose/amount. Business fees, eligibility, declaration/refund terms and
manual transaction-verification rules remain unapproved; Razorpay/Resend/Google
configuration remains deferred. No external funds are transferred by this slice.

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
