# Google sign-in setup for TPA

## Recommended ownership and environment separation

Use a TPA-controlled Google Cloud project, with the association support identity
`tollygungecacpestudycircle@gmail.com` as the initial owner/contact. Add a second
authorized association owner through a separately approved access change when
available. Keep the personal/developer project separate. No project is created by
this guide and no permissions are granted.

Create `TPA Development` for local/staging tests and a separate `TPA Production`
project before release. Google requires separate testing and production projects;
production clients should not include local/staging callbacks.
[Google production policies](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance)

## Local test setup

1. In [Google Cloud Console](https://console.cloud.google.com/), create/select the
   development project and open Google Auth Platform.
2. Configure Branding as **Tollygunge Professional Association**, using the TPA
   support email and a reachable developer contact.
3. Choose an External audience for ordinary Google accounts. Start in Testing;
   add the first administrator and designated testers while testing rules apply.
4. Create an OAuth client of type **Web application** named `TPA Local`.
5. Register this exact authorized redirect URI:

   `http://127.0.0.1:3000/api/auth/callback/google`

   This matches the app's current `BETTER_AUTH_URL`. If you deliberately use
   `localhost`, change the app base URL and register its matching callback. Do not
   interchange those hosts in a single session. Local loopback HTTP is allowed;
   deployed callbacks require HTTPS.
   [Google redirect rules](https://developers.google.com/identity/protocols/oauth2/web-server#redirect-uri-validation-rules)
6. Keep scopes limited to `openid`, `email` and `profile`. Google sign-in does not
   require Gmail, Drive or Calendar access. Request additional scopes only if a
   separately authorized product integration needs them.
7. Download the client configuration once and store it outside the Git checkout,
   with access restricted to its operator. Send only its absolute path for local
   integration; do not paste secrets into chat, issues or screenshots. The current
   app expects server-only `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`; agreeing
   how to load/store these secrets is part of configuration.

Better Auth owns the OAuth callback, state exchange and account/session handling.
Do not create a second Google login implementation or expose its secret to the
browser. [Better Auth Google integration](https://better-auth.com/docs/authentication/google)

## Before enabling production

Choose the final TPA domain and stable HTTPS origin first. Configure a production
Web application client with only the exact production callback, TPA branding,
verified association domain, public homepage/privacy/terms and reachable contacts.
Complete the verification requirements Google presents for the selected branding
and scopes. Keep credentials in the agreed deployment secret manager and set
`BETTER_AUTH_URL`/trusted origins to the production origin.

Verify sign-in, cancellation/error paths, sign-out, revocation, member isolation,
and same-email sign-in for the existing approved administrator. A returning account
must retain its original identity and explicit roles; new Google accounts receive
no staff role and no approved membership automatically. Never fabricate an email
verification flag or grant access based solely on an email string.
