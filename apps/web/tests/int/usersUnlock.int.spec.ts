// @vitest-environment node

import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { POST as payloadRESTPost } from '@/app/(payload)/api/[...slug]/route'
import type { User } from '@/payload-types'

describe('user unlock access integration', () => {
  let payload: Payload
  let fixturePrefix: string
  let operatorId: number
  let operatorDomain: string
  let staffToken: string
  let platformAdminToken: string
  let staff: User
  let target: User

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    fixturePrefix = `unlock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const operator = await payload.create({
      collection: 'operators',
      draft: false,
      data: {
        domain: `${fixturePrefix}.example.test`,
        name: fixturePrefix,
        status: 'active',
      },
      overrideAccess: true,
    })
    operatorId = operator.id
    operatorDomain = operator.domain

    const staffPassword = 'unlock-integration-test-password'
    staff = await payload.create({
      collection: 'users',
      data: {
        email: `${fixturePrefix}-editor@example.test`,
        password: staffPassword,
        tenants: [{ operator: operatorId, role: 'editor' }],
      },
      overrideAccess: true,
    })
    const staffLogin = await payload.login({
      collection: 'users',
      data: { email: staff.email, password: staffPassword },
    })
    if (!staffLogin.token) throw new Error('Expected the editor fixture to authenticate')
    staffToken = staffLogin.token

    const platformAdminPassword = 'unlock-integration-test-password'
    const platformAdmin = await payload.create({
      collection: 'users',
      data: {
        email: `${fixturePrefix}-platform@example.test`,
        password: platformAdminPassword,
        platformAdmin: true,
      },
      overrideAccess: true,
    })
    const platformAdminLogin = await payload.login({
      collection: 'users',
      data: { email: platformAdmin.email, password: platformAdminPassword },
    })
    if (!platformAdminLogin.token)
      throw new Error('Expected the Platform Admin fixture to authenticate')
    platformAdminToken = platformAdminLogin.token

    target = await payload.create({
      collection: 'users',
      data: {
        email: `${fixturePrefix}-target@example.test`,
        password: 'unlock-integration-test-password',
        tenants: [{ operator: operatorId, role: 'validation-manager' }],
      },
      overrideAccess: true,
    })

    await setTargetLockout()
  })

  afterAll(async () => {
    if (!payload || !fixturePrefix) return

    await payload.delete({
      collection: 'users',
      overrideAccess: true,
      where: { email: { contains: fixturePrefix } },
    })
    if (operatorId) {
      await payload.delete({ collection: 'operators', id: operatorId, overrideAccess: true })
    }
  })

  it('denies a same-operator editor and allows a Platform Administrator to clear a lockout', async () => {
    const denied = await restPost(operatorDomain, staffToken, { email: target.email })
    expect(denied.status).toBe(403)

    const stillLocked = await payload.findByID({
      collection: 'users',
      id: target.id,
      overrideAccess: true,
      showHiddenFields: true,
    })
    expect(stillLocked.loginAttempts).toBe(5)
    expect(stillLocked.lockUntil).not.toBeNull()

    const allowed = await restPost(operatorDomain, platformAdminToken, { email: target.email })
    expect(allowed.status).toBe(200)

    const unlocked = await payload.findByID({
      collection: 'users',
      id: target.id,
      overrideAccess: true,
      showHiddenFields: true,
    })
    expect(unlocked.loginAttempts).toBe(0)
    expect(unlocked.lockUntil).toBeNull()
  })

  async function setTargetLockout() {
    await payload.db.updateOne({
      id: target.id,
      collection: 'users',
      data: { lockUntil: new Date(Date.now() + 60_000).toISOString(), loginAttempts: 5 },
      req: await createLocalReq({}, payload),
    })
  }
})

function restPost(host: string, token: string, data: unknown) {
  return payloadRESTPost(
    new Request(`http://${host}/api/users/unlock`, {
      method: 'POST',
      headers: {
        authorization: `JWT ${token}`,
        'content-type': 'application/json',
        host,
      },
      body: JSON.stringify(data),
    }),
    { params: Promise.resolve({ slug: ['users', 'unlock'] }) },
  )
}
