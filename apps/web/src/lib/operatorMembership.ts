const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function getOperatorId(value: unknown): string | null {
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  if (isRecord(value)) {
    const id = value.id
    if (typeof id === 'number' || typeof id === 'string') return String(id)
  }
  return null
}

/** Check a Payload auth result for platform access or an exact Operator role. */
export function userHasOperatorRole(user: unknown, operatorId: number, roles: readonly string[]) {
  if (!isRecord(user)) return false
  if (user.platformAdmin === true) return true
  if (!Array.isArray(user.tenants)) return false
  const allowedRoles = new Set(roles)

  return user.tenants.some((assignment) => {
    if (!isRecord(assignment)) return false

    const role = assignment.role
    return (
      getOperatorId(assignment.operator) === String(operatorId) &&
      typeof role === 'string' &&
      allowedRoles.has(role)
    )
  })
}
