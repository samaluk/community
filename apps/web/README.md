# Community Platform Web

Next.js and Payload application for the community platform.

## Quick Start

From the repository root:

```sh
pnpm install
cd apps/web
vercel login
vercel link
pnpm env:pull
docker compose up -d postgres
cd ../..
pnpm dev
```

The app runs at `http://localhost:3000`. Payload admin runs at `/admin`.

## Check instant navigations locally

Run `pnpm dev` from the repository root, then open the app in a browser with the
Next.js DevTools available. The project enables Cache Components, so the DevTools
can show the shell that a visitor sees before request-time CMS data arrives.

Open the development app at `http://localhost:3000` so the DevTools connection
uses the same hostname as the server. Watch the Next.js development overlay for
**Instant Insights** while clicking
through the routes below. Each insight names the route or link that prevents an
instant navigation. Follow the linked fix guidance, then repeat the navigation
after the change.

- `/places` → `/places/<slug>`
- `/articles` → `/articles/<slug>`
- `/products` → `/products/<slug>`
- `/` → `/places` and `/verify`

To inspect the actual loading shell, open **Navigation Inspector**, turn on
**Pause on navigations**, and refresh a route or click one of its links. The
inspector freezes the page at the initial shell. A page refresh is shown as
**Page load**; a link click is shown as **Client nav**, with the source and target
URLs. Check that the shell contains the page structure and useful labels while
CMS data is pending, then click **Resume**. Turn **Pause on navigations** off when
finished, since every later navigation will otherwise pause.

Use the existing [`instant-nav.rig.md`](instant-nav.rig.md) for the seeded local
build and Playwright workflow. The `instant()` checks in that rig provide the
repeatable CI guard; the DevTools workflow is the manual check for the visual
quality of each shell.

The [Next.js 16.3 migration notes](../../docs/next-16.3-migration.md) link the
follow-up issues and record caching, recovery, and deployment decisions.

## Environment

