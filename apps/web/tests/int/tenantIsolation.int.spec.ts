// @vitest-environment node

import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { findMembershipByLookupHash } from '@/lib/memberships'
import { getPublishedCmsQueryOptions } from '@/lib/cmsQuery'
import {
  GET as payloadRESTGet,
  PATCH as payloadRESTPatch,
  POST as payloadRESTPost,
} from '@/app/(payload)/api/[...slug]/route'
import { POST as payloadGraphQLPost } from '@/app/(payload)/api/graphql/route'

const richTextBody = {
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 2,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        version: 1,
        children: [{ text: 'Operator isolation test body.', type: 'text', version: 1 }],
        direction: 'ltr',
      },
    ],
  },
}

// A valid one-pixel PNG so the test exercises Payload's upload/API path too.
const testPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aWQAAAAASUVORK5CYII=',
  'base64',
)

type FixtureOperator = { id: number; domain: string }

let payload: Payload
let operatorA: FixtureOperator
let operatorB: FixtureOperator
let suspendedOperator: FixtureOperator
let articleAId: number
let articleBId: number
let mediaAId: number
let mediaBId: number
let staffToken: string
let platformAdminToken: string
let fixturePrefix: string

describe('operator tenant isolation integration', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    fixturePrefix = `tenant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await createOperators()
    await createArticleAndMembershipFixtures()
    await createMediaFixtures()
    await createAuthFixtures()
  })

  afterAll(async () => {
    if (!payload || !fixturePrefix) return

    await payload.delete({
      collection: 'memberships',
      overrideAccess: true,
      where: { identifier: { contains: fixturePrefix } },
    })
    await payload.delete({
      collection: 'articles',
      overrideAccess: true,
      where: { slug: { contains: fixturePrefix } },
    })
    await payload.delete({
      collection: 'media',
      overrideAccess: true,
      where: { filename: { contains: fixturePrefix } },
    })
    await payload.delete({
      collection: 'users',
      overrideAccess: true,
      where: { email: { contains: fixturePrefix } },
    })

    for (const operator of [operatorA, operatorB, suspendedOperator]) {
      if (operator) {
        await payload.delete({ collection: 'operators', id: operator.id, overrideAccess: true })
      }
    }
  })

  it('serves only the host operator public content and rejects drafts and cross-tenant writes', async () => {
    await assertUnauthenticatedFirstRegisterCannotGrantPlatformAdmin()
    await assertPublicArticleReads()
    await assertDraftVisibility()
    await assertOperatorScopedWrites()
  })

  it('scopes media API reads by Host and blocks unresolved or suspended public Hosts', async () => {
    await assertMediaIsolation()
    await assertHostResolutionAndRecovery()
  })
})

async function createOperators() {
  operatorA = await createOperator('a')
  operatorB = await createOperator('b')
  suspendedOperator = await createOperator('suspended', 'suspended')
}

async function createArticleAndMembershipFixtures() {
  const sharedSlug = `${fixturePrefix}-shared`
  const articleA = await createArticle(operatorA.id, sharedSlug, 'Operator A article')
  const articleB = await createArticle(operatorB.id, sharedSlug, 'Operator B article')
  articleAId = articleA.id
  articleBId = articleB.id

  await createArticle(operatorA.id, `${fixturePrefix}-draft-a`, 'Operator A draft', true)
  await createArticle(operatorB.id, `${fixturePrefix}-draft-b`, 'Operator B draft', true)

  const identifier = `${fixturePrefix}-member`
  const membershipA = await payload.create({
    collection: 'memberships',
    data: {
      identifier,
      isActive: true,
      lookupHash: '',
      normalizedIdentifier: '',
      operator: operatorA.id,
    },
    overrideAccess: true,
  })
  const membershipB = await payload.create({
    collection: 'memberships',
    data: {
      identifier,
      isActive: true,
      lookupHash: '',
      normalizedIdentifier: '',
      operator: operatorB.id,
    },
    overrideAccess: true,
  })

  expect(membershipA.lookupHash).toBe(membershipB.lookupHash)
  expect(
    await findMembershipByLookupHash(payload, membershipA.lookupHash, operatorA.id),
  ).toMatchObject({
    id: membershipA.id,
  })
  expect(
    await findMembershipByLookupHash(payload, membershipB.lookupHash, operatorB.id),
  ).toMatchObject({
    id: membershipB.id,
  })
  expect(
    await findMembershipByLookupHash(payload, membershipA.lookupHash, suspendedOperator.id),
  ).toBeNull()
}

async function createMediaFixtures() {
  const createImage = (name: string) => ({
    data: testPng,
    mimetype: 'image/png',
    name,
    size: testPng.byteLength,
  })
  const mediaA = await payload.create({
    collection: 'media',
    data: { alt: 'Operator A image', operator: operatorA.id },
    file: createImage(`${fixturePrefix}-a.png`),
    overrideAccess: true,
  })
  const mediaB = await payload.create({
    collection: 'media',
    data: { alt: 'Operator B image', operator: operatorB.id },
    file: createImage(`${fixturePrefix}-b.png`),
    overrideAccess: true,
  })
  mediaAId = mediaA.id
  mediaBId = mediaB.id
}

async function createAuthFixtures() {
  const email = `${fixturePrefix}@example.test`
  const password = 'tenant-integration-test-password'
  await payload.create({
    collection: 'users',
    data: {
      email,
      password,
      tenants: [
        { operator: operatorA.id, role: 'admin' },
        { operator: operatorB.id, role: 'validation-manager' },
      ],
    },
    overrideAccess: true,
  })
  const login = await payload.login({ collection: 'users', data: { email, password } })
  if (!login.token) throw new Error('Expected the tenant staff fixture to authenticate')
  staffToken = login.token

  const platformAdminEmail = `${fixturePrefix}-platform@example.test`
  const platformAdminPassword = 'tenant-platform-test-password'
  await payload.create({
    collection: 'users',
    data: { email: platformAdminEmail, password: platformAdminPassword, platformAdmin: true },
    overrideAccess: true,
  })
  const platformAdminLogin = await payload.login({
    collection: 'users',
    data: { email: platformAdminEmail, password: platformAdminPassword },
  })
  if (!platformAdminLogin.token)
    throw new Error('Expected the platform admin fixture to authenticate')
  platformAdminToken = platformAdminLogin.token
}

async function assertPublicArticleReads() {
  const sharedSlug = `${fixturePrefix}-shared`
  for (const [operator, expectedTitle] of [
    [operatorA, 'Operator A article'],
    [operatorB, 'Operator B article'],
  ] as const) {
    const response = await restRequest(
      operator.domain,
      `articles?where%5Bslug%5D%5Bequals%5D=${encodeURIComponent(sharedSlug)}&locale=es&draft=false&depth=0`,
      operator.id,
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { docs: Array<{ title: string }> }
    expect(body.docs.map((doc) => doc.title)).toEqual([expectedTitle])
  }

  const ownGraphQLRead = await graphQLRequest(operatorA.domain, operatorA.id, {
    query:
      'query ArticlesBySlug($slug: String!) { Articles(where: { slug: { equals: $slug } }) { docs { id title } } }',
    variables: { slug: sharedSlug },
  })
  expect(ownGraphQLRead.status).toBe(200)
  const ownGraphQLBody = (await ownGraphQLRead.json()) as {
    data?: { Articles?: { docs: Array<{ id: string; title: string }> } }
  }
  expect(
    ownGraphQLBody.data?.Articles?.docs.map((doc) => doc.title),
    JSON.stringify(ownGraphQLBody),
  ).toEqual(['Operator A article'])

  const foreignGraphQLRead = await graphQLRequest(operatorA.domain, operatorA.id, {
    query:
      'query ArticleByID($id: Int!) { Articles(where: { id: { equals: $id } }) { docs { id title } } }',
    variables: { id: articleBId },
  })
  expect(foreignGraphQLRead.status).toBe(200)
  const foreignGraphQLBody = (await foreignGraphQLRead.json()) as {
    data?: { Articles?: { docs: Array<{ id: string; title: string }> } }
  }
  expect(foreignGraphQLBody.data?.Articles?.docs, JSON.stringify(foreignGraphQLBody)).toEqual([])
}

async function assertUnauthenticatedFirstRegisterCannotGrantPlatformAdmin() {
  const req = await createLocalReq(
    {
      req: {
        headers: new Headers({ host: operatorA.domain }),
        payloadAPI: 'REST',
      },
    },
    payload,
  )

  await expect(
    payload.create({
      collection: 'users',
      data: {
        email: `${fixturePrefix}-first-register@example.test`,
        password: 'unauthenticated-first-register-password',
        platformAdmin: true,
        tenants: [{ operator: operatorA.id, role: 'admin' }],
      },
      overrideAccess: true,
      req,
    }),
  ).rejects.toThrow('Only a Platform Administrator can create users through the API.')
}

async function assertDraftVisibility() {
  const draftResponse = await restRequest(
    operatorA.domain,
    `articles?where%5Bslug%5D%5Bequals%5D=${encodeURIComponent(`${fixturePrefix}-draft-a`)}&locale=es&draft=true&depth=0`,
    operatorA.id,
  )
  expect(draftResponse.status).toBe(200)
  const draftBody = (await draftResponse.json()) as { docs: unknown[] }
  expect(draftBody.docs).toEqual([])
}

async function assertOperatorScopedWrites() {
  const deniedWrite = await restPatch(
    operatorB.domain,
    `articles/${articleBId}?locale=es&draft=false`,
    operatorA.id,
    staffToken,
    { title: 'Cross-tenant overwrite' },
  )
  expect([403, 404]).toContain(deniedWrite.status)

  const tenantlessCreate = await createArticleThroughAPI(operatorA, `${fixturePrefix}-tenantless`, {
    body: richTextBody,
    title: 'Tenantless create attempt',
  })
  expect([400, 403]).toContain(tenantlessCreate.status)

  const ownReference = await createArticleWithReference(
    operatorA,
    articleAId,
    'same-operator-reference',
  )
  expect(ownReference.status).toBe(201)
  await assertReferencedContentHidesAfterUnpublish(`${fixturePrefix}-same-operator-reference`)

  const foreignReference = await createArticleWithReference(
    operatorA,
    articleBId,
    'cross-operator-reference',
  )
  expect(foreignReference.status).toBe(400)

  const allowedWrite = await restPatch(
    operatorA.domain,
    `articles/${articleAId}?locale=es&draft=false`,
    operatorA.id,
    staffToken,
    { title: 'Operator A updated' },
  )
  expect(allowedWrite.status).toBe(200)
}

async function assertReferencedContentHidesAfterUnpublish(slug: string) {
  const referenceOwnerResult = await payload.find({
    collection: 'articles',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { slug: { equals: slug } },
  })
  const referenceOwner = referenceOwnerResult.docs[0]
  expect(referenceOwner).toBeDefined()

  const readReferenceOwner = async () => {
    const publicQuery = await getPublishedCmsQueryOptions(payload, operatorA.domain)
    return payload.findByID({
      collection: 'articles',
      depth: 1,
      id: referenceOwner.id,
      locale: 'es',
      ...publicQuery,
    })
  }

  const beforeUnpublish = await readReferenceOwner()
  const beforeBody = JSON.stringify(beforeUnpublish.body)
  expect(beforeBody).toContain('Operator A article')
  expect(beforeBody).toContain('Operator isolation test body.')

  await payload.update({
    collection: 'articles',
    data: { _status: 'draft' },
    draft: false,
    id: articleAId,
    locale: 'es',
    overrideAccess: true,
  })

  const afterUnpublish = await readReferenceOwner()
  const afterBody = JSON.stringify(afterUnpublish.body)
  expect(afterBody).not.toContain('Operator A article')
  expect(afterBody).not.toContain('Operator isolation test body.')
}

async function createArticleThroughAPI(
  operator: FixtureOperator,
  slugSuffix: string,
  overrides: Record<string, unknown>,
) {
  const slug = overrides.slug ?? `${fixturePrefix}-${slugSuffix}`
  const title = overrides.title ?? 'Tenantless create attempt'
  return restPost(operator.domain, 'articles?locale=es&draft=false', operator.id, staffToken, {
    _status: 'published',
    body: richTextBody,
    category: 'Integration',
    difficulty: 'beginner',
    slug,
    sourceUrl: `https://example.test/${slug}`,
    title,
    ...overrides,
  })
}

