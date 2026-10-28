# Portal visual system

Applies to authenticated admin, member and account pages. Public landing pages,
authentication pages, authored flyers and published content are outside this phase.
Existing permissions, endpoints, records, workflows and publication rules are retained.

## Reference lock

Primary visual foundation: Open Collective's **Raise** style, retrieved through
Refero (`f72e18d0-98f4-4e88-9754-5426589564ea`): white surfaces, navy text,
one blue action color, clear type hierarchy and restrained borders.

Secondary pattern: [Linear members settings](https://refero.design/pages/f7d2b961-5f3e-4699-a227-23a3e26a0452),
for grouped sidebar navigation and compact filter/action controls. The
[Zapier member screen](https://refero.design/pages/f0ed18af-9363-4da0-9a9f-4ffa74d1156c)
informs the separation of member identity, account state and management actions.
Attio and Customer.io styles were compared, but their palettes and marketing
composition are not part of this direction.

| Decision | Source and role | Adaptation |
| --- | --- | --- |
| White surfaces, navy text, blue actions | Raise; blue identifies actions | Cool-gray canvas, navy `#122b4a`, action blue `#2455b6`; no gold portal accents |
| Sans-serif typography | Raise; legibility across UI | Retain the licensed, bundled Jakarta font; 24–30px page headings, 18px section headings, 13–14px working copy |
| Compact grouped navigation | Linear; persistent task access | 232px desktop sidebar, 216px at intermediate widths, expandable navigation below 800px |
| Aligned filters and structured member table | Linear and Zapier; identity and actions | Separate selection, name/email, membership number, status and account columns; preserve existing accessible record-button names |
| Context-sensitive density | User's brief | 8/12/16/20/24px working gaps, 38–40px desktop controls, 44px mobile targets and 16px mobile inputs |
| Purposeful motion | Emil's `emil-design-eng` and `animate` guidance | 140ms button feedback and 160ms pointer-opened popovers; instant keyboard command dialog and page headings; reduced-motion alternatives |
| Dashboard decorative accents | [Aboard task overview](https://refero.design/pages/a0a318b7-2e11-40a4-84ae-d0b87e7b812b); restrained colored icon chips | Selective blue/teal service chips, neutral metric surfaces; metric treatments follow label meaning and count, never index |
| Encouraging completion feedback | [Cake Equity onboarding](https://refero.design/pages/2e3932ef-f22d-41d6-b29e-bfe39baee7f0); clear next-step feedback | Pale blue required-details progress; inline completion check, separate approval badge; no celebration effects |

### Dashboard accent pilot — 28 October 2026

Raise remains dominant. Resume.io style (`6c5eed97-53d1-49df-bc95-b456eef1eb0d`)
informs restrained feature surfaces only. Aboard and Cake Equity contribute the
specific patterns above; their broader palettes and layouts are not adopted.

| Role | Light background / foreground | Dark background / foreground |
| --- | --- | --- |
| Decorative blue | `#eef4ff` / `#2455b6` | `#223653` / `#b6ceff` |
| Decorative teal | `#edf7f7` / `#17666a` | `#18383b` / `#a9dedc` |
| Actionable pending work | `#fff4dd` / `#805308` | `#3d301b` / `#f3cd83` |
| Actual active-members metric | `#edf7ef` / `#28643c` | `#203a2b` / `#afdbbd` |

Pilot tokens and overrides apply only inside `.member-home` and `.portal-overview`.
Green/amber/red retain semantic meanings. Zero metrics use neutral chips. Static
cards have no motion or hover affordance. Interactive cards change borders/shadows
without moving; arrows move at most 2px. Control feedback is 140ms and progress
changes 180ms; reduced motion removes transitions and transforms. Sidebar behavior
and all public styling remain outside the pilot. Completion, notifications and
approval logic are unchanged, including the uncommitted profile-progress work.

Before/after evidence lives locally under `output/playwright/dashboard-pilot/`.
The `before/` desktop/phone folders and `before-tablet/` tablet folder hold the
baseline; `final/` holds the validated pilot. Each contains light/dark screenshots for empty,
incomplete, complete, submitted and verified member states and pending admin alerts.
Review copies use `member-before.png`, `member-after.png`, `admin-before.png`,
and `admin-after.png`. Synthetic verification/attention responses perform no
application submission, approval, payment or email write.

Validation: production build, full lint, structure checks, all 116 unit tests and
18 focused Edge browser tests passed (pilot plus surrounding regressions across
390/768/1320px). Rendered text contrast is at least 4.5:1 in both modes. Checks
cover keyboard focus, 44px mobile card/button targets, distinct attention-link
pressed feedback, reduced motion, unchanged card geometry on hover, no horizontal
overflow, and no public-page token/palette leakage. Admin page height is unchanged;
the member progress panel adds at most 45–51 CSS pixels across the captured states
and viewports, without adding a section or changing the service grid. All work
remains local and uncommitted pending visual review.

Member dashboard layout follow-up: the profile-summary card uses its natural
height and aligns to the top of the verification card. Verification no longer
splits its narrow card into two columns: progress spans the available width,
the explanation and primary action form one wrapping group, and email status
uses a compact footer row. Small screens stack the action group in DOM order.
This changes presentation only. Build, focused lint, structure, mechanical design
scan and three Edge viewport/state/theme checks passed. Evidence:
`output/playwright/member-layout/`. Desktop checks also guard against stretched
profile cards and excessively tall verification cards.

Emil guidance: [design engineering](https://github.com/emilkowalski/skills/tree/main/skills/emil-design-eng)
and [animation construction](https://github.com/emilkowalski/skills/tree/main/skills/animate).
No animation dependency is required for these interactions.

## Implementation boundaries

`PortalShell` is shared by staff, member and account pages. Its CSS Module root
owns the palette and component rules, including dark-mode tokens. It is not
attached to public pages. The original logo asset and public typography remain
unchanged. Embedded event fallbacks opt into a compact panel with a section heading;
full-page fallbacks retain their existing presentation.

Dense data tables scroll within a keyboard-focusable region rather than expanding
the page. Member navigation exposes all existing destinations, with a mobile toggle
that supports Escape and returns keyboard focus to its trigger.

## Verification

`tests/browser/portal-design.spec.ts` uses synthetic account credentials supplied
through `TPA_UI_ADMIN_EMAIL`, `TPA_UI_ADMIN_PASSWORD`, `TPA_UI_MEMBER_EMAIL` and
`TPA_UI_MEMBER_PASSWORD`. It only runs against localhost. Set `TPA_TEST_URL` to
the running local server; `TPA_BROWSER_CHANNEL=msedge` can use installed Edge.

The desktop/tablet/phone projects check every permitted staff workspace and member
destination, document overflow, navigation state, mobile Escape/focus behavior,
keyboard search, member search empty states, dark/reduced-motion behavior and
public-page palette/type isolation. Screenshots are generated in ignored test output.
No business record is submitted, published or deleted by these design checks.

## Workspace information architecture

Every sidebar destination has a page title, task description and a bounded content
area. Workspaces use browse/edit panels, workflow stages, or a report builder as
appropriate; an empty record list does not reserve an otherwise unused column.

| Workspace | Main structure | Empty-state next step |
| --- | --- | --- |
| Verification | Review queue, requirements, history; filters above master/detail | Browse verified accounts or reset filters |
| Bulk onboarding | Choose workbook → map/validate → review → commit/track | Choose a workbook; template downloads stay beside import mode |
| Inquiries | Filters, results, private follow-up detail | Reset filters; select a record when results exist |
| Communications | Inbox, campaigns, templates, invitations, delivery; setup details in a disclosure | Refresh conversations or begin the relevant draft |
| Events | Event library and grouped editor; section links and a save bar | New event; the first event opens a full-width editor |
| Flyers | Choose event → prepare content → preview/export; editor beside preview | Create an event when none exists |
| Historical imports | Upload/validate panel beside validation guidance; row results below | Choose CSV; no commit action is invented |
| Website/content | Clear tool tabs; catalogue, editor and existing preview | Create a private draft or choose an existing page |
| Media/committees | Search or catalogue beside the relevant editor | Upload/configuration guidance or create a person/group |
| Payments | Registration review and payment instructions in separate tabs | View all statuses or refresh the payment roster |
| Email settings | Approved recipients, template tests, delivery history | Add approved test recipients before sending |
| Reports | Builder and saved presets; results and export actions below | Broaden/reset filters |
| Staff access | Account search, responsibilities, administrative activity | Select an account; permissions remain server enforced |

Supporting reference: Luma's [empty events page](https://refero.design/pages/89cfadea-c3cc-452e-bf12-7aa6964b7156)
and [event creation layout](https://refero.design/pages/38031b60-55bc-4199-8d9f-fc087fb2a9c3),
retrieved through Refero. Adapt the action-led empty state and separation of
configuration from preview; retain the existing institutional palette.

Additional browser checks exercise event creation entry points, flyer prerequisites,
import progress/template modes, verification accordions, communication subtabs and
keyboard navigation between payment tools, using synthetic/local data only.


Desktop portal navigation supports a persistent 72px icon rail, with a labelled
collapse/expand button, accessible link names, and hover/focus labels. The mobile
menu remains independent of the saved desktop preference. A 240ms CSS grid
transition reallocates content width; reduced motion switches instantly.

Sidebar icons use GSAP and @gsap/react following the official
[gsap-react skill](https://github.com/greensock/gsap-skills/blob/main/skills/gsap-react/SKILL.md)
and [gsap-core skill](https://github.com/greensock/gsap-skills/blob/main/skills/gsap-core/SKILL.md).
Scoped useGSAP/contextSafe handlers animate only transform properties, overwrite
interrupted tweens, remove listeners on unmount, and revert when reduced motion
is enabled. Hover/focus feedback is a 1.5px lift and 1.08 scale; nothing loops.

## Verification field spacing follow-up

The expanded requirements editor uses stacked labels and full-width controls,
12px separation between checkbox rows, and a distinct field action. Shared portal
form-grid labels explicitly establish grid layout; setting `gap` alone did not
align labels outside `.member-settings`. Public styles remain outside this scope.
Browser regression checks now measure caption/control separation, control widths
and checkbox spacing inside an expanded requirement, rather than only checking
that the outer accordion opens.

## Communications delivery details

The delivery/consent disclosure is now a Delivery details button alongside the
communication tabs. A native modal groups campaign readiness, password-reset
setup, subscriber counts and consent rules. Campaign readiness uses the API's
existing deliveryEnabled field separately from recoveryEnabled. Loading and
failure states avoid presenting unknown configuration as disabled. The unrelated
CRM link is removed from this information panel. Native modal behavior supports
Escape, trapped focus and focus restoration; browser checks cover opening/closing.

## Campaign readability follow-up

Campaigns now separate writing, message/audience preview and saved-draft review
into numbered stages. Optional templates sit with the writing fields, with
stacked controls and a short Apply template action. The message preview has a
bounded surface; review explains the next action for unsaved or archived drafts.
Recipient-check details and sending history use separate disclosures. Existing
save/review/confirm/queue and consent behavior is preserved. Local visual checks
exercise template controls and history disclosures at 1320, 768 and 390px without
saving or sending business data.

## Payments and email settings layout — 28 October 2026

Payment empty states render outside the table; column headers are shown only
when records exist. The populated table retains native table layout with a
keyboard-focusable horizontal scroll region. Status filters and record counts
share a responsive toolbar. Email settings uses a scoped vertical layout with
full-width stacked form controls, a four-row recipient input and individual
approved-recipient rows with separate Send test actions. Existing endpoints and
confirmation behavior are unchanged. Browser checks use synthetic mocked payment
and email-settings data and prohibit email write requests.

## Website/content workspace clarity — 28 October 2026

Website settings shortcuts now sit in a collapsed Manage other website content
folder with explicit descriptions of each staff-workspace destination. Content
editing uses full-width Edit/Preview views at all sizes, keeping the existing
keyboard tab behavior and draft state. Catalogue entries use plain page names and
paths. Metadata fields align at the top; section fields, counters, rich-text
controls and publication actions have scoped layout rules. Website settings
recursive fields have consistent stacked spacing. Public page rendering and
publication endpoints remain unchanged. Build, focused lint, structure and three
browser checks (desktop/tablet/phone) passed without saving or publishing content.

## Shorter content/settings editing — 28 October 2026

Catalogue items no longer shrink inside the scroll region; labels and paths stay
within each button. Content editing groups metadata, introduction, individual
sections, and sources/checks. Hidden fields remain mounted to preserve edits;
invalid native form fields reveal their editing group before focus. Website
settings groups top-level fields instead of rendering the entire tree. Save and
publication actions sit above the active editing fields without overlaying them.

## Navigation loading behavior — 28 October 2026

Removed root/admin/member route-level loading boundaries that replaced whole page
content with the generic Please wait panel. Client navigation now keeps the
current content until the server result is ready. Main public/portal links use
Next Link with hover/focus-triggered prefetch and useLinkStatus feedback: a
layout-independent top indicator appears after 180ms and honors reduced motion.
The pending indicator renders through a portal so closing a mobile menu cannot
hide it. Links retain their original handlers, modifiers and destinations.
Embedded loading states (member events/password controls) use quiet local content
placeholders instead of the old full-page message.

React cache deduplicates currentActor and publishedPage only within a server
render, including layout/page and metadata/page overlap. There is no cross-user
session/role cache and no persistent published-content cache. Header dependencies
and homepage settings load concurrently. Authentication, publication freshness,
error boundaries and API permission checks remain intact. No public visual
redesign or static caching of authenticated pages is part of this change.

A pre-change local click sample took 751/77/84ms across three staff routes. These
are diagnostic observations, not a production speed guarantee. Browser tests hold
route responses to verify retained content and pending feedback, and switch
admin/member/anonymous sessions to verify isolation. Local verification uses
synthetic accounts and performs no business writes.

## Profile completion and applicant alerts — 28 October 2026

Member overview now shows a native horizontal progress bar, percentage, required
item count, next missing requirement and a collapsible linked checklist. Progress
is derived from the currently published policy and saved answers, including
conditional professional-registration/selected-address checks and account-email
verification. Completed means required fields are filled; it does not approve a
profile or membership. Member application links accept validated step=0..4 to
open the right form step while retaining saved fields.

Admin Needs attention and the bell distinguish recent self-service sign-ups
(last seven days, not yet submitted) from applications awaiting profile review.
Existing staff, membership-linked accounts and invitation-created accounts are
excluded from the new-signup notice. Its link opens Members directly in Account
directory view. Submitted applications retain the existing pending-submission
queue and explicit administrator review; no automatic approval was introduced.
Dashboard alerts refresh every 30 seconds and on focus/visibility, preserving the
last result with a refresh error message if a request fails.

Validation: production build, focused lint/structure checks and all 114 unit tests
passed. Six focused Edge browser checks passed (two each on desktop/tablet/phone)
for progress, step links, live signup/submission alert changes and directory links.
Mocked responses exercise pending-application alerts without submitting fabricated
evidence. The actual Edge admin dashboard also shows the existing QA signup.
Rapid login runs encountered the normal local rate limit; reruns were spaced
without disabling security controls. No new real-world emails or approvals were
performed. Evidence is ignored under output/playwright/completion-* and
output/playwright/signup-flow/admin-signup-alert.png.
