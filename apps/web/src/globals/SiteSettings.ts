import type { CollectionConfig } from 'payload'

import { operatorScopedRead } from '@/access/operatorScopedRead'
import { ensureRequestHostOperator, getRecordField, isEditorOrAdmin } from '@/access/roles'
import { revalidateGlobalPublicContent } from '@/lib/publicContentPublishing'
import { getOperatorId } from '@/lib/preview'

export const SiteSettings: CollectionConfig = {
  slug: 'site-settings',
  labels: { singular: 'Site Settings', plural: 'Site Settings' },
  access: {
    read: operatorScopedRead,
    create: isEditorOrAdmin,
    update: isEditorOrAdmin,
  },
  hooks: {
    beforeValidate: [ensureRequestHostOperator],
    afterChange: [
      ({ doc }) => revalidateGlobalPublicContent(getOperatorId(getRecordField(doc, 'operator'))),
    ],
  },
  fields: [
    {
      name: 'brandName',
      type: 'text',
      required: true,
      defaultValue: 'Community',
    },
    {
      name: 'siteDescription',
      type: 'textarea',
      label: 'Site description',
      defaultValue: 'A platform for community connection and shared knowledge.',
    },
    {
      name: 'defaultLocale',
      type: 'text',
      label: 'Default locale',
      defaultValue: 'en',
    },
    {
      name: 'lang',
      type: 'text',
      label: 'Language (HTML lang attribute)',
      defaultValue: 'en',
    },
    {
      name: 'instagramUrl',
      type: 'text',
      label: 'Instagram URL',
    },
    {
      name: 'whatsappUrl',
      type: 'text',
      label: 'WhatsApp URL',
    },
    {
      name: 'memberIdentifierType',
      type: 'select',
      label: 'Member identifier format',
      defaultValue: 'generic',
      options: [
        {
          label: 'Generic identifier',
          value: 'generic',
        },
        {
          label: 'Chilean RUT',
          value: 'cl_rut',
        },
      ],
    },
  ],
}