async function createArticleWithReference(
  operator: FixtureOperator,
  targetID: number,
  slugSuffix: string,
) {
  const slug = `${fixturePrefix}-${slugSuffix}`
  const body = {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 2,
      direction: 'ltr',
      children: [
        {
          type: 'relationship',
          relationTo: 'articles',
          value: { id: targetID, relationTo: 'articles' },
          version: 1,
        },
      ],
    },
  }
  return createArticleThroughAPI(operator, slugSuffix, {
    body,
    operator: operator.id,
    title: `Article with ${slugSuffix}`,
  })
}

async function assertMediaIsolation() {
  const ownMedia = await restRequest(operatorA.domain, `media/${mediaAId}?depth=0`)
  expect(ownMedia.status).toBe(200)
  const foreignMedia = await restRequest(operatorA.domain, `media/${mediaBId}?depth=0`)
  expect([403, 404]).toContain(foreignMedia.status)
}

async function assertHostResolutionAndRecovery() {
  const unknownHost = 'unknown-tenant.example.test'
  const unknownRest = await restRequest(unknownHost, 'articles?limit=1')
  expect(unknownRest.status).toBe(404)
  const unknownGraphQL = await payloadGraphQLPost(
    new Request(`http://${unknownHost}/api/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', host: unknownHost },
      body: JSON.stringify({ query: '{ Articles { docs { id } } }' }),
    }),
  )
  expect(unknownGraphQL.status).toBe(404)

  const suspendedPublicRead = await restRequest(suspendedOperator.domain, 'articles?limit=1')
  expect([200, 403, 404]).toContain(suspendedPublicRead.status)
  if (suspendedPublicRead.status === 200) {
    const body = (await suspendedPublicRead.json()) as { docs: unknown[] }
    expect(body.docs).toEqual([])
  }

  const recovery = await restPatch(
    suspendedOperator.domain,
    `operators/${suspendedOperator.id}`,
    undefined,
    platformAdminToken,
    { status: 'active' },
  )
  expect(recovery.status).toBe(200)
  const recovered = await payload.findByID({
    collection: 'operators',
    id: suspendedOperator.id,
    overrideAccess: true,
  })
  expect(recovered.status).toBe('active')
}

async function createOperator(suffix: string, status: 'active' | 'suspended' = 'active') {
  const operator = await payload.create({
    collection: 'operators',
    data: {
      domain: `${fixturePrefix}-${suffix}.example.test`,
      name: `${fixturePrefix} ${suffix}`,
      status,
    },
    overrideAccess: true,
  })

  return { domain: operator.domain, id: operator.id }
}

function graphQLRequest(host: string, tenantId: number, body: unknown) {
  return payloadGraphQLPost(
    new Request(`http://${host}/api/graphql`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `payload-tenant=${tenantId}`,
        host,
      },
      body: JSON.stringify(body),
    }),
  )
}

