# Next.js 16.3 migration notes

This page is the working index for the Next.js 16.3 follow-up issues. Issue
numbers link to the repository tracker. The application is a Payload-backed
community site, so public content comes from the CMS and the route names in the
issues may differ from the current app routes.

## Issue index

| Issue | Topic |
| --- | --- |
| [#186](https://github.com/samaluk/community/issues/186) | Immutable static assets across deploys |
| [#187](https://github.com/samaluk/community/issues/187) | Custom error boundaries with server retry |
| [#188](https://github.com/samaluk/community/issues/188) | Evaluate `import.meta.glob` for local content |
| [#191](https://github.com/samaluk/community/issues/191) | Instant loading shells on public content routes |
| [#192](https://github.com/samaluk/community/issues/192) | ISR for CMS slug routes |
| [#193](https://github.com/samaluk/community/issues/193) | Partial Prefetching on navigation |
| [#194](https://github.com/samaluk/community/issues/194) | Instant Insights and Navigation Inspector workflow |
| [#195](https://github.com/samaluk/community/issues/195) | Instant navigation E2E regression suite |
| [#196](https://github.com/samaluk/community/issues/196) | Offline network resilience |

The app already used Next.js and `@next/playwright` 16.3.3 before this follow-up.
The changes below complete the remaining application work on that version.
On 2026-10-19 UTC, an isolated Preview running Next.js 16.4.2 passed #186's
immutable-asset and mutable public-content freshness checks. The September and
2026-10-18 observations below remain dated history; the Preview blocker is resolved.

## Operator tenancy follow-up

The original evidence below describes the single-Operator implementation from
September. The subsequent [Operator isolation decision](adr/0006-operator-multi-tenancy.md)
changes full-page prerendering: the same public path can now belong to different
Operators depending on its hostname. Builds produce a generic loading shell
and reserved detail parameter; Operator content and metadata resolve at request
time. Published data remains cached by Operator ID and invalidated by
Operator-scoped publishing tags. A warm data cache does not turn the whole
host-dependent response into a shared fully prerendered page.

The current browser checks therefore cover warm-data publishing invalidation,
draft isolation, instant route shells, and alternating hosts with the same slug.
The earlier top-20 build-slug and background full-page ISR observations remain
historical evidence, rather than the current multi-Operator rendering contract.
See the [operations guide](operator-tenancy.md) for migration and rollout limits.

## CMS rendering and recovery

The three detail routes prerender up to 20 published Spanish-language slugs,
ordered by title. The slug query reads only the slug field at depth zero.
An empty collection supplies a placeholder that resolves through `notFound()`;
this satisfies Cache Components' requirement for at least one build parameter.
Both empty and seeded databases build successfully.

Published document reads keep the existing `publicContent` cache profile:
15-minute revalidation and one-day expiry. Collection and document cache tags
let publish, unpublish, rename, and delete hooks expire the affected listings
and current/previous slugs immediately. Draft-only changes leave public caches
alone, and authenticated draft previews continue to bypass published reads.

Unknown published slugs receive the generic shell before content streams in.
Next then upgrades the route in the background. The ISR test waits for that
upgrade and checks a cache hit without postponed content, plus normal client
navigation to the published page.

Shared detail content now uses `catchError` with a server `retry()` button.
CMS failures propagate to that boundary instead of becoming false 404s.
Metadata retains a fallback title during an outage and rethrows Next's redirect
and not-found signals. The recovery test gives a disposable place an invalid
rich-text indent, navigates from its listing, repairs it through Payload's
authenticated API, and retries the same page. Each CMS test owns its Payload
instance so closing its database connection cannot break the next test.

Next.js 16.3.3 can return a generic HTTP 500 when a cold full-page request fails
during ISR rendering. The custom boundary recovery is verified on client
navigation through the shared shell; it does not cover that initial ISR failure.

## Navigation and offline behavior

`partialPrefetching: true` enables shared route shells for the existing header,
mobile navigation, and content links. The link audit found no explicit
`prefetch={true}` overrides to migrate. Default prefetch inlining remains enabled.
Existing Suspense/loading shells remain in place, with seven instant-navigation
journeys covering listings, details, home CTAs, and both header variants.

A local production comparison on 2026-09-07 used fresh browser sessions at
1280 × 900, opened `/places`, and scrolled through both fixture cards and the
footer. Both builds used the same seeded database and default inlining, with
the testing API disabled. Only `partialPrefetching` changed.

| Measurement | Flag off | Flag on |
| --- | ---: | ---: |
| Prefetch requests | 15 | 14 |
| Compressed response body bytes | 22,466 | 18,685 |
| Uncompressed response body bytes | 86,089 | 70,084 |

Request headers identified prefetches in the HAR; Chrome Resource Timing supplied
`encodedBodySize` and `decodedBodySize` for all matching requests. This journey
used about 17% fewer compressed body bytes and one fewer request. Map tiles,
scripts, and the initial page load are outside these prefetch totals.

`experimental.useOffline` enables Next's network retry support. The frontend
shows a live offline status message. Browser coverage verifies a prefetched
article remains usable without a connection and a pending location Server
Action saves when the connection returns. Cached title/content may already be
visible while offline; tests must not require it to disappear.

This is not an offline reload or service-worker implementation. Only Next's
managed requests receive this retry behavior. Direct client fetches, including
the membership verification API, do not gain automatic retry or persistence.

## Verification workflow

Final local checks on 2026-09-07 passed:

- 66 unit tests across 17 files, with fresh coverage.
- 4 integration tests against the separate disposable test database.
- 11 normal production browser tests and 7 instant-navigation tests.
- Normal and testing-API production builds, including TypeScript checks.
- Repository lint, formatting, and Fallow audit, dead-code, duplication, and
  complexity gates. Fallow retained its existing advisory UI clone warnings.

Playwright started and stopped both production servers. CMS mutation tests left
no temporary documents or admin users. The integration rerun used the existing
migrated test schema directly, since Payload's dev-mode schema marker makes a
second migration invocation interactive.

Normal production E2Es and instant-navigation E2Es use separate builds. In the
installed Next.js 16.3.3 implementation, enabling
`exposeTestingApiInProductionBuild` disables background ISR shell upgrades even
outside an `instant()` callback. Testing ISR in that build produces misleading
failures and can affect subsequent navigation tests after cache invalidation.

CI first builds without the testing API and runs the normal E2E project. It then
rebuilds with `EXPOSE_TESTING_API=1` and runs only the instant project with the
same flag set for its server. Fixtures
are seeded before the first build; mutation tests restore their documents, and
the second build prerenders the restored fixtures. See
[`apps/web/instant-nav.rig.md`](../apps/web/instant-nav.rig.md) for commands.

The DevTools check on 2026-09-07 used `http://localhost:3101`. Navigation Inspector
paused an Articles header navigation and displayed `Loading shell`, `Client
nav`, and `Resume` while the list shell remained visible. No Instant Insights
cards appeared on that flow. The same server's overlay did not appear at
`127.0.0.1`, so use `localhost` for the documented development workflow.

## #186: deployment check

All acceptance criteria were verified on an isolated Preview on 2026-10-19 UTC.
Vercel supplies immutable-asset support through its adapter; the application
keeps `supportsImmutableAssets` unset. The earlier observations below record
the investigation before the successful Preview verification.

### Production inspection on 2026-09-07

The 2026-09-07 inspection identified Vercel project `community`
(`prj_TVrFCtqtR1HbZoiwI8lfe3pjJnaL`). The CLI listed no ready Preview deployments.
The latest ready deployment at that time was the
production deployment `community-qpbaubi19-sebastianmaluks-projects.vercel.app`
for commit `bf2468a3f6ddb94e13ab08cbfdbd075f2c146cef`.

That deployed app serves its generated CSS and JavaScript from
`/_next/static/immutable/chunks/`, without a `?dpl` query parameter. A direct
request to one generated CSS file returned:

```text
HTTP/2 200
cache-control: public,max-age=31536000,immutable
```

The homepage response also returned `x-nextjs-prerender: 1` and referenced the
same immutable path. The Payload media endpoint remains a separate mutable
resource. A ranged request to `/api/media/file/mbqb-homepage-hero-video.mp4`
returned `cache-control: public, max-age=31536000` without `immutable`. This
records its separate cache classification; it does not test replacing media
content or prove that mutable resources remain fresh after deployment.

This is historical production evidence of automatic immutable-asset support,
not verification of subsequent changes or a Preview deployment.

### Read-only recheck on 2026-10-18

Vercel CLI 64.5.0 authenticated successfully and confirmed the same project in
scope `sebastianmaluks-projects`, with framework `nextjs` and root directory
`apps/web`. Both the Ready-only and unfiltered Preview deployment lists were
empty, with no further pages. `vercel env ls preview --project community`
returned zero variables. The all-environment metadata listed database
configuration for Production and Development only; no database connection or
other variable targeted Preview. No environment values were printed or pulled.

At that time, Preview verification was blocked by missing isolated Preview
configuration. The app required `POSTGRES_URL`, `PAYLOAD_SECRET`,
`PREVIEW_SECRET`, and `NEXT_PUBLIC_SERVER_URL`. Its build script runs Payload
migrations and a schema push before the Next.js build, so a Preview must have
its own database rather than reuse Production credentials. Any upload testing
also needs storage isolated from Production. No deployment, database, remote
configuration, or Production resource was changed during this recheck.

`apps/web/vercel.json` disabled automatic Git deployments for branches other
than `master`. The remaining verification plan was to provision isolated
Preview configuration, create a manual Preview, inspect its HTML and referenced
hashed CSS/JavaScript assets with `vercel curl`, and verify a mutable resource's
freshness after an update. The 2026-10-19 verification below completed that plan
using mutable public CMS content.

The installed Next.js 16.4.2 docs still identify `supportsImmutableAssets` as
primarily an adapter-author setting and warn that enabling it without provider
support can break deployments. Leave it unset in the app configuration. The
adapter guide requires immutable assets to remain available across deployments
and non-immutable assets to retain their deployment-scoped handling; no app
override is needed to request that contract from Vercel.

### Successful Preview verification on 2026-10-19 UTC

The same Vercel project in scope `sebastianmaluks-projects`, with app root
`apps/web`, deployed Next.js 16.4.2 as
[`dpl_BbCYfHUgZU2FKhUY29VWgx3fFzBY`](https://community-4emy700v6-sebastianmaluks-projects.vercel.app).
Its explicitly assigned canonical alias is
<https://community-git-feat-operator-tenancy-sebastianmaluks-projects.vercel.app>.
The source was commit `758d0a7999f29527d1816c64ce1787760e15d613` from
[#457](https://github.com/samaluk/community/pull/457). Immutable-asset support is
adapter-managed and unchanged from `master`'s Next.js 16.4.2 configuration.

A new, empty Neon Free resource, `community-preview-isolated`
(`store_8bfpqoWuE6WR25To`, Neon project `bold-art-19758544`), was connected only
to Preview. Its migrations and schema were initialized with six synthetic
public fixtures. No private Production data was copied. The Production
resource, store, and database were untouched, and <https://mbqb.vercel.app>
continued returning HTTP 200 throughout.

Authenticated `vercel curl` inspection of the Preview home HTML found the title
`Community`, 11 `/_next/static/immutable/` asset references, and zero `?dpl`
suffixes. Both referenced assets below returned HTTP 200 with
`cache-control: public,max-age=31536000,immutable`:

- CSS: `/_next/static/immutable/chunks/2wi5em9rkl9np.css`
- JavaScript: `/_next/static/immutable/chunks/3t26w73c-up6d.js`

The mutable home HTML returned HTTP 200 with
`cache-control: public,max-age=0,must-revalidate`.

The existing `apps/web/tests/e2e/cms-isr.e2e.spec.ts` workflow passed against the remote
Preview: **1 passed in 15.0 seconds, with zero retries**. It used a temporary
private configuration and the existing automation bypass while deployment
protection stayed enabled. Using only isolated Preview data, it verified the
generic streaming shell, hidden drafts, publishing and editing, and invalidation
and freshness of warmed public content. Its `finally` cleanup removed temporary
Places and the test administrator.

Mutable public CMS content supplied the freshness evidence for #186. Media
replacement was not tested; Preview storage intentionally did not use
Production Blob. The missing isolated Preview configuration recorded in
[#456](https://github.com/samaluk/community/pull/456) is resolved, and #186's
acceptance criteria are complete.

## #188: `import.meta.glob` audit

Next.js 16.3 documents `import.meta.glob()` as a Turbopack-only, Vite-compatible
API. It returns lazy import functions by default, or module objects with
`{ eager: true }`. It can also select named exports and load text or URLs with
`query`, but it is unavailable when the project uses webpack.

The audit found no `import.meta.glob` usage and no other `meta.glob` references in
`apps/web` source, scripts, tests, or configuration. There is no
`apps/web/public` directory in the current checkout. The homepage hero video is
selected through Payload's `HomePage.heroVideo` upload field and served from the
related `media` document's URL. Public route content, including
places, articles, and products, is queried through Payload adapters and is not
stored as a batch of local modules. The route code imports ordinary TypeScript
modules directly, and the remaining local files are application code, tests, or
deployment assets rather than a filesystem content catalogue.

There is no current local-file batch-loading use case to adopt. Adding a glob
loader would introduce a second content source beside Payload without removing
any existing work. Leave the API unused unless the project later adds a local
catalogue of modules, raw text, or URL assets that needs lazy batch discovery.

The installed reference is
`node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md`, under the
`import.meta.glob` section. It also records that TypeScript types are included
when `moduleResolution` is `bundler`, which this app already uses.

## References

- [Ensuring instant navigations](https://nextjs.org/docs/app/guides/instant-navigation)
- [Adopting Partial Prefetching](https://nextjs.org/docs/app/guides/adopting-partial-prefetching)
- [Turbopack `import.meta.glob`](https://nextjs.org/docs/app/api-reference/turbopack#importmetaglob)
- [Immutable static assets](https://nextjs.org/docs/app/api-reference/config/next-config-js/supportsImmutableAssets)
