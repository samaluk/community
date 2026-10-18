// @vitest-environment node

import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { createPayloadPlacesAdapter } from '@/lib/placesBrowsing'
import type { User } from '@/payload-types'
import { GET as payloadRESTGet } from '@/app/(payload)/api/[...slug]/route'

type TestOperator = { domain: string; id: number }
type TestUser = { email: string; password: string; token: string; user: User }
type MembershipVersionRecord = {
  id: string | number
  version: { operator: number | { id: number } }
}
type MembershipVersionList = { docs: MembershipVersionRecord[] }

type Fixtures = {
  editorA: TestUser
  managerA: TestUser
  managerB: TestUser
  membershipAId: number
  membershipBId: number
  operatorA: TestOperator
  operatorB: TestOperator
  payload: Payload
  versionAIDs: string[]
  versionBIDs: string[]
  prefix: string
}

let fixtures: Fixtures

describe('membership version tenant isolation integration', () => {
  beforeAll(async () => {
    fixtures = await createFixtures()
  })

  afterAll(async () => {
    if (fixtures) await destroyFixtures(fixtures)
  })

  it('scopes version lists and direct reads to the authenticated Operator and role', async () => {
    await assertLocalVersionAccess(fixtures)
    await assertRESTVersionAccess(fixtures)
  })

  it('allows an authorized Operator editor to list that Operator’s draft Places', async () => {
    await assertDraftPlacesListing(fixtures)
  })
})

async function createFixtures(): Promise<Fixtures> {
  const payload = await getPayload({ config: await config })
  const prefix = `membership-version-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const operatorA = await createOperator(payload, prefix, 'a')
  const operatorB = await createOperator(payload, prefix, 'b')
  const managerA = await createUser(payload, prefix, 'manager-a', operatorA, 'validation-manager')
  const editorA = await createUser(payload, prefix, 'editor-a', operatorA, 'editor')
  const managerB = await createUser(payload, prefix, 'manager-b', operatorB, 'validation-manager')
  const membershipAId = await createVersionedMembership(payload, prefix, operatorA, 'member-a')
  const membershipBId = await createVersionedMembership(payload, prefix, operatorB, 'member-b')
  const versionAIDs = await getVersionIDs(payload, membershipAId)
  const versionBIDs = await getVersionIDs(payload, membershipBId)

  return {
    editorA,
    managerA,
    managerB,
    membershipAId,
    membershipBId,
    operatorA,
    operatorB,
    payload,
    versionAIDs,
    versionBIDs,
    prefix,
  }
}

async function destroyFixtures({ payload, prefix, operatorA, operatorB }: Fixtures) {
  await payload.delete({
    collection: 'memberships',
    overrideAccess: true,
    where: { identifier: { contains: prefix } },
  })
  await payload.delete({
    collection: 'users',
    overrideAccess: true,
    where: { email: { contains: prefix } },
  })
  await payload.delete({
    collection: 'places',
    overrideAccess: true,
    where: { slug: { contains: prefix } },
  })
  await payload.delete({ collection: 'operators', id: operatorA.id, overrideAccess: true })
  await payload.delete({ collection: 'operators', id: operatorB.id, overrideAccess: true })
}

async function assertLocalVersionAccess(fixture: Fixtures) {
  const { payload, operatorA, operatorB, managerA, editorA, managerB } = fixture
  const requestA = await createOperatorRequest(payload, managerA.user, operatorA)
  const requestAEditor = await createOperatorRequest(payload, editorA.user, operatorA)
  const requestB = await createOperatorRequest(payload, managerB.user, operatorB)

  const historyA = await findMembershipVersions(payload, requestA, [
    fixture.membershipAId,
    fixture.membershipBId,
  ])
  expect(historyA.docs.length).toBeGreaterThan(0)
  expect(historyA.docs.every((version) => getVersionOperatorID(version) === operatorA.id)).toBe(
    true,
  )
  expect((await findMembershipVersions(payload, requestA, [fixture.membershipBId])).docs).toEqual(
    [],
  )
  await expect(
    findMembershipVersions(payload, requestAEditor, [fixture.membershipAId]),
  ).rejects.toMatchObject({
    status: 403,
  })

  for (const id of fixture.versionBIDs) {
    await expect(
      payload.findVersionByID({
        collection: 'memberships',
        id,
        overrideAccess: false,
        req: requestA,
      }),
    ).rejects.toMatchObject({ status: 403 })
  }

  const historyB = await findMembershipVersions(payload, requestB, [fixture.membershipBId])
  expect(historyB.docs.length).toBeGreaterThan(0)
  expect(historyB.docs.every((version) => getVersionOperatorID(version) === operatorB.id)).toBe(
    true,
  )
  for (const id of fixture.versionBIDs) {
    const version = await payload.findVersionByID({
      collection: 'memberships',
      id,
      overrideAccess: false,
      req: requestB,
    })
    expect(String(version.id)).toBe(id)
  }
}

async function assertRESTVersionAccess(fixture: Fixtures) {
  const { operatorA, operatorB, managerA, managerB, editorA, membershipAId, membershipBId } =
    fixture

  const historyAResponse = await requestMembershipVersions(operatorA, managerA.token, [
    membershipAId,
    membershipBId,
  ])
  expect(historyAResponse.status).toBe(200)
  const historyA = (await historyAResponse.json()) as MembershipVersionList
  expect(historyA.docs.map((version) => String(version.id))).toEqual(
    expect.arrayContaining(fixture.versionAIDs),
  )
  expect(historyA.docs.map((version) => String(version.id))).not.toEqual(
    expect.arrayContaining(fixture.versionBIDs),
  )
  expect(historyA.docs.every((version) => getVersionOperatorID(version) === operatorA.id)).toBe(
    true,
  )

  const foreignHistoryResponse = await requestMembershipVersions(operatorA, managerA.token, [
    membershipBId,
  ])
  expect(foreignHistoryResponse.status).toBe(200)
  expect(((await foreignHistoryResponse.json()) as MembershipVersionList).docs).toEqual([])

  const editorHistoryResponse = await requestMembershipVersions(operatorA, editorA.token, [
    membershipAId,
  ])
  expect(editorHistoryResponse.status).toBe(403)

  const historyBResponse = await requestMembershipVersions(operatorB, managerB.token, [
    membershipBId,
  ])
  expect(historyBResponse.status).toBe(200)
  const historyB = (await historyBResponse.json()) as MembershipVersionList
  expect(historyB.docs.map((version) => String(version.id))).toEqual(
    expect.arrayContaining(fixture.versionBIDs),
  )
}

async function assertDraftPlacesListing({ payload, prefix, operatorA, editorA }: Fixtures) {
  const slug = `${prefix}-draft-place`
  await payload.create({
    collection: 'places',
    data: {
      _status: 'draft',
      accessType: 'open',
      body: emptyRichTextBody,
      operator: operatorA.id,
      slug,
      sourceUrl: `https://example.test/${slug}`,
      title: `${prefix} draft Place`,
    },
    draft: true,
    locale: 'es',
    overrideAccess: true,
  })

  const req = await createOperatorRequest(payload, editorA.user, operatorA)
  const places = createPayloadPlacesAdapter({
    cmsQuery: { draft: true, overrideAccess: false, req },
    operatorId: operatorA.id,
    payload,
  })
  const result = await places.find({ depth: 0, limit: 10, locale: 'es' })
  expect(result.docs.map((place) => place.title)).toContain(`${prefix} draft Place`)
}

