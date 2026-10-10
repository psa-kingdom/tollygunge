# Signed-in visibility — 2026-10-06

| Identity | Landing page | Navigation and records |
| --- | --- | --- |
| Anonymous | Public website / login | Public sitemap, Member login and Join TPA. Protected pages redirect to login; APIs reject anonymous access. |
| Verified or explicitly operator-approved account with no staff roles | `/member` through `/account` | Account navigation: own profile, application draft, registrations/attendance, inquiries, active payment details and security. No staff workspaces. Account creation does not confer approved membership. |
| Administrator | `/admin` through `/account`; `/member` redirects to `/admin` | All staff workspaces, Access/audit and scoped reports. Own profile through `/account/profile`, security and an explicit Public website link. |
| Membership reviewer | `/admin` | Members/review and authorized document review; own profile/security and permitted reports. |
| Content editor | `/admin` | Content and editorial Media; own profile/security and content reports. |
| Event operator | `/admin` | Events, Flyers and Imports; own profile/security and event reports. |
| Communications operator | `/admin` | Communications and CRM; own profile/security and communication reports. |
| Finance operator | `/admin` | Payments, payment-detail/QR management and finance-scoped reports; own profile/security. |

Multiple roles grant their combined permissions. Every write/read operation still
checks the server-owned permissions and record ownership; navigation is not an
authorization boundary. Staff may use their own account services by direct routes
without becoming approved members, but those pages retain staff account navigation.

Signed-in users visiting the public website still get the public sitemap, with a
workspace link replacing login/join actions. Protected account pages use a separate
account header, without public marketing dropdowns. Password and Google callbacks
use `/account` so the server decides the correct destination. Signed-in visits to
`/login` also redirect to the appropriate workspace.

Every staff workspace now uses the same grouped, permission-filtered sidebar.
CRM is labelled Inquiries. Public intake creates contact records, not identities;
only communications operators/administrators see the private staff queue.
