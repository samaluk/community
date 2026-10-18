import type { Payload } from 'payload'

import type { Membership } from '@/payload-types'
import { getMembershipLookup } from '@/lib/membershipPrivacy'

export type MembershipRecord = Pick<
  Membership,
  'id' | 'identifier' | 'isActive' | 'lookupHash' | 'normalizedIdentifier' | 'notes'
>

export type VerificationStatus = 'active' | 'invalid_identifier' | 'not_found'

export type VerificationResult = {
  status: VerificationStatus
}

export type MembershipLookupDependencies = {
  findByLookupHash: (lookupHash: string) => Promise<MembershipRecord | null>
  hashSecret: string
}

export const checkMembership = async (
  identifierInput: string,
  lookup: MembershipLookupDependencies,
): Promise<VerificationResult> => {
  const membershipLookup = getMembershipLookup(identifierInput, lookup.hashSecret)

  if (!membershipLookup.ok) {
    return { status: 'invalid_identifier' }
  }

  const membership = await lookup.findByLookupHash(membershipLookup.lookupHash)

  if (!membership?.isActive) {
    return { status: 'not_found' }
  }

  return { status: 'active' }
}

export const findMembershipByLookupHash = async (
  payload: Payload,
  lookupHash: string,
  operatorId: number,
): Promise<MembershipRecord | null> => {
  const result = await payload.find({
    collection: 'memberships',
    depth: 0,
    limit: 1,
    pagination: false,
    // This is an anonymous public verification lookup. Local API calls default
    // to access control, which rejects the request without a staff user; the
    // explicit Operator and HMAC filters below are the authorization boundary.
    overrideAccess: true,
    select: {
      id: true,
      identifier: true,
      isActive: true,
      lookupHash: true,
      normalizedIdentifier: true,
      notes: true,
    },
    where: {
      and: [{ lookupHash: { equals: lookupHash } }, { operator: { equals: operatorId } }],
    },
  })

  return result.docs[0] ?? null
}
