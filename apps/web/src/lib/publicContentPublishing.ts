import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
} from 'payload'

import { publishedOrStaff } from '@/access/publishedOrStaff'
import {
  ensureLexicalTargetsMatchOperator,
  ensureRequestHostOperator,
  isEditorOrAdmin,
  isVersionEditorOrAdmin,
} from '@/access/roles'
import { env } from '@/env'
import {
  getPublicContentCollectionCacheTag,
  getPublicContentDocCacheTag,
  type PublicContentCollection,
} from '@/lib/publicContentCache'
import { buildPreviewUrl, draftVersions, getOperatorId } from '@/lib/preview'

export type { PublicContentCollection } from '@/lib/publicContentCache'

type PublicContentPublishingTarget = {
  collection: PublicContentCollection
  detailPrefix: string
  listingPath: string
}

export type SlugData = {
  slug?: unknown
  operator?: unknown
}

export type MaybePublicDoc = SlugData & {
  _status?: unknown
}

export type RevalidatePath = (path: string) => void
export type RevalidateTag = (tag: string, profile: { expire: number }) => void

const publicContentTargets = {
  articles: {
    collection: 'articles',
    detailPrefix: '/articles',
    listingPath: '/articles',
  },
  places: {
    collection: 'places',
    detailPrefix: '/places',
    listingPath: '/places',
  },
  products: {
    collection: 'products',
    detailPrefix: '/products',
    listingPath: '/products',
  },
} satisfies Record<PublicContentCollection, PublicContentPublishingTarget>

const globalPublicPaths = ['/', '/places', '/articles', '/products', '/privacy']

export function getPublicContentPublishing(collection: PublicContentCollection) {
  return {
    access: {
      create: isEditorOrAdmin,
      delete: isEditorOrAdmin,
      read: publishedOrStaff,
      readVersions: isVersionEditorOrAdmin,
      update: isEditorOrAdmin,
    },
    admin: {
      livePreview: {
        url: ({ data, locale }) => getPublicContentPreviewUrl({ collection, data, locale }),
      },
      preview: (data, { locale }) => getPublicContentPreviewUrl({ collection, data, locale }),
    },
    versions: draftVersions,
    indexes: [{ fields: ['operator', 'slug'], unique: true }],
    hooks: {
      afterChange: [revalidatePublicContentChange(collection)],
      afterDelete: [revalidatePublicContentDelete(collection)],
      beforeValidate: [ensureRequestHostOperator, ensureLexicalTargetsMatchOperator],
    },
  } satisfies Pick<CollectionConfig, 'access' | 'admin' | 'hooks' | 'versions' | 'indexes'>
}

/**
 * Pure preview-URL projection shared by Payload's admin preview and live
 * preview callbacks. Returns null when the doc has no usable slug.
 */
export function getPublicContentPreviewUrl({
  collection,
  data,
  locale,
}: {
  collection: PublicContentCollection
  data?: { slug?: unknown; operator?: unknown } | null
  locale?: unknown
}): string | null {
  const slug = typeof data?.slug === 'string' ? data.slug : ''
  const operatorId = getOperatorId(data?.operator)

  if (!slug || operatorId === null) return null

  return buildPreviewUrl({
    collection,
    operatorId,
    locale,
    path: getPublicContentDetailPath(collection, slug),
    slug,
  })
}

function getPublicContentListingPath(collection: PublicContentCollection) {
  return publicContentTargets[collection].listingPath
}

function getPublicContentDetailPath(collection: PublicContentCollection, slug: string) {
  return `${publicContentTargets[collection].detailPrefix}/${slug}`
}

export function getPublicContentRevalidationPaths({
  collection,
  doc,
  previousDoc,
}: {
  collection: PublicContentCollection
  doc?: MaybePublicDoc | null
  previousDoc?: MaybePublicDoc | null
}) {
  const paths = new Set<string>([getPublicContentListingPath(collection)])

  for (const slug of [getSlug(doc), getSlug(previousDoc)]) {
    if (slug) {
      paths.add(getPublicContentDetailPath(collection, slug))
    }
  }

  return Array.from(paths)
}

export async function revalidateGlobalPublicContent(
  operatorId?: number | null,
  revalidate?: RevalidatePath,
  revalidateTag?: RevalidateTag,
) {
  await revalidatePublicPaths(globalPublicPaths, revalidate)

  if (operatorId === undefined || operatorId === null) return

  await revalidateTags([`home-page:${operatorId}`, `site-settings:${operatorId}`], revalidateTag)
}

