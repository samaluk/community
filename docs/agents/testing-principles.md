# Testing principles

Adapted from Kent C. Dodds' testing principles in Kody:
https://github.com/kentcdodds/kody/blob/main/docs/contributing/testing-principles.md

These principles complement repository-specific test commands and suite guidance. Existing project constraints take precedence.

## Principles

- Choose the lightest test layer that can falsify the behavior. Escalate to integration, browser, or end-to-end tests only when the behavior genuinely depends on those boundaries.
- Prefer fewer, longer tests when multiple actions and assertions belong to one meaningful workflow.
- Treat a test like a manual tester's script: explicit setup, actions in realistic order, and all relevant assertions for that journey.
- Do not split one coherent flow into tiny tests merely to achieve one assertion per test. Multiple related assertions are desirable when they validate the same behavior.
- Keep test files flat where practical. Prefer top-level `test(...)`/`it(...)` over deep `describe` nesting.
- Avoid hidden shared setup. Prefer setup inside the test or explicit factory helpers over `beforeEach`/`afterEach` hooks that obscure what the test needs.
- Avoid shared mutable state between tests. If later assertions depend on the same rendered object, request, response, or state transition, they likely belong in the same test.
- Build helpers that return ready-to-use test objects or fixtures instead of exposing mutable globals.
- Keep test names behavior-focused and specific enough to explain the expected outcome.
- Test observable behavior and stable public contracts rather than implementation details.
- Prefer structured or user-visible outcomes over assertions that pin incidental prose, descriptions, warnings, or configuration strings.
- Do not write tests for guarantees already enforced by the type system unless runtime behavior adds something materially different.
- Keep tests deterministic and able to run offline where practical. Prefer local fakes, fixtures, and controlled dependencies over live public services.
- Keep the bar high for slow integration and end-to-end coverage. Reserve those layers for important cross-boundary behavior and critical happy-path journeys.
- Prefer asserting meaningful intermediate states inside the broader workflow that produces them rather than creating isolated tests for incidental loading or transition states.
- Add regression tests when the failure is plausible to recur or the affected workflow is important enough to justify ongoing maintenance.
- Use disposable resources only when there is real cleanup to perform; do not add lifecycle machinery without a cleanup need.
- Use async/await for asynchronous tests; avoid callback-style completion APIs when the framework supports promises.
- Never commit focused or disabled tests such as `.only` or `.skip` unless the repository explicitly documents an exception.

## Review heuristic

Before adding a test, ask:

1. What behavior could this test falsify?
2. Is there a lighter test layer that can prove the same thing honestly?
3. Does this assertion belong to an existing workflow test instead of a new isolated case?
4. Am I testing behavior, or merely pinning implementation detail or prose?
5. Will this test remain useful enough to justify its maintenance and runtime cost?

## Landmines lint gate

`pnpm lint:testing` runs five `landmines` rules as errors via
`.oxlintrc.testing.json`. Both `pnpm check:lint` (CI) and the staged hk lint
steps include this gate. It intentionally does not use `.oxlintignore`, whose
legacy exclusions hide tests from the core and Tailwind lint passes. The testing
pass leaves unrelated built-in rules disabled; it does not change test behavior.

Existing violations are grandfathered, not permission for new ones:

- Rules with an `allow` option use exact per-file counts in the testing config.
  Reduce or remove the allowance when fixing an existing violation; stale counts
  fail lint. The installed version also supports this for `no-unsignaled-poll`.
- `no-flake-masking` only counts timeout increases in its allowlist. The
  existing CI-only Playwright retry setting has a single-line directive to keep
  E2E behavior unchanged during the lint upgrade; remove it with the retries.
- `no-test-doubles` has no allowlist option. Its existing violations use narrow
  `oxlint-disable-next-line` directives with `TODO(landmines)` notes. Remove the
  directive when replacing the test double; do not extend it to new code.

The initial backlog is **85 violations in 11 files**: 84 `no-test-doubles`
violations in 10 files and one `no-flake-masking` violation in one file.
`strict-msw`, `no-fixed-sleep`, and `no-unsignaled-poll` start at zero.
`landmines/test-file-names` is deferred: the initial probe reports
102 violations, requiring a separate naming/layout migration. No style or type
plugins are registered.
