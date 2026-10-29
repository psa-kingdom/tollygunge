# TPA cleanup review — awaiting exact-path approval

29 October 2026. **No source folder has been deleted or moved.** The private
archive and restoration are copies. Removing the originals is a separate action
requiring approval of the complete list below.

## Verified preservation

- Archive: `D:/Downloads/TPA-private-archive/20261029`.
- **1,37,985 files / 17,76,09,97,880 bytes** preserved and restored
  into a separate directory, with every restored file matching its SHA-256.
- **18,113 directories** retained, including empty directories.
- 15 original valid checkout HEAD/index/dirty states verified after archival
  metadata repairs; 7 pre-existing stale worktree links reconstructed from preserved
  original HEADs, indexes and Git objects. Their original raw links remain in the
  unmodified restoration. 2 bare history repositories separately bundled and checked.
- 21 distinct historical commits absent from the canonical checkout's current
  refs remain preserved; detailed inventories stay private with the archive.
- Canonical all-refs bundle verified, cloned into independent storage and checked
  with `git fsck --full`. SHA-256:
  `80526106cf929cda1395eb71b2c0395058fa4c38d0aa097757f46e6033f78fbc`.
- 650 reproducible cache directories excluded; 8 cache symlinks/junctions
  recorded without following their targets. No meaningful source, configuration,
  production backup, supplied asset or evidence file was discarded.
- Archive root access is restricted to the current Windows account and SYSTEM;
  copied private provider material and source-file samples inherit that policy.
  Credentials, real database backups and raw manifests stay outside Git.

Evidence: private `archive-results.json`, `source-manifest.json`,
`directory-manifest.json` and `git-restoration-results.json` in the archive.
Earlier failures are retained: stale original Git links and Windows' refusal to
truncate a hidden `.git` file with the default write mode. The correction uses
an existing-file handle inside the archive; the full restored file hash check
was repeated successfully before the final Git verification.

## Exact proposed retirement list

Only these **10 paths** are candidates. Counts exclude reproducible caches.

| Original path | Preserved files | Preserved bytes |
| --- | ---: | ---: |
| `D:/Downloads/Workspace/TPA Test` | 0 | 0 |
| `D:/Downloads/Workspace/TPA-recovery` | 1,22,729 | 16,68,88,24,422 |
| `D:/Downloads/Workspace/TPA-redesign-recovery-20261014` | 7 | 87,65,257 |
| `D:/Downloads/Workspace/tpa-reference-20261014` | 27 | 12,69,056 |
| `D:/Downloads/Workspace/TPA/.launch-recovery` | 126 | 1,74,81,649 |
| `D:/Downloads/Workspace/TPA/design-lab` | 14,402 | 1,03,15,14,319 |
| `D:/Downloads/Workspace/TPA/email-runtime-acceptance` | 3 | 2,74,652 |
| `D:/Downloads/Workspace/TPA/launch-readiness` | 632 | 95,34,215 |
| `D:/Downloads/Workspace/TPA/phase6-integration` | 0 | 0 |
| `D:/Downloads/Workspace/TPA/preview-evidence` | 59 | 33,34,310 |

Retain `D:/Downloads/Workspace/TPA/app`, the enclosing `TPA` directory,
current supplied/client materials and root branding/documents. Every other
project, including `Crazy_Hands`, remains untouched. The private archive and
its restoration rehearsal are retained.

## Execution conditions after approval

1. Recheck source hashes and Git HEAD/ref/dirty states immediately before removal.
   Stop on any change since preservation; preserve the new work before continuing.
2. Resolve every approved path and verify it is exactly on this allowlist, inside
   the intended Workspace location, and never the canonical checkout or an
   ancestor of it. Operate with native PowerShell literal paths. Remove cache
   links themselves without traversing their targets.
3. The local QA PostgreSQL executable currently comes from the old recovery
   folder. Stop only the owned preview/QA cluster using its recorded data path,
   then restart it from the verified private archive's matching vendor binaries.
   Its data stays under the canonical checkout's ignored local directory. No
   production database is involved.
4. Retire the clean linked `launch-readiness` checkout through Git's worktree
   operation. Preserve its branch/history; do not use a forced removal to conceal
   dirty state. Remove the other approved original copies only after these checks.
5. Verify the remaining worktree list, canonical feature branch/main identities,
   Crazy Hands' unchanged status, retained materials, and local demo health.
   Record the actual completed removals separately from this proposal.

This approval does not authorize deleting remote branches, modifying main,
merging the review branch, deploying, publishing, sending messages or spending.
