# TPA premium redesign: reconnaissance and safe integration plan

14 October 2026. Phase 1 only: application runtime code has not been changed by this task. No push, deployment, environment changes, database writes, or authentication changes were performed.

## Verified repository and branch findings

- The supplied workspace directory is a parent folder, not a Git repository. The application root is `D:/Downloads/Workspace/TPA/app`; origin is `https://github.com/psa-kingdom/tollygunge.git`.
- Current branch: `feat/platform-foundation`, HEAD `93d0025`. There are 86 modified tracked files, with 3,629 inserted and 1,324 deleted lines, plus many untracked files. This includes runtime supervision, member imports, event operations, website settings, authentication, and frontend changes. These are existing user work and must all survive integration.
- Live `git ls-remote` matched locally recorded remote tips: development `db0ddae072eb9d57b5659914faa3648c29bb1067`, main `6532f3a9d8a58ae462a9902fce95fe01bce4d8a4`. Current HEAD is one commit behind the development tip and twelve behind remote main. Commit ancestry alone does not capture the newer local uncommitted features.
- `codex/tpa-premium-redesign` does not exist. It was not created because the brief explicitly stops branch changes when the current state is dirty or ambiguous. A clean remote checkout would omit substantial current features; choosing it as the integration baseline would be unsafe.
- Worktrees include this application, `blue-gold-preview`, `email-delivery`, `onboarding-release`, and `.local/main-launch-release`. Only the blue/gold branch was identified as a frontend exercise. Release and backend worktrees are outside cleanup scope.
- User selected a recovery archive for the old frontend exercise. Preserve its commit `1cdd5e3da29931f77ee11fa7456a172093ee0097`, worktree, and files; use a verified bundle outside the application and an archive branch name rather than deleting commits or checkout contents. The existing experiment references a different asset system and should not be merged wholesale.

## Verified reference implementation

An isolated no-checkout clone was created at `D:/Downloads/Workspace/tpa-reference-20261014`. Source was inspected with `git show` and `git ls-tree`; no reference files were edited or scripts executed.

- Repository: `https://github.com/kingsrv18/tpa-site`.
- Exact inspected commit: `a909b06319d1badd479982e9f94fcecdd8cc26bb`, "Add TPA community landing page", dated 13 October 2026, 21:35 IST. Only one commit and 24 tracked files exist in the fetched history. It is later-dated than the current application HEAD, but it is an independent static design, not a newer application release.
- Inspected: `public/index.html`, `public/styles.css`, `public/atlas.css`, `public/app.js`, `package.json`, `README.md`, and the opening verification logic in `scripts/verify.mjs`; asset inventory inspected through Git tree.
- Structure: centered wordmark/navigation, three-line hero and Kolkata watercolor, association introduction, three-chapter interactive atlas, featured/list event composition, membership panel, resources, community image, contact/footer, event dialog.
- Typography: self-hosted Cormorant Garamond and Plus Jakarta Sans with OFL license files. Palette: teal `#245d5b`, ink `#203c3b`, cream `#fffdf0`, gold `#ad9354`. The user's navy/gold requirement calls for deliberate recoloring rather than copying these teal tokens unchanged.
- Assets: Kolkata hero, professional-community and book watercolors, community collage, offline Kolkata map SVG and provenance JSON. Retain font licenses and map attribution. The community illustration depicts fictional people; it must not be presented as actual members or an actual association photograph.
- Behavior: accessible mobile menu; local membership validation/review only; illustrative event dialogs; user-triggered atlas opening/page turns; fine-pointer tilt; once-only IntersectionObserver reveals; reduced-motion media-query handling.
- No backend framework or runtime dependencies. Reference build is a standalone static export. Do not adopt its server/build scripts, form handoff logic, or fixed programme examples.

## Verified current architecture and boundaries

