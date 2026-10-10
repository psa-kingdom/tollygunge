# Public editorial media

Uploading creates a private editorial draft. Save changes updates only the draft.
Publish copies saved metadata to the public snapshot; subsequent public page loads
use that snapshot. Unpublish clears it and blocks anonymous image retrieval.
Application documents are a separate private namespace and cannot be published here.

All published editorial assets appear in Resources → Media (latest 100). The new
explicit homepage placement checkbox selects assets for a landing-page gallery
(latest three featured published assets). Placement changes require save and publish.
Disabling homepage placement and publishing removes the asset from the homepage
while keeping it in Resources. Committee/founding portraits continue to reference
published editorial assets and disappear when their referenced asset is withdrawn.

Image files remain immutable assets. To replace a photograph, upload a new asset,
review and publish it, update any committee portrait references, then withdraw the
old asset. Metadata edits do not replace the underlying image file. Hero artwork and
arbitrary page image slots are not managed by this gallery setting.

Public pages are rendered from current PostgreSQL published records; editorial image
responses use no-store so withdrawal is checked on each request. Existing browser
pages require reload or navigation to see a newly published snapshot.

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
