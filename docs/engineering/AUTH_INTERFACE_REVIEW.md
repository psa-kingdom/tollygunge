# Login and signup interface review — 28 October 2026

Scope: existing `/login` and `/signup` pages, including their shared form controls,
onboarding sign-in, loading/error messages, unavailable registration and legacy
password sign-in. This is a page audit and implementation, authorized after the
clean-tree scope check; it is not a review of the previous commit.

Stack: Next.js App Router, React, TypeScript, Better Auth, existing global styles
and an isolated authentication CSS Module. Recon covered `AGENTS.md`, `CLAUDE.md`,
`REPOSITORY_STRUCTURE.md`, `PORTAL_DESIGN_SYSTEM.md`, installed Next.js CSS guidance,
the public shell and existing forms. The portal guide explicitly excludes auth
pages; the public navy/gold palette, Jakarta and Cormorant fonts remain the reference.
No translation catalogue is used by these forms.

## Reference lock and decisions

Two style searches and one screen search informed the design. Full references:
Open Collective **Raise** (`f72e18d0-98f4-4e88-9754-5426589564ea`), Aaron Poe & Co
(`b5366346-8c4d-4b66-86e7-abbcd8259c85`), and Appwrite's
[login](https://refero.design/pages/0ff7961f-5f92-4e84-af1c-2b38c434a509) and
[signup](https://refero.design/pages/fcd1e5bc-9230-453a-87b8-6e088071598f).

Primary foundation: TPA's existing public identity, supported by Raise's high
contrast, comfortable spacing and contained content. Preserve navy, gold accents,
editorial headings, the existing Kolkata watercolor and readable sans-serif forms.
Borrow Appwrite's separation of the task and supporting artwork, and Aaron Poe's
restraint in separators and decoration. Do not adopt their pink/red palettes,
fonts, gradients or abstract imagery.

| Decision | Source and role | Reason |
| --- | --- | --- |
| Shared 416px form measure | Appwrite auth structure; one task column | Align the two pages and keep inputs easy to scan |
| Navy artwork panel, gold annotations | Existing public identity; original watercolor | Connect authentication to TPA without adding assets |
| Form first in DOM and on mobile | Accessibility/layout domain rules | Reach the task before supporting information |
| Existing surface/text/action tokens, 6px control radius | Project conventions | Respect appearance preferences and existing controls |
| 48px minimum fields and actions, 16px inputs | Accessibility/typography domain rules | Comfortable targets and no small-text input zoom |
| Neutral outlined Google action when configured | Appwrite hierarchy; provider is secondary | Preserve one filled primary form action |
| Local input borders `#7c898e`, dark `#8b9da9` | Measured contrast; boundary role only | Keep input edges distinct from their surfaces |
| No entrance or interaction motion added | Frequent authentication task | Immediate, predictable feedback |

## Coverage

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Native labels/buttons, autocomplete, live errors, busy/disabled states, keyboard focus and reduced motion | Fixed boundary contrast; checked scope passes |
| Layout | Shared layout and forms at 320/390/768/1320px, both appearances; RTL and enlarged-text reflow | Consistent measure and no horizontal overflow |
| Writing | Page descriptions, membership policy, recovery, unavailable and mocked failure states | Recovery instructions and action hierarchy clarified |
| Typography | Existing font files, heading scale, computed input size, wrapping and text resize | 16px input text and scalable copy |
| Colors | Rendered foreground/background pairs and input edges in both appearances | All sampled text meets 4.5:1, large text 3:1; input edges meet 3:1 |
| UI | Shared spacing/radius, primary/provider actions, loading and error presentation | Consistent treatment; no motion added |

## Findings implemented

| Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- |
| HIGH | Accessibility | `src/components/auth-layout.module.css:20` (original rule: `src/app/globals.css:1242`) | Global input boundary `#dcded5` against white measured 1.36:1 | Scoped boundary `#7c898e` measures 3.60:1 against white; dark border also passes browser measurement | WCAG 1.4.11 requires 3:1 for the visible input boundary |
| MEDIUM | Layout | `src/components/auth-layout.tsx:14`, `src/app/login/page.tsx:35`, `src/app/signup/page.tsx:19` | Login used a centered panel after a separate introduction; signup used a wider bare form | Shared contained form and supporting community panel | Both entry paths now have consistent alignment, grouping and task order |
| MEDIUM | Typography | `src/components/auth-layout.module.css:20` | Inputs inherited 15px body text | Explicit 16px inputs with at least 48px height | Avoids small-text input zoom on iOS and improves form readability |
| MEDIUM | UI | `src/app/login/page.tsx:52`, `src/components/auth-layout.module.css:35` | Google and password actions shared filled styling; unavailable Google remained visible | Neutral provider action only when configured; clear unavailability message for disabled password sign-in | Makes the primary action and available methods unambiguous |
| LOW | Writing | `src/components/onboarding-auth.tsx`, `src/components/password-controls.tsx` | Some errors offered no recovery instruction; old errors remained during retry | Clear retry/recovery language, reset messages on retry, announced errors and busy state | Explains how to continue and avoids stale feedback |

## Verification

Passed:

- `npm run build` — optimized application and worker build.
- `npm run typecheck` — TypeScript check.
- `npm run lint` — full repository ESLint check.
- `npm test` — all 116 tests passed.
- `npm run check:structure` and `git diff --check`.
- `node .local/check-auth-design.mjs` — 16 route/theme/viewport combinations;
  computed text and input contrast, input sizes, overflow, keyboard focus,
  mocked sign-in/signup errors, signup loading/disabled state, recovery from errors,
  preserved allowed `returnTo`, reduced motion and RTL overflow.
- Production preview with onboarding disabled — disabled sign-in explanation and
  registration-unavailable state with a sign-in recovery link.
- Signup at 640px with 200% root text size — no horizontal overflow.
- Visual inspection of desktop dark login and mobile light signup screenshots.
  Decorative artwork is omitted below 800px to keep the mobile support panel compact.

Evidence: ignored `output/playwright/auth-design/after/`, including `checks.json`,
16 page screenshots and error-state captures. The local runner is ignored under
`.local/`. Initial capture was concurrent with implementation, so the `before/`
folder is not treated as reliable baseline evidence; original-state findings use
the reviewed source. A first return-path check used an unsupported route and was
corrected to the application's allowed `/member/events` destination before passing.

Not verified: screen-reader speech, physical iOS behavior, browser-chrome zoom,
real OAuth, successful account creation/sign-in, emailed recovery, and the
authenticated account-switch notice. Error responses were intercepted locally;
no account or email writes were performed. Google styling is source-reviewed;
the local preview does not configure a live OAuth provider. BrowserOS neo tools
were unavailable, so browser checks used installed Edge through Playwright.

Verdict: **Approve** for the inspected interface states and domains; no remaining
HIGH findings. Runtime authentication and the unverified interactions above are
outside this design verification. Changes are local and uncommitted.
