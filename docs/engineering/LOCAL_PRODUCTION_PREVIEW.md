# Local production-data preview

The 20 November 2026 testing setup uses a read-only PostgreSQL 18 production
snapshot restored into a newly named database on the loopback PostgreSQL server.
The prior local database is retained. The restore was checked against production
row counts for all 98 application tables. Production was not migrated or changed.

Historical attendance is a separate Railway web-service setting, not a table in
the PostgreSQL dump. The local configuration includes that exact compressed
snapshot: 67 records for 3 October, 99 for 2 September, 91 for 14 August and 86 for
16 July 2026. The November historical event has metadata but no attendance
register in the production snapshot. Missing registers must display unknown
counts rather than zero participants.

At this snapshot, production has zero rows in `event_registrations`,
`event_attendance` and `finance_entries`. Historical attendance does not contain
payment amounts, methods or individual online/offline participation modes.
The UI must not infer those facts from attendance or a receipt's entry source.
Event delivery format is displayed separately from individual participation mode.

All 19 objects under the production bucket's `tpa/` prefix were copied by read
operations into an isolated S3-compatible server bound to `127.0.0.1:59000`.
The local application uses local-only storage credentials. The optional
`TPA_LOCAL_STORAGE_ENDPOINT` is accepted only when both the deployment and
database are local and the storage endpoint is loopback. Uploaded test assets
and page edits therefore cannot change production storage.

The preview runs at `http://localhost:3200`. Both local checkout configurations
point to this isolated data copy. Email is captured locally; email operations,
reminders, promotions, onboarding and member-import workers are disabled. No
worker process was started. Existing local staff testing sessions were retained;
authentication and local audit activity are consequently local test state rather
than a byte-for-byte production clone.

Private dumps, original configurations, source variables and verification records
are retained outside the repository under the user's local `TPA-PrivateQA`
directory. Do not commit or attach those files. The local storage launcher and
installed storage runtime are also there. Production credentials are used only
by the one-time read-only copy process, never by the local application.

CMS verification exercised draft saving, stale-version rejection, publication,
image upload and image publication through the local HTTP API. Test pages and
media were restored to their original baseline afterward; local audit history
retains the test activity. Public publishing still requires an explicit action.

Publishing test data is intentionally added to the isolated local copy by
`scripts/seed-publishing-preview.mts`. It requires loopback app, database and
storage URLs, plus the local mail sink. It creates five clearly labelled DEMO
articles (three published, two drafts), two demonstration images, two sample PDF
downloads and two example reference links. Original production records are
retained. Run with the private preview environment and `TPA_TEST_URL` set to the
local preview URL; no production seeding or automatic startup seeding is used.
