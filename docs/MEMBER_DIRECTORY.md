# Membership staff account directory

Members now includes a private account directory for administrators and membership
reviewers. `/api/staff/members` enforces `members:review` on every list and detail
request. Other staff roles and ordinary accounts receive 403; anonymous requests
receive 401. This is not a public member directory or an approved membership list.

Search matches name, email, phone, organization, profession, job title and city.
Literal `%`, `_` and backslashes are escaped in parameterized SQL. Verification and
phone-availability filters run before stable ordering and 25-record pagination.
Counts and rows use one repeatable-read transaction. Optional account detail lookup
returns only identity/contact/professional summary fields, without sessions, roles,
consent/preferences, documents or private application drafts.

Selecting a result opens a compact profile preview; focus moves to its heading.
Closing returns focus to search. Email and phone copy actions report success or a
manual-copy fallback. Missing phone numbers disable copy.

Five recent searches and five recently viewed summaries are retained only in React
memory while the workspace stays open; no localStorage or server search-history
records retain this contact information. Clear recent activity removes both lists.
Reopening a recent profile reloads its summary through the authorized endpoint.
Approved-member, membership-plan, renewal and application-review filters await the
actual membership workflows and approved rules; verified email is not membership.
