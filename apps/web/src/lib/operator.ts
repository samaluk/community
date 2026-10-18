import config from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

import { normalizeOperatorHost } from '@/lib/operatorHost'

export { normalizeOperatorHost } from '@/lib/operatorHost'

/** The fields needed to identify and route an Operator. */
export type RequestOperator = {
  id: number
  name: string
  domain: string
  status: 'active' | 'suspended'
}

export class OperatorResolutionError extends Error {
  constructor(message = 'Operator not found') {
    super(message)
    this.name = 'OperatorResolutionError'
  }
}

/** Resolve the Operator assigned to a canonical Host, retaining suspended rows for staff recovery. */
export async function getOperatorForHost(hostHeader: string | null): Promise<RequestOperator> {
  const domain = normalizeOperatorHost(hostHeader)
  if (!domain) throw new OperatorResolutionError()

  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'operators',
    depth: 0,
    limit: 2,
    overrideAccess: true,
    select: {
      name: true,
      domain: true,
      status: true,
    },
    where: { domain: { equals: domain } },
  })

  if (result.docs.length !== 1) throw new OperatorResolutionError()

  const operator = result.docs[0]
  if (operator.status !== 'active' && operator.status !== 'suspended') {
    throw new OperatorResolutionError()
  }

  return {
    id: operator.id,
    name: operator.name,
    domain: operator.domain,
    status: operator.status,
  }
}

/** Resolve the current request using Host only, outside all cached scopes. */
export async function getRequestOperator(): Promise<RequestOperator> {
  return getOperatorForHost((await headers()).get('host'))
}

/** Public routes must check this before rendering or querying content. */
export function assertActiveOperator(operator: RequestOperator): RequestOperator {
  if (operator.status !== 'active') throw new OperatorResolutionError()
  return operator
}
