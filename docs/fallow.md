# Fallow

Community Platform is in the Fallow ZERO-DEBT steady state (see
[issue #264](https://github.com/samaluk/community/issues/264), with
[fintual-api #405](https://github.com/samaluk/fintual-api/pull/405) as the
reference). The full repository scan reports zero findings, and every surface
— pre-commit, pre-push, `hk check`, and CI — blocks on any of them.

## Gates

| Surface | Command | Scope |
|---|---|---|
| pre-commit | `pnpm fallow:staged` | every finding on staged hunks (`audit --diff-stdin --gate all`) |
| pre-push | `pnpm test:coverage && pnpm fallow:ci` | FULL repository scan over fresh coverage |
| `hk check` | `pnpm test:coverage && pnpm fallow:ci` | manual deep check, same scope as pre-push |
| CI — [`.github/workflows/fallow.yml`](.github/workflows/fallow.yml) | `Test with coverage` produces one `coverage-fallow` artifact; gate and review consume it | blocking pull-request validation; no generic default-branch rerun |
| CI — review job | pinned `fallow-rs/fallow` Action at `gate: all` | PR feedback: sticky comment, Check Run, inline review comments |

The canonical scripts live in the root `package.json`:

```bash
pnpm fallow          # passthrough to the CLI
pnpm fallow:staged   # strict audit over the staged diff (pre-commit)
pnpm fallow:full     # audit --gate all + blocking dead-code, dupes, and health
pnpm fallow:ci       # canonical alias of fallow:full — what pre-push, hk check, and CI run
```

The canonical `fallow:full` composition is explicit and standalone:

```bash
fallow audit --gate all --type-aware --coverage coverage/coverage-final.json --coverage-root "$PWD" && pnpm fallow:dead-code && pnpm fallow:dupes && pnpm fallow:health
```

`fallow:dead-code`, `fallow:dupes`, and `fallow:health` each block independently;
the first is type-aware and the last is coverage-aware. Coverage coupling is
explicit: the audit and health gate pass `--coverage coverage/coverage-final.json`
and `--coverage-root "$PWD"`, and require the file to exist (run
`pnpm test:coverage` first). The shared config carries no coverage key, so only
covered runs provide the complete health verdict.

## Command reference

```bash
pnpm fallow:dead-code       # blocking type-aware unused files, exports, types, deps, leaks
pnpm fallow:dupes           # blocking semantic and near duplication gate
pnpm fallow:health          # blocking thresholds, CRAP, coverage-aware health gate
pnpm fallow:security        # unverified advisory candidates
pnpm fallow:suppressions    # suppression inventory
pnpm fallow:recommend       # stack/config recommendation
pnpm fallow:status          # type-aware companion status
pnpm fallow:boundaries      # zones and dependency rules
pnpm fallow:config          # resolved configuration
```

None uses a baseline or regression machinery.

## Analysis configuration

### Type-aware analysis

Type-aware analysis is enabled and required to be `complete` for:

- `apps/web/tsconfig.json` — application and production sources;
- `apps/web/tsconfig.tests.json` — Vitest and Playwright configuration/tests.

Fallow 3.20 reports TypeScript-Go protocol 7, zero abstentions, zero unresolved
queries, and zero warnings for these projects. This is Fallow-owned semantic
evidence; `tsc --noEmit` remains responsible for compiler correctness and
Oxlint remains responsible for typed lint rules.

`includeEntryExports` remains disabled: treating Next.js and tooling entry
exports as ordinary public API reports false positives for framework-managed
surfaces.

### Dead code and exceptions

The entry model covers App Router route files, `payload.config.ts`, and the
standalone script entries (`seed-e2e-fixtures.ts`,
`resolve-postgres-url.ts` — the latter invoked by
`seed-dev-from-production.sh` through tsx by path). Payload-generated
type/schema files and test/build artifacts are ignored because they are
generated surfaces, not application modules. Payload migrations are marked
`dynamicallyLoaded`.

The only broad export exception is the shadcn/Base UI primitive surface under
`apps/web/src/components/ui/*.tsx`: removing it produced a large set of
intentionally available primitive exports. Those files remain analyzed for
reachability; their internal repetition is handled by reviewed duplication
exceptions below rather than by refactoring them away from upstream.

Private type leaks, stale suppressions, missing suppression reasons, and
boundary violations are errors — and with zero debt, any finding blocks.

### Duplication

Semantic mode with near detection, an 8-line/60-token floor,
`minOccurrences: 2`, and import wiring ignored. Generated surfaces are
excluded via `duplicates.ignore` (migrations, Payload-generated admin routes).
Eleven clone groups are recorded in `ignoredClones` as reviewed exceptions —
vendored UI patterns and intentional CSS variants — each keyed
`<fingerprint>:<occurrence count>`, so any content or count change re-reports
the group.

### Coverage and health

`pnpm test:coverage` writes Istanbul-format `coverage/coverage-final.json`.
Health thresholds: cyclomatic 20, cognitive 15, CRAP 30, unit size 60 — a
function is flagged when it meets or exceeds them, and under covered gates
none does. The `coverage-gaps` rule remains advisory `warn`.

### Architecture boundaries

Ten repository-derived zones with ten dependency-direction rules and complete
boundary coverage (`fallow:boundaries`); the full boundary scan has zero
violations.

## Hooks and CI

`hk` remains the only hook manager.

- **Pre-commit** formats and lints staged web files, then runs typecheck,
  `fallow:staged`, unit tests, and the staged React Doctor scan.
- **Pre-push** checks the environment, typechecks, fetches origin/master,
  runs the changed-scope React Doctor gate, builds, generates fresh coverage,
  and runs the full scan via `fallow:ci` (depends on the fetch step).

CI splits quality jobs so a pull request goes green fast:

- **`Lint, typecheck & format`** (ci.yml) — static checks.
- **`Test with coverage`** (fallow.yml) — the unit suite, producing one
  `coverage-fallow` artifact.
- **`Fallow gate`** (fallow.yml) — consumes that artifact and runs the full
  scan, blocking.
- **`Fallow PR review`** (fallow.yml) — independently consumes the same
  artifact for native Fallow PR feedback, even when the gate fails.
- **`Build, integration, and E2E tests`** (ci.yml) — Playwright against
  PostGIS.

Each is its own required status check on the `master` branch ruleset. Generic
CI/Fallow/React Doctor validation is pull-request-only.
