# Implementation status

## Current slice

Foundation and design preview. Public sitemap, responsive shell, membership application
preview and synthetic member-review workspace. No application data leaves the browser.

## Next dependencies

Confirm database, authentication and private storage before persistence. Inspect
Railway/Vercel/Cloudflare access only within approved scope; present cost/provisioning
details before resource creation. Production deployment is not part of this slice.

## Pending slices

Identity/CMS; membership/payments; events/member history; CRM/communications;
flyers/news; reporting/hardening. No placeholder screen counts as a completed module.

## Required business inputs

Verified founders/committee, contact details, governing documents, membership fees,
benefits, eligibility, declarations, refund terms, learning-hour rules and historical
import source/mapping. Never publish invented association facts.

## Verification

2026-10-04: npm run lint, npm run build and npm run typecheck passed. All public
routes and representative workspace routes returned 200; unknown route returned 404.
Browser verified at desktop and 390px mobile widths: homepage, submenu section
navigation, required-field validation, full student preview flow, admin filtering,
rejection reason guard, refund explanation and arrow-key status tabs. Application
and admin overflow bugs found during testing were corrected; page width stayed
within the mobile viewport after fixes. Screenshots are retained in the parent
workspace preview-evidence directory, outside Git.

npm audit --omit=dev: zero vulnerabilities. Full audit reports five high-severity
entries in the development-only eslint-config-next/fast-glob/micromatch/braces
chain. Registry braces latest is 3.0.3, still affected; npm suggests downgrading
the Next lint config across a major version. No unsafe force downgrade applied.
Recheck the advisory before production release and update the lint chain when fixed.

Pending: provider selection/access, server-side authentication, persistent data,
uploads, CMS, payment/communication integrations and production verification.

## Database and private storage preparation

Railway/Vercel account access verified. User intends to use an existing distinct R2
bucket; exact name, privacy status and bucket credentials remain pending. Auth.js
maintainer guidance now recommends Better Auth for new projects; proposed change
awaits confirmation. Dedicated Railway PostgreSQL provisioning also awaits a choice.

Added server-only PostgreSQL pool and R2 S3 adapter, transactional/checksummed
migrations, staff permission and private-document policies, file size/type/signature
checks and namespaced object keys. No live route consumes these helpers yet. Five
unit tests pass, as do lint, build and TypeScript. Database integration checks are
configured against disposable PostgreSQL in CI. Local Docker start was attempted,
but its engine remained unavailable; no local database was created.

No R2 bucket was changed, no cloud service was created, and no live migration ran.
Google OAuth configuration, approved initial staff identity and email provider remain
needed before authenticated workflows. See PROVIDER_SETUP.md for the configuration
contract; put credentials in ignored environment files or deployment secret stores.
