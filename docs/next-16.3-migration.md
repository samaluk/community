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
Preview deployment verification is still pending an isolated database.

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

The Vercel project is linked in both the repository root and `apps/web` under
project `community` (`prj_TVrFCtqtR1HbZoiwI8lfe3pjJnaL`). On 2026-09-07, the CLI
listed no ready Preview deployments. The latest ready deployment was the
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
returned `cache-control: public, max-age=31536000` without `immutable`, which is
appropriate because it is not a content-addressed `/_next/static` asset.

This verifies automatic immutable-asset support on the current production
deployment. It does not verify pending local changes until a deployment
includes them. Preview verification remains blocked because the project has no
isolated Preview environment variables or database. The Vercel deployment
metadata identifies Turbopack and does not expose a project-level adapter
setting that needs to be changed. Next's installed 16.3 docs caution that
`supportsImmutableAssets` is primarily an adapter-author setting, so leave it
to the Vercel adapter unless a deployment stops emitting the immutable path.

## #188: `import.meta.glob` audit

Next.js 16.3 documents `import.meta.glob()` as a Turbopack-only, Vite-compatible
API. It returns lazy import functions by default, or module objects with
`{ eager: true }`. It can also select named exports and load text or URLs with
`query`, but it is unavailable when the project uses webpack.

The audit found no `import.meta.glob` usage and no other `meta.glob` references in
`apps/web` source, scripts, tests, or configuration. The only file in
`apps/web/public` is the homepage hero video. Public route content, including
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
