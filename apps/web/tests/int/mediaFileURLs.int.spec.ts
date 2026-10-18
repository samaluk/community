// @vitest-environment node

import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { GET as payloadRESTGet } from '@/app/(payload)/api/[...slug]/route'

const testPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aWQAAAAASUVORK5CYII=',
  'base64',
)

type OperatorFixture = { id: number; domain: string }

let payload: Payload
let mediaId: number | undefined
let primaryOperator: OperatorFixture
let secondaryOperator: OperatorFixture
let filename: string
let fixturePrefix: string

describe('local media URLs across Operator Hosts', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    fixturePrefix = `media-url-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const primary = await createOperator('primary')
    primaryOperator = { domain: primary.domain, id: primary.id }
    const secondary = await createOperator('secondary')
    secondaryOperator = { domain: secondary.domain, id: secondary.id }
    filename = `media-url-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`

    const media = await payload.create({
      collection: 'media',
      data: { alt: 'Secondary Operator media URL test', operator: secondaryOperator.id },
      file: { data: testPng, mimetype: 'image/png', name: filename, size: testPng.byteLength },
      overrideAccess: true,
    })
    mediaId = media.id
  })

  afterAll(async () => {
    if (payload && mediaId !== undefined) {
      await payload.delete({ collection: 'media', id: mediaId, overrideAccess: true })
    }
    if (payload && secondaryOperator) {
      await payload.delete({
        collection: 'operators',
        id: secondaryOperator.id,
        overrideAccess: true,
      })
    }
    if (payload && primaryOperator) {
      await payload.delete({
        collection: 'operators',
        id: primaryOperator.id,
        overrideAccess: true,
      })
    }
  })

  it('returns a same-origin URL that serves on the owning Host and is denied on the primary Host', async () => {
    if (mediaId === undefined) throw new Error('The media fixture was not created.')

    const secondaryReq = await createLocalReq(
      {
        req: {
          headers: new Headers({ host: secondaryOperator.domain }),
          payloadAPI: 'REST',
        },
      },
      payload,
    )
    const media = await payload.findByID({
      collection: 'media',
      id: mediaId,
      overrideAccess: false,
      req: secondaryReq,
    })
    const expectedURL = `/api/media/file/${encodeURIComponent(filename)}`

    expect(media.url).toBe(expectedURL)
    expect(media.thumbnailURL).toBe(expectedURL)

    const ownerResponse = await requestMediaFile(secondaryOperator.domain, expectedURL)
    expect(ownerResponse.status).toBe(200)
    expect(new Uint8Array(await ownerResponse.arrayBuffer())).toEqual(new Uint8Array(testPng))

    const primaryResponse = await requestMediaFile(primaryOperator.domain, expectedURL)
    expect([403, 404]).toContain(primaryResponse.status)
  })
})

async function createOperator(suffix: string) {
  const operator = await payload.create({
    collection: 'operators',
    data: {
      domain: `${fixturePrefix}-${suffix}.example.test`,
      name: `${fixturePrefix} ${suffix}`,
      status: 'active',
    },
    overrideAccess: true,
  })

  return { domain: operator.domain, id: operator.id }
}

function requestMediaFile(host: string, url: string) {
  const path = url.replace(/^\/api\//, '')
  return payloadRESTGet(new Request(`http://${host}${url}`, { headers: { host } }), {
    params: Promise.resolve({ slug: path.split('/') }),
  })
}
