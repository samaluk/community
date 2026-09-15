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
