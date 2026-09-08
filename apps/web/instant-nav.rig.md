# Instant navigation test workflow

The navigation, ISR, and offline tests run against a production build. Development
prefetch behavior does not establish that a production navigation is instant.

## Local run

Use a disposable local database. The fixture seed creates or overwrites published
content at fixed slugs, and the CMS tests create and remove their own records.
`POSTGRES_URL` must point to that database, and `TEST_POSTGRES_URL` must point to a
separate database for the integration suite. Never use production database URLs.

From `apps/web`, after configuring `.env.local` or exporting the test variables:

```sh
# On a fresh database only, apply the schema before seeding.
pnpm migrate
pnpm exec tsx scripts/seed-e2e-fixtures.ts
# Build and run the normal production E2Es without Next's testing API. This
# keeps ISR and ordinary prefetch behavior representative of production.
pnpm build:next
pnpm test:e2e
# Rebuild for the isolated instant-navigation project. The testing API changes
# Next's background ISR path, so it must not share the normal build.
EXPOSE_TESTING_API=1 pnpm build:next
EXPOSE_TESTING_API=1 pnpm test:e2e:instant
```

Playwright starts `pnpm start` locally and in CI. It uses
`NEXT_PUBLIC_SERVER_URL`, defaulting to `http://localhost:3000`. For a different
port, set both `PORT` and `NEXT_PUBLIC_SERVER_URL` for the server and tests. Local
runs can reuse an already running production server at that URL. CI starts its
own server and refuses to reuse one.

`EXPOSE_TESTING_API=1` enables the Next.js testing API in the isolated instant
navigation build. Keep it set for the test command so the server starts with the
same configuration. Never enable it for a deployment serving real users. Seed
before each build only when the database is fresh; the normal and instant builds
reuse the same already-seeded database. Leave `E2E_SEED_FIXTURES` unset when
running tests after the build. That flag remains available as an explicit opt-in
to the standalone Playwright fixture setup.

A successful build includes the two fixture slugs for each of `places`,
`articles`, and `products`. The suite visits them anonymously. Draft preview and
publishing tests use separate temporary staff users and documents.

## What the checks prove

- `instant-nav.e2e.spec.ts` uses `@next/playwright`'s `instant()` helper for each
  collection's list-to-detail link, the home CTAs, and desktop/mobile navigation.
  The destination shell must be visible while the lock is held. Prerendered or
  cached content may appear immediately too; requiring it to remain hidden would
  reject successful prerendering.
- `offline.e2e.spec.ts` disconnects the browser after a link's prefetch. It checks
  the shell while the browser cannot reach the server, then reconnects and checks
  the content. A separate journey checks that a pending location Server Action
  saves after reconnection and survives a reload.
- `cms-isr.e2e.spec.ts` checks publishing and draft isolation for existing and
  newly published slugs against the running Next.js server.
- `error-boundary.e2e.spec.ts` checks recovery through the public content retry
  boundary and preserves the missing-document behavior.

The DevTools workflow in [README.md](README.md#check-instant-navigations-locally)
checks the visual quality of the loading UI. Automated assertions do not replace
that manual inspection.

## CI

The `build-and-integration` job migrates an empty database and seeds the
fixtures. It builds and tests the normal production target first (`pnpm build:next`
then `pnpm test:e2e`), then rebuilds and runs `pnpm test:e2e:instant` with
`EXPOSE_TESTING_API=1`. The two builds use the same seeded database and do not
reseed between tests. Integration tests use `TEST_POSTGRES_URL`.

Local build scripts mask production env files before running Next.js. They do
not change the target of an explicitly supplied `POSTGRES_URL`.
