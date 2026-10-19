import config from '@payload-config'
import { getTenantFromCookie } from '@payloadcms/plugin-multi-tenant/utilities'
import { draftMode, headers } from 'next/headers'
import { createLocalReq, getPayload, type Payload } from 'payload'

import { assertActiveOperator, getOperatorForHost, OperatorResolutionError } from '@/lib/operator'
import { userHasOperatorRole } from '@/lib/operatorMembership'

export async function getCmsQueryOptions() {
  const { isEnabled: draft } = await draftMode()
  if (!draft) return { draft: false, overrideAccess: false } as const

  const draftRequest = await getDraftReadRequest()
  if (!draftRequest) return { draft: false, overrideAccess: false } as const

  return {
    draft: true,
    overrideAccess: false,
    req: draftRequest,
  } as const
}

async function getDraftReadRequest() {
  const requestHeaders = await headers()
  let operator

  try {
    operator = assertActiveOperator(await getOperatorForHost(requestHeaders.get('host')))
  } catch (error) {
    if (error instanceof OperatorResolutionError) return null
    throw error
  }

  const payload = await getPayload({ config })
  const auth = await payload.auth({ headers: requestHeaders })
  const userValue = auth && 'user' in auth ? auth.user : auth
  const selectedOperator = getTenantFromCookie(requestHeaders, 'number')
  if (selectedOperator === null || String(selectedOperator) !== String(operator.id)) return null
  if (!userHasOperatorRole(userValue, operator.id, ['admin', 'editor'])) return null

  return createLocalReq({ req: { headers: requestHeaders }, user: userValue ?? undefined }, payload)
}

export async function getPublishedCmsQueryOptions(payload: Payload, operatorDomain: string) {
  const req = await createLocalReq(
    {
      req: { headers: new Headers({ host: operatorDomain }) },
    },
    payload,
  )

  return {
    draft: false,
    overrideAccess: false,
    req,
  } as const
}
