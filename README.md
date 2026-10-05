# Tollygunge Professional Association

Professional association website and operations platform. The current delivery is
a public design foundation and PostgreSQL-backed identity/private-document slice.
Google OAuth configuration is pending; membership/payment operations remain future slices.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Membership preview: /join. Synthetic admin preview:
/preview/admin. Real /member and /admin routes enforce sessions and staff permissions.

Project map, decisions and delivery status are maintained in docs/. Provider setup
and confirmed association policies gate persistent operations and production launch.
