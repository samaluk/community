import { describe, expect, it } from 'vitest'

import { operatorScopedRead } from '@/access/operatorScopedRead'

function accessArgs({
  hostOperator,
  user,
}: {
  hostOperator: { id: number; status: 'active' | 'suspended' } | null
  user?: unknown
}) {
  const domain = hostOperator ? `operator-${hostOperator.id}.example.test` : 'unknown.example.test'
  return {
    req: {
      headers: new Headers({ cookie: `payload-tenant=${hostOperator?.id ?? 101}`, host: domain }),
      payload: {
        find: async () => ({
          docs: hostOperator ? [{ ...hostOperator, domain }] : [],
        }),
      },
      user,
    },
  } as never
}

describe('operator-scoped read access', () => {
  it('allows public reads only within the active Host operator', async () => {
    expect(
      await operatorScopedRead(accessArgs({ hostOperator: { id: 101, status: 'active' } })),
    ).toEqual({ operator: { equals: 101 } })

    expect(
      await operatorScopedRead(accessArgs({ hostOperator: { id: 202, status: 'active' } })),
    ).toEqual({ operator: { equals: 202 } })
  })

  it('denies unknown Hosts and suspended operators to public visitors', async () => {
    expect(await operatorScopedRead(accessArgs({ hostOperator: null }))).toBe(false)
    expect(
      await operatorScopedRead(accessArgs({ hostOperator: { id: 101, status: 'suspended' } })),
    ).toBe(false)
  })

  it('keeps suspended-operator reads limited to staff roles and that operator', async () => {
    const operator = { id: 101, status: 'suspended' as const }

    expect(
      await operatorScopedRead(
        accessArgs({
          hostOperator: operator,
          user: { id: 1, tenants: [{ operator: 101, role: 'editor' }] },
        }),
      ),
    ).toEqual({
      and: [
        { operator: { equals: 101 } },
        {
          and: [{ operator: { equals: 101 } }, { operator: { in: [101] } }],
        },
      ],
    })

    expect(
      await operatorScopedRead(
        accessArgs({
          hostOperator: operator,
          user: { id: 2, tenants: [{ operator: 202, role: 'admin' }] },
        }),
      ),
    ).toBe(false)
  })
})
