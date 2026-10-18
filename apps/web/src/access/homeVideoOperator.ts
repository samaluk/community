import { APIError, type CollectionBeforeValidateHook } from 'payload'

import { getRecordField } from '@/access/roles'
import { getOperatorId } from '@/lib/preview'

/** A home page may only publish media owned by its Operator. */
export const ensureHomeVideoOperator: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const operatorId = getOperatorId(
    getRecordField(data, 'operator') ?? getRecordField(originalDoc, 'operator'),
  )
  const mediaId = getOperatorId(
    getRecordField(data, 'heroVideo') ?? getRecordField(originalDoc, 'heroVideo'),
  )
  if (operatorId === null || mediaId === null) return data

  const media = await req.payload.findByID({
    collection: 'media',
    depth: 0,
    id: mediaId,
    overrideAccess: true,
    req,
    select: { operator: true },
  })

  if (getOperatorId(media.operator) !== operatorId) {
    throw new APIError('The home page video must belong to the same operator.', 400)
  }

  return data
}
