import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { env } from '@/env'
import config from '@/payload.config'
import { checkMembership, findMembershipByLookupHash } from '@/lib/memberships'

let payload: Payload
let operatorId: number

const testIdentifier = 'MEMBER-42'
const testRut = '12.345.678-5'
const cleanedRut = '123456785'

describe('Memberships integration', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const operator = await payload.create({
      collection: 'operators',
      data: {
        domain: `memberships-${Date.now()}.example.test`,
        name: 'Membership integration test',
        status: 'active',
      },
      overrideAccess: true,
    })
    operatorId = operator.id
  })

  afterAll(async () => {
    await payload.delete({
      collection: 'memberships',
      overrideAccess: true,
      where: { operator: { equals: operatorId } },
    })
    await payload.delete({ collection: 'operators', id: operatorId, overrideAccess: true })
  })

  beforeEach(async () => {
    await payload.delete({
      collection: 'memberships',
      overrideAccess: true,
      where: {
        and: [
          { operator: { equals: operatorId } },
          {
            or: [
              {
                identifier: {
                  equals: testIdentifier,
                },
              },
              {
                identifier: {
                  equals: cleanedRut,
                },
              },
            ],
          },
        ],
      },
    })
  })

  it('finds active memberships through the hashed lookup field within its operator', async () => {
    const created = await payload.create({
      collection: 'memberships',
      data: {
        identifier: testIdentifier,
        isActive: true,
        lookupHash: '',
        normalizedIdentifier: '',
        operator: operatorId,
      },
      draft: false,
      overrideAccess: true,
    })

    expect(created.normalizedIdentifier).toBe('member-42')
    expect(created.lookupHash).toMatch(/^[a-f0-9]{64}$/)

    const result = await checkMembership(testIdentifier, {
      findByLookupHash: (lookupHash) => findMembershipByLookupHash(payload, lookupHash, operatorId),
      hashSecret: env.PAYLOAD_SECRET,
    })

    expect(result).toEqual({ status: 'active' })
  })

  it('does not expose inactive memberships as active', async () => {
    await payload.create({
      collection: 'memberships',
      data: {
        identifier: testIdentifier,
        isActive: false,
        lookupHash: '',
        normalizedIdentifier: '',
        operator: operatorId,
      },
      draft: false,
      overrideAccess: true,
    })

    const result = await checkMembership(testIdentifier, {
      findByLookupHash: (lookupHash) => findMembershipByLookupHash(payload, lookupHash, operatorId),
      hashSecret: env.PAYLOAD_SECRET,
    })

    expect(result).toEqual({ status: 'not_found' })
  })

  it('stores RUTs without dots or dash and verifies them across input formats', async () => {
    const created = await payload.create({
      collection: 'memberships',
      data: {
        identifier: testRut,
        isActive: true,
        lookupHash: '',
        normalizedIdentifier: '',
        operator: operatorId,
      },
      draft: false,
      overrideAccess: true,
    })

    expect(created.identifier).toBe(cleanedRut)
    expect(created.normalizedIdentifier).toBe(cleanedRut)
    expect(created.lookupHash).toMatch(/^[a-f0-9]{64}$/)

    for (const input of [testRut, '12345678-5', cleanedRut]) {
      const result = await checkMembership(input, {
        findByLookupHash: (lookupHash) =>
          findMembershipByLookupHash(payload, lookupHash, operatorId),
        hashSecret: env.PAYLOAD_SECRET,
      })

      expect(result).toEqual({ status: 'active' })
    }
  })
})
