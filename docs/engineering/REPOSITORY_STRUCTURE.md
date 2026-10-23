# Repository structure and file placement

This policy follows the [Phase 8A audit](PHASE8A_REPOSITORY_AUDIT.md) and
[Phase 8B logo integration](PHASE8B_LOGO_INTEGRATION.md). The Git repository is
`app`, inside the TPA workspace. Sibling checkouts, supplied documents, recovery
bundles and source photographs are not repository clutter to import or remove.
Keep the existing Next.js App Router/TypeScript structure. No existing source or
historical report needs moving to satisfy this policy.

## Directory responsibilities

```text
app/
  src/
    app/                 routes, layouts, handlers, styles, framework icons
    components/          reusable UI and existing workspace components
    domain/              business rules, validation and permission policies
    lib/                 server services, storage, database and integrations
  public/design/         public artwork, logo, maps, fonts and their licences
  tests/
    browser/             Playwright specifications
    helpers/             reusable test support
    fixtures/            future synthetic fixtures; create only when needed
  scripts/               developer/operator tools and worker entrypoints
  migrations/            ordered, checksummed SQL migrations
  data/postal/           runtime reference data, provenance and licences
  docs/
    engineering/         new engineering guidance and audits
      decisions/         future numbered architecture decisions, when needed
  .github/workflows/     CI configuration
  .local/                ignored local runners, diagnostics and recovery evidence
  output/playwright/     ignored browser review galleries and screenshots
  playwright-report/     ignored generated Playwright reports
  test-results/          ignored traces and test attachments
```

Root files retain their supported locations: Dockerfile, `.dockerignore`,
`.gitignore`, `.env.example`, package manifest/lockfile, Next/TypeScript/ESLint/
Playwright configuration, README, AGENTS, CLAUDE and the existing release note.
`next-env.d.ts` is already tracked: preserve its current treatment in this phase.
`.next`, `node_modules`, `out` and TypeScript build information are generated,
ignored outputs. Their presence does not authorize deletion or prove redundancy.

## Choosing a destination

| New item | Destination and responsibility |
| --- | --- |
| Page or layout | `src/app/<route>/page.tsx` or `layout.tsx`; preserve framework conventions and URL segments. |
| API handler | `src/app/api/<resource>/route.ts`; keep authorization at the server boundary. Existing download/media handlers outside `/api` stay where they are. |
| Route-specific component | Beside the owning route when used only there; use the installed Next.js colocation guidance. Do not introduce new page/route files accidentally. |
| Shared or workspace UI | `src/components/<kebab-case>.tsx`; accompanying `<name>.module.css` when appropriate. Existing workspace components stay here. |
| Feature logic | Pure rules in `src/domain`; service/integration code in `src/lib`. Do not add a parallel `features` architecture merely for symmetry. |
| Public asset | Existing `public/design` namespace, referenced by `/design/...`; framework icon files remain in `src/app`. |
| Private asset | Existing private-storage services and authorized routes; never `public`, source fixtures or Git. |
| Unit/integration test | `tests/<subject>.test.ts` or `<subject>.integration.ts`; existing runtime `.test.mjs` convention remains supported. |
| Browser test / fixture | `tests/browser/<subject>.spec.ts`; synthetic reusable inputs in `tests/fixtures`, helpers in `tests/helpers`. |
| Migration / schema tooling | Next ordered SQL file in `migrations`; schema-generation tooling in `scripts`. Never rename or edit applied migrations. |
| Worker / script | `scripts/<kebab-case>.mts` for typed scripts; `.mjs` for Node tooling. Worker service logic may remain in `src/lib`. |
| Engineering guide / decision | `docs/engineering/UPPER_SNAKE_CASE.md`; decisions use `decisions/NNNN-kebab-case.md`, next unused sequence number. |
| Product or operational document | `docs/<SUBJECT>.md`, beside related existing guides. Keep existing historical paths and evidence links. |
| Configuration example | Root `.env.example` with placeholders; other templates beside their owning tooling under `scripts` or `docs`. Never copy live configuration values. |
| Generated evidence | `output/playwright/<phase-or-run>/` for galleries; `.local/<phase-or-run>/` for logs, sanitized runners and diagnostics. |

Use existing kebab-case source names and framework-required names. Exported
React component names use PascalCase; do not rename existing files just to
normalize style. Directory names describe responsibility, not authors or dates,
except dated run/evidence directories. Keep imports using the established `@/*`
source alias or existing relative conventions.

