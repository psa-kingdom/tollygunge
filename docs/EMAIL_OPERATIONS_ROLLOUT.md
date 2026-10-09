# Durable communications rollout — 9 October 2026

Status: implementation and isolated acceptance complete; hosted acceptance in progress.

## Scope and proof

Migration018 adds dispatch/job/event/suppression/inbox/reply/token/receipt/health records without rewriting campaign drafts or revisions. All private staff APIs enforce communications permissions and no-store responses. Recovery bodies, reset URLs and recovery tokens are never recorded; recovery logs contain only provider receipt/time/outcome.

The single existing Railway container supervises Next.js and one PostgreSQL-leased email worker. The worker holds a database advisory leader lock, prioritises transactional onboarding/inbound/replies before campaigns, and reports fresh health/provider quota. Onboarding processing remains disabled until its own batch acceptance. Both domains share one verified signed webhook; handlers persist before acknowledgment and tolerate retries.

Accepted, delivered, delayed, failed, bounced and complained remain distinct. Unsubscribe lookup stores hashes; queued unsubscribe URLs and immutable provider requests are authenticated-encrypted at rest with the managed auth secret. Stable per-job idempotency retries stop at 23 hours for uncertain sends and require reconciliation. Campaign snapshots never acquire later recipients; eligibility, current addresses, consent, preferences, suppressions, cancellation and staff authority are rechecked before the provider call. Cancelled pending jobs are retained. Quota resets govern continuation; daily campaigns leave 20 sends available to recovery/replies and monthly exhaustion pauses all sends. Provider plan is never upgraded.

The inbox only retrieves addressed contact@updates.tpassociation.org mail after signature validation. Plain/converted text has no executable HTML/remote images. Attachment names/types are recorded; no files/URLs are fetched or sent. Threading uses known message references plus correspondent, never subject-only matching. Notes/links/assignment/draft changes are versioned and audited. Archives retain history.

## Verification completed

44 unit tests pass. Mock-provider PostgreSQL acceptance in a disposable database proves dispatch duplication and audience conflicts, consent withdrawal during quota checks, quota reserve, stable retries, lease/window recovery, duplicate delivery events/permanent-bounce suppression, repeat unsubscribe, safe inbound text/attachment metadata and permission-revoked replies. HTTP checks prove all six staff roles/member/anonymous boundaries, revoked sessions, stale drafts, explicit confirmation and valid/forged/duplicate/changed webhooks. Production build passes.

Browser checks at 1440/768/390 confirm inbox selection, saved reply draft without sending, edits retained across tabs, custom unsaved-discard prompt, Escape dismissal and keyboard tab traversal. Tablet/phone page widths remain within viewport. Screenshots are synthetic disposable fixtures.

## Managed configuration

The existing sending-only runtime key remains unchanged. A separate receiving/usage runtime key and webhook signing secret use managed settings only; processing is disabled until deployment acceptance. Resend exposes full_access/sending_access; the receiving/usage key is full_access, not a narrowly scoped receiving credential. The supervisor strips it from the web child, supplying only a presence flag. The original setup key remains in Credential.md; no credentials appear in source, docs, args or output.

## Deployment and rollback

Apply checksummed additive migration018 before starting this runtime. Build Next standalone plus the bundled worker; deploy clean committed source through the existing feature/draft PR workflow. Verify the signed endpoint, provider permissions/domain/quota and healthy worker before enabling EMAIL_OPERATIONS_ENABLED. Enable the one shared webhook and verify disposable provider recipients/incoming mail, then remove exact fixtures while recording provider-retained test messages.

Auth-secret rotation must coordinate decrypt/reseal of queued encrypted payloads before replacing the old secret; never silently resend undecipherable uncertain jobs.

Rollback: set EMAIL_OPERATIONS_ENABLED=false through managed stdin settings, pause the shared webhook only if its replacement cannot verify/persist events, and redeploy the last healthy application revision. Preserve PostgreSQL queues/events/history and authentication/storage configuration; do not revert applied checksums. Onboarding processing has its own flag and must be paused jointly when reverting the shared runtime. Recovery remains synchronous and independent of campaign eligibility and worker health.

Full backup restoration remains unverified; no production restore exercise is performed here. Keep Google/WhatsApp/payment/membership/learning/import/news policy gates and broader release acceptance open. See [DELIVERY_CHECKLIST.md](DELIVERY_CHECKLIST.md) as current status.
