import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'

import { ensureRequestHostOperator, isAdmin, isValidationManagerOrAdmin } from '@/access/roles'
import { env } from '@/env'
import { getMembershipPrivacyFields } from '@/lib/membershipPrivacy'
import { validateRut } from '@/lib/rut'

export const populateMembershipPrivacyFields: CollectionBeforeValidateHook = ({ data }) => {
  const identifier: unknown = data?.identifier
  if (typeof identifier !== 'string' || identifier.length === 0) return data

  const rut = validateRut(identifier)
  const storedIdentifier = rut.ok ? `${rut.rut.body}${rut.rut.checkDigit}` : identifier
  const privacyFields = getMembershipPrivacyFields(storedIdentifier, env.PAYLOAD_SECRET)

  return privacyFields ? { ...data, identifier: storedIdentifier, ...privacyFields } : data
}

export const Memberships: CollectionConfig = {
  slug: 'memberships',
  labels: {
    singular: 'Membership',
    plural: 'Memberships',
  },
  admin: {
    useAsTitle: 'normalizedIdentifier',
    defaultColumns: ['normalizedIdentifier', 'isActive', 'updatedAt'],
  },
  access: {
    read: isValidationManagerOrAdmin,
    create: isValidationManagerOrAdmin,
    update: isValidationManagerOrAdmin,
    delete: isAdmin,
  },
  indexes: [
    { fields: ['operator', 'normalizedIdentifier'], unique: true },
    { fields: ['operator', 'lookupHash'], unique: true },
  ],
  hooks: {
    beforeValidate: [ensureRequestHostOperator, populateMembershipPrivacyFields],
  },
  fields: [
    {
      name: 'identifier',
      type: 'text',
      label: 'Member Identifier',
      required: true,
      admin: {
        description:
          'Staff entry field. Payload stores a normalized identifier and lookup hash for checks.',
      },
    },
    {
      name: 'normalizedIdentifier',
      type: 'text',
      required: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'lookupHash',
      type: 'text',
      required: true,
      access: {
        read: () => false,
      },
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      required: true,
      defaultValue: true,
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Internal staff notes. Never exposed in the public verification result.',
      },
    },
  ],
  versions: {
    drafts: false,
  },
}
