import config from '@payload-config'
import { cacheLife, cacheTag } from 'next/cache'
import { draftMode } from 'next/headers'
import { getPayload } from 'payload'

import { getCmsQueryOptions, getPublishedCmsQueryOptions } from '@/lib/cmsQuery'
import { assertActiveOperator, getRequestOperator } from '@/lib/operator'
import { isPayloadUnavailableError } from '@/lib/payloadUnavailableError'
import type { SiteSetting } from '@/payload-types'

export type PublicSiteSettings = Omit<SiteSetting, 'operator'>

export const DEFAULT_SITE_SETTINGS: PublicSiteSettings = {
  id: 0,
  brandName: 'Community',
  siteDescription: 'A platform for community connection and shared knowledge.',
  defaultLocale: 'en',
  lang: 'en',
  memberIdentifierType: 'generic',
  createdAt: '',
  updatedAt: '',
}

async function fetchSiteSettings(options: {
  draft: boolean
  operatorId: number
  operatorDomain: string
  overrideAccess: boolean
}): Promise<PublicSiteSettings> {
  try {
    const payload = await getPayload({ config })
    const { operatorId, operatorDomain, ...queryOptions } = options
    const publicQuery = queryOptions.draft
      ? {}
      : await getPublishedCmsQueryOptions(payload, operatorDomain)
    const settings = await payload.find({
      collection: 'site-settings',
      depth: 1,
      limit: 1,
      ...queryOptions,
      ...publicQuery,
      where: { operator: { equals: operatorId } },
    })

    return {
      ...DEFAULT_SITE_SETTINGS,
      ...settings.docs[0],
    }
  } catch (error) {
    if (!isPayloadUnavailableError(error)) {
      console.error('Failed to load site settings', error)
    }

    return DEFAULT_SITE_SETTINGS
  }
}

async function getPublishedSiteSettings(
  operatorId: number,
  operatorDomain: string,
): Promise<PublicSiteSettings> {
  'use cache'
  cacheLife('publicContent')
  cacheTag(`site-settings:${operatorId}`)

  return fetchSiteSettings({ draft: false, operatorId, operatorDomain, overrideAccess: false })
}

export async function getSiteSettings(): Promise<PublicSiteSettings> {
  const operator = assertActiveOperator(await getRequestOperator())
  try {
    const { isEnabled: draft } = await draftMode()
    if (!draft) {
      return await getPublishedSiteSettings(operator.id, operator.domain)
    }

    const cmsQuery = await getCmsQueryOptions()

    if (!cmsQuery.draft) {
      return await getPublishedSiteSettings(operator.id, operator.domain)
    }

    return await fetchSiteSettings({
      ...cmsQuery,
      operatorId: operator.id,
      operatorDomain: operator.domain,
    })
  } catch {
    return await getPublishedSiteSettings(operator.id, operator.domain)
  }
}
