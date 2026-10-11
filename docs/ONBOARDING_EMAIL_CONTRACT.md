# Onboarding integration contract

Migration 019 belongs to onboarding; migration 018 and the email worker/supervisor belong to the coordinated communications batch. Do not deploy the batches independently over one another.

Use the existing sender `no-reply@updates.tpassociation.org` and existing managed sending key. No root-domain DNS changes or additional webhooks/workers are needed.

- Existing `scripts/email-worker.mts` imports `runOnboardingTick` from `src/lib/onboarding-delivery` and calls it once per bounded loop using its existing pool. Run it independently of campaign eligibility, but respect shared quota and suppressions. ONBOARDING_ENABLED gates processing. It needs the managed auth secret to decrypt queued content.
- The existing verified `/api/webhooks/resend` handler calls `recordOnboardingEvent(pool, eventId, parsedEvent)` before acknowledging, alongside its communication event handler. Svix 2.8 `.verify()` returns undefined: verify the raw bounded body, then JSON.parse that body.
- `tpa.onboarding_mail` has per-job UUID/dedupe, user_id, recipient, kind, encrypted payload, queued/leased/accepted/delivered/bounced/failed state, attempts, first_attempt_at, reason, available_at, lease_until and provider_id. Payload is erased after acceptance. Stable idempotency key is `onboarding-{UUID}`. Uncertain sends older than 23 hours require reconciliation.
- `tpa.onboarding_mail_events` deduplicates signed events and reconciles delivery outcomes even when events arrive before provider-id persistence.
- Welcome, verification, invitation and requirement-update messages are transactional. Existing synchronous recovery remains independent from this queue and must keep its single-use 15-minute token.
- Test inboxes are admin-configured, defaulting to `savagesnowboy@gmail.com`. No normal-user recipient rewriting. Test-template buttons contain harmless login URLs; real action links are tested on disposable identities.

Onboarding owns no new provider keys or managed settings during coordination. Public signup is enabled only after schema and shared runtime acceptance. Existing verified badges survive requirement publication.
