import { tenantField } from '@payloadcms/plugin-multi-tenant/fields'
import type { CollectionConfig, PayloadRequest, TypedUser } from 'payload'

import { getOperatorForPayloadRequest, getRelationshipID } from '@/access/roles'

const userHasAccessToAllTenants = (user: TypedUser) =>
  Boolean(user && typeof user === 'object' && 'platformAdmin' in user && user.platformAdmin)

const validateLocalOperator = async (
  operatorID: number | string,
  req: PayloadRequest,
): Promise<true> => {
  await req.payload.findByID({
    collection: 'operators',
    depth: 0,
    id: operatorID,
    overrideAccess: true,
    select: { status: true },
  })
  return true
}

const validateHostOperator = async (
  operatorID: number | string,
  req: PayloadRequest,
): Promise<true | string> => {
  const hostOperator = await getOperatorForPayloadRequest(req)
  return hostOperator !== null && String(hostOperator.id) === String(operatorID)
    ? true
    : 'The assigned operator must match this request host.'
}

const validateOperatorAssignment = async (value: unknown, req: PayloadRequest) => {
  const operatorID = getRelationshipID(value)
  if (operatorID === null) return 'An Operator is required.'
  if (req.payloadAPI === 'local') return validateLocalOperator(operatorID, req)
  return validateHostOperator(operatorID, req)
}

const operatorField = (unique = false) => ({
  ...tenantField({
    adminUsersSlug: 'users',
    isAutosaveEnabled: true,
    name: 'operator',
    tenantsArrayFieldName: 'tenants',
    tenantsArrayTenantFieldName: 'operator',
    tenantsCollectionSlug: 'operators',
    unique,
    userHasAccessToAllTenants,
    overrides: {
      defaultValue: async ({ req }) => (await getOperatorForPayloadRequest(req))?.id ?? null,
      validate: (value: unknown, { req }: { req: PayloadRequest }) =>
        validateOperatorAssignment(value, req),
    },
  }),
  required: true,
})

export const withOperatorField = (
  collection: CollectionConfig,
  unique = false,
): CollectionConfig => ({
  ...collection,
  fields: [operatorField(unique), ...collection.fields],
})
