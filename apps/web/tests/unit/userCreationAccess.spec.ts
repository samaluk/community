import { describe, expect, it } from 'vitest'

import { enforceUserCreateAuthority } from '@/collections/Users'

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
