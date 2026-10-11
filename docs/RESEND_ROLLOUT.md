# Resend rollout — 8 October 2026

Status: Transactional recovery enabled; campaign delivery remains Partial.
Full-access setup credentials inspect the verified `updates.tpassociation.org`
domain. The application uses a separately generated sending-only managed key.
The setup key remains only in its original file. No DNS changes were necessary.

## Activation order

1. Inspect existing Resend domains. Reuse a verified TPA sender or configure a
   dedicated TPA sending subdomain using Hostinger. Preserve web records and
   mailbox MX records. Keep tracking disabled for recovery messages.
2. Store the rotated sending key as `RESEND_API_KEY` in managed Railway secrets.
   Configure `AUTH_EMAIL_FROM` as a bare TPA domain address. Set
   `RESEND_DOMAIN_VERIFIED=true` only after provider/DNS verification.
3. Verify a disposable provider test message and recovery journey. Reset links
   expire after 15 minutes, are single-use and revoke existing sessions.
4. Run release checks with `--expect-recovery-enabled`; this checks the UI only.
   Provider acceptance and recipient delivery need separate evidence.
5. Implement campaign outbox/retries, verified delivery events, consent checks,
   unsubscribe and suppression before enabling campaign sends. Inbox and WhatsApp
   remain separate provider dependencies.

The adapter uses Resend's HTTPS API, a 20-second timeout, plain-text messages and
an opaque idempotency key derived from recipient and reset URL. It does not log
provider responses, addresses, reset links or secrets. Provider acceptance is not
a claim of mailbox delivery. An incomplete Resend configuration fails closed;
SMTP remains available when no Resend key is configured.

No local credential-file fallback or browser-exposed key is added. No campaign,
real-recipient email or DNS modification was made. All other gates remain in
DELIVERY_CHECKLIST.md.

## Hosted evidence

- Deployment `2c26ad17-0213-465e-81c1-eec81fa2008a` is SUCCESS for code
  `4cf367f`; both GitHub CI runs passed.
- `RESEND_API_KEY`, `AUTH_EMAIL_FROM` and `RESEND_DOMAIN_VERIFIED` were stored
  through Railway stdin. Existing database, identity, domain and R2 settings were
  compared and preserved. Sender is `no-reply@updates.tpassociation.org`.
- A uniquely labelled Resend delivered test recipient completed the hosted
  request → provider message → reset → replacement sign-in journey. Resend
  reported `delivered`; repeat token use and the old password were rejected,
  and the old session was revoked. Exact synthetic identity/sessions/audits were
  removed. Resend retains its test-message record. Real-mailbox acceptance remains
  unverified; no real-user passwords were changed.
- Anonymous public/protected-route release checks and enabled recovery UI pass.
  Stored first-admin password smoke failed authentication; that credential may be
  stale and its successful login is not asserted. Synthetic login/reset succeeded.
- Existing administrator browser session opens Communications successfully.
  Hosted campaign permission/consent/draft tests pass after using the correct
  HTTPS session cookie; campaign dispatch still returns a controlled rejection.
- Desktop 1440px and phone 390px checks show enabled controls, loading feedback,
  keyboard submission and generic unknown-account feedback. Temporary viewport
  overrides were reset. Repository credential scan found zero matches.
- Local checks: 40 unit tests, 5 PostgreSQL tests, lint, typecheck and build pass.
  Backup restore remains unverified independently of password recovery.
- Final status UI runtime `baac007` is deployed successfully as
  `c4566be1-c9a6-4f2c-ad94-a3c1536cfed4`; CI runs 37770288707 and
  37770295620 pass. Hosted administrator Communications shows recovery enabled
  and keeps templates/campaign drafts available without enabling dispatch.
  Eleven public responses/bundles contain no supplied or runtime credential values.

Provider contracts: [sending API](https://resend.com/docs/api-reference/emails/send-email)
and [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
