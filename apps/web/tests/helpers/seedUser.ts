import { getPayload } from 'payload'
import config from '../../src/payload.config.js'
import { getTestOperator } from '../../scripts/getTestOperator.js'

export const testUser = {
  email: 'dev@payloadcms.com',
  password: 'test',
}

export type TestUserFixture = {
  id: number
  operatorId: number
}

/**
 * Seeds a test user for e2e admin tests.
 */
export async function seedTestUser(): Promise<TestUserFixture> {
  const payload = await getPayload({ config })

  // Delete existing test user if any
  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })

  // Create fresh test user
  const operator = await getTestOperator(payload)
  const user = await payload.create({
    collection: 'users',
    data: {
      ...testUser,
      tenants: [{ operator: operator.id, role: 'admin' }],
    },
    overrideAccess: true,
  })

  return { id: user.id, operatorId: operator.id }
}

/**
 * Cleans up test user after tests
 */
export async function cleanupTestUser(userId?: number): Promise<void> {
  const payload = await getPayload({ config })

  if (userId !== undefined) {
    await payload.delete({ collection: 'users', id: userId, overrideAccess: true })
    return
  }

  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })
}
