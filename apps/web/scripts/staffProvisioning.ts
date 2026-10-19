type StaffRole = 'admin' | 'editor' | 'validation-manager'

export type StaffUser = {
  id: number
  platformAdmin?: boolean | null
  tenants?: Array<{
    operator: number | { id?: number }
    role?: 'admin' | 'editor' | 'validation-manager' | null
  }> | null
}

export type StaffUserData = {
  email?: string
  password?: string | null
  platformAdmin?: boolean | null
  tenants?: Array<{ operator: number; role: 'admin' | 'editor' | 'validation-manager' }> | null
}

export type StaffProvisioningPort = {
  findUserByEmail(email: string): Promise<StaffUser | null>
  assertOperatorExists(operatorId: number): Promise<void>
  createUser(data: StaffUserData): Promise<void>
  updateUser(id: number, data: StaffUserData): Promise<void>
}

export type StaffProvisioningInput = {
  email: string
  password: string
  operatorId?: string
  role?: string
  grantPlatformAdmin: boolean
  updateExisting: boolean
}

const staffRolesByName: Record<string, StaffRole> = {
  admin: 'admin',
  editor: 'editor',
  'validation-manager': 'validation-manager',
}

function parseStaffRole(value: string | undefined): StaffRole {
  const role = value?.trim() || 'admin'
  const parsed = staffRolesByName[role]

  if (!parsed) {
    throw new Error(`CMS_USER_ROLE must be one of: ${Object.keys(staffRolesByName).join(', ')}`)
  }

  return parsed
}

function parseOperatorId(rawValue: string | undefined): number | undefined {
  const raw = rawValue?.trim()
  if (!raw) return undefined

  const id = Number(raw)
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id <= 0) {
    throw new Error('CMS_OPERATOR_ID must be a positive integer')
  }

  return id
}

export async function provisionStaffUser(
  payload: StaffProvisioningPort,
  input: StaffProvisioningInput,
): Promise<'created' | 'updated'> {
  const email = input.email.trim().toLowerCase()
  if (!email) throw new Error('CMS_USER_EMAIL is required')
  if (!input.password.trim()) throw new Error('CMS_USER_PASSWORD is required')

  const operatorId = parseOperatorId(input.operatorId)
  if (!operatorId && !input.grantPlatformAdmin) {
    throw new Error(
      'Set CMS_OPERATOR_ID for Operator staff or CMS_PLATFORM_ADMIN=true for platform administration',
    )
  }

  const existingUser = await payload.findUserByEmail(email)
  if (existingUser && !input.updateExisting) {
    throw new Error(`User ${email} already exists. Set CMS_USER_UPDATE_EXISTING=true to update it.`)
  }

  const data: StaffUserData = { password: input.password }
  if (input.grantPlatformAdmin) data.platformAdmin = true

  if (operatorId) {
    await payload.assertOperatorExists(operatorId)
    const role = parseStaffRole(input.role)
    const assignments = existingUser?.tenants ?? []
    const otherAssignments = assignments.flatMap((assignment) => {
      const operator = assignment.operator
      const assignedId = operator && typeof operator === 'object' ? operator.id : operator
      if (assignedId === undefined || assignedId === null) return []
      if (String(assignedId) === String(operatorId)) return []
      if (!assignment.role)
        throw new Error('Existing Operator staff assignment is missing its role')
      if (typeof assignedId !== 'number')
        throw new Error('Existing Operator staff assignment has an invalid Operator ID')
      return [{ operator: assignedId, role: assignment.role }]
    })

    data.tenants = [...otherAssignments, { operator: operatorId, role }]
  }

  if (existingUser) {
    await payload.updateUser(existingUser.id, data)
    return 'updated'
  }

  await payload.createUser({ ...data, email })
  return 'created'
}