Share code when multiple real consumers need the same behavior. Keep single-route
UI local and avoid premature abstractions. Domain code must not acquire UI or
database dependencies for convenience; server integration remains in `src/lib`.

## Runtime, public assets and operations

The supplied logo remains `public/design/tpa-logo.png`, retaining its original
bytes and `/design/tpa-logo.png` URL. Keep `src/app/icon.png` and `apple-icon.png`
in their Next.js metadata locations. Preserve font licences beside their fonts.
CMS published-media overrides continue through existing media routes; uploading a
file does not make private media suitable for `public`.

Retain `scripts/email-worker.mts`, `member-import-worker.mts`, `build-worker.mjs`
and `start-runtime.mjs`. The build produces separate `.next` worker bundles;
Docker copies them and the supervisor into the runtime image. Do not combine
workers with the web process or change their output names for organization.
Keep postal runtime data at the paths traced by `next.config.mjs`.

## Generated artifacts and sensitive material

Browser galleries under `output/playwright` are excluded from Git and the Docker
build context. Existing galleries remain on disk and linked from their reports;
ignoring them is not archival or backup verification. Preserve meaningful reports
in `docs`, including historical acceptance/security evidence. Do not blanket-ignore
images, JSON, Markdown, all `output`, or all reports. CI artifacts can be uploaded
through existing workflows without committing them.

Never add production exports, member lists, private documents, real sessions,
passwords, API keys, environment files or private/certificate key material to Git.
Use synthetic fixtures and placeholder examples. `.env.local`, `.postgres-ca.pem`,
`Credential.md`, `.local` and `references` stay local. Do not print their contents
while checking placement. Public datasets require provenance and a licence;
database backups and recovery bundles belong in approved private recovery storage.
Do not delete uncertain outputs, untracked work or recovery evidence.

## Enforcement and changes to the structure

Run `npm run check:structure` from the repository root. CI runs the same command.
The dependency-free checker reads NUL-separated Git index paths, including staged
and force-added ignored files. It rejects unsupported root destinations, generated
outputs, explicitly local/private paths, environment files except root
`.env.example`, `Credential.md`, certificate/key extensions and TypeScript build
information. It prints offending paths, not contents.

Untracked files are not checked until added to the index. Review `git status`
before handoff and inspect new files against this guide; do not stage work merely
to run the checker. The checker is a placement guard, not secret-content scanning,
data classification or proof of safety. Existing allowed roots can still contain
incorrectly placed or sensitive files; review remains necessary.

Before adding a top-level directory or root file, document why existing
destinations are insufficient, update this guide and the checker allowlist, and
add a focused policy test. Do not create empty directories speculatively.
Dependencies require a concrete need and review of compatibility, licence,
bundle/runtime cost and lockfile changes. Configuration changes require checking
every build, CI, container and runtime consumer. Do not upgrade dependencies as
part of a mechanical reorganization.

## Before creating or moving a file

1. Read AGENTS and the applicable installed Next.js guide; inspect current Git
   state and preserve unrelated work.
2. Choose an existing destination and distinguish public, private, source,
   reference data and generated evidence.
3. For a move, search static/dynamic imports, string paths, scripts, tests,
   workflows, Docker, tracing, asset URLs and documentation links. Check runtime
   generated paths and case-sensitive Linux resolution.
4. Leave uncertain candidates, applied migrations and historical/recovery evidence
   in place. Record unresolved ownership or references rather than deleting them.
5. Move only a coherent, justified group; update all references mechanically and
   inspect the diff before the next group. Separate functional changes.
6. Run structure checking, relevant tests, lint, build and typecheck; use isolated
   local fixtures for browser/runtime checks. Record hosted/container checks only
   when actually run on the candidate.
7. Review status, new/untracked files, evidence links and preservation hashes.
   Commit, push, deployment and cleanup require the task's explicit authorization.

## Placement examples

| Correct | Incorrect |
| --- | --- |
| `src/app/api/staff/example/route.ts` | A new root `api/` tree that bypasses App Router. |
| `src/components/example-panel.tsx` | `public/example-panel.tsx` exposing source as an asset. |
| `public/design/tpa-logo.png` | Moving the logo into `src/assets` without preserving its public URL. |
| `tests/fixtures/synthetic-members.json` | A production member export committed as a fixture. |
| Ignored `output/playwright/phase8c/` | Screenshots committed beside application components. |
| Existing historical report retained with an index link | Bulk renaming reports and breaking recovery references. |
| New ordered migration | Renaming old migration files to match a preferred style. |
