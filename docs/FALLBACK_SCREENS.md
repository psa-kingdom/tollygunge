# Availability and fallback screens — 13 October 2026

The previous Railway deployment `7359d379-a8f7-468e-a9d7-a8568560cf21` was CRASHED with its three restart attempts exhausted. Its logs repeatedly ended with email-worker failure; the supervisor stopped web on email-worker exit. The domain targets and listening port both matched 3000. The screenshot request ID was not returned by retained HTTP logs, so exact request correlation remains unavailable.

## Configuration and coverage

Edit `src/domain/fallbacks.ts` for fallback labels, headings, explanations and recovery links. Presentation is in `src/components/fallback-screen.module.css`. Keep recovery links local, do not send messages from fallback rendering, and do not add automatic retries of writes.

| Situation | Handling |
| --- | --- |
| Unmatched URL | Independent global 404 document, no database or normal shell, HTTP 404 and noindex |
| Missing page/event/resource | Route not-found presentation; Next.js may return 200 after streaming begins and inserts noindex |
| Page rendering failure | Independent route error with user-triggered read retry and safe support digest |
| Root-layout failure | Global error document with its own styles and system-font fallback |
| Page loading | Public/member/staff status message; no misleading empty result |
| Missing password reset token | Configured expired-link panel and link to request recovery; no automatic email |
| Member events load failure | Unavailable panel with retry of the events GET only |
| Successful empty events list | Configured empty-state panel |
| Expired session / API access denial | API client exposes useful sign-in/permission messages and preserves status/code |
| Restricted staff URL / private missing resource | Existing redirects and concealed not-found behavior preserved to avoid exposing private resource existence |
| Verification / invitation / unsubscribe links | Existing workflow-specific expiry, account-switch and confirmation behavior retained; audited rather than replaced with generic recovery |
| Proxy HTML / network / API server failure | Safe request message, no raw HTML/SQL/error details and no automatic submission replay |
| Complete Railway outage | Provider screen; replacing this requires an independent serving layer, outside this patch |

Workers restart independently at 5, 10, 20, 40 and at most 60-second intervals; a process surviving 60 seconds resets backoff. Existing leadership/advisory-lock and delivery-idempotency behavior is retained. Shutdown cancels retries and allows 25 seconds before force termination. An unexpected web exit is nonzero even if it exits with zero.

`GET /api/health` retains `status: ready` when authentication configuration and PostgreSQL are available, and adds `backgroundProcesses: running | degraded | unknown`. This reports supervisor process state, not provider readiness or delivery success. Operational email heartbeat/quota remains the source for worker readiness. No credentials or queue/member records are returned.

## Release boundary

The focused release is assembled over archived main `6532f3a9d8a58ae462a9902fce95fe01bce4d8a4` with only availability/fallback changes. Do not deploy the working directory or the separately prepared website/event package. No migrations, hosting limits, recipients, invitation holds or payment records change. Roll back using the recorded prior artifact only after assessing its known worker-coupling defect; restarting that artifact alone does not solve the outage.

Validation and deployment identities are recorded in `.local/fallback-release/` and appended here after hosted verification.

## Completed verification

- Final deployment: `c9cb451d-2bc9-4f9b-bf22-0d7b5e148f1f`, Railway SUCCESS. Local fixed-build ID: `Pg5NaxUb8pMS8TcDT1Sw5`; Railway rebuilds the same reviewed source with its own build ID. Exact 22-file source change manifest: `.local/fallback-release/manifest.json`.
- Availability was first restored by `dd978b30-457e-447e-8a37-53b4bd0656e0`. A hosted-only non-root permission issue prevented writing health status under `/app`; the final deployment uses the writable OS temporary directory with a private, atomic file and per-port filename.
- Final snapshot: `npm run typecheck`, `npm run lint` and `npm run build` passed; `npm test` passed 84 tests. `node --test tests/runtime-supervisor.test.mjs` passed 5 tests, including actual HTTP availability through worker crash/restart, temporary-directory health publication and web-process failure. The larger working checkout separately passed 100 unit tests, typecheck, lint and build; it was not deployed.
- `TPA_TEST_URL=http://127.0.0.1:3187 TPA_FALLBACK_OUTAGE_URL=http://127.0.0.1:3188 TPA_BROWSER_CHANNEL=chrome npx playwright test tests/browser/fallbacks.spec.ts --project=desktop --project=phone`: 6 passed against the final fixed build. The outage process used an unreachable synthetic database; recovery issued no write requests. Desktop and phone screenshots were inspected. Global-error component rendering separately verified a complete HTML/body document, safe copy, retry control and no private exception message; a real root-layout fault was not injected into production.
- The same browser suite against `https://tpassociation.org`: 4 passed, 2 intentionally skipped outage checks. Additional hosted desktop (1280×812) and phone (390×844) checks observed the homepage and login rendering, anonymous staff/member navigation resolving to login, and no horizontal overflow. This did not test an authenticated login or physical device.
- Final hosted reads: canonical and Railway origins `/api/health` HTTP 200 with `status: ready`, `backgroundProcesses: running`; unknown nested URL HTTP 404; anonymous staff/member APIs HTTP 401 with JSON responses. Final deployment logs show clean startup without worker exits or health-publication errors during verification.
- Final production read-only snapshot at 13:11 IST on 13 October: 208 accounts, 202 unreleased invitation holds, 29 migrations and zero active email jobs. Email-worker state was `ready` with heartbeat age 6 seconds. Counts match the preflight; no migration or flag/resource changes were made.
- Evidence: `.local/fallback-release/hosted-verification.json`, `preservation.json`, `404-desktop.png`, `404-phone.png`, `error-desktop.png`, `error-phone.png`.

Rollback reference: the preceding recovery artifact `dd978b30-457e-447e-8a37-53b4bd0656e0` preserves independent workers and the same schema; its known limitation is `backgroundProcesses: unknown` due to the health-file permission issue. The original `7359d379-a8f7-468e-a9d7-a8568560cf21` is the source baseline but is not a suitable availability rollback because it couples email-worker failures to web shutdown. Preserve database and invitation holds on any rollback; never reverse migrations or replay deliveries.
