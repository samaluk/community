import type { Access, Where } from 'payload'

import { getOperatorForPayloadRequest, getStaffAccessScope } from '@/access/roles'

export const publishedOrStaff: Access = async (args) => {
  const operator = await getOperatorForPayloadRequest(args.req)
  if (!operator) return false

  const staffScope = await getStaffAccessScope(args)
  const operatorScope: Where = { operator: { equals: operator.id } }
  const publishedScope: Where = {
    _status: {
      equals: 'published',
    },
  }

  if (staffScope === true) return operatorScope
  if (operator.status === 'suspended') {
    if (staffScope === false) return false
    return { and: [operatorScope, staffScope] }
  }
  if (staffScope === false) return { and: [operatorScope, publishedScope] }
  return {
    or: [{ and: [operatorScope, publishedScope] }, { and: [operatorScope, staffScope] }],
  }
}
