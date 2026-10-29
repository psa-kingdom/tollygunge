# Portal review checkpoint — 29 October 2026

The first three working screens are ready for visual review. The remaining
portal modules await the agreed design approval; folder retirement awaits its
separate, exact-path approval. This is a local candidate, not a live release.

## Open the showcase

- Comparison gallery: <http://127.0.0.1:3186>
- Working application: <http://127.0.0.1:3185/login>
- Administrator: `portal-admin@example.invalid`
- Member: `portal-member@example.invalid`
- Both synthetic passwords: `Launch!1234`

These accounts exist only in the disposable loopback QA database. They are not
production credentials. The gallery switches between the three screens, desktop
and phone, and light/dark appearance, with before and after images side by side.

Try sign-in, the member-register/account-directory switch, member search, empty
results and reset, pagination, record details and Close details, profile/event
shortcuts, and keyboard navigation. On phones the record table scrolls inside its
own labelled keyboard-focusable region. Account controls retain the existing
appearance and sign-out actions.

## What changed

Sign-in adopts Crazy Hands' split identity/form composition with TPA blue tokens.
The members screen has pill view controls, grouped filters, round identity marks,
and a clearer record panel with focus restoration. Member overview has an actor
identity header, shortcuts to real routes, and grouped verification/profile and
service panels. Shared navigation, search and permissions remain in place.

The new component names and optional authentication presentation flag are internal
UI interfaces. No public API, database schema, authentication policy or business
module is added. Signup and the public landing page retain their existing
presentation. Logo bytes match the baseline Git object.

## Verification and limits

- Optimized Next.js application and both worker bundles: passed.
- Typecheck, lint, all **127 unit tests**, structure check and whitespace check:
  passed. Untracked/new paths are also reviewed against the placement policy.
- Existing portal regression: **9 passed** across desktop, tablet and phone,
  covering all current navigation destinations, mobile menus, keyboard workspace
  search, reduced motion, dark appearance, and public style isolation.
- Focused Chrome verification: seven groups cover reflow at 320/768/1024px in
  both modes; search/reset/pagination/detail focus; member shortcuts; sign-in
  recovery and real synthetic login; all six staff navigation sets and member
  route/API authorization; measured control contrast; and unchanged public
  landing/signup computed styles. Final results are in the local evidence.
- Before screenshots were captured before attaching the new presentation.
  Final after screenshots use the optimized build, at 1440px and 390px in both
  appearances. Evidence is ignored under `output/playwright/portal-review/`.

The sign-in failure screenshot uses an intercepted local 401 response. Successful
sign-ins, member searches and access checks use the real local application/API.
The harness retains earlier diagnostic failures: development-route compilation
exceeded short initial waits; an alert locator needed form scoping; repeated
sign-ins reached the existing throttle; and a global CSS selector overrode the
initial input border. The runner now reuses real sessions, respects retry timing,
and the scoped border correction passes the final measurements.

The optimized local runner emits the existing standalone-launch recommendation.
No hosted or container deployment has been validated. External OAuth/email,
screen-reader speech, physical touch hardware, and complete business transaction
regressions remain outside this first visual checkpoint. The broader workflow
acceptance in the implementation brief follows approval of this direction.

## Local operation

The QA cluster listens only on `127.0.0.1:55439`. Database, preview-process and
synthetic environment records live in ignored `.local/portal-review/`. The preview
inherits no hosted credentials; mail goes to the sink and operational workers are
disabled. Keep these local records out of Git.

From the repository root, after the existing preview process has stopped:

```powershell
node .local/portal-review/start-production.mjs
node .local/portal-review/serve-gallery.mjs
```

These two commands run in separate terminals and reuse the current synthetic
database. Check that ports 3185/3186 are free; do not stop unrelated listeners.
Use the recorded owned PIDs when stopping the background preview. Do not run a
database cleanup until the review session is finished.

## Decisions requested

1. Approve the direction of the three screens, or identify changes by screen,
   appearance and device. Approval authorizes applying it across the remaining
   authenticated modules and authentication journeys.
2. Review the separate `TPA_CLEANUP_REVIEW.md` preservation results and exact
   retirement list before approving removal of the obsolete folders.

The feature branch is local. Main, remote branches and production have not been
merged or deployed by this task.
