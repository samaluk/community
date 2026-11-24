import { beforeEach, expect, it, vi } from 'vitest'

import { DEFAULT_SITE_SETTINGS, getSiteSettings } from '@/lib/siteSettings'

// oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
vi.mock('@payload-config', () => ({ default: {} }))
// oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
vi.mock('payload', () => ({
  // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
  createLocalReq: vi.fn(async ({ req }) => req),
  getPayload: vi.fn(),
}))
// oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
vi.mock('next/headers', () => ({
  draftMode: vi.fn(),
  headers: vi.fn(),
}))
// oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

beforeEach(async () => {
  vi.clearAllMocks()
  const { draftMode, headers } = await import('next/headers')
  // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
  vi.mocked(draftMode).mockResolvedValue({ isEnabled: false } as any)
  // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
  vi.mocked(headers).mockResolvedValue(new Headers({ host: 'localhost' }))
})

it('provides generic community fallback defaults when CMS data is empty or unavailable', () => {
  expect(DEFAULT_SITE_SETTINGS.brandName).toBe('Community')
  expect(DEFAULT_SITE_SETTINGS.defaultLocale).toBe('en')
  expect(DEFAULT_SITE_SETTINGS.lang).toBe('en')
  expect(DEFAULT_SITE_SETTINGS.siteDescription).toBe(
    'A platform for community connection and shared knowledge.',
  )
  expect(DEFAULT_SITE_SETTINGS.memberIdentifierType).toBe('generic')
})

it('fetches published site settings when draft mode is disabled', async () => {
  const { headers } = await import('next/headers')
  const { getPayload } = await import('payload')

  // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
  const mockFindOperator = vi.fn().mockResolvedValue({
    docs: [{ id: 1, name: 'Test Operator', domain: 'localhost', status: 'active' }],
  })
  // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
  const mockFindSettings = vi.fn().mockResolvedValue({
    docs: [
      {
        id: 1,
        operator: 1,
        brandName: 'Custom Brand',
        siteDescription: 'Custom Description',
        defaultLocale: 'es',
        lang: 'es-CL',
      },
    ],
  })
  // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
  vi.mocked(getPayload)
    .mockResolvedValueOnce({ find: mockFindOperator } as any)
    .mockResolvedValueOnce({ find: mockFindSettings } as any)

  const settings = await getSiteSettings()

  expect(settings.brandName).toBe('Custom Brand')
  expect(settings.siteDescription).toBe('Custom Description')
  expect(settings.lang).toBe('es-CL')
  expect(mockFindSettings).toHaveBeenCalledWith(
    expect.objectContaining({
      collection: 'site-settings',
      draft: false,
      overrideAccess: false,
      req: { headers: new Headers({ host: 'localhost' }) },
      where: { operator: { equals: 1 } },
    }),
  )
})

it('returns fallback defaults if getPayload throws an unavailable error', async () => {
  const { getPayload } = await import('payload')

  // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
  vi.mocked(getPayload)
    .mockResolvedValueOnce({
      // oxlint-disable-next-line landmines/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
      find: vi.fn().mockResolvedValue({
        docs: [{ id: 1, name: 'Test Operator', domain: 'localhost', status: 'active' }],
      }),
    } as any)
    .mockRejectedValueOnce({ code: '42P01' })

  const settings = await getSiteSettings()

  expect(settings).toEqual(DEFAULT_SITE_SETTINGS)
})
