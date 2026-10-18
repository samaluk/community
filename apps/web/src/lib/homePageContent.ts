import config from '@payload-config'
import { cacheLife, cacheTag } from 'next/cache'
import { getPayload, type Payload, type PayloadRequest } from 'payload'

import { getCmsQueryOptions, getPublishedCmsQueryOptions } from '@/lib/cmsQuery'
import { isPayloadUnavailableError } from '@/lib/payloadUnavailableError'
import type { HomePage as HomePageGlobal } from '@/payload-types'

type HomePageQueryOptions = {
  draft: boolean
  overrideAccess: boolean
  req?: Partial<PayloadRequest>
}

async function findHomePageContent(
  payload: Payload,
  operatorId: number,
  queryOptions: HomePageQueryOptions,
): Promise<HomePageGlobal | null> {
  const result = await payload.find({
    collection: 'home-page',
    depth: 1,
    limit: 1,
    ...queryOptions,
    where: {
      and: [
        { operator: { equals: operatorId } },
        ...(queryOptions.draft ? [] : [{ _status: { equals: 'published' as const } }]),
      ],
    },
  })

  return result.docs[0] ?? null
}

function logHomePageFailure(error: unknown) {
  if (!isPayloadUnavailableError(error)) {
    console.error('Failed to load home page content', error)
  }
}

export async function getPublishedHomePageContent(
  operatorId: number,
  operatorDomain: string,
): Promise<HomePageGlobal | null> {
  'use cache'
  cacheLife('publicContent')
  cacheTag(`home-page:${operatorId}`)

  try {
    const payload = await getPayload({ config })
    const queryOptions = await getPublishedCmsQueryOptions(payload, operatorDomain)
    return await findHomePageContent(payload, operatorId, queryOptions)
  } catch (error) {
    logHomePageFailure(error)
    return null
  }
}

export async function getHomePageContent(
  operatorId: number,
  operatorDomain: string,
  draft: boolean,
): Promise<HomePageGlobal | null> {
  if (!draft) return getPublishedHomePageContent(operatorId, operatorDomain)

  try {
    const queryOptions = await getCmsQueryOptions()
    if (!queryOptions.draft) return getPublishedHomePageContent(operatorId, operatorDomain)

    const payload = await getPayload({ config })
    return await findHomePageContent(payload, operatorId, queryOptions)
  } catch (error) {
    logHomePageFailure(error)
    return null
  }
}
