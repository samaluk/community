import { getTenantFromCookie } from '@payloadcms/plugin-multi-tenant/utilities'
import { normalizeOperatorHost } from '@/lib/operatorHost'
import { APIError } from 'payload'
import type {
  Access,
  AccessArgs,
  AccessResult,
  CollectionBeforeValidateHook,
  FieldAccess,
  PayloadRequest,
} from 'payload'

type StaffRole = 'admin' | 'editor' | 'validation-manager'

type TenantMembership = {
  operator?: number | string | { id?: number | string } | null
  role?: StaffRole | null
}

type UserWithTenants = {
  id?: number | string
  platformAdmin?: boolean | null
  tenants?: TenantMembership[] | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const asUser = (user: unknown): UserWithTenants | null => {
  if (!isRecord(user)) return null
  const id = user.id
  const platformAdmin = user.platformAdmin
  const tenantRows = user.tenants
  const tenants = Array.isArray(tenantRows)
    ? tenantRows.flatMap((row): TenantMembership[] => {
        if (!isRecord(row)) return []
        const operator = row.operator
        const role = row.role
        if (role !== 'admin' && role !== 'editor' && role !== 'validation-manager') return []
        const operatorID = isRecord(operator) ? operator.id : operator
        if (typeof operatorID !== 'number' && typeof operatorID !== 'string') return []
        return [{ operator: isRecord(operator) ? { id: operatorID } : operatorID, role }]
      })
    : undefined

  return {
    id: typeof id === 'number' || typeof id === 'string' ? id : undefined,
    platformAdmin: typeof platformAdmin === 'boolean' ? platformAdmin : undefined,
    tenants,
  }
}

export const getRecordField = (value: unknown, field: string): unknown =>
  isRecord(value) && field in value ? value[field] : undefined

export const isPlatformAdmin = ({ req }: AccessArgs) => asUser(req.user)?.platformAdmin === true

export const isPlatformAdminField: FieldAccess = ({ req }) =>
  asUser(req.user)?.platformAdmin === true

export const operatorsReadAccess: Access = ({ req }) => {
  const user = asUser(req.user)
  if (user?.platformAdmin === true) return true
  if (!user) return false

  const operatorIDs = Array.from(
    new Set(getOperatorIDsForRoles(req.user, ['admin', 'editor', 'validation-manager'])),
  )
  return operatorIDs.length > 0 ? { id: { in: operatorIDs } } : false
}

export const getRelationshipID = (value: unknown): number | string | null => {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (isRecord(value) && 'id' in value) {
    const id = value.id
    return typeof id === 'number' || typeof id === 'string' ? id : null
  }
  return null
}

const getOperatorIDsForRoles = (user: unknown, roles: StaffRole[]) => {
  const memberships = asUser(user)?.tenants ?? []
  const allowedRoles = new Set(roles)
  return memberships.flatMap((membership) => {
    const operatorID = getRelationshipID(membership.operator)
    return operatorID !== null && membership.role && allowedRoles.has(membership.role)
      ? [operatorID]
      : []
  })
}

export async function getOperatorForPayloadRequest(
  req: PayloadRequest,
  explicitOperatorID?: number | string,
) {
  if (req.payloadAPI === 'local' && explicitOperatorID !== undefined) {
    return req.payload.findByID({
      collection: 'operators',
      depth: 0,
      id: explicitOperatorID,
      overrideAccess: true,
      select: { domain: true, status: true },
    })
  }

  const domain = normalizeOperatorHost(req.headers.get('host'))
  if (!domain) return null

  const result = await req.payload.find({
    collection: 'operators',
    depth: 0,
    limit: 2,
    overrideAccess: true,
    select: {
      domain: true,
      status: true,
    },
    where: { domain: { equals: domain } },
  })
  if (result.docs.length !== 1) return null

  const [operator] = result.docs
  return operator.status === 'active' || operator.status === 'suspended' ? operator : null
}

const roleAccess = async (
  args: AccessArgs,
  roles: StaffRole[],
  version = false,
): Promise<AccessResult> => {
  const hostOperator = await getOperatorForPayloadRequest(args.req)
  if (!hostOperator) return false

  const selectedOperator = getTenantFromCookie(args.req.headers, 'number')
  if (selectedOperator === null || String(selectedOperator) !== String(hostOperator.id))
    return false

  const operatorIDs = isPlatformAdmin(args)
    ? [hostOperator.id]
    : getOperatorIDsForRoles(args.req.user, roles)
  if (!operatorIDs.some((id) => String(id) === String(hostOperator.id))) return false

  // On create, scope the submitted relationship itself. The admin UI also
  // calls create access before it has data, so that preflight only checks the
  // user's memberships; actual create requests must name an authorized one.
  if (
    args.isReadingStaticFile !== true &&
    args.id === undefined &&
    args.data &&
    typeof args.data === 'object'
  ) {
    const data: unknown = args.data
    if (!isRecord(data) || !('operator' in data)) return false
    const operatorID = getRelationshipID(getRecordField(data, 'operator'))
    return operatorID !== null && String(operatorID) === String(hostOperator.id)
  }

  return {
    and: [
      { [version ? 'version.operator' : 'operator']: { equals: hostOperator.id } },
      { [version ? 'version.operator' : 'operator']: { in: operatorIDs } },
    ],
  }
}

export const isAdmin: Access = (args) => roleAccess(args, ['admin'])

export const isEditorOrAdmin: Access = (args) => roleAccess(args, ['admin', 'editor'])

export const isVersionEditorOrAdmin: Access = (args) => roleAccess(args, ['admin', 'editor'], true)

export const isValidationManagerOrAdmin: Access = (args) =>
  roleAccess(args, ['admin', 'validation-manager'])

export const isVersionValidationManagerOrAdmin: Access = (args) =>
  roleAccess(args, ['admin', 'validation-manager'], true)

export const isStaff: Access = (args) => roleAccess(args, ['admin', 'editor', 'validation-manager'])

export const getStaffAccessScope = (args: AccessArgs): Promise<AccessResult> =>
  roleAccess(args, ['admin', 'editor', 'validation-manager'])

export const ownerOrAdmin: Access = ({ req: { user } }) => {
  if (!user) return false
  if (asUser(user)?.platformAdmin === true) return true
  return { id: { equals: user.id } }
}

export const ensureRequestHostOperator: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const dataOperator = getRecordField(data, 'operator')
  const currentOperator = getRecordField(originalDoc, 'operator')
  const operatorId = getRelationshipID(dataOperator ?? currentOperator)
  const hostOperator =
    req.payloadAPI === 'local' && operatorId !== null
      ? await getOperatorForPayloadRequest(req, operatorId)
      : await getOperatorForPayloadRequest(req)

  if (!hostOperator || operatorId === null || String(operatorId) !== String(hostOperator.id)) {
    throw new APIError('The assigned operator must match this request host.', 400)
  }

  return data
}

