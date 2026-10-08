# Resend rollout — 8 October 2026

Status: Partial. The provider adapter is implemented; production remains unchanged.
The supplied sending-only key cannot inspect domains (`restricted_api_key`).
Rotation of the key pasted in chat and domain-management access are pending.

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
real recipient email, DNS modification or production secret update was made in
this preparation pass. All other gates remain in DELIVERY_CHECKLIST.md.

Provider contracts: [sending API](https://resend.com/docs/api-reference/emails/send-email)
and [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
