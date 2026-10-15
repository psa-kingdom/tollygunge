# Phase 6–8 — Integration and premium application acceptance

Execution started 15 October 2026. **IN PROGRESS — NOT DEPLOYED.**

## Preserved starting points

- Redesign/Phase 5: `34b3a29b8aa98d7fda1b150d0c89274c1cb9d695`.
- Verified remote main: `6532f3a9d8a58ae462a9902fce95fe01bce4d8a4`.
- Preserved application: `ae7fadc954207e067778ea80933a6ac79dfbc407`.
- Recovery tags and verified complete bundle: `../phase6-preintegration-20261015.bundle` relative to the original app checkout. Phase 5 evidence remains in that checkout's ignored `.local/phase5` directory.
- Integration is isolated in `../phase6-integration`. Main and the audited redesign checkout remain untouched during acceptance.

## Design direction

Visual thesis: calm editorial navy/gold surfaces, intentional widths and readable operational density.
Content plan: retain published introductions, section anchors, existing workflows and final actions; arrange informational section titles alongside readable working content.
Interaction thesis: once-only 450ms section entrances, 180ms affordance/overlay feedback, immediate functional status; no new loops or automatic scrolling. Honor live reduced motion.
The homepage composition, hero artwork, book/atlas, assets and interactions are protected. The initial integration has no application-source differences from the audited baseline; main's invitation and payment-table keyboard safeguards are already present there.

## Integration checkpoint

VERIFIED: authoritative merge identified 24 conflicts. Each hunk was reconciled with a per-file rationale retained in `.local/phase6/conflict-resolutions.json`. Merge commit preserves both histories; the only resulting difference from the audited baseline is CI whitespace, pending cleanup. No blanket Git merge strategy or repository/file replacement was used.

## Evidence and open gates

Machine-readable results and original/retry logs are kept under `.local/phase6`, separate from previous phases. No historical result is counted as a current pass.
Initial build FAILED because a dependency junction pointed outside Turbopack's filesystem root. The junction was removed without touching its target, and dependencies installed locally from the unchanged lockfile. This is an isolated workspace setup failure, not a passing build.
Production artifact equivalence, hosted provider/storage/inbox/device and capacity evidence remain release gates. Production release, live migrations, settings changes, real messages and payment transactions are not authorized.