const tenantOwnedCollections = [
  'articles',
  'places',
  'products',
  'memberships',
  'media',
  'home-page',
  'site-settings',
] as const

type TenantOwnedCollection = (typeof tenantOwnedCollections)[number]

const isTenantOwnedCollection = (value: unknown): value is TenantOwnedCollection =>
  typeof value === 'string' && tenantOwnedCollections.some((slug) => slug === value)

type LexicalReference = {
  collection: TenantOwnedCollection
  id: number | string
}

const findLexicalReferences = (value: unknown, references: LexicalReference[]) => {
  if (Array.isArray(value)) {
    value.forEach((item) => findLexicalReferences(item, references))
    return
  }

  if (!isRecord(value)) return

  const node = value
  if (
    (node.type === 'relationship' || node.type === 'upload') &&
    isTenantOwnedCollection(node.relationTo)
  ) {
    const id = getRelationshipID(node.value)
    if (id !== null) references.push({ collection: node.relationTo, id })
  }

  Object.values(value).forEach((child) => findLexicalReferences(child, references))
}

export const ensureLexicalTargetsMatchOperator: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const dataOperator = getRecordField(data, 'operator')
  const originalOperator = getRecordField(originalDoc, 'operator')
  const operatorID = getRelationshipID(dataOperator ?? originalOperator)
  if (operatorID === null) throw new APIError('An Operator is required.', 400)

  const references: LexicalReference[] = []
  const body = getRecordField(data, 'body') ?? getRecordField(originalDoc, 'body')
  const status = getRecordField(data, '_status') ?? getRecordField(originalDoc, '_status')
  findLexicalReferences(body, references)
  const uniqueReferences = new Map(
    references.map((reference) => [`${reference.collection}:${reference.id}`, reference]),
  )

  await Promise.all(
    Array.from(uniqueReferences.values(), async (reference) => {
      const target = await req.payload.findByID({
        collection: reference.collection,
        depth: 0,
        id: reference.id,
        overrideAccess: true,
        select: { _status: true, operator: true },
      })
      if (String(getRelationshipID(target.operator)) !== String(operatorID)) {
        throw new APIError('Rich text references must belong to the same operator.', 400)
      }
      const targetStatus = getRecordField(target, '_status')
      if (status === 'published' && targetStatus && targetStatus !== 'published') {
        throw new APIError('Published rich text cannot reference draft content.', 400)
      }
    }),
  )

  return data
}
