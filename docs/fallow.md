# Fallow

Fallow checks dead code, duplication, code health, and architecture boundaries.
The CLI, type-aware companion, and GitHub Action are pinned to **3.47.0** together
and updated by Renovate. Declare `fallow-type-aware` as a direct devDependency at exactly the
same version as `fallow`: the CLI does not install this optional companion, but
our complete type-aware gates require it. The Action provisions its own companion;
that does not satisfy local scripts or the separate full-gate job.
The strict gate established in [issue #264](https://github.com/samaluk/community/issues/264)
uses no baselines or regression allowances. The full gate blocks every remaining
clone group, and `--fail-on-issues` also blocks warning-severity findings. Intentional
duplication needs a documented, content-and-count-specific exception.

## Gates

| Surface | Command | Scope |
|---|---|---|
| pre-commit | `pnpm exec fallow audit --staged --quiet`, separate `pnpm fallow:staged:branch` and `pnpm fallow:health:staged` | Strict index-snapshot audit, branch-relative audit, and staged-hunk health check |
| pre-push / `hk check` | `pnpm test:coverage && pnpm fallow:ci` | Strict changed-code audit plus full repository analysis using fresh coverage |
| CI — `Test with coverage` | `pnpm test:coverage` | Unit suite; produces the shared coverage artifact |
| CI — `Fallow gate` | `pnpm fallow:ci` | Same covered gate as local checks |
| CI — `Fallow PR review` | Official Action, `audit`, `gate: new-only` | Sticky summary, Check Run, and inline feedback, independent of the full gate |

`hk` is the only hook manager. CI runs on pull requests; job names match the
required checks on `master`.

The native `audit --staged` command analyzes the index snapshot, not unstaged
working-tree content, and includes staged new files. `--quiet` keeps actionable
findings visible. The separate health script forces canonical `a/` and `b/` diff
headers and disables external diff drivers so Git preferences cannot silently
empty its staged-hunk scope.
The separate branch-relative audit retains the previous `--diff-stdin` check:
native `--staged` compares only with `HEAD` and can miss an unused dependency
whose manifest declaration was added in an earlier branch commit. The old
branch-relative check must remain mandatory alongside the native command.
Audit exempts test-file complexity even with `gate: all`; standalone health
with `--fail-on-issues` keeps those findings blocking, using the same thresholds
and exclusions. During pre-commit, `hk` stashes unstaged work before all staged checks.
Running the health script directly analyzes the current working tree scoped to
staged hunks; run it through `hk run pre-commit` for index-only isolation.

Fallow links workspace `node_modules` into audit snapshots, so pnpm's isolated
workspace dependencies resolve without publicly hoisting `vitest`. Complete
type-aware analysis remains required for both projects, including the real
`vitest/globals` types, alongside the unchanged real typecheck, branch audit,
and staged health gates. Verify both staged and branch snapshots when upgrading;
never disable type completeness or remove test globals to make the audit pass.

## Coding agents

Use the official [agent installer](https://fallow.tools/docs/integrations/agents/)
and [package-backed skill pointers](https://fallow.tools/docs/integrations/agent-skills/):

```bash
pnpm install --frozen-lockfile
pnpm exec fallow agent install --harness codex --harness claude --without hooks --without mcp --dry-run
pnpm exec fallow agent install --harness codex --harness claude --without hooks --without mcp
pnpm exec fallow agent status --format json --quiet
```

Commit the generated `AGENTS.md` task map, `CLAUDE.md` import, and the `fallow`
and `fallow-setup` pointers under `.agents/skills/` and `.claude/skills/`.
They read the version-matched instructions in `node_modules/fallow/skills/`
instead of vendoring copies. Install dependencies before running the installer
so it selects pointer form. The initial migration used `--force` to replace
the old unmanaged skill; ordinary refreshes do not need it.

Skip agent hooks because `hk` already owns the commit and push gates; do not
install a second hook manager or duplicate agent commit gate. Skip MCP changes
because the existing `.mcp.json` already runs the local `pnpm exec fallow-mcp`.
No shared configuration or another project's setup is required.

The required full-gate job checks `agent status`, independently of the coverage
producer and PR feedback job. Stale pointers block merging without preventing
tests or new-only review feedback from running. Status is informational,
so CI validates its JSON: all six committed guide/skill surfaces must be
`installed`, and no surface may be `stale`. Absent optional hooks/MCP surfaces
and the existing unmanaged MCP registration are intentional. After every
Fallow upgrade, rerun the installer and commit its refreshed pointers.

## Commands

```bash
pnpm test:coverage          # Generate coverage/coverage-final.json first
pnpm fallow:ci              # Alias of fallow:full, used by hooks and CI
pnpm fallow:full            # Changed-code audit, then combined full scan
pnpm fallow:staged          # Native index-snapshot audit; no coverage required
pnpm fallow:staged:branch   # Retained branch-relative staged audit
pnpm fallow:health:staged   # Separate strict health check of staged hunks
hk run pre-commit          # All staged gates, with unstaged changes stashed by hk
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
pnpm fallow config --resolved --for audit # Effective policy and its sources
pnpm fallow doctor
pnpm fallow type-aware status
pnpm fallow list --entry-points
pnpm fallow list --boundaries
pnpm fallow recommend
pnpm fallow recommend --root apps/web    # Inspect workspace-specific stack facts
pnpm fallow dead-code --namespace-escapes # Find namespace imports that hide unused exports
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
- Binary exceptions name only externally provisioned tools: `pg_dump` is the
  PostgreSQL client used when the baseline migration script cannot use Docker,
  and the globally installed, authenticated `vercel` CLI pulls environment
  files. Neither belongs in the application's npm dependencies. Keep the
  `unlisted-binaries` rule enabled for every other command.
- Vendored shadcn/Base UI primitive exports remain available. Reviewed clone
  exceptions cover upstream primitives, declarative detail-route wiring around
  the shared document component, and intentional stylesheet patterns. Their
  fingerprint and occurrence-count keys report changed content or counts again.
  The 13 count-locked `duplicates.ignoredClones` entries are the mechanism for
  accepting an intentional clone. Preserve their fingerprints and occurrence
  counts; never replace them with baseline files or a saved baseline.
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

Both analysis jobs install workspace dependencies through the existing toolchain
setup action. Installing the CLI and its companion alone does not provide the
project dependencies needed for framework plugins and type resolution; without
them the review can report `node-modules-missing` and misleading findings.
The review job also adds npm's resolved global `bin` directory to `GITHUB_PATH`
before the official Action installs its CLI. With the pnpm-managed runtime,
npm's global prefix is not necessarily on the runner's initial `PATH`.

The official Action posts the sticky summary and inline review comments using
`pull-requests: write` and `checks: write`. Keep `review-comments: true` and
`review-guidance: true`; use the Action's default token handling rather than a
`branded-token: false` override or a custom review-posting workaround. Verify
the Action's render/post-review steps and the resulting feedback on each
upgrade PR. A clean diff may have no inline findings to post.

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
   and a representative staged change through `fallow audit --staged --quiet`.
   Verify added lines reach the staged audit, an intentionally unused staged
   file fails, an over-threshold staged test/helper fails, and pre-commit checks
   the index with unstaged work stashed.
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