- Next.js App Router with React/TypeScript, npm/package-lock, Next 16.3.8 declared range, React 19.3 declared range. `app/AGENTS.md` requires installed Next documentation before any implementation.
- Server components load data through `src/lib`, with `src/domain` for contracts/rules and client components for interaction. App Router API handlers preserve authorization and service boundaries.
- Better Auth, PostgreSQL, private object storage, email/import workers, Tiptap editing, ExcelJS imports and QR/PDF flyer output are application capabilities absent from the static reference.
- Homepage: `src/app/page.tsx` loads published `home` and `shared` settings, renders `HomeView` in `SiteShell`, and supplies `HomepageMedia`. `src/domain/website-home.ts` holds current editable slots; `src/lib/website-content.ts` reads published settings and public navigation.
- Root layout loads DM Sans/Manrope, appearance bootstrap, metadata, and skip link. Shared styles are in `src/app/globals.css`; fallback screens have a dedicated CSS module.
- Existing tokens include navy `#122c42`, gold `#b78c43`, paper `#faf9f6`, ink `#192e3e`. Light/dark/system appearance uses `tpa-appearance` storage and root color-mode attributes; preserve its semantics.
- `SiteShell` owns public brand/navigation/footer; `AccountShell` and member navigation own account workflows. Staff shell in `src/app/admin/layout.tsx` owns sidebar, search, and account controls.
- `currentActor` resolves authenticated identity and roles with existing verification exceptions. Staff layout redirects unauthenticated visitors to login and non-staff to member space. Staff workspace routing and operation APIs enforce permissions. Design must not weaken any checks.
- Docker creates a standalone Next runtime plus workers; CI has quality/onboarding jobs with disposable PostgreSQL. Build/deployment configuration and runtime workers remain untouched by the redesign. No production endpoint was tested or modified in this phase.

## File-level integration map

| Reference element | Application integration | Preservation requirement |
| --- | --- | --- |
| Hero, introduction, section spacing | `src/components/homepage-view.tsx` | Keep every published copy/link slot, read-only preview behavior, media injection, and inquiry integration. Adapt composition rather than replace data with reference text. |
| Header, wordmark, mobile navigation, footer | `src/components/site-shell.tsx`, existing navigation components | Keep configurable branding, database-driven navigation, account controls, relative app routes, and sticky-header behavior. |
| Fonts and palette | `src/app/layout.tsx`, scoped design CSS, `public/` licensed assets | Preserve metadata/bootstrap and dark mode. Display serif on public editorial headings; keep portal controls and tables readable with sans-serif. Avoid reference global resets. |
| Interactive atlas | New isolated React client component and scoped CSS | Translate DOM handlers into React state/effects; cleanup listeners/observers/timeouts. Keep keyboard controls, focus, attribution, reduced motion and visible static fallback. |
| Event composition | Existing published content/event renderers and `public-content-view.tsx` | Render actual published events and existing detail/registration routes. Never import illustrative event records or substitute sample dialogs for live registration. |
| Membership visual panel | Existing `/join`, `/signup`, `/member/application` entry paths | Use existing onboarding and validation; preserve drafts, verification, invitation holds, and submit behavior. Reference form is not a real application. |
| Resources/community/contact | Existing resource/media/governance renderers and `public-inquiry.tsx` | Retain published/private access distinctions, real inquiry submission, uploads and resource links. Decorative watercolor must stay separate from real media. |
| Portal surface system | Member/account shells, `src/app/member/page.tsx`, admin layout and existing workspace components | Apply shared tokens, spacing, focus and restrained transitions; preserve actions, permissions, tables, labels, status semantics and navigation. |

Do not change API contracts, domain settings schemas, database migrations, credentials, backend services, or dependency versions. A new atlas section can use fixed decorative/contextual copy without altering existing editable settings contracts; its relationship to current editor controls must be explicitly documented.

## Route and page families

- Public: `/`, dynamic public `[page]` pages (about, governance, membership, events, resources, contact), `/events/[id]`, `/resources/[slug]`, downloads and shared flyers.
- Account/onboarding: login, signup, join, forgot/reset password, invitation, email verification, account/profile, unsubscribe.
- Member: overview, application, events and journey, inquiries, payment details, security.
- Admin: overview; permission-based members, verification, bulk onboarding, CRM, communications, events, flyers, imports, website settings, content, media, governance, and remaining administrative groups. Inventory all staff-navigation entries before implementation; do not remove lesser-used routes.
- Preview/fallback: admin previews, editorial preview, loading, error, global error/not-found and unauthorized/empty states. Preview appearances are not proof of authenticated production behavior.

## Proposed design system and responsive motion

Use the approved reference's editorial layout, illustration, serif hierarchy and generous spacing, harmonized with the current navy/gold tokens. Cream surfaces, fine rules, small gold accents and restrained shadows should support a professional association rather than overwhelm operational screens.

Use responsive typography and spacing; test narrow widths rather than hiding overflowing content. Public navigation retains useful routes on desktop and accessible disclosure on phone. Admin tables may scroll inside labeled containers; action controls remain reachable.

