# Tollygunge Professional Association

Professional association website and operations platform. The current delivery is
a public website, PostgreSQL identity/private documents, CMS drafts/publishing, saved
membership drafts, free event registration/attendance, CRM follow-ups, communication
template drafts, flyer PNG/PDF exports and scoped reports. Historical import previews
validate identities and duplicates without committing records.
Resend configuration is deferred. Payment collection, membership approval/renewals,
learning-hour awards and import commit require approved providers and business rules.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Membership preview: /join. Synthetic admin preview:
/preview/admin. Real /member and /admin routes enforce sessions and staff permissions.

Project map, decisions and delivery status are maintained in docs/. Provider setup
and confirmed association policies gate persistent operations and production launch.
