# Member dashboard and verification refresh

The member overview now separates profile verification, email status, personal profile access and account services. The full editor stays at `/account/profile`. Navigation prioritises Overview, Verification, Profile and Events; secondary services are under More.

The five-step form has a responsive stepper and consistent card layout. Optional family/health, additional telephone and referral fields expand independently. Saved optional answers remain discoverable; error focus opens the relevant section. Administrators making these fields mandatory brings them into the main form. Autosave, recovery, upload association, version conflicts and submission permissions retain their existing paths.

Fax is archived with the same `fax` identifier and optional status. Live requirements version 2 was published through the authenticated requirements API after impact preview reported zero affected verified profiles. Verification state was compared before/after publication and remained identical. Old policy versions, submitted snapshots and answers are untouched; administrators can restore Fax through another versioned publication. Fresh initial policies also archive Fax. No SQL migration was needed.

## Validation

Unit, build, lint/type checks and isolated database/HTTP/browser acceptance results are recorded after execution. Browser fixtures cover five dashboard states at desktop/tablet/phone sizes; new signup journeys cover optional-section persistence and form recovery. Mail delivery acceptance from the prior onboarding work is separate from this visual refresh.

## Rollback

Deploy the previous code revision to restore the former presentation. Saved form data and published policies survive a code rollback. To restore Fax, publish a revised requirement configuration with its existing identifier visible and optional; do not mutate historic versions or delete saved answers.
