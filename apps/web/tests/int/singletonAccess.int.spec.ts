// @vitest-environment node

import { BasePayload, type Payload } from 'payload'
import { expect, it } from 'vitest'

import config from '@/payload.config'
import { DELETE as deleteREST } from '@/app/(payload)/api/[...slug]/route'

it('rejects foreign singleton deletion through REST and retains the home page history', async () => {
  const payload = await new BasePayload().init({ config })
  const prefix = `singleton-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  try {
    const operatorA = await createOperator(payload, `${prefix}-a`)
    const operatorB = await createOperator(payload, `${prefix}-b`)
    const { settings, home } = await createSingletons(payload, operatorB.id, prefix)
    const token = await createValidationManager(payload, operatorA.id, prefix)
    const versions = await homeVersions(payload, home.id)
    expect(versions.totalDocs).toBeGreaterThan(0)

    await expectDeleteDenied(operatorA, token, 'site-settings', settings.id)
    await expectDeleteDenied(operatorA, token, 'home-page', home.id)

    expect(
      await payload.findByID({ collection: 'site-settings', id: settings.id, depth: 0 }),
    ).toMatchObject({
      id: settings.id,
      operator: operatorB.id,
    })
    expect(
      await payload.findByID({ collection: 'home-page', id: home.id, depth: 0 }),
    ).toMatchObject({
      id: home.id,
      operator: operatorB.id,
    })
    expect((await homeVersions(payload, home.id)).totalDocs).toBe(versions.totalDocs)
  } finally {
    try {
      await cleanupFixture(payload, prefix)
    } finally {
      await payload.destroy()
    }
  }
})

function createOperator(payload: Payload, name: string) {
  return payload.create({
    collection: 'operators',
    data: { name, domain: `${name}.localhost`, status: 'active' },
    overrideAccess: true,
  })
}

async function createSingletons(payload: Payload, operator: number, prefix: string) {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aWQAAAAASUVORK5CYII=',
    'base64',
  )
  const media = await payload.create({
    collection: 'media',
    data: { alt: prefix, operator },
    file: { data: png, mimetype: 'image/png', name: `${prefix}.png`, size: png.length },
    overrideAccess: true,
  })
  const settings = await payload.create({
    collection: 'site-settings',
    data: { operator, brandName: prefix },
    overrideAccess: true,
  })
  const home = await payload.create({
    collection: 'home-page',
    data: { operator, heroVideo: media.id, heroVideoAlt: prefix, _status: 'published' },
    overrideAccess: true,
  })
  return { settings, home }
}

async function createValidationManager(payload: Payload, operator: number, prefix: string) {
  const credentials = { email: `${prefix}@example.test`, password: 'singleton-test-password' }
  await payload.create({
    collection: 'users',
    data: { ...credentials, tenants: [{ operator, role: 'validation-manager' }] },
    overrideAccess: true,
  })
  const { token } = await payload.login({ collection: 'users', data: credentials })
  if (!token) throw new Error('The fixture user could not authenticate')
  return token
}

async function expectDeleteDenied(
  operator: { id: number; domain: string },
  token: string,
  collection: 'site-settings' | 'home-page',
  id: number,
) {
  const response = await deleteREST(
    new Request(`http://${operator.domain}/api/${collection}/${id}`, {
      method: 'DELETE',
      headers: {
        host: operator.domain,
        authorization: `JWT ${token}`,
        cookie: `payload-tenant=${operator.id}`,
      },
    }),
    { params: Promise.resolve({ slug: [collection, String(id)] }) },
  )
  expect(response.status, await response.text()).toBe(403)
}

function homeVersions(payload: Payload, id: number) {
  return payload.findVersions({
    collection: 'home-page',
    where: { parent: { equals: id } },
    overrideAccess: true,
  })
}

async function cleanupFixture(payload: Payload, prefix: string) {
  await payload.delete({
    collection: 'home-page',
    where: { heroVideoAlt: { equals: prefix } },
    overrideAccess: true,
  })
  await payload.delete({
    collection: 'site-settings',
    where: { brandName: { equals: prefix } },
    overrideAccess: true,
  })
  await payload.delete({
    collection: 'media',
    where: { alt: { equals: prefix } },
    overrideAccess: true,
  })
  await payload.delete({
    collection: 'users',
    where: { email: { equals: `${prefix}@example.test` } },
    overrideAccess: true,
  })
  await payload.delete({
    collection: 'operators',
    where: { name: { contains: prefix } },
    overrideAccess: true,
  })
}