Motion: one-time subtle opacity/vertical reveals below the fold, 150–220ms control feedback, 500–750ms user-triggered atlas transitions; pointer tilt only for fine-pointer devices. No looping decorative motion. Content is visible without JavaScript; reduced motion removes translation, tilt, page-turn and smooth-scroll effects. A preference change while the page is open must cancel pending animation timers. Keep animations on transform/opacity and avoid animating layout or essential form/status updates.

## Risks, inferred conclusions, and unknowns

**VERIFIED risks:** dirty source tree; divergent committed baselines; existing editable website slots; broad global CSS; static reference selectors collide with application class names; hard-coded production links/sample events/form review behavior; no portals or backend in the reference; reference light-only defaults versus current appearance modes.

**INFERRED:** translating reference sections into existing components with scoped CSS is safer than static HTML injection or wholesale cherry-picking the prior experiment. No extra animation dependency is needed for the inspected effects. Shared portal tokens can extend the approved design without transplanting decorative landing-page behavior into staff operations.

**UNKNOWN:** stakeholder approval of this exact Git SHA is asserted by the supplied brief, not independently recorded in the repository. Final licensed usage rights for reference raster imagery are not fully documented. Exact desired handling of newly added atlas content in the website editor is undecided. Hosted data, browser appearance, physical-device behavior and provider delivery were not verified in this reconnaissance.

**BLOCKER:** the explicitly required installed `frontend-skill` was not found in the available skill catalog, `.codex/skills`, `.codex/plugins`, or `.agents/skills`. Obtain its actual location or an explicit waiver; do not invent its guidance or silently substitute another skill.

**BLOCKER:** current dirty/ambiguous Git state prevents the branch operation specified in the brief. Safest next action: a separately authorized preservation snapshot of all current tracked/untracked source changes, then establish `codex/tpa-premium-redesign` from that exact current application baseline. Do not stash/reset/clean, switch to stale main, or commit unrelated work implicitly. Do not copy secrets, environment files, dependency folders or build outputs into a preservation commit.

## Verification and completion criteria for implementation

1. Save exact baseline status and per-file hashes before changes. Review the final diff: only planned frontend/assets/docs changes; no pre-existing edits lost.
2. Read installed Next guidance and the required frontend skill. Check local script definitions before executing.
3. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` in the isolated preserved baseline. Record exact commands and results; distinguish pre-existing failures from new regressions.
4. Run meaningful existing browser suites with `TPA_TEST_URL` pointing to a fixed local build and disposable test data: workspace UX, real content, onboarding/member platform, held account, import-job, fallback flows. Do not run production-data or real-recipient tests as redesign checks.
5. Verify `/`, representative public pages, authentication forms, member pages and admin families at 1440, 1024, 768, 390 and 320px. Capture screenshots and inspect actual rendered layout, font/image loading, overflow, contrast, keyboard focus, navigation, menus, dialogs and atlas interactions.
6. Check light/dark/system, reduced motion at load and changed live, touch and keyboard, no-JavaScript public content, loading/errors/empty states, and runtime/network errors. Confirm anonymous protected routes still deny access and staff permissions still filter routes/actions.
7. Exercise current editable homepage preview/published rendering, links, real inquiry behavior using synthetic data, private resources, manual pending-payment semantics, event registration/reminders, flyers and draft preservation in isolated fixtures. Avoid live mail, invitations, promotions and payment changes.
8. Report automated/code/browser evidence separately. Local success does not authorize deployment or establish hosted/provider/physical-device/admin acceptance. Retain the existing delivery checklist's release gates.

## Same-day execution order after blockers resolve

| Order | Work | Approximate effort |
| --- | --- | --- |
| 1 | Required skill and preservation baseline; safe redesign branch; baseline checks | 45–90 min |
| 2 | Licensed assets, scoped public tokens, header and hero composition | 60–90 min |
| 3 | Remaining homepage sections and React atlas, preserving current content/settings | 90–150 min |
| 4 | Member/account and admin shared shells; representative page-family refinement | 90–150 min |
| 5 | Responsive/keyboard/motion checks, regression checks, screenshots, fixes and handoff | 90–150 min |

This is approximately 6–10.5 hours after blockers clear. Shared shells and representative families are realistic in one working day; every admin workspace requires its own acceptance before claiming a complete portal redesign. No push or production deployment is included.

## Phase 1 outcome

Repository identity and dirty-tree safety assessed; reference inspected in isolation; file-level integration plan prepared. Runtime application remains unchanged. Redesign branch creation and implementation await the explicit safety/skill blockers above. The reference is a visual source, while the current application and all its uncommitted features remain the functional source of truth.