[Vercel](https://vercel.com) is the source of truth for all environment variables. The canonical list and validation rules live in [`src/env.ts`](src/env.ts) (`@t3-oss/env-nextjs` + Zod). Local files are only a cache from `vercel env pull`:

| File | When |
|------|------|
| `.env.local` | Local dev, build, migrate, and tests — `pnpm env:pull` (Vercel **Development**) |
| `.env.production.local` | Production-only scripts — `pnpm env:pull:production` (seed from prod, prod admin user, `build:production`, `migrate:production`) |

```sh
cd apps/web
pnpm env:pull              # → .env.local
pnpm env:pull:production   # → .env.production.local
vercel env ls              # inspect remote values
```

Configure the Vercel **Development** environment with a local Docker `POSTGRES_URL` (`postgres://postgres:postgres@127.0.0.1:5433/community`), `TEST_POSTGRES_URL` for integration tests (`postgres://postgres:postgres@127.0.0.1:5433/community_test`), `NEXT_PUBLIC_SERVER_URL=http://localhost:3000`, `PAYLOAD_SECRET`, `PREVIEW_SECRET`, and `BLOB_READ_WRITE_TOKEN` (optional). Do not point Development `POSTGRES_URL` or `TEST_POSTGRES_URL` at production. Production uses Neon’s `POSTGRES_URL` from the Vercel integration — use that name only; do not add a separate `DATABASE_URL`.

If you run `pnpm seed:dev-from-prod`, set Development `PAYLOAD_SECRET` to the **same value as Production** in the Vercel dashboard so membership lookup hashes match the copied data.

### Adding a new variable

1. Add it in the Vercel project (`vercel env add …`).
2. Add it to the `server` or `client` schema and `runtimeEnv` in [`src/env.ts`](src/env.ts).
3. Run `pnpm env:pull` (or `env:pull:production` if production-only).
4. Use `env.YOUR_VAR` in application code under `src/` — do not read `process.env` directly.

## Local Database

Use Docker when you do not have local Postgres:

```sh
cd apps/web
docker compose up -d postgres
```

Postgres 17 + PostGIS on port **5433** (avoids clashing with a local Postgres on 5432). Compose creates `community` and `community_test` when the `pgdata` volume is initialized. If you already have a local `pgdata` volume, create the test database once with `docker compose exec postgres createdb -U postgres community_test`. Set `POSTGRES_URL` and `TEST_POSTGRES_URL` in Vercel Development, then `pnpm env:pull`.

Volumes initialized before the Community rename retain their original database names. Recreate a disposable local volume or rename the existing databases to `community` and `community_test` before starting the app.

### Seed local data from production

```sh
cd apps/web
pnpm env:pull:production
pnpm seed:dev-from-prod
```

This replaces your local `community` database with a copy of production (schema and content), then applies any pending Payload migrations.

### Production admin user

```sh
cd apps/web
pnpm env:pull:production
CMS_USER_EMAIL=you@example.com CMS_USER_PASSWORD="$(openssl rand -base64 32)" pnpm create:prod-user
```

Use `CMS_USER_UPDATE_EXISTING=true` to reset an existing user password. `create:prod-user` loads `.env.production.local` when `NODE_ENV=production`.

## Current Foundation

The app uses Payload with Postgres, Vercel Blob-backed media when `BLOB_READ_WRITE_TOKEN` is present, and built-in admin auth with `admin`, `editor`, and `validation-manager` staff roles.

Current CMS foundation includes collections `users`, `media`, `memberships`, `places`, `articles`, `products`, and globals `site-settings`, `home-page`.

## Live preview (server-rendered)

Editors can preview draft CMS content in the admin panel (Live Preview) and via the Preview button. The frontend uses Next.js draft mode plus `router.refresh()` on autosave.

`PREVIEW_SECRET` and `NEXT_PUBLIC_SERVER_URL` must be set (via Vercel / `env:pull`). They are validated in `src/env.ts`.

### Migrations

Local development follows Payload's recommended Postgres workflow: the local database is a sandbox, and Payload/Drizzle `push` syncs schema changes while `pnpm dev` runs. Do not run migrations against the same pushed local database as part of ordinary feature work; Payload treats `push` and migrations as separate workflows.

For normal schema changes:

1. Edit the Payload config locally and develop against the pushed local schema.
2. Finish the feature before generating a migration.
3. Create a migration from `apps/web`:

   ```sh
   pnpm payload migrate:create meaningful-name
   ```

4. Review the generated SQL before committing it.
5. Let CI run `pnpm build`; production runs must use `pnpm build:production`.

If a migration depends on environment-specific config, generate and review it with those conditions in mind. This matters for production-only plugins or flags, including Vercel Blob storage controlled by `BLOB_READ_WRITE_TOKEN`.

Useful migration commands from `apps/web`:

```sh
pnpm migrate:status
pnpm migrate:create meaningful-name
pnpm migrate:down
pnpm migrate:fresh
```

`pnpm build` and `pnpm migrate` use `.env.local` or CI-injected variables and never load production configuration. Production targeting is explicit:

```sh
pnpm env:pull:production
pnpm build:production
pnpm migrate:production
```

Next.js runs TypeScript 7 through the project-local compiler CLI, enabled by
`experimental.useTypeScriptCli`. The production build checks types, and
`pnpm typecheck` runs the same compiler independently.

### Squashed baseline

Schema history starts from `20260604_000000_baseline` (includes drafts/version tables and Lexical `body` jsonb columns). The legacy HTML-to-Lexical body import has already been applied and is no longer part of the app interface.

**Local / CI — empty database:**

```sh
cd apps/web
POSTGRES_URL=postgres://postgres:postgres@127.0.0.1:5433/community pnpm migrate:fresh
```

`pnpm test:int` refuses to run unless `TEST_POSTGRES_URL` is set. Payload may push schema during integration setup, so this database must be isolated from local development content and production-like data.

**Local — match production:** `pnpm seed:dev-from-prod` (restores prod dump, then `payload migrate`).

### Baseline migration reset

After deploying the squash to production (schema already correct; Lexical shipped):

1. Take a production `pg_dump` backup.
2. Deploy this commit.
3. Run `scripts/reset-payload-migrations-to-baseline.sql` against production (resets only `payload_migrations`, not content).
4. Confirm the next deploy’s `pnpm migrate` reports no pending migrations.

Regenerate the baseline from a DB that matches prod:

```sh
cd apps/web
pnpm migrate:baseline
```
