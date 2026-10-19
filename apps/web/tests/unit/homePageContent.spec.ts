import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  getCmsQueryOptions: vi.fn(),
  getPayload: vi.fn(),
  getPublishedCmsQueryOptions: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('@/lib/cmsQuery', () => ({
  getCmsQueryOptions: mocks.getCmsQueryOptions,
  getPublishedCmsQueryOptions: mocks.getPublishedCmsQueryOptions,
}))

import { getHomePageContent, getPublishedHomePageContent } from '@/lib/homePageContent'

describe('home page content', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPayload.mockResolvedValue({ find: mocks.find })
    mocks.find.mockResolvedValue({ docs: [{ id: 10, operator: 2, heroVideo: null }] })
    mocks.getPublishedCmsQueryOptions.mockResolvedValue({
      draft: false,
      overrideAccess: false,
      req: { headers: new Headers({ host: 'club.example' }) },
    })
  })

  it('loads published content through an access-aware host request scoped to its operator', async () => {
    const result = await getPublishedHomePageContent(2, 'club.example')

    expect(result).toMatchObject({ id: 10, operator: 2 })
    expect(mocks.getPublishedCmsQueryOptions).toHaveBeenCalledWith(
      expect.objectContaining({ find: mocks.find }),
      'club.example',
    )
    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'home-page',
        draft: false,
        overrideAccess: false,
        where: {
          and: [{ operator: { equals: 2 } }, { _status: { equals: 'published' } }],
        },
      }),
    )
  })

  it('uses the authenticated draft request and keeps draft reads within the active operator', async () => {
    const req = { user: { id: 5 } }
    mocks.getCmsQueryOptions.mockResolvedValue({ draft: true, overrideAccess: false, req })

    await getHomePageContent(2, 'club.example', true)

    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'home-page',
        draft: true,
        overrideAccess: false,
        req,
        where: { and: [{ operator: { equals: 2 } }] },
      }),
    )
    expect(mocks.getPublishedCmsQueryOptions).not.toHaveBeenCalled()
  })

  it('falls back to the published query when draft access is unavailable', async () => {
    mocks.getCmsQueryOptions.mockResolvedValue({ draft: false, overrideAccess: false })

    await getHomePageContent(2, 'club.example', true)

    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: false,
        where: {
          and: [{ operator: { equals: 2 } }, { _status: { equals: 'published' } }],
        },
      }),
    )
  })

  it('returns no content when the CMS is unavailable', async () => {
    mocks.find.mockRejectedValue(new Error('CMS unavailable'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(getPublishedHomePageContent(2, 'club.example')).resolves.toBeNull()

    expect(error).toHaveBeenCalledWith('Failed to load home page content', expect.any(Error))
    error.mockRestore()
  })
})
