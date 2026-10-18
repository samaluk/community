import type { CollectionConfig } from 'payload'

import { isPlatformAdmin, operatorsReadAccess } from '@/access/roles'

const canonicalDomain = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase().replace(/\.$/, '') : value

const isCanonicalDomain = (value: unknown) =>
  typeof value === 'string' &&
  value.length <= 253 &&
  value.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))

export const Operators: CollectionConfig = {
  slug: 'operators',
  labels: {
    singular: 'Operator',
    plural: 'Operators',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'domain', 'status', 'updatedAt'],
  },
  access: {
    read: operatorsReadAccess,
    create: isPlatformAdmin,
    update: isPlatformAdmin,
    delete: () => false,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data || typeof data.domain !== 'string') return data
        return { ...data, domain: canonicalDomain(data.domain) }
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'domain',
      type: 'text',
      label: 'Canonical domain',
      required: true,
      unique: true,
      validate: (value: unknown) =>
        isCanonicalDomain(canonicalDomain(value)) ||
        'Enter a hostname without a scheme, port, path, or trailing dot.',
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      required: true,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
      ],
    },
  ],
}