async function createArticle(operatorId: number, slug: string, title: string, draft = false) {
  return payload.create({
    collection: 'articles',
    data: {
      _status: draft ? 'draft' : 'published',
      body: richTextBody as never,
      category: 'Integration',
      difficulty: 'beginner',
      operator: operatorId,
      slug,
      sourceUrl: `https://example.test/${slug}`,
      title,
    },
    draft,
    locale: 'es',
    overrideAccess: true,
  })
}

function restRequest(host: string, path: string, tenantId?: number) {
  const headers = new Headers({ host })
  if (tenantId !== undefined) headers.set('cookie', `payload-tenant=${tenantId}`)

  return payloadRESTGet(new Request(`http://${host}/api/${path}`, { headers }), {
    params: Promise.resolve({ slug: path.split('?')[0]?.split('/') ?? [] }),
  })
}

function restPatch(
  host: string,
  path: string,
  tenantId: number | undefined,
  token: string,
  data: unknown,
) {
  const headers = new Headers({
    authorization: `JWT ${token}`,
    'content-type': 'application/json',
    host,
  })
  if (tenantId !== undefined) headers.set('cookie', `payload-tenant=${tenantId}`)

  return payloadRESTPatch(
    new Request(`http://${host}/api/${path}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    }),
    { params: Promise.resolve({ slug: path.split('?')[0]?.split('/') ?? [] }) },
  )
}

function restPost(host: string, path: string, tenantId: number, token: string, data: unknown) {
  return payloadRESTPost(
    new Request(`http://${host}/api/${path}`, {
      method: 'POST',
      headers: {
        authorization: `JWT ${token}`,
        'content-type': 'application/json',
        cookie: `payload-tenant=${tenantId}`,
        host,
      },
      body: JSON.stringify(data),
    }),
    { params: Promise.resolve({ slug: path.split('?')[0]?.split('/') ?? [] }) },
  )
}