async function createOperator(
  payload: Payload,
  prefix: string,
  suffix: string,
): Promise<TestOperator> {
  const operator = await payload.create({
    collection: 'operators',
    data: {
      domain: `${prefix}-${suffix}.example.test`,
      name: `${prefix} ${suffix}`,
      status: 'active',
    },
    overrideAccess: true,
  })
  return { domain: operator.domain, id: operator.id }
}

async function createUser(
  payload: Payload,
  prefix: string,
  suffix: string,
  operator: TestOperator,
  role: 'editor' | 'validation-manager',
): Promise<TestUser> {
  const email = `${prefix}-${suffix}@example.test`
  const password = `${prefix}-test-password`
  const user = await payload.create({
    collection: 'users',
    data: { email, password, tenants: [{ operator: operator.id, role }] },
    overrideAccess: true,
  })
  const login = await payload.login({ collection: 'users', data: { email, password } })
  if (!login.token) throw new Error(`Could not authenticate fixture user ${suffix}`)
  return { email, password, token: login.token, user }
}

async function createVersionedMembership(
  payload: Payload,
  prefix: string,
  operator: TestOperator,
  suffix: string,
) {
  const created = await payload.create({
    collection: 'memberships',
    data: {
      identifier: `${prefix}-${suffix}`,
      isActive: true,
      lookupHash: '',
      normalizedIdentifier: '',
      notes: 'Initial membership version',
      operator: operator.id,
    },
    overrideAccess: true,
  })
  await payload.update({
    collection: 'memberships',
    data: { notes: 'Updated membership version' },
    id: created.id,
    overrideAccess: true,
  })
  return created.id
}

async function getVersionIDs(payload: Payload, parentID: number): Promise<string[]> {
  const history = await payload.findVersions({
    collection: 'memberships',
    limit: 20,
    overrideAccess: true,
    where: { parent: { equals: parentID } },
  })
  return history.docs.map((version) => String(version.id))
}

async function createOperatorRequest(payload: Payload, user: User, operator: TestOperator) {
  return createLocalReq(
    {
      req: {
        headers: new Headers({
          cookie: `payload-tenant=${operator.id}`,
          host: operator.domain,
        }),
      },
      user,
    },
    payload,
  )
}

async function findMembershipVersions(
  payload: Payload,
  req: Awaited<ReturnType<typeof createOperatorRequest>>,
  parentIDs: number[],
) {
  return payload.findVersions({
    collection: 'memberships',
    depth: 0,
    limit: 20,
    overrideAccess: false,
    req,
    where: { parent: { in: parentIDs } },
  })
}

function getVersionOperatorID(version: MembershipVersionRecord): number {
  const operator = version.version.operator
  return typeof operator === 'number' ? operator : operator.id
}

async function requestMembershipVersions(
  operator: TestOperator,
  token: string,
  parentIDs: number[],
) {
  const query = new URLSearchParams({ limit: '20', depth: '0' })
  query.set('where[parent][in]', parentIDs.join(','))
  const path = `memberships/versions?${query.toString()}`
  const route = payloadRESTGet(
    new Request(`http://${operator.domain}/api/${path}`, {
      headers: {
        authorization: `JWT ${token}`,
        cookie: `payload-tenant=${operator.id}`,
        host: operator.domain,
      },
    }),
    { params: Promise.resolve({ slug: ['memberships', 'versions'] }) },
  )
  return route
}

const emptyRichTextBody = {
  root: {
    type: 'root',
    format: '' as const,
    indent: 0,
    version: 2,
    direction: 'ltr' as const,
    children: [],
  },
}
