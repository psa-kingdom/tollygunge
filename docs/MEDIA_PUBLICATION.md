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
