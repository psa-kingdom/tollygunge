# Member dashboard and verification refresh

The member overview now separates profile verification, email status, personal profile access and account services. The full editor stays at `/account/profile`. Navigation prioritises Overview, Verification, Profile and Events; secondary services are under More.

The five-step form has a responsive stepper and consistent card layout. Optional family/health, additional telephone and referral fields expand independently. Saved optional answers remain discoverable; error focus opens the relevant section. Administrators making these fields mandatory brings them into the main form. Autosave, recovery, upload association, version conflicts and submission permissions retain their existing paths.

Fax is archived with the same `fax` identifier and optional status. Live requirements version 2 was published through the authenticated requirements API after impact preview reported zero affected verified profiles. Verification state was compared before/after publication and remained identical. Old policy versions, submitted snapshots and answers are untouched; administrators can restore Fax through another versioned publication. Fresh initial policies also archive Fax. No SQL migration was needed.

## Validation

- Runtime revision: `7d8d968c3b1d5f2036f5efaf119b7c39b4f65c82`.
- Railway deployment: `bb554135-550f-4f9e-baca-7eea468641a5`, healthy on 9 October 2026.
- CI runs [37937324352](https://github.com/psa-kingdom/tollygunge/actions/runs/37937324352) and [37937318665](https://github.com/psa-kingdom/tollygunge/actions/runs/37937318665) pass both verify and onboarding jobs: 55 unit tests, lint/typecheck/build, database/mail/HTTP baseline and 9 browser journeys (6 redundant viewport cases skipped).
- Local isolated database/auth/worker checks, onboarding HTTP acceptance, and all 9 browser journeys also pass. Desktop/tablet/phone screenshots reviewed for segmentation, readable inputs and no overflow; keyboard navigation and five dashboard states are covered. Signup checks retain optional answers through refresh, report upload failure, and exercise email verification, recovery, returning sessions, offline recovery and conflicting tabs.
- Hosted `/member` and `/member/application` return the refreshed member shell for an existing disposable ordinary member. `/api/member/verification` confirms archived Fax/version 2; health returns 200. The temporary synthetic session used for these HTTP checks was removed immediately. This is not a new claim of human password-login or mailbox acceptance. Chrome's existing administrator session still redirects `/member` to its staff workspace.
- Actual mailbox/password-login acceptance from the earlier onboarding work remains a separate gate; retained live mail-link fixtures were not deleted by this refresh.

## Rollback

Deploy the previous code revision to restore the former presentation. Saved form data and published policies survive a code rollback. To restore Fax, publish a revised requirement configuration with its existing identifier visible and optional; do not mutate historic versions or delete saved answers.
