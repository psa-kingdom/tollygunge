# Public navigation, footer and information pages

28 October 2026. Covers shared public navigation and footers, plus governance,
membership, events, resources and contact. About shares the information-page
component. Existing login/signup work is retained. No portal styling, publishing
rules, application requirements, authentication or database schema is changed.

## Reference lock

Primary direction: the existing TPA public identity — navy text, paper canvas,
gold annotations, licensed Cormorant headings and Jakarta controls. The existing
Raise reference supports contained content and readable spacing; its action
palette is not imported. Existing watercolor assets remain decorative, and the
form/content is prioritized over artwork on small screens.

Refero screen research inspected full references for:

- [Bloomberg footer](https://refero.design/pages/3d4bbf91-1faa-4451-8933-0370861be4ed): separate identity and grouped navigation.
- [Linear contact and footer](https://refero.design/pages/b9448a36-4e51-418d-9801-f53e1b44a1f9): restrained grouping, content measure and form alignment.
- [DailyArt navigation](https://refero.design/pages/4364cc9d-144f-41ba-b189-5f62023ad939): clearly named link groups and generous readable link rows.

The references inform structure only. No new red accent, font, imagery, social
account or unconfirmed contact information is introduced.

| Decision | Source and role | Implementation |
| --- | --- | --- |
| One footer with an identity column and three navigation groups | Bloomberg/Linear grouping; TPA navy | Shared footer styles apply to all public shells, including the homepage |
| Compact dropdown with an overview destination and section links | DailyArt grouping; existing native disclosures | Native `details`/`summary`, normal links, 44px rows, anchored panel |
| Section index beside readable content | Existing information sections and layout rules | Sticky index on wide screens; wrapping links on narrow screens |
| Preserve editorial headings and existing artwork | TPA identity | Consistent heading measure and page gutters; no new font or asset |
| Group contact details and progressively disclose optional fields | Linear form grouping and native platform | Existing inquiry fields, labels and validation retained |

## Before / after

| Before | After | Why |
| --- | --- | --- |
| Footer group grid was accidentally nested inside `min-width:1500px`; homepage had a separate layout | One responsive footer at every width, with the obsolete overrides removed | Common laptop and phone sizes now retain proper groups and alignment |
| Dropdowns lacked an overview link, consistent active treatment and dismissal behavior | Overview links, current-page indication, outside-pointer dismissal, Escape focus restoration, focus-leave and link-selection dismissal | Navigation is clear and usable with both pointer and keyboard |
| Information pages used inconsistent heading/body widths and a narrow section-heading column | Shared 1240px container, section index and naturally sized content | Long rosters and resources have room without making short pages sparse |
| Membership progression was one arrow-separated paragraph | Responsive ordered application sequence | The six steps remain readable when text wraps |
| Contact optional fields were all expanded | Native Additional details disclosure, with validation opening it when needed | Shorter default form without removing fields |
| Open biographies stretched neighboring profile cards | Roster items align to the start | Adjacent cards keep their natural height |

## Motion decisions

Applied `emil-design-eng` and `animate`. Navigation is frequent, so content,
section jumps and keyboard disclosure actions are instant. Pointer-opened panels
use the **preventing a jarring change** purpose; header button presses use
**feedback**. CSS is sufficient; no dependency was added.

- Panel entrance: opacity and `scale(.97) translateY(-4px)`, trigger-side origin,
  180ms `cubic-bezier(0.23,1,0.32,1)`, using `@starting-style` as enhancement.
- Header button press: scale `.97`, 150ms on the same easing.
- Keyboard input removes those transitions immediately. Reduced motion removes
  transforms; hover treatment is gated to fine pointers that support hover.
- Closing disclosures is immediate. No content reveal, timer or stagger gates reading.

## Verification

Browser checks use installed Edge through Playwright; BrowserOS neo MCP tools
were unavailable. The preview uses no live database. Inquiry failures are mocked,
and populated-layout fixtures are rendered from the real components with clearly
synthetic profiles, events and resources. No inquiry, account or publication is
written by these checks.

- `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` (116 unit tests),
  `npm run check:structure`, and `git diff --check`.
- `TPA_TEST_URL=http://127.0.0.1:3112 TPA_BROWSER_CHANNEL=msedge npx playwright test tests/browser/public-navigation.spec.ts tests/browser/footer.spec.ts`:
  desktop, tablet and phone regression coverage for footer destinations, section
  anchors, disclosure behavior, 320px menu scrolling and inquiry failure recovery.
- `node .local/check-public-design.mjs`: 72 combinations of six public pages,
  light/dark appearance and 320/390/768/1024/1320/1600px widths. Text contrast is
  measured against rendered backgrounds; sampled normal text meets 4.5:1 and
  large text meets 3:1. Nine synthetic populated layouts are checked separately.
  Enlarged text, reduced motion and RTL overflow checks also pass.
- Enlarging text exposed a footer identity-row overflow; wrapping the row fixed it.
- The first inquiry test expected raw server wording. It was corrected to the
  established service-unavailable message. The outside-click check was moved to
  an uncovered page location so mobile overlays did not intercept the test action.

Before/after screenshots and measured results are local and ignored under
`output/playwright/public-design/`. Browser-test evidence is in ignored
`test-results/` and `playwright-report/`. Physical touch hardware, screen-reader
speech, production content and live form delivery have not been verified.

Changes remain local and uncommitted. A slow-motion feel check of pointer menus
and a physical-phone pass are useful follow-ups; neither blocks keyboard access
or hides content when motion or JavaScript is unavailable.
