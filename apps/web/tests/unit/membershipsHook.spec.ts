import { describe, expect, it } from 'vitest'

import { populateMembershipPrivacyFields } from '@/collections/Memberships'
import { env } from '@/env'
import { getMembershipPrivacyFields } from '@/lib/membershipPrivacy'

describe('membership privacy before-validation hook', () => {
  it('stores a valid RUT without punctuation and derives its lookup fields', () => {
    const result = populateMembershipPrivacyFields({
      data: { identifier: ' 12.345.678-5 ', isActive: true },
    } as never)

    expect(result).toMatchObject({
      identifier: '123456785',
      isActive: true,
      ...getMembershipPrivacyFields('123456785', env.PAYLOAD_SECRET),
    })
  })

  it('preserves a non-RUT identifier while normalizing only its private lookup fields', () => {
    const result = populateMembershipPrivacyFields({
      data: { identifier: ' Member-123 ' },
    } as never)

    expect(result).toMatchObject({
      identifier: ' Member-123 ',
      ...getMembershipPrivacyFields('member-123', env.PAYLOAD_SECRET),
    })
  })

  it('leaves missing and empty identifiers unchanged for Payload validation', () => {
    const missing = { isActive: true }
    const empty = { identifier: '' }

    expect(populateMembershipPrivacyFields({ data: missing } as never)).toBe(missing)
    expect(populateMembershipPrivacyFields({ data: empty } as never)).toBe(empty)
  })
})
