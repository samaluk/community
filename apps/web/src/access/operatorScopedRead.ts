import type { Access, Where } from 'payload'

import { getOperatorForPayloadRequest, getStaffAccessScope } from '@/access/roles'

/** Public data is visible only on its Operator Host; suspended data is staff-only. */
export const operatorScopedRead: Access = async (args) => {
  const operator = await getOperatorForPayloadRequest(args.req)
  if (!operator) return false

  const operatorScope: Where = { operator: { equals: operator.id } }
  if (operator.status === 'active') return operatorScope

  const staffScope = await getStaffAccessScope(args)
  if (staffScope === false) return false
  if (staffScope === true) return operatorScope
  return { and: [operatorScope, staffScope] }
}
