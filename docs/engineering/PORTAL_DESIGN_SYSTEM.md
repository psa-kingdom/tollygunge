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
