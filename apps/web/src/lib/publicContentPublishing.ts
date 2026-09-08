import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
} from 'payload'

import { publishedOrStaff } from '@/access/publishedOrStaff'
import { isEditorOrAdmin } from '@/access/roles'
import { env } from '@/env'
import {
  getPublicContentCollectionCacheTag,
  getPublicContentDocCacheTag,
  type PublicContentCollection,
} from '@/lib/publicContentCache'
import { buildPreviewUrl, draftVersions } from '@/lib/preview'

export type { PublicContentCollection } from '@/lib/publicContentCache'

type PublicContentPublishingTarget = {
  collection: PublicContentCollection
  detailPrefix: string
  listingPath: string
}

export type SlugData = {
  slug?: unknown
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
      update: isEditorOrAdmin,
    },
    admin: {
      livePreview: {
        url: ({ data, locale }) => getPublicContentPreviewUrl({ collection, data, locale }),
      },
      preview: (data, { locale }) => getPublicContentPreviewUrl({ collection, data, locale }),
    },
    hooks: {
      afterChange: [revalidatePublicContentChange(collection)],
      afterDelete: [revalidatePublicContentDelete(collection)],
    },
    versions: draftVersions,
  } satisfies Pick<CollectionConfig, 'access' | 'admin' | 'hooks' | 'versions'>
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
  data?: { slug?: unknown } | null
  locale?: unknown
}): string | null {
  const slug = typeof data?.slug === 'string' ? data.slug : ''

  if (!slug) return null

  return buildPreviewUrl({
    collection,
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

export async function revalidateGlobalPublicContent(revalidate?: RevalidatePath) {
  await revalidatePublicPaths(globalPublicPaths, revalidate)
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
    [getSlug(args.doc), getSlug(args.previousDoc)],
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

async function revalidatePublicPaths(paths: string[], revalidate?: RevalidatePath) {
  const revalidatePath =
    revalidate ??
    (await import('next/cache')
      .then(({ revalidatePath: nextRevalidatePath }) => nextRevalidatePath)
      .catch((error) => {
        // `next/cache` resolves only inside Next's runtime. Standalone
        // Payload scripts (for example, the Playwright fixture seed) run
        // outside it; revalidation is best-effort there. Inside Next, a
        // resolution failure must stay visible instead of silently disabling
        // public-path revalidation, so rethrow.
        if (env.NEXT_RUNTIME) throw error
        console.error(`Failed to load next/cache outside Next runtime`, error)
        return null
      }))

  if (!revalidatePath) return

  for (const path of paths) {
    try {
      revalidatePath(path)
    } catch (error) {
      if (env.NEXT_RUNTIME) throw error
      console.error(`Failed to revalidate public path "${path}"`, error)
    }
  }
}

async function revalidatePublicContentTags(
  collection: PublicContentCollection,
  slugs: Array<string | undefined>,
  revalidate?: RevalidateTag,
) {
  const tags = Array.from(
    new Set([
      getPublicContentCollectionCacheTag(collection),
      ...slugs
        .filter((slug): slug is string => Boolean(slug))
        .map((slug) => getPublicContentDocCacheTag(collection, slug)),
    ]),
  )
  const revalidateTag =
    revalidate ??
    (await import('next/cache')
      .then(({ revalidateTag: nextRevalidateTag }) => nextRevalidateTag)
      .catch((error) => {
        // Standalone Payload scripts do not have Next's cache runtime. Hooks
        // remain best-effort there, while real Next requests surface failures.
        if (env.NEXT_RUNTIME) throw error
        console.error(`Failed to load next/cache outside Next runtime`, error)
        return null
      }))

  if (!revalidateTag) return

  for (const tag of tags) {
    try {
      revalidateTag(tag, { expire: 0 })
    } catch (error) {
      if (env.NEXT_RUNTIME) throw error
      console.error(`Failed to revalidate public cache tag "${tag}"`, error)
    }
  }
}

function getSlug(doc?: MaybePublicDoc | null) {
  return typeof doc?.slug === 'string' && doc.slug.length > 0 ? doc.slug : undefined
}

function isPublished(doc?: MaybePublicDoc | null) {
  return doc?._status === 'published'
}
