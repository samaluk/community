import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCmsQueryOptions } from '@/lib/cmsQuery'

// oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
vi.mock('@payload-config', () => ({ default: {} }))
// oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
vi.mock('next/headers', () => ({ draftMode: vi.fn(), headers: vi.fn() }))
// oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
vi.mock('payload', () => ({
  // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
  createLocalReq: vi.fn(async ({ req, user }) => ({ ...req, user })),
  getPayload: vi.fn(),
}))
// oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
vi.mock('@/lib/operator', () => ({
  // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
  assertActiveOperator: vi.fn((operator) => operator),
  getOperatorForHost: vi.fn(),
}))

describe('draft CMS reads', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    const { draftMode, headers } = await import('next/headers')
    const { getOperatorForHost } = await import('@/lib/operator')
    const { getPayload } = await import('payload')

    // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
    vi.mocked(draftMode).mockResolvedValue({ isEnabled: true } as Awaited<
      ReturnType<typeof draftMode>
    >)
    // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
    vi.mocked(headers).mockResolvedValue(
      new Headers({ cookie: 'payload-tenant=101', host: 'operator-a.example.test' }),
    )
    // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
    vi.mocked(getOperatorForHost).mockResolvedValue({
      id: 101,
      name: 'Operator A',
      domain: 'operator-a.example.test',
      status: 'active',
    })
    // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
    vi.mocked(getPayload).mockResolvedValue({ auth: vi.fn() } as never)
  })

  it('does not let a DraftMode cookie expose drafts to unauthenticated visitors', async () => {
    const { getPayload } = await import('payload')
    // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
    vi.mocked(getPayload).mockResolvedValue({
      // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
      auth: vi.fn().mockResolvedValue({ user: null }),
    } as never)

    await expect(getCmsQueryOptions()).resolves.toEqual({ draft: false, overrideAccess: false })
  })

  it('does not let staff from another Operator read this Operator’s drafts', async () => {
    const { getPayload } = await import('payload')
    // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
    vi.mocked(getPayload).mockResolvedValue({
      // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
      auth: vi.fn().mockResolvedValue({
        user: { tenants: [{ operator: { id: 202 }, role: 'admin' }] },
      }),
    } as never)

    await expect(getCmsQueryOptions()).resolves.toEqual({ draft: false, overrideAccess: false })
  })

  it('requires the selected Operator cookie to match the request Host', async () => {
    const { draftMode, headers } = await import('next/headers')
    // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
    vi.mocked(headers).mockResolvedValue(
      new Headers({ cookie: 'payload-tenant=202', host: 'operator-a.example.test' }),
    )
    const { getPayload } = await import('payload')
    // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
    vi.mocked(getPayload).mockResolvedValue({
      // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
      auth: vi.fn().mockResolvedValue({
        user: { tenants: [{ operator: { id: 101 }, role: 'editor' }] },
      }),
    } as never)
    // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
    vi.mocked(draftMode).mockResolvedValue({ isEnabled: true } as Awaited<
      ReturnType<typeof draftMode>
    >)

    await expect(getCmsQueryOptions()).resolves.toEqual({ draft: false, overrideAccess: false })
  })

  it('allows admin and editor drafts only for the active request Operator', async () => {
    const { getPayload } = await import('payload')
    // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
    vi.mocked(getPayload).mockResolvedValue({
      // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
      auth: vi.fn().mockResolvedValue({
        user: { tenants: [{ operator: { id: 101 }, role: 'editor' }] },
      }),
    } as never)

    await expect(getCmsQueryOptions()).resolves.toEqual({
      draft: true,
      overrideAccess: false,
      req: {
        headers: new Headers({
          cookie: 'payload-tenant=101',
          host: 'operator-a.example.test',
        }),
        user: { tenants: [{ operator: { id: 101 }, role: 'editor' }] },
      },
    })
  })
})
