import { describe, expect, it } from 'vitest'

import { publishedOrStaff } from '@/access/publishedOrStaff'

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

describe('published-or-staff access', () => {
  it('limits anonymous reads on active Hosts to published records for that operator', async () => {
    expect(
      await publishedOrStaff(accessArgs({ hostOperator: { id: 101, status: 'active' } })),
    ).toEqual({
      and: [{ operator: { equals: 101 } }, { _status: { equals: 'published' } }],
    })
    expect(await publishedOrStaff(accessArgs({ hostOperator: null }))).toBe(false)
  })

  it('allows active-operator staff to read drafts only in their assigned operator', async () => {
    expect(
      await publishedOrStaff(
        accessArgs({
          hostOperator: { id: 101, status: 'active' },
          user: { id: 1, tenants: [{ operator: 101, role: 'editor' }] },
        }),
      ),
    ).toEqual({
      or: [
        {
          and: [{ operator: { equals: 101 } }, { _status: { equals: 'published' } }],
        },
        {
          and: [
            { operator: { equals: 101 } },
            {
              and: [{ operator: { equals: 101 } }, { operator: { in: [101] } }],
            },
          ],
        },
      ],
    })

    expect(
      await publishedOrStaff(
        accessArgs({
          hostOperator: { id: 101, status: 'active' },
          user: { id: 2, tenants: [{ operator: 202, role: 'admin' }] },
        }),
      ),
    ).toEqual({
      and: [{ operator: { equals: 101 } }, { _status: { equals: 'published' } }],
    })
  })

  it('restricts suspended operators to authenticated staff for the matching operator', async () => {
    expect(
      await publishedOrStaff(accessArgs({ hostOperator: { id: 101, status: 'suspended' } })),
    ).toBe(false)
    expect(
      await publishedOrStaff(
        accessArgs({
          hostOperator: { id: 101, status: 'suspended' },
          user: { id: 1, tenants: [{ operator: 101, role: 'validation-manager' }] },
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
      await publishedOrStaff(
        accessArgs({
          hostOperator: { id: 101, status: 'suspended' },
          user: { id: 2, tenants: [{ operator: 202, role: 'admin' }] },
        }),
      ),
    ).toBe(false)
  })
})
