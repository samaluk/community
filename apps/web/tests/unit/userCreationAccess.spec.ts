import { assert, describe, expect, it } from 'vitest'

import { enforceUserCreateAuthority, Users } from '@/collections/Users'

function hookArgs({
  operation = 'create',
  payloadAPI = 'REST',
  platformAdmin = false,
}: {
  operation?: string
  payloadAPI?: string
  platformAdmin?: boolean
} = {}) {
  return {
    data: { email: 'new-user@example.test', platformAdmin: true },
    operation,
    req: {
      payloadAPI,
      user: platformAdmin ? { id: 1, platformAdmin: true } : null,
    },
  } as never
}

describe('user creation authority hook', () => {
  it.each([
    { actor: 'anonymous', user: null, ownerAccess: false, mayAdminister: false },
    {
      actor: 'ordinary user',
      user: { id: 7, platformAdmin: false, tenants: [] },
      ownerAccess: { id: { equals: 7 } },
      mayAdminister: false,
    },
    {
      actor: 'Operator Administrator',
      user: { id: 7, tenants: [{ operator: 101, role: 'admin' }] },
      ownerAccess: { id: { equals: 7 } },
      mayAdminister: false,
    },
    {
      actor: 'Operator Editor',
      user: { id: 7, tenants: [{ operator: 101, role: 'editor' }] },
      ownerAccess: { id: { equals: 7 } },
      mayAdminister: false,
    },
    {
      actor: 'Operator Validation Manager',
      user: { id: 7, tenants: [{ operator: 101, role: 'validation-manager' }] },
      ownerAccess: { id: { equals: 7 } },
      mayAdminister: false,
    },
    {
      actor: 'Platform Administrator',
      user: { id: 7, platformAdmin: true, tenants: [] },
      ownerAccess: true,
      mayAdminister: true,
    },
  ])(
    'enforces user and privileged-field authority for $actor',
    async ({ user, ownerAccess, mayAdminister }) => {
      const access = Users.access
      assert.isDefined(access)
      assert.isDefined(access.read)
      assert.isDefined(access.update)
      assert.isDefined(access.delete)
      assert.isDefined(access.unlock)
      assert.isDefined(access.create)

      for (const id of [7, 8]) {
        const args = { id, req: { user } } as never

        expect(await access.read(args)).toEqual(ownerAccess)
        expect(await access.update(args)).toEqual(ownerAccess)
        expect(await access.delete(args)).toBe(mayAdminister)
        expect(await access.unlock(args)).toBe(mayAdminister)
      }

      const platformAdminField = Users.fields.find(
        (field) => 'name' in field && field.name === 'platformAdmin',
      )
      if (!platformAdminField || !('access' in platformAdminField)) {
        throw new Error('Expected the Platform Administrator field access policy')
      }
      const fieldAccess = platformAdminField.access
      assert.isDefined(fieldAccess)
      assert.isDefined(fieldAccess.create)
      assert.isDefined(fieldAccess.update)

      for (const platformAdmin of [true, false]) {
        const args = { data: { platformAdmin }, req: { user, payloadAPI: 'REST' } }

        expect(await access.create(args as never)).toBe(mayAdminister)
        expect(await fieldAccess.create(args as never)).toBe(mayAdminister)
        expect(await fieldAccess.update(args as never)).toBe(mayAdminister)
        if (!mayAdminister) {
          expect(() =>
            enforceUserCreateAuthority({ ...args, operation: 'create' } as never),
          ).toThrow()
        }
      }
    },
  )

  it('denies unauthenticated API creates regardless of collection access overrides', async () => {
    expect(() => enforceUserCreateAuthority(hookArgs())).toThrow(
      'Only a Platform Administrator can create users through the API.',
    )
  })

  it('allows Platform Administrators to create users through authenticated APIs', async () => {
    const args = hookArgs({ platformAdmin: true })

    expect(enforceUserCreateAuthority(args)).toEqual({
      email: 'new-user@example.test',
      platformAdmin: true,
    })
  })

  it('preserves trusted Local API bootstrap and does not restrict updates', async () => {
    const localCreate = hookArgs({ payloadAPI: 'local' })
    const update = hookArgs({ operation: 'update' })

    expect(enforceUserCreateAuthority(localCreate)).toEqual({
      email: 'new-user@example.test',
      platformAdmin: true,
    })
    expect(enforceUserCreateAuthority(update)).toEqual({
      email: 'new-user@example.test',
      platformAdmin: true,
    })
  })
})
