# Fallow

Fallow checks dead code, duplication, code health, and architecture boundaries.
The CLI and GitHub Action are pinned together and updated by Renovate.
The strict gate established in [issue #264](https://github.com/samaluk/community/issues/264)
uses no baselines or regression allowances. The full gate blocks every remaining
clone group, and `--fail-on-issues` also blocks warning-severity findings. Intentional
duplication needs a documented, content-and-count-specific exception.

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

The staged script forces canonical `a/` and `b/` diff headers and disables
external diff drivers so Git preferences cannot silently empty Fallow's line
scope. During pre-commit, `hk` stashes unstaged work before the audit. Running
the script directly analyzes the current working tree scoped to staged hunks.

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
Keep the default human output for this gate: it prints the failure summary that
names the blocking findings. Use JSON for inspection, not as a drop-in
replacement for this command's blocking output.

Use the CLI directly for inspection and cleanup instead of adding script aliases:

```bash
pnpm fallow config
pnpm fallow doctor
pnpm fallow type-aware status
pnpm fallow list --entry-points
pnpm fallow list --boundaries
pnpm fallow recommend
pnpm fallow recommend --root apps/web    # Inspect workspace-specific stack facts
pnpm fallow architecture                 # Cycles, boundaries, and policy violations
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
  errors. Coverage gaps use warning severity for exploratory analysis; the
  strict full gate treats any reported warning as blocking too.
- Payload config and scripts invoked indirectly remain explicit entries.
  Generated Payload files and build/test output are excluded; migrations
  are dynamically loaded. E2E source stays in the graph so its helper imports
  and framework integrations count as used.
- E2E assertion workflows have a documented local CRAP exemption because unit
  coverage does not instrument Playwright. Cyclomatic and cognitive checks
  still apply. Production code and E2E helpers retain normal health thresholds.
- Dependency exceptions cover the interactive shadcn CLI and plugins loaded
  by the secondary Oxlint config. Stylesheet imports and Playwright imports
  provide native evidence for their dependencies without exceptions.
- Vendored shadcn/Base UI primitive exports remain available. Reviewed clone
  exceptions cover upstream primitives, declarative detail-route wiring around
  the shared document component, and intentional stylesheet patterns. Their
  fingerprint and occurrence-count keys report changed content or counts again.
- Duplication uses semantic mode, near detection, and an 8-line/60-token floor.
- Ten repository-specific architecture zones enforce dependency direction and
  require every source file to belong to a zone, with explicit exemptions.
  Tests may import scripts for environment loading and fixture setup.

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

## Reviewing Renovate updates

Every Fallow update is an opportunity to improve the setup and the codebase.
The reviewing agent should use the installed and proposed dependency pins to
identify the upgrade range, without adding release-specific claims to this guide.

1. Read the [upstream changelog](https://github.com/fallow-rs/fallow/blob/main/CHANGELOG.md)
   for every intervening release and consult the current
   [adoption](https://fallow.tools/docs/adoption/),
   [configuration](https://fallow.tools/docs/configuration/overview/), and
   [CI integration](https://fallow.tools/docs/integrations/ci/) docs. Resolve
   commands and flags from the candidate CLI's `--help`, `schema`, and
   `config-schema`; docs on the default branch can describe newer behavior.
2. Keep the npm dependency, lockfile, semantic companion, and digest-pinned
   GitHub Action aligned. Install with the frozen lockfile and run `doctor`,
   `config`, `type-aware status`, and `list --entry-points` / `list --plugins`.
   Run `recommend` at the root and in the web workspace. Check detected facts
   against the repository: its proposals can assume generic entry conventions
   that do not fit a routed Next.js app. Preserve project-specific policy.
3. Evaluate new rules, framework detection, type-aware evidence, architecture
   analysis, duplication handling, coverage support, CI feedback, and agent
   integration for concrete benefits here. Adopt supported improvements and
   remove workarounds that native detection now replaces. Trial optional
   heuristics before making them policy. Keep `hk` responsible for Git hooks;
   inspect agent-install plans before introducing another gate. Keep telemetry
   and continuous/cloud monitoring opt-in.
4. Reproduce gate failures with the candidate CLI and inspect structured output
   (`--format json --quiet --explain`, including `kind` and `gate_outcomes`).
   Trace imports, exports, and dependencies before removing code. Fix genuine
   findings; repair missing framework/config discovery for false positives.
   If clone fingerprints change, review every affected group and its locations
   before replacing an exception. Never copy replacement keys blindly, add a
   blanket source exclusion, raise thresholds, or baseline findings just to
   make the update pass. Keep complete type-aware analysis mandatory.
5. Generate fresh coverage and run `pnpm fallow:ci`, the standalone analyses,
   and a representative staged diff through `fallow audit --diff-stdin`.
   Verify added lines reach the staged audit, an intentionally unused staged
   file fails, and pre-commit audits the index with unstaged work stashed.
   The covered full gate must use the current checkout. Exercise cross-checkout
   coverage rebasing and the Action's
   changed-code audit options when those integrations change. Run lint,
   typecheck, formatting, and tests appropriate to any resulting code changes.
   Missing coverage or an invalid setup must fail; remaining findings must
   retain their intended blocking behavior.
6. Record what was adopted, which workarounds were removed, validation evidence,
   and why relevant new capabilities were left unused in the PR review. Update
   this guide and configuration comments when policy or workflows change,
   keeping guidance applicable to the next upgrade.
