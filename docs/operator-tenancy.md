# Operating a shared Community Platform

Each Operator has a configured hostname, settings, content, memberships, and
staff assignments. Public routes remain `/places`, `/articles`, `/products`, and
`/verify`. The hostname selects the Operator; query parameters and forwarded
Operator headers do not. Unknown or suspended public hosts are denied. See
[ADR-0006](adr/0006-operator-multi-tenancy.md) for the isolation contract.

## Upgrade an existing deployment

The forward migration creates an initial Operator from existing Site Settings
and the hostname in `NEXT_PUBLIC_SERVER_URL`. Existing documents, versions,
media, memberships, settings, and staff roles are attached to that Operator.
Document IDs, membership hashes, and retained version content are preserved.

This is a forward-only migration and needs a controlled cutover. The earlier
application expects the global staff-role column and performs unscoped content
queries; it cannot safely share the migrated database once multiple Operators
are provisioned. The production build runs `migrate:production` and then
`push:schema:production`, so the migration changes the database while the build
is running, before the new application is serving traffic. Do not start that
build while an old revision can still read or write the Production database.

Use this sequence:

1. Rehearse the complete cutover with an isolated database and the exact
   Production hostname in `NEXT_PUBLIC_SERVER_URL`. Verify backup restoration,
   the migration, schema push, and application startup. Never use Production
   credentials for this rehearsal.
2. Schedule downtime. Pause automatic Production deployments and CMS writes,
   stop old revisions from serving requests or accessing the Production
   database, and review retired deployment URLs and deployment protection.
   Moving the public alias alone does not remove an old revision's database
   access.
3. Take and verify a restorable Production database backup. Confirm that
   `NEXT_PUBLIC_SERVER_URL` contains the intended canonical hostname for the
   initial Operator.
4. With old database access still stopped, run exactly one Production build
   using the Production environment. From `apps/web`, the existing command is
   `pnpm build:production`; it runs the forward migration, pushes the matching
   schema, and builds the application. Keep public traffic blocked while it
   runs.
5. Deploy and verify the new application, including Operator resolution,
   administrative recovery, and public content. Then restore routing and
   traffic.

The deployment build may run the recorded migration again; Payload skips an
already-applied migration. Keep old revisions disabled through this build too.
If cutover fails, restore traffic only after restoring the database and code to
a mutually compatible state. The migration's `down` function intentionally
throws; a code-only rollback is insufficient. Existing Operator
administrators are not automatically promoted to Platform Administrators.

### Fresh local database

For a disposable, empty local database, use the migration workflow once to
create the initial Operator from `NEXT_PUBLIC_SERVER_URL` (normally
`http://localhost:3000`):

```sh
cd apps/web
pnpm migrate
```

Confirm that `.env.local` points only to the disposable local database. The
`migrate` command loads `.env.local`; it does not create a Platform
Administrator. Bootstrap one against that same local database with:

```sh
CMS_USER_EMAIL=platform-admin@example.org \
CMS_USER_PASSWORD='<secure password>' \
CMS_PLATFORM_ADMIN=true \
DOTENV_CONFIG_PATH=.env.local \
NODE_ENV=production \
node --env-file=.env.local --import=tsx scripts/create-payload-user.ts
```

This command explicitly injects the disposable local environment before
loading Payload. Production mode prevents development schema push from
modifying a migration-validation database; it does not select a remote database.
Confirm `.env.local` has nonempty `POSTGRES_URL`, `PAYLOAD_SECRET`,
`PREVIEW_SECRET`, and `NEXT_PUBLIC_SERVER_URL` values before running it. Use
`pnpm build:next` and `pnpm start` with the same injected environment to inspect
this migration-based installation. Sign in at `http://localhost:3000/admin`,
configure the initial Operator, and create additional Operators there. The
initial Operator is active by default, so keep local or Preview DNS/routing
closed to public traffic until its settings and content are ready.

