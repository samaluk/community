import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  draftEnable: vi.fn(),
  find: vi.fn(),
  getOperatorForHost: vi.fn(),
  redirect: vi.fn(
    (path: string) => new Response(null, { status: 307, headers: { location: path } }),
  ),
  OperatorResolutionError: class OperatorResolutionError extends Error {},
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/env', () => ({ env: { PREVIEW_SECRET: 'preview-secret' } }))
vi.mock('payload', () => ({
  getPayload: async () => ({ auth: mocks.authenticate, find: mocks.find }),
}))
vi.mock('next/headers', () => ({ draftMode: async () => ({ enable: mocks.draftEnable }) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/operator', () => ({
  OperatorResolutionError: mocks.OperatorResolutionError,
  assertActiveOperator: (operator: { status: string }) => {
    if (operator.status !== 'active')
      throw new mocks.OperatorResolutionError('Operator is suspended')
    return operator
  },
  getOperatorForHost: mocks.getOperatorForHost,
}))

import { GET } from '@/app/(frontend)/preview/route'

const operator = { id: 101, name: 'Community', domain: 'community.example.test', status: 'active' }

function previewRequest({
  operatorId = 101,
  path = '/articles/story?locale=en',
  collection = 'articles',
  slug = 'story',
}: {
  operatorId?: number
  path?: string
  collection?: string
  slug?: string
} = {}) {
  const params = new URLSearchParams({
    previewSecret: 'preview-secret',
    operatorId: String(operatorId),
    path,
    collection,
    slug,
  })
  return new Request(`https://community.example.test/preview?${params}`, {
    headers: { host: 'community.example.test', authorization: 'Bearer token' },
  })
}

describe('preview route authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getOperatorForHost.mockResolvedValue(operator)
    mocks.authenticate.mockResolvedValue({
      user: { id: 1, tenants: [{ operator: 101, role: 'editor' }] },
    })
    mocks.find.mockResolvedValue({ docs: [{ id: 5 }] })
  })

  it('checks Host and target Operator, then scopes the draft lookup before enabling preview', async () => {
    const response = await GET(previewRequest())

    expect(mocks.getOperatorForHost).toHaveBeenCalledWith('community.example.test')
    expect(mocks.find).toHaveBeenCalledWith({
      collection: 'articles',
      depth: 0,
      draft: true,
      limit: 1,
      locale: 'en',
      overrideAccess: true,
      where: {
        and: [{ operator: { equals: 101 } }, { slug: { equals: 'story' } }],
      },
    })
    expect(mocks.draftEnable).toHaveBeenCalledOnce()
    expect(mocks.redirect).toHaveBeenCalledWith('/articles/story?locale=en')
    expect(response.headers.get('location')).toBe('/articles/story?locale=en')
  })

  it('rejects mismatched Operator, wrong-operator staff, and validation-only staff', async () => {
    expect((await GET(previewRequest({ operatorId: 202 }))).status).toBe(404)
    expect(mocks.authenticate).not.toHaveBeenCalled()

    mocks.authenticate.mockResolvedValueOnce({
      user: { id: 2, tenants: [{ operator: 202, role: 'editor' }] },
    })
    expect((await GET(previewRequest())).status).toBe(404)

    mocks.authenticate.mockResolvedValueOnce({
      user: { id: 3, tenants: [{ operator: 101, role: 'validation-manager' }] },
    })
    expect((await GET(previewRequest())).status).toBe(404)
    expect(mocks.find).not.toHaveBeenCalled()
  })

  it('rejects suspended or unknown Hosts and unsafe preview paths', async () => {
    mocks.getOperatorForHost.mockResolvedValueOnce({ ...operator, status: 'suspended' })
    expect((await GET(previewRequest())).status).toBe(404)

    mocks.getOperatorForHost.mockRejectedValueOnce(
      new mocks.OperatorResolutionError('unknown host'),
    )
    expect((await GET(previewRequest())).status).toBe(404)

    expect(
      (await GET(previewRequest({ path: 'https://attacker.example.test/articles/story' }))).status,
    ).toBe(404)
    expect((await GET(previewRequest({ path: '/articles/other' }))).status).toBe(404)
    expect(mocks.find).not.toHaveBeenCalled()
  })
})
