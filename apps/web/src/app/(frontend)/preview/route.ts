import { env } from '@/env'
import config from '@payload-config'
import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload, type Where } from 'payload'

import {
  assertActiveOperator,
  getOperatorForHost,
  OperatorResolutionError,
  type RequestOperator,
} from '@/lib/operator'
import { userHasOperatorRole } from '@/lib/operatorMembership'

type PreviewRequest = {
  collection: string
  locale: 'en' | 'es'
  operatorId: number
  path: string
  slug: string
}

const notAllowed = () => new Response('You are not allowed to preview this page', { status: 404 })
const previewableCollections = ['articles', 'places', 'products'] as const

export async function GET(req: Request) {
  const parsed = parsePreviewRequest(req)
  if ('error' in parsed) return parsed.error

  let operator: RequestOperator
  try {
    operator = await getOperatorForHost(req.headers.get('host'))
    assertActiveOperator(operator)
  } catch (error) {
    if (error instanceof OperatorResolutionError) return notAllowed()
    throw error
  }

  if (operator.id !== parsed.request.operatorId) return notAllowed()

  const payload = await getPayload({ config })
  const user = await authenticatePreviewUser(req, payload)
  if (!user || !canPreviewOperator(user, operator.id)) return notAllowed()

  if (
    parsed.request.collection !== 'home-page' &&
    !isPreviewableCollection(parsed.request.collection)
  ) {
    return notAllowed()
  }

  const where: Where =
    parsed.request.collection === 'home-page'
      ? { operator: { equals: operator.id } }
      : {
          and: [{ operator: { equals: operator.id } }, { slug: { equals: parsed.request.slug } }],
        }
  const docs = await payload.find({
    collection: parsed.request.collection,
    depth: 0,
    draft: true,
    limit: 1,
    locale: parsed.request.locale,
    overrideAccess: true,
    where,
  })
  if (docs.docs.length === 0) return notAllowed()

  const draft = await draftMode()
  draft.enable()
  return redirect(parsed.request.path)
}

/** Outcome of preview param validation and secret check. */
type ParsedPreviewRequest = { error: Response } | { request: PreviewRequest }

/** Validates the shared secret and binds the preview path to a single document. */
function parsePreviewRequest(req: Request): ParsedPreviewRequest {
  const url = new URL(req.url)
  const request = asPreviewRequest({
    path: url.searchParams.get('path'),
    collection: url.searchParams.get('collection'),
    operatorId: url.searchParams.get('operatorId'),
    slug: url.searchParams.get('slug'),
  })

  if (!request) return { error: new Response('Insufficient search params', { status: 404 }) }
  if (url.searchParams.get('previewSecret') !== env.PREVIEW_SECRET) {
    return { error: notAllowed() }
  }

  const target = new URL(request.path, url.origin)
  const targetLocale = target.searchParams.get('locale')
  if (
    target.origin !== url.origin ||
    target.pathname !== getExpectedPreviewPath(request) ||
    (targetLocale !== null && targetLocale !== 'en') ||
    (request.collection === 'home-page' && request.slug !== 'home-page')
  ) {
    return { error: notAllowed() }
  }

  request.locale = targetLocale === 'en' ? 'en' : 'es'
  return { request }
}

function asPreviewRequest(raw: {
  collection: string | null
  operatorId: string | null
  path: string | null
  slug: string | null
}): PreviewRequest | null {
  const { collection, path, slug } = raw
  const operatorId = Number(raw.operatorId)

  if (
    !path ||
    !collection ||
    !slug ||
    !Number.isSafeInteger(operatorId) ||
    operatorId < 1 ||
    slug.includes('/') ||
    slug.includes('\\')
  ) {
    return null
  }

  return { collection, locale: 'es', operatorId, path, slug }
}

function getExpectedPreviewPath(request: PreviewRequest) {
  if (request.collection === 'home-page') return '/'
  if (!isPreviewableCollection(request.collection)) return ''
  return `/${request.collection}/${request.slug}`
}

function isPreviewableCollection(
  collection: string,
): collection is (typeof previewableCollections)[number] {
  return collection === 'articles' || collection === 'places' || collection === 'products'
}

async function authenticatePreviewUser(
  req: Request,
  payload: Awaited<ReturnType<typeof getPayload>>,
): Promise<unknown> {
  try {
    const authenticated = await payload.auth({ headers: req.headers })
    const value = authenticated && 'user' in authenticated ? authenticated.user : authenticated
    return value && typeof value === 'object' ? value : null
  } catch (error) {
    payload.logger.error({ err: error }, 'Error verifying token for live preview')
    return null
  }
}

const canPreviewOperator = (user: unknown, operatorId: number) =>
  userHasOperatorRole(user, operatorId, ['admin', 'editor'])