Keep the migration and schema-push workflows separate for each database. Once
a local database has been used by the development schema-push workflow, do not
run Payload migrations against that same database; use a separate disposable
database to rehearse or validate migrations. `pnpm dev` enables schema push;
reserve it for a development database rather than this migration rehearsal.
Local, integration, and Preview
databases each need their own host registration and runtime settings. A
Preview hostname is not registered automatically: create its Operator in that
Preview database, or update the initial Operator created by migration, to match
the Preview deployment's canonical hostname. Do not point a Preview deployment
at Production's database.

## Bootstrap platform administration

From `apps/web`, after pulling the intended Production environment:

```sh
CMS_USER_EMAIL=platform-admin@example.org \
CMS_USER_PASSWORD='<secure password>' \
CMS_PLATFORM_ADMIN=true \
pnpm create:prod-user
```

`CMS_PLATFORM_ADMIN=true` explicitly grants platform authority. To update an
existing user, also set `CMS_USER_UPDATE_EXISTING=true`; this resets their
password. Omitting the platform flag preserves existing platform authority.
For local setup, follow the [fresh local database](#fresh-local-database)
workflow above and use only the disposable local environment.

## Provision an Operator and staff

1. Sign in as a Platform Administrator at `/admin`. Create an Operator with its
   name and canonical hostname, without a scheme, port, or path. Establish domain
   ownership and finish its settings and content before enabling DNS or routing
   public traffic to it.
2. Note its Operator ID. Select it in the CMS and configure its Site Settings,
   Media, and Home Page. Settings and Home Page are one-per-Operator collections.
3. Assign staff through shared user administration or the trusted CLI:

   ```sh
   CMS_USER_EMAIL=operator-admin@example.org \
   CMS_USER_PASSWORD='<secure password>' \
   CMS_OPERATOR_ID=1 \
   CMS_USER_ROLE=admin \
   pnpm create:prod-user
   ```

   Replace `1` with the intended ID. Roles are `admin`, `editor`, and
   `validation-manager`. Updating an existing user changes that Operator's role
   and preserves their other assignments. A platform bootstrap may also include
   an Operator ID when both capabilities are needed.
4. Have staff sign in at the target Operator's hostname under `/admin`. Browser
   authentication and draft cookies are host-local. A CMS selector or preview
   secret does not transfer authentication or authorize another Operator.
5. Publish content and check public pages, metadata, previews, and membership
   verification through that hostname.

Platform Administrators manage shared staff assignments. Operator staff cannot
grant platform authority or change another Operator's assignments.

## Suspension and offboarding

Suspension denies public access while preserving data and administrative
recovery. Keep platform credentials available for recovery. Operator deletion
and automatic cascading cleanup are disabled. Exports, retention, storage
cleanup, and destructive removal require a separate offboarding workflow.

Media records, relationships, uploads, and Payload file routes obey Operator
access checks. Public Vercel Blob URLs remain public assets: suspension cannot
revoke an existing external URL, download, or browser/CDN cache. Do not publish
private membership material as media.

## Rendering and validation

The shared initial HTML shell has a generic language and no Operator content.
Streamed branded chrome carries its configured language; hydration updates the
document language for page content too. Operator metadata also streams. Header
and footer have their own Suspense boundaries so resolving the hostname does
not block the page's static navigation shell. This preserves the loading shell
without caching one hostname's identity for another.

Listing detail links and the home page's Verify action explicitly enable
per-link prefetching so their hostname-dependent UI can be cached before
navigation. This adds a server prefetch per visible link; listings cap their
document query at 20.

The Payload admin integration wrappers explicitly wait for a request before
authentication, keeping private administration outside prerendering. Preserve
these `connection()` calls and the private layout's `instant = false` config
if regenerating Payload's Next.js templates.

Trusted published queries constrain both Operator and publication status.
Draft reads additionally authenticate staff for that Operator. Cached data and
invalidation tags include the Operator ID. Build-time shell generation does not
choose an Operator using a missing request hostname.

Use disposable PostGIS databases for migration and integration checks. Run both
the normal production and separate instant-navigation suites from
[`instant-nav.rig.md`](../apps/web/instant-nav.rig.md). Test two Operators sharing
a slug and member identifier, differing roles, draft-only content, warm caches,
foreign media relationships, and unknown/suspended hosts. Compare migrated IDs,
hashes, and versions with a pre-upgrade fixture; also test an empty installation.
