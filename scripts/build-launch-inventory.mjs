import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Source discovery and evidence bookkeeping only. This script never starts the app,
// loads environment files, contacts a provider, executes tests, or changes Git refs.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const inventoryPath = resolve(root, 'docs/engineering/TPA_LAUNCH_FEATURE_INVENTORY.json');
const registerPath = resolve(root, 'docs/engineering/TPA_LAUNCH_TEST_REGISTER.md');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const walk = (path) => readdirSync(resolve(root, path), { withFileTypes: true })
  .sort((a, b) => a.name.localeCompare(b.name, 'en'))
  .flatMap((entry) => entry.isDirectory() ? walk(`${path}/${entry.name}`) : [`${path}/${entry.name}`]);
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sourceSha = git('rev-parse', 'HEAD');
const branch = git('branch', '--show-current');
const handoff = read('docs/TPA_TESTING_HANDOFF.md');
const stableId = (kind, key) => `LR-${kind}-${createHash('sha256').update(key).digest('hex').slice(0, 10)}`;
const statuses = new Set(['PASS', 'FAIL', 'FIXED AND RETESTED', 'BLOCKED', 'NOT TESTED', 'DEFERRED']);
const previous = existsSync(inventoryPath) ? JSON.parse(readFileSync(inventoryPath, 'utf8')) : null;
const previousResults = new Map((previous?.features ?? []).map((feature) => [feature.id, feature.result]));
const resultFlag = process.argv.indexOf('--results');
if (process.argv.some((arg, index) => index > 1 && arg !== '--results' && index !== resultFlag + 1)) {
  throw new Error('Usage: node scripts/build-launch-inventory.mjs [--results path/to/results.json]');
}
const supplied = resultFlag >= 0 ? JSON.parse(readFileSync(resolve(root, process.argv[resultFlag + 1] ?? ''), 'utf8')) : [];
if (!Array.isArray(supplied)) throw new Error('Results input must be an array of per-feature results.');
const incoming = new Map();
for (const result of supplied) {
  if (!result.id || incoming.has(result.id)) throw new Error('Each supplied result needs a unique feature id.');
  incoming.set(result.id, result);
}
const features = [];
const cases = [];
let category = '';
for (const line of handoff.split(/\r?\n/)) {
  const heading = line.match(/^### ([A-R])\. (.+)$/);
  if (heading) category = `${heading[1]}. ${heading[2]}`;
  const qa = line.match(/^- \[ \] \*\*(QA-\d+) — (.+?)\*\* \((P\d); (.+)\)$/);
  if (qa) cases.push({ id: qa[1], title: qa[2], priority: qa[3], legacyEnvironment: qa[4], category });
}
const categoryCases = (letters) => cases.filter((test) => letters.includes(test.category[0])).map((test) => test.id);
function add(kind, key, title, expected, sources, letters, extra = {}) {
  const id = extra.id ?? stableId(kind, key);
  const defaultResult = { status: extra.planned ? 'DEFERRED' : 'NOT TESTED', summary: extra.planned ? extra.reason : 'Inventory established; behavioral execution not recorded for this feature.', evidence: [], environment: null, testedSha: null, limitation: extra.planned ? extra.reason : 'Source inspection is not runtime acceptance.' };
  const result = { ...defaultResult, ...previousResults.get(id), ...incoming.get(id) };
  delete result.id;
  if (!statuses.has(result.status)) throw new Error(`Invalid result status for ${id}`);
  if (!Array.isArray(result.evidence)) throw new Error(`Evidence must be an array for ${id}`);
  if (['PASS', 'FAIL', 'FIXED AND RETESTED'].includes(result.status) && (!result.evidence.length || !result.environment || !result.testedSha)) {
    throw new Error(`Executed result ${id} requires evidence, environment, and testedSha.`);
  }
  if (result.status === 'FIXED AND RETESTED' && !result.regressionEvidence) throw new Error(`Fixed result ${id} requires regressionEvidence.`);
  if (['BLOCKED', 'DEFERRED'].includes(result.status) && !result.limitation) throw new Error(`Disposition ${id} requires a limitation.`);
  features.push({ id, kind, key, title, expected, sources, qaIds: categoryCases(letters), journeyIds: extra.journeyIds ?? [], ...extra, result });
}

// Retain every written acceptance case; test IDs survive regeneration and sorting.
for (const item of cases) {
  const expression = new RegExp(`\\*\\*${item.id} —[^\\n]+\\n\\s*- Steps: ([^\\n]+)\\n\\s*- Expected: ([^\\n]+)`);
  const detail = handoff.match(expression);
  add('QA', item.id, item.title, detail?.[2]?.trim() ?? item.title, ['docs/TPA_TESTING_HANDOFF.md'], '', { ...item, steps: detail?.[1]?.trim() ?? '', qaIds: [item.id] });
}
for (const match of handoff.matchAll(/^### (E2E-\d+) — (.+)\r?\n([\s\S]*?)(?=^### |^## |$(?![\s\S]))/gm)) {
  const expected = match[3].match(/^- Expected: (.+)$/m)?.[1]?.trim() ?? match[2];
  add('JOURNEY', match[1], match[2], expected, ['docs/TPA_TESTING_HANDOFF.md'], '', { id: match[1], journeyIds: [match[1]], isolation: 'Run the complete journey in an isolated candidate environment with synthetic identities; production remains read-only.' });
}

function categories(path) {
  if (/newsletter/.test(path)) return 'BL';
  if (/auth|login|signup|password|invitation|email-verification|onboarding\/sign-in/.test(path)) return 'CGP';
  if (/event|attendance|registration|flyer/.test(path)) return 'HIJN';
  if (/payment/.test(path)) return 'IP';
  if (/verification|documents|application/.test(path)) return 'DP';
  if (/inquir|crm|inbox/.test(path)) return 'FL';
  if (/communications|email|campaign|deliveries|unsubscribe|resend/.test(path)) return 'KL';
  if (/member|onboarding|profile|account|portrait/.test(path)) return 'DEGN';
  if (/content|website|resources/.test(path)) return 'BM';
  if (/governance|people|media/.test(path)) return 'BN';
  if (/report|audit|search|attention/.test(path)) return 'O';
  if (/health|access/.test(path)) return 'PQ';
  return 'BR';
}
const appFiles = walk('src/app');
for (const file of appFiles.filter((path) => /\/(?:page|route)\.(?:ts|tsx)$/.test(path))) {
  const api = file.endsWith('/route.ts');
  const url = '/' + relative('src/app', dirname(file)).replaceAll('\\', '/').replace(/^\.$/, '');
  const code = read(file);
  const methods = [...new Set([...code.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map((m) => m[1]))];
  if (/export\s+const\s*\{\s*GET\s*,\s*POST\s*\}/.test(code)) methods.push('GET', 'POST');
  const actions = [...new Set([...code.matchAll(/(?:action\s*(?:===|!==)\s*|case\s+)["']([^"']+)["']/g)].map((m) => m[1]))].sort();
  add(api ? (url.startsWith('/api/') ? 'API' : 'RESOURCE') : 'PAGE', url, `${api ? 'Handler' : 'Page'} ${url}`, api ? 'Declared methods/actions obey validation, current authorization/ownership and state contracts; verify side effects only with isolated fixtures.' : 'Direct navigation and supported actions render correct published/authorized data with loading, empty, validation and failure states.', [file], categories(file), { route: url, methods: [...new Set(methods)].sort(), staticallyDetectedActions: actions, discoveryLimit: 'Literal extraction is partial; delegated services, conditional actions and runtime records require journey review.' });
}
const navigation = read('src/domain/staff-navigation.ts');
for (const name of [...new Set([...navigation.matchAll(/href\s*:\s*["']\/admin\/workspaces\/([^"']+)["']/g)].map((m) => m[1]))].sort()) {
  add('WORKSPACE', name, `Staff workspace: ${name}`, 'Workspace and every tab/dialog/control match the current server permission contract, including action-specific and combined-role checks.', ['src/domain/staff-navigation.ts', 'src/app/admin/workspaces/[workspace]/page.tsx'], categories(name), { route: `/admin/workspaces/${name}` });
}
for (const match of read('src/domain/site-pages.ts').matchAll(/^  ([a-z]+): \{/gm)) {
  add('PUBLIC', match[1], `Public page: ${match[1]}`, 'Published page and configured sections resolve through the dynamic public-page template without exposing drafts or private assets.', ['src/domain/site-pages.ts', 'src/app/[page]/page.tsx'], 'B', { route: `/${match[1]}` });
}
const business = [
  ['live-invitations-preservation', 'Production 202 invitation holds remain under administrator control', 'All 202 existing member invitation holds remain present and unreleased; validation does not queue/send/retry/revoke invitations, approve their template or change the administrator-controlled batch-release workflow.', 'GK', 'scripts/verify-launch-invitation-holds.mts;src/lib/invitation-release.ts;src/components/invitation-release-review.tsx;src/components/invitation-template-editor.tsx', 'E2E-02'],
  ['authentication', 'Authentication and complete session lifecycle', 'Synthetic administrator/member login, invalid credentials, logged-out guards, persistence/refresh, logout/revocation, invalid/expired sessions and account/hold states enforce the existing credential and redirect contract without bypasses.', 'CGP', 'src/app/login/page.tsx;src/lib/auth.ts;src/lib/auth-options.ts;src/lib/actor.ts;tests/identity.integration.ts;tests/onboarding-auth.integration.ts', 'E2E-01;E2E-02;E2E-11'],
  ['response-privacy', 'Private download and token response privacy headers', 'The effective HTTP Referrer-Policy is no-referrer for protected document/event resources and supported token-bearing verification/unsubscribe responses; global headers must not override the route-specific privacy contract.', 'KP', 'next.config.mjs;tests/private-download-headers.integration.ts', 'E2E-01;E2E-09;E2E-10'],
  ['safe-orchestration', 'Guarded test orchestration, accurate evidence and preservation', 'The launch entrypoint rejects hosted/non-QA database targets, blanks inherited dotenv/provider settings, retains per-run evidence, separates assertion counts from phase outcomes, and preserves original worktrees, private baseline payloads and prior artifacts.', 'AQ', 'scripts/launch-test-safety.mjs;scripts/verify-launch-readiness.mjs;tests/launch-test-safety.test.ts;docs/engineering/TPA_LAUNCH_DECISIONS.md', 'E2E-12'],
  ['payment-table', 'Readable and keyboard-scrollable registration payment table', 'Long member/event text at 320/390/768 widths in light/dark preserves readable Review payment actions, semantic table/region focus, actual keyboard horizontal scrolling, no page overflow, dismissed confirmation without writes and the empty state.', 'IR', 'src/components/registration-payments.tsx;src/app/globals.css;tests/helpers/payment-table-acceptance.ts', 'E2E-04'],
  ['branding', 'Approved branding, icons, header/footer and mobile navigation', 'Original supplied artwork remains intact; links, anchors, responsive navigation and focus work.', 'BR', 'src/components/site-shell.tsx;src/components/public-footer.tsx;src/components/tpa-logo.tsx', ''],
  ['appearance', 'Light/dark/system appearance and account controls', 'Supported mode persists and resolves correctly across public/member/staff surfaces.', 'R', 'src/components/account-controls.tsx;src/domain/appearance.ts', ''],
  ['identity-states', 'Independent identity, verification, membership and publication states', 'Account/email/profile/membership/payment/publication states never imply one another.', 'CDG', 'src/domain/member-foundation.ts;src/domain/verification.ts;src/lib/actor.ts', 'E2E-01;E2E-02'],
  ['roles', 'Six staff roles, member isolation and revoked privileges', 'Server authorization enforces role/action/owner checks, including stale sessions and exports.', 'P', 'src/domain/access.ts;src/lib/actor.ts;src/lib/operation-api.ts', 'E2E-11'],
  ['applications', 'Application drafts, addresses, private evidence and review', 'Draft/resubmit/versioned requirements/reviewer decisions preserve private documents and historical verification.', 'DE', 'src/components/application-draft.tsx;src/components/verification-workspace.tsx;src/lib/verification-service.ts', 'E2E-01'],
  ['directory', 'Member directory, person/membership/account links and search', 'Create/edit/filter/detail remain consistent; duplicates do not replace credentials or merge ambiguous people.', 'G', 'src/components/member-register.tsx;src/components/member-editor.tsx;src/lib/member-register.ts', 'E2E-02'],
  ['imports', 'Member imports, validation, duplicate handling and resumable jobs', 'Small valid/invalid/duplicate fixtures reconcile row counts; retries/replay preserve existing records and send no mail implicitly.', 'GQ', 'src/lib/member-import-jobs.ts;src/domain/member-import-job.ts;src/components/bulk-onboarding.tsx', 'E2E-02;E2E-12'],
  ['invitation-release', 'Held account provisioning and controlled invitation release', 'Template approval and exact-recipient review precede authorized release; stale reviews fail; activation links remain single-use.', 'CGKL', 'src/lib/invitation-release.ts;src/lib/account-provisioning.ts;src/components/invitation-release-review.tsx', 'E2E-02'],
  ['events', 'Event draft/publication/edit/cancellation and booking', 'Visibility, dates, fees, capacity races, ownership and booking versions obey existing event contracts.', 'H', 'src/components/event-manager.tsx;src/domain/event-flow.ts', 'E2E-03;E2E-04;E2E-05'],
  ['payment-instructions', 'Manual bank/UPI instructions and QR assets', 'Active purpose/amount/payee instructions are readable and authorized; historical bookings retain their applicable account/QR revision.', 'I', 'src/components/payment-details.tsx;src/lib/event-payment-access.ts', 'E2E-04'],
  ['payment-state', 'Payment references, manual verification and full-refund history', 'Member reference never marks paid; only authorized review changes payment state; recording a refund never transfers funds.', 'I', 'src/components/registration-payments.tsx;src/domain/event-operations.ts', 'E2E-04;E2E-05'],
  ['financials', 'Event financials, expense edits/voids and private receipts', 'Integer-paise totals reconcile authoritative history, protect finance data and retain versioned audit evidence.', 'IJ', 'src/lib/event-operations.ts;src/components/event-operations-panel.tsx', 'E2E-04;E2E-05'],
  ['attendance', 'Attendance reconciliation, finalization and completion lifecycle', 'Registration/payment/attendance remain distinct; corrections conflict safely; completion freezes writes; reopening requires combined permissions and reason.', 'J', 'src/lib/event-operations.ts;src/domain/event-operations.ts', 'E2E-03;E2E-10'],
  ['entitlements', 'Member history, badges, eligible resources and manual perks', 'Member A/B isolation and current eligibility govern bytes/links/badges/perks, including revoke, cancellation, archive and unpublished states.', 'EJN', 'src/lib/event-engagement.ts;src/components/member-event-journey.tsx', 'E2E-10'],
  ['reminders', 'Durable event reminders and eligibility rechecks', 'Changed schedule/booking/payment/cancellation invalidates obsolete jobs; retry/restart does not duplicate delivery.', 'JK', 'src/lib/event-reminders.ts;src/lib/email-worker.ts', 'E2E-06'],
  ['promotions', 'Reviewed event promotions and announcements', 'Approved recipients/event/settings version, consent, expiry and idempotency are checked before any synthetic send.', 'JKL', 'src/lib/event-promotion.ts;src/components/event-engagement-panel.tsx', 'E2E-07'],
  ['crm', 'Inquiry receipt, ownership, assignment, follow-up and closure', 'Public/member submission and staff follow-up retain correct ownership, history and report state.', 'F', 'src/components/crm-workspace.tsx;src/domain/inquiries.ts', 'E2E-08'],
  ['mail', 'Transactional email, delivery queue, signed events and suppression', 'Queue/provider/delivery/inbox outcomes remain distinct; retry, wrong recipient, signed webhook and suppression checks use mocks/sinks.', 'K', 'src/lib/email-worker.ts;src/lib/email-events.ts;src/lib/email-service.ts', 'E2E-01;E2E-02;E2E-12'],
  ['communications', 'Campaigns, templates, shared inbox/replies and delivery logs', 'Audience review/consent/unsubscribe, stale versions and idempotent dispatch protect recipients; attachments retain current metadata-only boundary.', 'L', 'src/components/communications-workspace.tsx;src/components/campaign-workspace.tsx;src/components/email-inbox.tsx', 'E2E-07;E2E-08'],
  ['newsletter', 'Public newsletter subscribe/confirm/unsubscribe', 'Double opt-in and token/duplicate/error cases preserve consent without account creation or unauthorized sends.', 'BL', 'src/lib/public-newsletter.ts;src/domain/newsletter.ts', 'E2E-07'],
  ['cms', 'CMS rich editing, preview, publication and withdrawal', 'Saved publication snapshots, stale conflicts, sanitized rich text and draft privacy hold across editor/preview/public views.', 'M', 'src/components/content-editor.tsx;src/components/content-preview.tsx;src/lib/website-content.ts', 'E2E-09'],
  ['website', 'Website settings, shared resources and public downloads', 'Approved copy/branding/footer/resource settings preview and publish consistently; bytes and eligibility are checked at access.', 'M', 'src/components/website-control.tsx;src/domain/website-settings.ts', 'E2E-09'],
  ['people-media', 'People/committee review, portraits and media publication', 'Public projections require eligible publication; private application evidence never enters the public gallery.', 'N', 'src/components/governance-workspace.tsx;src/components/media-workspace.tsx;src/lib/public-people.ts', 'E2E-09'],
  ['flyers', 'Flyer variants, PNG/PDF exports and decoded QR destinations', 'Published/draft/member-only export access, rendering and QR destination match the selected event.', 'N', 'src/components/flyer-builder.tsx;src/lib/flyer-canvas.ts', 'E2E-03'],
  ['reports', 'Permission-scoped reports, presets, CSV/XLSX exports and audit', 'Current account/event/inquiry/content/newsletter totals, date filters and exported rows reconcile; formula injection and stale/revoked access are rejected.', 'O', 'src/components/operations-reports.tsx;src/domain/reports.ts;src/lib/report-query.ts', 'E2E-11'],
  ['storage', 'Private object storage, uploads and direct download authorization', 'Owned/reviewer/public/entitled access returns intended bytes and rejects guessed IDs; failure compensation leaves no unrelated deletion.', 'NPQ', 'src/lib/private-storage.ts;src/domain/storage-configuration.ts;src/domain/upload-workflow.ts', 'E2E-09;E2E-10;E2E-12'],
  ['database', 'Migrations, transactions, constrained runtime roles and recovery', 'Ordered checksums/schema compatibility, rollback/replay and isolated restore reconcile without editing applied migrations or production data.', 'PQ', 'scripts/migrate.mjs;src/lib/database.ts;src/lib/database-options.ts', 'E2E-12'],
  ['accessibility', 'Responsive, keyboard, zoom and loading/empty/error states', '320/390/768/1440 widths, supported modes and 200% zoom retain usable navigation, forms, tables/dialogs and recovery.', 'R', 'src/domain/fallbacks.ts;src/components/fallback-screen.tsx', ''],
  ['deployment', 'Candidate identity, CI/build/worker/container and hosted health', 'Exact source/build/deployment identities and actual results are separated across local, preview, production read-only and human acceptance.', 'AQ', '.github/workflows/ci.yml;Dockerfile;scripts/start-runtime.mjs;scripts/verify-release.mjs', ''],
];
for (const [key, title, expected, letters, files, journeys] of business) {
  const sources = files.split(';').filter((path) => existsSync(resolve(root, path)));
  add('FEATURE', key, title, expected, sources, letters, {
    journeyIds: journeys ? journeys.split(';') : [],
    ...(key === 'response-privacy' ? { baselineFinding: 'Coordinator-confirmed root cause: the Next.js catch-all Referrer-Policy overrode handler-level private/token response policy. Candidate adds scoped header overrides; attach executed regression evidence before marking fixed.' } : {}),
    ...(key === 'payment-table' ? { baselineFinding: 'Reproduced defect: at 320px/light with long member/event text, Review payment action collapsed to 44.609375px. Original screenshot and failing regression are retained. Candidate selectively ports table class/min-width/nowrap with existing scrolling; rebuilt targeted regression is required before marking fixed.' } : {}),
  });
}
for (const file of walk('scripts').filter((path) => /(?:worker\.(?:mts|mjs)|start-runtime\.mjs|build-worker\.mjs)$/.test(path))) {
  add('WORKER', file, `Runtime: ${file}`, 'Build/start/supervision, configured enablement, least privilege, heartbeat, restart and durable work recovery match existing contracts; no live effects during tests.', [file], 'KQ', { gates: [...new Set([...read(file).matchAll(/process\.env\.([A-Z][A-Z_]+)/g)].map((m) => m[1]))].sort() });
}
const planned = [
  ['historical-import-commit', 'Historical attendance import commit', 'Preview is implemented; commit deliberately returns 409 until mapping/provenance/learning rules are approved.', 'src/app/api/staff/imports/route.ts'],
  ['gateway', 'Razorpay/live online checkout', 'Outside launch scope; retain existing inactive placeholders only, no checkout or payment credentials.', 'docs/EVENT_OPERATIONS_UPGRADE.md'],
  ['membership-policy', 'Membership fees, eligibility, renewal, numbering and approval policy', 'Record handling exists; new financial/renewal/numbering business rules require authoritative association decisions.', 'docs/DELIVERY_CHECKLIST.md'],
  ['learning-awards', 'Learning hours and automatic certificates', 'Approved award policy is absent from the supported event operations contract; protected uploaded certificate files remain supported.', 'docs/EVENT_OPERATIONS_UPGRADE.md'],
  ['whatsapp', 'Official WhatsApp delivery', 'Provider and policy gate remains distinct from implemented email/inbox functionality.', 'docs/DELIVERY_CHECKLIST.md'],
  ['google', 'Google OAuth live enablement', 'Google control exists; live configuration/identity acceptance requires verified client setup. Mocked flows do not prove provider acceptance.', 'docs/GOOGLE_SIGN_IN_SETUP.md'],
  ['news', 'Automated attributed news collection', 'Source preparation exists; approval alone does not enable scheduled collection; feeds/schedule require approval.', 'docs/DELIVERY_CHECKLIST.md'],
  ['themes', 'Additional visual themes', 'Existing Themes control is disabled and labelled Coming later; supported light/dark/system modes remain in regression scope.', 'src/components/account-controls.tsx'],
  ['speaker-library', 'Reusable speaker profiles, portraits and biographies', 'Event snapshots already support speaker details; reusable speaker library is expressly deferred.', 'docs/EVENT_ENGAGEMENT_ACCEPTANCE.md'],
  ['health-dashboard', 'Admin diagnostic dashboard', 'Optional future work; deliver CI-generated engineering health evidence first, without exposing internal secrets or executable controls.', 'docs/engineering/TPA_LAUNCH_TEST_PLAN.md'],
  ['accounting', 'Partial refunds, tax engine and double-entry accounting', 'Outside existing event upgrade; retain manual full-refund history and recorded expenses.', 'docs/EVENT_OPERATIONS_UPGRADE.md'],
  ['layout-collaboration', 'Page-layout builder, collaboration and DOCX content import', 'Separate future product scope; preserve current approved design/editor publication contracts.', 'docs/CONTENT_EDITOR.md'],
];
for (const [key, title, reason, source] of planned) add('PLANNED', key, title, reason, [source], '', { planned: true, reason });

const known = new Set(features.map((feature) => feature.id));
if (known.size !== features.length) throw new Error('Duplicate inventory IDs.');
for (const id of incoming.keys()) if (!known.has(id)) throw new Error(`Unknown result id ${id}; no files written.`);
const totals = Object.fromEntries([...statuses].map((status) => [status, features.filter((feature) => feature.result.status === status).length]));
const counts = Object.fromEntries([...new Set(features.map((feature) => feature.kind))].map((kind) => [kind, features.filter((feature) => feature.kind === kind).length]));
const inventory = { schemaVersion: 1, generatedAt: new Date().toISOString(), branch, sourceSha, sourceWorkingTree: 'Inventory describes current files; a HEAD SHA does not imply a clean tree or tested build.', resultPolicy: 'QA mappings identify candidate acceptance cases, not executed coverage. Each result records its own testedSha, environment, evidence and limitation. Broad suite success never automatically promotes mapped features.', discoveryLimits: ['File discovery is exhaustive for current page/route modules and listed worker entrypoints; dynamic runtime records are not enumerated.', 'HTTP method/action extraction is static and partial; trace delegated services, tabs, dialogs and error paths.', 'Handoff contains written QA cases only; companion workbook includes additional route/UX cases and remains untouched.', 'Planned/deferred items record boundaries, not newly implemented capabilities.'], counts, totals, features };
const escape = (value) => String(value ?? '').replaceAll('|', '&#124;').replaceAll('\r', '').replaceAll('\n', '<br>');
const links = (paths) => paths.map((path) => /^https?:\/\//.test(path) ? `[evidence](${path})` : `[${path}](${relative(dirname(registerPath), resolve(root, path)).replaceAll('\\', '/')})`).join('; ');
const rows = features.map((feature) => {
  const result = feature.result;
  return `| **${escape(feature.id)} — ${escape(feature.title)}**<br>${escape(feature.expected)}${feature.qaIds.length ? `<br>QA mapping: ${escape(feature.qaIds.join(', '))}` : ''}${feature.journeyIds.length ? `<br>Journeys: ${escape(feature.journeyIds.join(', '))}` : ''} | VERIFIED source inventory: ${links(feature.sources)}.${feature.methods?.length ? `<br>Declared methods: ${escape(feature.methods.join(', '))}.` : ''}${feature.staticallyDetectedActions?.length ? `<br>Literal actions (partial): ${escape(feature.staticallyDetectedActions.join(', '))}.` : ''}<br>${feature.baselineFinding ? escape(feature.baselineFinding) : 'Behavior before execution: UNKNOWN; no failure is inferred from source discovery.'} | **${escape(result.status)}** — ${escape(result.summary)}<br>Evidence: ${result.evidence.length ? links(result.evidence) : 'none recorded'}${result.regressionEvidence ? `<br>Regression: ${links([result.regressionEvidence])}` : ''}<br>Environment: ${escape(result.environment ?? 'not executed')}; tested SHA: ${escape(result.testedSha ?? 'not recorded')}.<br>Limitation: ${escape(result.limitation ?? 'none recorded')} |`;
});
const markdown = `# TPA launch test register\n\nGenerated by \`node scripts/build-launch-inventory.mjs\` from the machine inventory and retained per-feature results. Source HEAD: \`${sourceSha}\`; branch: \`${branch}\`. HEAD identifies the base, not acceptance of uncommitted changes.\n\nExactly three columns; test IDs, outcomes, evidence and limitations stay inside cells. Initial inventory entries are NOT TESTED; deferred capabilities are explicit. VERIFIED here means source discovery only until a behavioral result is attached. The reported live login failure was diagnosed as Invalid password; the user completed recovery and authenticated browser traversal. See the authentication row and health report for scope and evidence.\n\nCounts: ${Object.entries(counts).map(([key, value]) => `${key} ${value}`).join('; ')}. Outcomes: ${Object.entries(totals).map(([key, value]) => `${key} ${value}`).join('; ')}. These are inventory dispositions, not a passing percentage or assertion count.\n\n| What was expected | What was there | What we did, now |\n|---|---|---|\n${rows.join('\n')}\n`;
writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
writeFileSync(registerPath, markdown);
console.log(JSON.stringify({ branch, sourceSha, counts, totals, output: ['docs/engineering/TPA_LAUNCH_FEATURE_INVENTORY.json', 'docs/engineering/TPA_LAUNCH_TEST_REGISTER.md'] }));
