# Reporting and news-source preparation — 8 October 2026

Current status: implemented; acceptance evidence is appended after rollout.
Source of truth: [DELIVERY_CHECKLIST.md](DELIVERY_CHECKLIST.md).

## Reports

`/api/staff/reports` retains its existing summary object by default. `?catalog=true`
returns permitted datasets; `?report=…` returns a bounded 200-row preview, columns,
resolved dates and an explicit preview-limit flag. `/api/staff/reports/export` accepts
the same filters plus `format=csv|xlsx`. Both use one query module; directory search,
email verification, contact availability and profile review share the member-directory
filter/query definitions. Contacts are accepted baseline data, never pending proposals.

Reports: accounts (not memberships), events/recorded attendance, inquiry summaries,
content totals and newsletter consent totals. Each dataset enforces its domain permission
on every request. Finance operators have no dataset until verified payment reporting
exists. Content/newsletter are labelled current state; inquiry overdue is also current
state. Event starts, inquiry receipt and account creation use inclusive India-date bounds.
Timestamps in rows/downloads are labelled ISO UTC.

Shortcuts: all dates, last 30 calendar days including today, whole current month,
previous month, current Indian financial year (April–March), custom inclusive dates.
Relative preset periods resolve on application; downloads freeze the applied exact
bounds. Preview/exports query current records, not a stored historical result snapshot.

Exports query up to 10,001 rows and reject over 10,000, never silently truncate. XLSX
uses ExcelJS 4.4.0, fixed readable headers, frozen header row, filters and Metadata.
String cells never become formulas; numeric totals/boolean flags keep their types.
CSV quotes values and prefixes formula-like strings with an apostrophe. Responses are
private/no-store; temporary browser Blob URLs are revoked and exports are not stored
in R2. Audit records identify actor, dataset and format, never row data. Empty files
retain column headers. ExcelJS's uuid dependency is pinned through a scoped override
to patched CommonJS-compatible 11.1.1; workbook round-trips are verified.

`/api/staff/report-presets` stores only name, selection and validated filters. Private
presets can be managed only by their owner, including against another administrator.
Shared presets are managed only by administrators and listed only for permitted
datasets. Every save/delete rechecks live roles and optimistic version; revoked access
cannot apply/export a preset. Visibility is immutable; make a separate private copy.
Checksummed migration 017 adds ownership foreign keys and audited changes.

## Content → Sources

Sources begin empty. Name 160 characters, HTTPS URL 1,000, notes 3,000, website/RSS.
Content editors save drafts; only administrators approve/pause. Approval requires a
saved draft; pause requires approved state. Editing approved/paused records returns
them to draft. Saves/decisions have version conflicts and full revision snapshots with
actor/time/action; no fetch, remote metadata, feed parsing, background job or automatic
publication is introduced. Approving an unreachable synthetic URL is safe because it
is never contacted. Actual sources/schedule/fetch security remain future gates.
Existing news attribution and summary limits are unchanged.

Sources and Pages/Insights share the Content workspace; switching views retains each
editor's in-memory changes. Sources prompts before discarding edits or leaving. Failed
saves retain input; unsaved sources cannot be approved. History is staff-only.

## Release and retained gates

See [RELEASE_RUNBOOK.md](RELEASE_RUNBOOK.md). Resend remains deferred; OAuth, membership
terms, payment verification/refunds, learning policy, imports and collection remain
separate gates. No new paid services/resources. Recovery, full accessibility/security
and complete production acceptance remain open. Historical reports are preserved.

## Local acceptance

Lint/typecheck/build pass; 38 unit and 5 PostgreSQL checks pass. The configured local
HTTP suite verifies all staff report-domain combinations, anonymous/member denial,
account/directory filter agreement, India date boundaries, CSV formula protection,
parsed XLSX string/boolean/header/filter/metadata contents, empty exports, private and
shared ownership, stale preset updates, source approval/edit-to-draft/pause/history,
revoked roles/sessions and exact synthetic cleanup. CI additionally exercises a real
10,001-event export rejection in disposable PostgreSQL (never production).