export async function revalidatePublicContentDoc(args: {
  collection: PublicContentCollection
  doc?: MaybePublicDoc | null
  previousDoc?: MaybePublicDoc | null
  revalidate?: RevalidatePath
  revalidateTag?: RevalidateTag
}) {
  if (!shouldRevalidatePublicContent(args.doc, args.previousDoc)) return

  await revalidatePublicPaths(getPublicContentRevalidationPaths(args), args.revalidate)
  await revalidatePublicContentTags(
    args.collection,
    [args.doc, args.previousDoc],
    args.revalidateTag,
  )
}

export async function revalidateDeletedPublicContentDoc(args: {
  collection: PublicContentCollection
  doc?: MaybePublicDoc | null
  revalidate?: RevalidatePath
  revalidateTag?: RevalidateTag
}) {
  await revalidatePublicContentDoc(args)
}

function revalidatePublicContentChange(
  collection: PublicContentCollection,
): CollectionAfterChangeHook {
  return async ({ doc, previousDoc }) =>
    revalidatePublicContentDoc({
      collection,
      // oxlint-disable-next-line typescript/no-unsafe-assignment
      doc,
      // oxlint-disable-next-line typescript/no-unsafe-assignment
      previousDoc,
    })
}

function revalidatePublicContentDelete(
  collection: PublicContentCollection,
): CollectionAfterDeleteHook {
  return async ({ doc }) =>
    revalidateDeletedPublicContentDoc({
      collection,
      // oxlint-disable-next-line typescript/no-unsafe-assignment
      doc,
    })
}

function shouldRevalidatePublicContent(
  doc?: MaybePublicDoc | null,
  previousDoc?: MaybePublicDoc | null,
) {
  return isPublished(doc) || isPublished(previousDoc)
}

async function loadNextCache() {
  try {
    return await import('next/cache')
  } catch (error) {
    // Standalone Payload scripts have no Next cache runtime; requests inside
    // Next must surface a load failure instead of silently skipping revalidation.
    if (env.NEXT_RUNTIME) throw error
    console.error(`Failed to load next/cache outside Next runtime`, error)
    return null
  }
}

async function revalidatePublicPaths(paths: string[], revalidate?: RevalidatePath) {
  const revalidatePath = revalidate ?? (await loadNextCache())?.revalidatePath

  if (!revalidatePath) return

  await revalidateEach(
    paths,
    revalidatePath,
    (path) => `Failed to revalidate public path "${path}"`,
  )
}

async function revalidatePublicContentTags(
  collection: PublicContentCollection,
  docs: Array<MaybePublicDoc | null | undefined>,
  revalidate?: RevalidateTag,
) {
  const tags = Array.from(
    new Set(
      docs.flatMap((doc) => {
        const operatorId = getOperatorId(doc?.operator)
        if (operatorId === null) return []
        const docTags = [getPublicContentCollectionCacheTag(operatorId, collection)]
        const slug = getSlug(doc)
        if (slug) docTags.push(getPublicContentDocCacheTag(operatorId, collection, slug))
        return docTags
      }),
    ),
  )
  await revalidateTags(tags, revalidate)
}

async function revalidateTags(tags: string[], revalidate?: RevalidateTag) {
  const revalidateTag = revalidate ?? (await loadNextCache())?.revalidateTag

  if (!revalidateTag) return

  await revalidateEach(
    tags,
    (tag) => revalidateTag(tag, { expire: 0 }),
    (tag) => `Failed to revalidate public cache tag "${tag}"`,
  )
}

async function revalidateEach<Value>(
  values: Value[],
  revalidate: (value: Value) => void,
  getFailureMessage: (value: Value) => string,
) {
  for (const value of values) {
    try {
      revalidate(value)
    } catch (error) {
      if (env.NEXT_RUNTIME) throw error
      console.error(getFailureMessage(value), error)
    }
  }
}

function getSlug(doc?: MaybePublicDoc | null) {
  return typeof doc?.slug === 'string' && doc.slug.length > 0 ? doc.slug : undefined
}

function isPublished(doc?: MaybePublicDoc | null) {
  return doc?._status === 'published'
}
