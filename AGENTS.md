# AGENTS.md

## Next.js agent rules

The version-matched Next.js agent-rules block lives in `apps/web/AGENTS.md`,
next to the `next` package it references (`node_modules/next/dist/docs/` does not
resolve from the repo root in this monorepo). `next dev` writes and refreshes
that block, so run `pnpm dev` once after a Next.js upgrade to update it. Read
`apps/web/AGENTS.md` before writing code in `apps/web`.

## Agent skills

### Testing

For testing changes, follow `docs/agents/testing-principles.md` in addition to repository-specific commands and framework guidance.

### Issue tracker

Issues and PRDs for this repo live as GitHub issues; use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default canonical triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context layout with root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.

### Linting

After making UI changes, run `pnpm check:lint` and fix all errors. Design-system
contracts live in `.oxlintrc.tailwind.json` (`shadcn/*` rules).

### Fallow

Follow [docs/fallow.md](docs/fallow.md) for code-health gates and upgrade reviews.
For every Fallow Renovate PR, read the intervening upstream changelog and current
docs, evaluate new capabilities that would benefit this repository, and adopt
supported improvements to configuration, analysis, and agent workflows. Verify
the staged audit, coverage-backed full gate, and PR feedback setup; a dependency
bump and passing checks alone are not a complete upgrade review.

Repository policy takes precedence over the generated defaults below: `hk`
owns Git hooks, so agent installation skips hooks. `.fallowrc.json` already sets
`audit.gate: all`; only the separate PR review Action uses `new-only`. Runtime
errors must fail verification, never count as a successful audit.

---

<!-- fallow:setup-hooks:start -->
## Fallow checks

Use fallow for code-quality, cleanup, and setup tasks in this repository. Fallow checks the changed code before each `git commit` and `git push`. In Claude Code and Codex, a PreToolUse hook from `fallow agent install` runs this check and blocks the command when the verdict is `fail`. Other agents run the check themselves: `fallow audit --format json --quiet --explain --gate-marker agent`. If the verdict is `fail`, fix the reported findings before you try again. A JSON runtime error such as `{ "error": true, ... }` does not block.

Audit defaults to `gate=new-only`: only findings introduced by the current changeset affect the verdict. Inherited findings on touched files are reported under `attribution` and annotated with `introduced: false`, but do not block the commit. Set `[audit] gate = "all"` in `fallow.toml` to gate every finding in changed files.

For non-skill agents, treat the task map below as the local onboarding source: run the listed fallow command before destructive edits, before commits, and before pull request handoff.

## Fallow task map

| When the agent is about to... | Run |
|---|---|
| delete an "unused" export or file | `fallow dead-code --trace <file>:<export>` |
| prove a TypeScript symbol's exact consumers before refactoring | `fallow dead-code --type-aware --symbol-impact <file>:<export-or-class.method>` |
| find how one module reaches another | `fallow trace --path <from> <to>` (Reports `reachable: false` instead of failing when no import path exists; type-only hops are reported, not skipped.) |
| delete an "unused" dependency | `fallow dead-code --trace-dependency <name>` |
| migrate a dependency | `fallow trace --dependency <name> --sites` (Counts each imported name, follows one hop through project wrappers, and counts each use that it cannot resolve.) |
| commit or open a PR | `fallow audit --base <ref>` |
| read a diff before approving it | `fallow review --base <ref> --brief` (orientation, never gates: deterministic and always exit 0, unlike the audit row) |
| prioritize refactoring | `fallow health --hotspots --targets` |
| ask who owns code | `fallow health --ownership` |
| check untested-but-reachable code | `fallow health --coverage-gaps` |
| improve or check the tests of a change | `fallow mutation --plan --base <ref>` (The plan runs no code. Without `--plan`, the command runs the project tests against each mutant, so ask the user first.) |
| consolidate duplication | `fallow dupes --trace dup:<fingerprint>` |
| find feature flags | `fallow flags` |
| check which architecture rules apply to a file before changing it | `fallow guard <files>` |
| check import cycles, boundaries and policy rules after changing code | `fallow architecture` |
| surface security candidates | `fallow security` |
| understand a finding | `fallow explain <issue-type>` |
| scope a monorepo | `--workspace <glob> / --changed-workspaces <ref>` (global flags, prefix any command) |
<!-- fallow:setup-hooks:end -->
