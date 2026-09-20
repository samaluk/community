# Fallow

Fallow checks dead code, duplication, code health, and architecture boundaries.
The CLI and GitHub Action are pinned together at 3.27.0 and updated by Renovate.
The strict gate established in [issue #264](https://github.com/samaluk/community/issues/264)
uses no baselines or regression allowances. Existing advisory duplication findings
remain visible; a passing gate does not mean every advisory is absent.

## Gates

| Surface | Command | Scope |
|---|---|---|
| pre-commit | `pnpm fallow:staged` | Strict audit of staged hunks |
| pre-push / `hk check` | `pnpm test:coverage && pnpm fallow:ci` | Strict changed-code audit plus full repository analysis using fresh coverage |
| CI — `Test with coverage` | `pnpm test:coverage` | Unit suite; produces the shared coverage artifact |
| CI — `Fallow gate` | `pnpm fallow:ci` | Same covered gate as local checks |
| CI — `Fallow PR review` | Official Action, `audit`, `gate: new-only` | Sticky summary, Check Run, and inline feedback, independent of the full gate |

`hk` is the only hook manager. CI runs on pull requests; job names match the
required checks on `master`.

## Commands

```bash
pnpm test:coverage          # Generate coverage/coverage-final.json first
pnpm fallow:ci              # Alias of fallow:full, used by hooks and CI
pnpm fallow:full            # Changed-code audit, then combined full scan
pnpm fallow:staged          # Staged diff; audit.gate and typeAware come from config
pnpm fallow:dead-code       # Strict standalone dead-code analysis
pnpm fallow:dupes           # Standalone duplication analysis
pnpm fallow:health          # Standalone coverage-aware health analysis
```

The full gate uses Fallow's native combined command instead of running the
three whole-project analyses separately:

```bash
fallow audit --coverage coverage/coverage-final.json && fallow --coverage coverage/coverage-final.json --fail-on-issues
```

Keep the audit: its changed-code verdict also covers duplication and styling.
The combined command scans the whole repository, including untouched files.
Keep the default human output for this gate: in 3.27, combined JSON output does
not enforce the same issue exit codes. Use JSON for inspection, not as a drop-in
replacement for this command's blocking output.

Use the CLI directly for inspection and cleanup instead of adding script aliases:

```bash
pnpm fallow config
pnpm fallow type-aware status
pnpm fallow list --boundaries
pnpm fallow recommend
pnpm fallow security                     # Advisory candidates, requiring review
pnpm fallow suppressions
pnpm fallow fix --dry-run                # Review before applying
pnpm fallow fix --yes
```

## Configuration

[`.fallowrc.json`](../.fallowrc.json) keeps project-specific policy and exceptions:

- Type-aware analysis is enabled and required to be complete for
  `apps/web/tsconfig.json` and `apps/web/tsconfig.tests.json`. `tsc` still owns
  compiler correctness and Oxlint owns local typed lint rules.
- `audit.gate: all` blocks findings on changed code. The PR feedback job
  explicitly uses `new-only` and best-effort types; the full gate remains strict.
- Private type leaks, stale suppressions, and missing suppression reasons are
  errors. Coverage-gap findings remain advisory.
- Payload config and scripts invoked indirectly remain explicit entries.
  Generated Payload files and test/build artifacts are excluded; migrations
  are dynamically loaded.
- Vendored shadcn/Base UI primitive exports remain available. Reviewed clone
  exceptions retain their fingerprint and occurrence-count keys, so changed
  content or counts are reported again.
- Duplication uses semantic mode, near detection, and an 8-line/60-token floor.
- Ten repository-specific architecture zones enforce dependency direction and
  require every source file to belong to a zone, with explicit exemptions.

Fallow discovers pnpm workspaces and Next.js entries automatically. Defaults
already supply two-occurrence duplication detection, ignored import wiring,
framework-managed entry exports, and health thresholds of cyclomatic 20,
cognitive 15, CRAP 30, and unit size 60. These need no duplicated config.

## Coverage in CI

[The workflow](../.github/workflows/fallow.yml) uploads coverage once and exposes
the producing checkout's absolute path as a job output. The full gate passes
that path through `FALLOW_COVERAGE_ROOT`; the review Action uses `coverage-root`.
Fallow rebases Istanbul paths to the consuming checkout itself, so the artifact
needs no rewriting, including when jobs use different checkout directories.

Local commands need only `--coverage`: the report already refers to the current
checkout. Coverage stays explicit on covered gates so a missing report fails
instead of silently falling back to estimated CRAP scores. Staged audits do
not require a coverage file.
