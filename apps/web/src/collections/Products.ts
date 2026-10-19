import type { CollectionConfig } from 'payload'

import { getPublicContentPublishing } from '@/lib/publicContentPublishing'

import { localizedRichBodyField, localizedTitleField, uniqueSlugField } from './fields'

const publishing = getPublicContentPublishing('products')

export const Products: CollectionConfig = {
  slug: 'products',
  ...publishing,
  admin: {
    ...publishing.admin,
    defaultColumns: ['title', 'priceCLP', 'stockStatus', 'updatedAt'],
    useAsTitle: 'title',
  },
  fields: [
    localizedTitleField(),
    uniqueSlugField(),
    localizedRichBodyField(),
    {
      name: 'priceCLP',
      type: 'number',
      label: 'Price CLP',
      required: true,
    },
    {
      name: 'stockStatus',
      type: 'select',
      defaultValue: 'available',
      options: [
        {
          label: 'Available',
          value: 'available',
        },
        {
          label: 'Unavailable',
          value: 'unavailable',
        },
      ],
      required: true,
    },
    {
      name: 'imageUrl',
      type: 'text',
      label: 'Source image URL',
    },
    {
      name: 'sourceUrl',
      type: 'text',
      label: 'Original URL',
      required: true,
    },
    {
      name: 'sourceUpdatedAt',
      type: 'date',
      label: 'Original updated at',
    },
  ],
}
