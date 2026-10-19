import config from '@payload-config'
import { cacheLife, cacheTag } from 'next/cache'
import { draftMode } from 'next/headers'
import { unstable_rethrow } from 'next/navigation'
import { getPayload } from 'payload'
import type { CollectionSlug, DataFromCollectionSlug } from 'payload'
import type { Metadata } from 'next'
import { cache } from 'react'

import { getCmsQueryOptions, getPublishedCmsQueryOptions } from '@/lib/cmsQuery'
import { assertActiveOperator, getRequestOperator } from '@/lib/operator'
import { isPayloadUnavailableError } from '@/lib/payloadUnavailableError'
import {
  getPublicContentCollectionCacheTag,
  getPublicContentDocCacheTag,
  emptyPublicContentSlug,
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
  const operator = assertActiveOperator(await getRequestOperator())
  const [{ isEnabled: draft }, cmsQuery] = await Promise.all([draftMode(), getCmsQueryOptions()])

  return draft && cmsQuery.draft
    ? await getDraftPayloadDocBySlug(collection, slug, operator.id)
    : await getPublishedPayloadDocBySlug(collection, slug, operator.id, operator.domain)
})

/** Draft-mode dispatch for listing routes (see {@link getPayloadDocBySlug}). */
export const getPayloadDocs = cache(async function getPayloadDocs<
  TSlug extends CollectionSlug<Config>,
>(collection: TSlug): Promise<DataFromCollectionSlug<TSlug>[]> {
  const operator = assertActiveOperator(await getRequestOperator())
  const [{ isEnabled: draft }, cmsQuery] = await Promise.all([draftMode(), getCmsQueryOptions()])

  return draft && cmsQuery.draft
    ? await getDraftPayloadDocs(collection, operator.id)
    : await getPublishedPayloadDocs(collection, operator.id, operator.domain)
})

/**
 * Build params for public detail routes. Next requires at least one param
 * with Cache Components enabled. Static generation has no request Host, so
 * it cannot enumerate one operator's slugs safely. The reserved value builds
 * the static shell and resolves through the normal not-found path.
 */
async function getPublishedPayloadStaticParams(
  _collection: PublicContentCollection,
): Promise<Array<{ slug: string }>> {
  return [{ slug: emptyPublicContentSlug }]
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
  operatorId: number,
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
      and: [{ operator: { equals: operatorId } }, { slug: { equals: slug } }],
    },
  })

  return docs.docs[0] ?? null
}

async function getPublishedPayloadDocBySlug<TSlug extends CollectionSlug<Config>>(
  collection: TSlug,
  slug: string,
  operatorId: number,
  operatorDomain: string,
): Promise<DataFromCollectionSlug<TSlug> | null> {
  'use cache'
  cacheLife('publicContent')
  cacheTag(getPublicContentDocCacheTag(operatorId, collection, slug))

  try {
    const payload = await getPayload({ config })
    const publicQuery = await getPublishedCmsQueryOptions(payload, operatorDomain)
    const docs = await payload.find({
      collection,
      depth: 1,
      limit: 1,
      locale: 'es',
      ...publicQuery,
      where: {
        and: [
          { operator: { equals: operatorId } },
          { _status: { equals: 'published' } },
          { slug: { equals: slug } },
        ],
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
  operatorId: number,
  operatorDomain: string,
): Promise<DataFromCollectionSlug<TSlug>[]> {
  'use cache'
  cacheLife('publicContent')
  cacheTag(getPublicContentCollectionCacheTag(operatorId, collection))

  try {
    const payload = await getPayload({ config })
    const publicQuery = await getPublishedCmsQueryOptions(payload, operatorDomain)
    const docs = await payload.find({
      collection,
      depth: 1,
      limit: 20,
      locale: 'es',
      sort: 'title',
      ...publicQuery,
      where: {
        and: [{ operator: { equals: operatorId } }, { _status: { equals: 'published' } }],
      },
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
  operatorId: number,
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
    where: {
      operator: { equals: operatorId },
    },
  })

  return docs.docs
}
