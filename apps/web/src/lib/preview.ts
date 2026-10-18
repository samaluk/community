import { env } from '@/env'

export type PreviewTarget = {
  collection: string
  operatorId: number
  path: string
  slug: string
  locale?: unknown
}

function normalizeLocale(locale: unknown) {
  return typeof locale === 'string' ? locale : null
}

function buildPreviewPath(path: string, locale?: unknown) {
  const normalizedLocale = normalizeLocale(locale)
  if (!normalizedLocale || normalizedLocale === 'es') {
    return path
  }

  const url = new URL(path, 'http://localhost')
  url.searchParams.set('locale', normalizedLocale)
  return `${url.pathname}${url.search}`
}

export function buildPreviewUrl({ collection, operatorId, path, slug, locale }: PreviewTarget) {
  const params = new URLSearchParams({
    collection,
    operatorId: String(operatorId),
    path: buildPreviewPath(path, normalizeLocale(locale)),
    previewSecret: env.PREVIEW_SECRET,
    slug,
  })

  return `/preview?${params.toString()}`
}

/** Extract a Payload relationship ID without relying on its populated shape. */
export function getOperatorId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const id = Number(value)
    return Number.isSafeInteger(id) && id > 0 ? id : null
  }
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return getOperatorId(value.id)
  }
  return null
}

export const draftVersions = {
  drafts: {
    autosave: {
      interval: 375,
    },
  },
} as const
