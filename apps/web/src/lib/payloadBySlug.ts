import config from '@payload-config'
import { cacheLife, cacheTag } from 'next/cache'
import { draftMode } from 'next/headers'
import { unstable_rethrow } from 'next/navigation'
import { getPayload } from 'payload'
import type { CollectionSlug, DataFromCollectionSlug } from 'payload'
import type { Metadata } from 'next'
import { cache } from 'react'

import { getCmsQueryOptions, getPublishedCmsQueryOptions } from '@/lib/cmsQuery'
import { isPayloadUnavailableError } from '@/lib/payloadUnavailableError'
import {
  getPublicContentCollectionCacheTag,
  getPublicContentDocCacheTag,
  getPublicContentStaticParams,
  type PublicContentCollection,
} from '@/lib/publicContentCache'
import type { Config } from '@/payload-types'

/**
 * Draft-mode dispatch shared by every public content route: previews read the
 * draft variants, everyone else reads the published, cached ones.
 *
 * React `cache()` memoizes per request, so `generateMetadata` and the page
 * body resolve a given slug once per render instead of querying Payload twice
 * (the published path is additionally absorbed by its `'use cache'` function).
 */
export const getPayloadDocBySlug = cache(async function getPayloadDocBySlug<
  TSlug extends CollectionSlug<Config>,
>(collection: TSlug, slug: string): Promise<DataFromCollectionSlug<TSlug> | null> {
  const { isEnabled: draft } = await draftMode()

  return draft
    ? await getDraftPayloadDocBySlug(collection, slug)
    : await getPublishedPayloadDocBySlug(collection, slug)
})

/** Draft-mode dispatch for listing routes (see {@link getPayloadDocBySlug}). */
export const getPayloadDocs = cache(async function getPayloadDocs<
  TSlug extends CollectionSlug<Config>,
>(collection: TSlug): Promise<DataFromCollectionSlug<TSlug>[]> {
  const { isEnabled: draft } = await draftMode()

  return draft ? await getDraftPayloadDocs(collection) : await getPublishedPayloadDocs(collection)
})

/**
 * Slugs to prerender for public detail routes. This intentionally uses the
 * published query directly: `generateStaticParams` runs at build time, where
 * draft mode has no request context to inspect.
 */
async function getPublishedPayloadDocSlugs(collection: PublicContentCollection): Promise<string[]> {
  'use cache'
  cacheLife('publicContent')
  cacheTag(getPublicContentCollectionCacheTag(collection))

  const payload = await getPayload({ config })
  const docs = await payload.find({
    collection,
    depth: 0,
    limit: 20,
    locale: 'es',
    sort: 'title',
    select: {
      slug: true,
    },
    ...getPublishedCmsQueryOptions(),
  })

  return docs.docs.flatMap((doc) =>
    typeof doc.slug === 'string' && doc.slug.length > 0 ? [doc.slug] : [],
  )
}

/**
 * Build params for public detail routes. Next requires at least one param
 * with Cache Components enabled, even when a collection has no published
 * documents. The reserved value resolves through the normal not-found path;
 * CMS errors still throw from getPublishedPayloadDocSlugs above.
 */
async function getPublishedPayloadStaticParams(
  collection: PublicContentCollection,
): Promise<Array<{ slug: string }>> {
  const slugs = await getPublishedPayloadDocSlugs(collection)

  return getPublicContentStaticParams(slugs)
}

/**
 * `generateMetadata` factory for detail routes: titles the page after the
 * fetched doc, falling back when the doc is missing.
 */
export function payloadDocMetadata(
  collection: CollectionSlug<Config>,
  fallbackTitle: string,
): (props: { params: Promise<{ slug: string }> }) => Promise<Metadata> {
  return async ({ params }) => {
    const { slug } = await params
    let doc: DataFromCollectionSlug<typeof collection> | null

    try {
      doc = await getPayloadDocBySlug(collection, slug)
    } catch (error) {
      // Metadata renders outside the page tree, so let the detail boundary
      // handle the body while keeping a transient CMS outage from aborting the
      // whole route before that boundary can render.
      unstable_rethrow(error)

      if (!isPayloadUnavailableError(error)) {
        console.error(`Failed to load metadata for ${collection} "${slug}"`, error)
      }

      return { title: fallbackTitle }
    }

    if (!doc) return { title: fallbackTitle }

    return { title: 'title' in doc && typeof doc.title === 'string' ? doc.title : fallbackTitle }
  }
}

/** Shared route exports for public CMS slug pages. */
export function payloadDocRoute(collection: PublicContentCollection, fallbackTitle: string) {
  return {
    generateMetadata: payloadDocMetadata(collection, fallbackTitle),
    generateStaticParams: getPublishedPayloadStaticParams.bind(null, collection),
  }
}

async function getDraftPayloadDocBySlug<TSlug extends CollectionSlug<Config>>(
  collection: TSlug,
  slug: string,
): Promise<DataFromCollectionSlug<TSlug> | null> {
  // Payload boot and CMS query options are independent, so race them.
  const [payload, cmsQuery] = await Promise.all([getPayload({ config }), getCmsQueryOptions()])
  const docs = await payload.find({
    collection,
    depth: 1,
    limit: 1,
    locale: 'es',
    ...cmsQuery,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return docs.docs[0] ?? null
}

async function getPublishedPayloadDocBySlug<TSlug extends CollectionSlug<Config>>(
  collection: TSlug,
  slug: string,
): Promise<DataFromCollectionSlug<TSlug> | null> {
  'use cache'
  cacheLife('publicContent')
  cacheTag(getPublicContentDocCacheTag(collection, slug))

  try {
    const payload = await getPayload({ config })
    const docs = await payload.find({
      collection,
      depth: 1,
      limit: 1,
      locale: 'es',
      ...getPublishedCmsQueryOptions(),
      where: {
        slug: {
          equals: slug,
        },
      },
    })

    return docs.docs[0] ?? null
  } catch (error) {
    if (!isPayloadUnavailableError(error)) {
      console.error(`Failed to load ${collection} "${slug}"`, error)
    }

    throw error
  }
}

/**
 * Latest 20 published docs of a public content collection, cached. Payload
 * outages degrade to an empty list instead of failing the route.
 */
async function getPublishedPayloadDocs<TSlug extends CollectionSlug<Config>>(
  collection: TSlug,
): Promise<DataFromCollectionSlug<TSlug>[]> {
  'use cache'
  cacheLife('publicContent')
  cacheTag(getPublicContentCollectionCacheTag(collection))

  try {
    const payload = await getPayload({ config })
    const docs = await payload.find({
      collection,
      depth: 1,
      limit: 20,
      locale: 'es',
      sort: 'title',
      ...getPublishedCmsQueryOptions(),
    })

    return docs.docs
  } catch (error) {
    if (!isPayloadUnavailableError(error)) {
      console.error(`Failed to load ${collection}`, error)
    }

    return []
  }
}

/** Latest 20 docs of a collection including drafts, for draft-mode previews. */
async function getDraftPayloadDocs<TSlug extends CollectionSlug<Config>>(
  collection: TSlug,
): Promise<DataFromCollectionSlug<TSlug>[]> {
  // Payload boot and CMS query options are independent, so race them.
  const [payload, cmsQuery] = await Promise.all([getPayload({ config }), getCmsQueryOptions()])
  const docs = await payload.find({
    collection,
    depth: 1,
    limit: 20,
    locale: 'es',
    sort: 'title',
    ...cmsQuery,
  })

  return docs.docs
}
