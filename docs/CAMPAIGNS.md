# Campaign preparation

Communications now separates Campaign drafts and Email templates into keyboard
accessible tabs. Both panels stay mounted so switching tabs preserves editor state.
No messages are sent and no delivery jobs or scheduled sends are created.

Drafts store a name, single-line subject, plain-text message and optional city and
profession audience filters. Full-value filters ignore case. Profile values do not
establish professional eligibility or approved membership. Saved templates can be
copied into a draft; later template edits do not change saved campaign content.

Audience previews query current PostgreSQL identities, newsletter consent and
contact preferences in a repeatable-read transaction. A recipient must be subscribed,
have a verified email and allow optional email messages. Public inquiries do not
subscribe contacts. Counts distinguish missing consent, unverified subscribed email
and verified subscribers with optional messages disabled. Samples contain at most
20 eligible addresses and are restricted to communications staff/administrators.
Preview results are temporary and invalidate when the editor changes. Future delivery
must recheck consent and preferences immediately before each send; this preview
must never be treated as a durable recipient authorization.

Save, archive and restore use server version checks and row locks. Every successful
change retains a snapshot and an audit action. Archived drafts cannot be edited
until restored. The interface shows the latest 100 drafts matching the state filter
and the latest 30 saved revisions per draft. Older history remains in PostgreSQL.

`/api/staff/campaigns` enforces `communications:manage` for every request and origin
checks for POST. Other roles and ordinary accounts cannot read audiences or draft
messages. Send, enqueue and schedule actions return 409 while provider setup is
deferred. No provider API or SMTP call is made by this slice. Deliveries, campaigns
with jobs/retries, unsubscribes in email, incoming replies and WhatsApp remain future
integration work. Migration 014 adds only draft and revision tables.
