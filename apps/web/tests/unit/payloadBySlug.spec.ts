import { beforeEach, expect, it, vi } from 'vitest'
import { notFound, redirect } from 'next/navigation'

import { getPayloadDocBySlug, payloadDocMetadata } from '@/lib/payloadBySlug'

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))
vi.mock('next/headers', () => ({ draftMode: vi.fn() }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))

beforeEach(async () => {
  vi.clearAllMocks()

  const { draftMode } = await import('next/headers')
  vi.mocked(draftMode).mockResolvedValue({
    disable: vi.fn(),
    enable: vi.fn(),
    isEnabled: false,
  })
})

it('propagates a published CMS failure so the detail boundary can retry it', async () => {
  const { getPayload } = await import('payload')
  const failure = { code: 'ECONNREFUSED' }
  vi.mocked(getPayload).mockRejectedValue(failure)

  await expect(getPayloadDocBySlug('articles', 'retryable-article')).rejects.toBe(failure)
})

it('keeps metadata renderable when the detail CMS lookup fails', async () => {
  const { getPayload } = await import('payload')
  const failure = { code: 'ECONNREFUSED' }
  vi.mocked(getPayload).mockRejectedValue(failure)

  const metadata = await payloadDocMetadata(
    'articles',
    'Articles',
  )({
    params: Promise.resolve({ slug: 'metadata-outage-article' }),
  })

  expect(metadata).toEqual({ title: 'Articles' })
})

it('lets redirect control-flow signals escape metadata error handling', async () => {
  const { getPayload } = await import('payload')
  let redirectSignal: unknown

  try {
    redirect('/login')
  } catch (error) {
    redirectSignal = error
  }

  vi.mocked(getPayload).mockRejectedValue(redirectSignal)

  await expect(
    payloadDocMetadata(
      'articles',
      'Articles',
    )({
      params: Promise.resolve({ slug: 'metadata-redirect' }),
    }),
  ).rejects.toBe(redirectSignal)
})

it('lets not-found control-flow signals escape metadata error handling', async () => {
  const { getPayload } = await import('payload')
  let notFoundSignal: unknown

  try {
    notFound()
  } catch (error) {
    notFoundSignal = error
  }

  vi.mocked(getPayload).mockRejectedValue(notFoundSignal)

  await expect(
    payloadDocMetadata(
      'articles',
      'Articles',
    )({
      params: Promise.resolve({ slug: 'metadata-not-found' }),
    }),
  ).rejects.toBe(notFoundSignal)
})
