import { beforeEach, expect, it, vi } from 'vitest'
import { notFound, redirect } from 'next/navigation'

import { getPayloadDocBySlug, payloadDocMetadata } from '@/lib/payloadBySlug'

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))
vi.mock('next/headers', () => ({ draftMode: vi.fn(), headers: vi.fn() }))
vi.mock('payload', () => ({
  createLocalReq: vi.fn(async ({ req }) => req),
  getPayload: vi.fn(),
}))

beforeEach(async () => {
  vi.clearAllMocks()

  const { draftMode, headers } = await import('next/headers')
  vi.mocked(draftMode).mockResolvedValue({
    disable: vi.fn(),
    enable: vi.fn(),
    isEnabled: false,
  })
  vi.mocked(headers).mockResolvedValue(new Headers({ host: 'localhost' }))
})

async function mockOperatorThenPayloadQuery(failure: unknown) {
  const { getPayload } = await import('payload')
  vi.mocked(getPayload)
    .mockResolvedValueOnce({
      find: vi.fn().mockResolvedValue({
        docs: [{ id: 1, name: 'Test Operator', domain: 'localhost', status: 'active' }],
      }),
    } as never)
    .mockRejectedValueOnce(failure)
}

it('propagates a published CMS failure so the detail boundary can retry it', async () => {
  const failure = { code: 'ECONNREFUSED' }
  await mockOperatorThenPayloadQuery(failure)

  await expect(getPayloadDocBySlug('articles', 'retryable-article')).rejects.toBe(failure)
})

it('limits published slug lookups to the active Operator and published status', async () => {
  const operator = {
    id: 101,
    name: 'Operator A',
    domain: 'localhost',
    status: 'active' as const,
  }
  const operatorFind = vi.fn().mockResolvedValue({ docs: [operator] })
  const contentFind = vi.fn().mockResolvedValue({
    docs: [{ id: 17, operator: operator.id, slug: 'public-article', _status: 'published' }],
  })
  const { getPayload } = await import('payload')
  vi.mocked(getPayload)
    .mockResolvedValueOnce({ find: operatorFind } as never)
    .mockResolvedValueOnce({ find: contentFind } as never)

  const result = await getPayloadDocBySlug('articles', 'public-article')

  expect(result).toMatchObject({ slug: 'public-article', _status: 'published' })
  expect(contentFind).toHaveBeenCalledWith(
    expect.objectContaining({
      collection: 'articles',
      draft: false,
      overrideAccess: false,
      req: { headers: new Headers({ host: operator.domain }) },
      where: {
        and: [
          { operator: { equals: operator.id } },
          { _status: { equals: 'published' } },
          { slug: { equals: 'public-article' } },
        ],
      },
    }),
  )
})

it('keeps metadata renderable when the detail CMS lookup fails', async () => {
  const failure = { code: 'ECONNREFUSED' }
  await mockOperatorThenPayloadQuery(failure)

  const metadata = await payloadDocMetadata(
    'articles',
    'Articles',
  )({
    params: Promise.resolve({ slug: 'metadata-outage-article' }),
  })

  expect(metadata).toEqual({ title: 'Articles' })
})

it('lets redirect control-flow signals escape metadata error handling', async () => {
  let redirectSignal: unknown

  try {
    redirect('/login')
  } catch (error) {
    redirectSignal = error
  }

  await mockOperatorThenPayloadQuery(redirectSignal)

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
  let notFoundSignal: unknown

  try {
    notFound()
  } catch (error) {
    notFoundSignal = error
  }

  await mockOperatorThenPayloadQuery(notFoundSignal)

  await expect(
    payloadDocMetadata(
      'articles',
      'Articles',
    )({
      params: Promise.resolve({ slug: 'metadata-not-found' }),
    }),
  ).rejects.toBe(notFoundSignal)
})
