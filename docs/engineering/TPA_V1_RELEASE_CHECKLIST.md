# TPA v1 release gates

Target: 28 October 2026. This is a finite gate record, not a claim that all inventory cases passed. Historical evidence remains in the four launch documents and executed-result index. The release evidence must identify exact commits, run IDs and deployment IDs.

| Gate | Current state |
|---|---|
| Preserve source and recovery | PASS: nine checkouts captured with verified payloads and all-refs bundle in private `D:/Downloads/Workspace/TPA-recovery/20261028-v1/source-baseline`. Original checkouts remain untouched. |
| Production PG18 backup and restore | PASS: complete custom-format snapshot, PG18 dump/restore, 92 table counts, 978 constraints, indexes and extensions verified; owned restore database removed and owned server stopped. Private result `production-backup-9ee904bb-8bdb-4fbb-bce7-8e138979492b/results.json` in recovery root. |
| Invitations | PASS at 06:37 UTC: 202 held, zero queued/leased invitation mail, no approved template. Recheck after deployment. Administrator must approve template and explicitly release invitations later. |
| Application static checks | Latest completed v1 run at `1355d65`: lint, structure, 127 unit + 9 runtime tests, web/worker builds and typecheck PASS. Repeat after route-context fix. |
| v1 browser cases | 9/9 PASS at 06:37 UTC: public metadata/privacy/404/share image and actual public/member issue reporting. Repeat with final runtime. |
| Publishing | PASS after transient null pathname guard: actual save/reload/publication and nine responsive/accessibility views at `.local/website-control/2026-10-28T06-41-45.157Z`. Original failures remain retained. |
| Other local baseline | Newsletter, member, accounts, imports, invitations, events and manual payments passed at recorded scope. The interrupted full browser run is FAIL, not a baseline pass; full rerun required. |
| Required CI | PASS on PR4 candidate `e181eb0` and merged main `676e2752f4781ff265ba30d71fdce12480105988`: all four jobs. Runs 40647830810 and 40649383107. PR5 corrects Linux fixture retirement and duplicate cancelled checks; its final gates remain required. |
| Merge and exact SHA CI | PR4 merged normally as `676e275`; testing was fast-forwarded to it. PR5 is a tooling-only follow-up; final branch alignment awaits its normal merge and exact-SHA CI. |
| Hosted acceptance | BLOCKED: two upload deployments failed at Railway SNAPSHOT_CODE before build. Prior deployment remains healthy. Reviewed production patch `3e17706d-8efc-4b34-8dc5-2430dc27927e` pins existing service to verified GitHub main SHA `676e275`; applying it was rejected by Railway's approval gate. User approval requested. No QA account or QA emails yet. |
| Observation and rollback | PENDING: 15 minutes. Critical failure redeploys previous verified app; retain subsequent user data. |
| Archive and consolidation | PENDING until hosted acceptance: verified recovery/restoration, owner/process review, allowlisted retirement, clean canonical checkouts, exactly two aligned local/origin branches and v1.0.0 tag. |

## Twenty-point public website disposition

1. Preserve SSR and authorization; public content without JavaScript checked by existing public-interactions suite.
2. Add robots guidance and sitemap; never treat crawler rules as access control.
3. Sitemap includes fixed canonical public pages and only eligible published public events/resources.
4–7. Page-specific titles, descriptions and canonical URLs; primary H1 retained; no-JavaScript notice is a paragraph.
8. Branded default Open Graph/Twitter card uses the unchanged supplied logo.
9. Existing custom recovery page returns HTTP 404.
10. Retain valid existing www-to-apex 308; verify HTTPS and redirect behavior hosted.
11–13. Existing meaningful alt text and loading behavior retained. Measure assets before any format change; do not convert supplied branding blindly.
14. Homepage Organization JSON-LD contains verified association name, URL and logo only.
15. Subtle breadcrumbs on deeper public event/resource pages.
16. Public interactions and internal-destination traversal remain required.
17. Google Analytics deferred; no new tracker.
18. Owner handoff: verify the `tpassociation.org` Search Console domain property using the association's Google owner, then submit `https://tpassociation.org/sitemap.xml`. Indexing is a later external outcome.
19. `/privacy` explains actual information use, role access, service providers and contact procedures without invented retention/compliance claims.
20. Existing consent, duplicate protection, persistence and CRM remain; issue topic maps to backward-compatible General + website-issue tag, no migration or API contract change.

Physical devices, future features and search indexing remain distinct from browser emulation and executed v1 acceptance. No unexecuted inventory item becomes PASS by association. Actual Chrome native 200% zoom passed eight prior-live public/sign-in destinations, each one H1/no horizontal overflow at 429 CSS px; restored 100%. This does not establish candidate deployment or private member zoom acceptance.

Private archive restoration rehearsed: 39,963 source/evidence/config files match hashes, including 270 configuration/credential-related files. Original eight-worktree recheck at 09:45 UTC reports zero failures. No retirement or recursive cache deletion has occurred.

## Laboratory performance checkpoint

Anonymous read-only cold Chromium samples at 390/1440px for home/about/contact: LCP 2168–3608 ms, CLS 0 in six navigations, TTFB 283–350 ms. No CPU/network throttling; one-second post-network quiet window. This is workstation/network laboratory evidence, not field INP or percentile performance. `.local/launch-readiness/public-lab-2026-10-28T06-44-42.938Z/results.json`. Existing original logo costs 1,960,615 transfer bytes; retain supplied branding and record optimized delivery as measured maintenance work. No photographic asset conversion is justified by these samples.
