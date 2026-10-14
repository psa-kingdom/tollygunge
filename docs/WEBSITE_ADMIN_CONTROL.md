# Website admin control — 13 October 2026 (IST)

**Status: implemented and accepted locally; NOT DEPLOYED.** Production remains main `6532f3a9` with migration 029. The replacement release includes the previously unreleased event platform plus website-control migration 033. Deployment still requires final approval.

## People and canonicality

The old deployed directory selected 200 people before filtering, hiding seven of the eight published committee profiles. The replacement applies search/status/committee filters in SQL before 50-row pagination, provides exact counts and defaults to **All people**. Direct record links bypass pagination. Members and People use the same Person IDs; membership/account/publication states remain separate.

The fresh production backup contains 214 people, including the disposable QA person, and eight published committee profiles. All eight appear in the corrected restored-data admin list. The 202 member records are accessible through the same directory. Existing standalone committee identities are not automatically merged with similarly named imported members; any identity merge requires authoritative matching and a separate reviewed operation.

Biography headings now default to **About {name}**, using the full name. Website settings controls the default template; each person may have an optional override. The override follows draft, review and publication snapshots. Ordinary members cannot change staff-managed presentation headings or publish profiles.

Archive withdraws a profile without deleting its Person, membership, account, portraits or history. Restore leaves it private until explicitly published again. The two known QA records were archived through the browser in the restored local preview. Their production archival remains a post-deployment task; production was not modified in this pass.

## Admin-control inventory

“Controlled” means an existing management workflow. “New control added” means included in this reviewed release, not yet live.

| Public route/component | Fields and state | Status / admin location |
|---|---|---|
| `/` homepage | All marketing copy, heading lines, guide copy/numbers, values, cards, CTA labels/destinations, contact-section copy | New control added: Website settings → Homepage. Fixed layout slots retained. |
| Homepage media gallery | Images, titles, alt text, category, featured selection, display order; gallery heading/eyebrow/link | Controlled: Media library; new order control and Homepage gallery copy controls. Three featured display slots retained. |
| Public header and footer | Organisation name/text brand or published logo, logo description, menu labels/destinations, contact link, join/login labels, footer copy/location/links | New control added: Website settings. Matching published page section headings supply submenu labels. |
| Shared metadata | Default title/description and title suffix | New control added: Website settings. Route-specific account/security titles remain application UI. |
| `/about` | Page label/title/introduction, section headings/body, founding profiles | New page-label and heading controls in Content; people placement controlled in People & Committee. |
| `/governance` | Page copy/headings, committee/group labels, subgroup hierarchy, roles, terms, ordering, people/portraits/biography headings/public links | Controlled: Content and People & Committee; new complete directory, heading and archive controls. |
| `/membership` | Editorial page copy/headings/links | Controlled: Content; new section-heading/label controls. Plans, eligibility and membership approval stay in their operational workflows. |
| `/events` | Editorial page copy/headings; published event listings | Controlled: Content and Events. Existing route/section anchors retained. |
| `/events/[id]` and member events | Event information, speakers, booking windows/capacity, visibility, fee/payee selection, resources, attendance/financial/benefit states | Controlled: Events/Payments and event command center in the pending release. Financial facts are not CMS copy. |
| `/flyers/[id]`, flyer exports | Presentation headline/accent and publication; canonical event details and speakers | Controlled: Flyers/Events. Export freshness checks and static-download timestamps retained. |
| `/resources` | Editorial copy/headings, ordered articles/images, important links, downloads | Controlled: Content/Media; new Important links and Downloads collections in Website settings. |
| `/resources/[slug]` | Article title/introduction/rich body, source/attribution, display order, draft/publish/withdraw/archive | Controlled: Content, with new ordering/archive controls and published metadata. |
| `/contact` | Editorial office/location/contact copy and rich HTTPS links | Controlled: Content. Inquiry processing remains an operational workflow. |
| `/downloads/[id]` | Managed PDF title/description/order, upload/replacement and publication | New control added: Website settings → Downloads. PDF up to 5 MB or document links. |
| `/media/[id]` | Public editorial image and description, publication | Controlled: Media library. Upload new replacement assets and publish the relevant reference; existing files are not overwritten. |
| Public portrait endpoints | Owned portrait reference, photo replacement, public visibility through a published profile | Controlled: People & Committee. Private member evidence is a separate storage/access domain. |
| `/login`, `/signup`, `/join`, `/forgot-password`, `/reset-password`, `/email-verification`, `/invitation`, `/unsubscribe` | Shared branding/footer metadata; account forms, consent and security behavior | Branding is controlled. Account-flow instructions, validation, system messages and token behavior are deferred from CMS and remain application code. |
| `/account/*`, `/member/*`, `/admin/*` | Private profiles, evidence, membership, payments, operations and staff access | Governed by existing permissions/workflows, not public CMS publication. |
| `/preview/*`, error pages | Demonstration screens and system error/navigation messages | Deferred: engineering-owned previews/system UI. They are not canonical public content. |

Content’s six website-page buttons load current defaults for unsaved pages. Saving does not publish them. Section counts, ordering and `#section-N` anchors remain structural; their labels and content are editable. Withdrawing a website-page override restores its original fallback; withdrawing an article removes its public article URL.

The existing 12 professional links are adopted into managed published rows by migration 033 without changing their titles, destinations or order. PDFs use a new editorial storage namespace and publication-aware application downloads; a private evidence ID cannot be attached as a public PDF. Replacement uploads create new file records, preserve the old published bytes until publication and retain historical references.

## Evidence and practical limits

- 97 unit tests pass; build, lint and type checking pass.
- Website acceptance covers role denial, 206-person pagination, older committee records, member linkage, biography defaults/overrides, archive/restore, homepage publication, synchronized section labels/anchors, link publication and PDF replacement/withdrawal, invalid/oversized files and retained file records.
- Real browser acceptance saves/reloads/publishes homepage content and checks admin People, Website settings and Content at verified 1440/768/390px widths. The nine checked states have no page overflow or automated WCAG violations. This is viewport emulation, not a physical-device claim.
- Evidence: `.local/live-product/website-final-acceptance.log`, `.local/website-control/*/acceptance.json`, screenshots and server logs. Exact source and replacement package builds are recorded in the acceptance evidence and final release manifest.
- Fresh production backup restores and migrates through 033 locally. Original 208 accounts, five credential rows, 214 people, 202 memberships, eight portrait rows, payment configuration and existing content match the pre-migration data. All 202 invitation holds remain intact. No workers run during restore.
- Restored-data browser evidence: `.local/website-preview/all-eight-committee-profiles.jpg` and cleanup rehearsal evidence. Local credentials are synthetic and excluded from the release. The preview does not configure production storage writes; existing portrait references are retained, while actual hosted upload/replacement remains unverified.
- No production migration, deployment, external test email, financial transfer or production record edit occurred.

## Deferred capabilities

Deployment approval, remote CI and hosted retests remain required. Actual hosted PDF/photo upload, inbox delivery, physical devices and human acceptance are not established by the local mocks. The Chrome extension’s file-upload access limitation from the previous pass remains a hosted browser blocker.

Free-form layouts, adding new structural page types/slots, CSS/themes, favicon/app-icon formats, multilingual interfaces, account/security microcopy, database identity merges, historical-file download/one-click revision restoration and provider/infrastructure configuration remain engineering work. Public Office/executable uploads, uploads over 5 MB, new payment integrations and automatic external news collection are deferred. Future content types should reuse the same draft/publication, version, permission and audit controls.
