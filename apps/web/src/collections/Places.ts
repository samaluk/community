import type { CollectionConfig } from 'payload'

import { getPublicContentPublishing } from '@/lib/publicContentPublishing'

import { localizedRichBodyField, localizedTitleField, uniqueSlugField } from './fields'

const publishing = getPublicContentPublishing('places')

export const Places: CollectionConfig = {
  slug: 'places',
  labels: {
    singular: 'Place',
    plural: 'Places',
  },
  ...publishing,
  admin: {
    ...publishing.admin,
    defaultColumns: ['title', 'accessType', 'region', 'updatedAt'],
    useAsTitle: 'title',
  },
  fields: [
    localizedTitleField(),
    uniqueSlugField(),
    {
      name: 'summary',
      type: 'textarea',
      localized: true,
    },
    localizedRichBodyField(),
    {
      name: 'accessType',
      type: 'select',
      defaultValue: 'open',
      options: [
        {
          label: 'Open',
          value: 'open',
        },
        {
          label: 'Private',
          value: 'private',
        },
        {
          label: 'Restricted',
          value: 'restricted',
        },
      ],
      required: true,
    },
    {
      name: 'region',
      type: 'text',
    },
    {
      name: 'city',
      type: 'text',
      label: 'City / locality',
    },
    {
      name: 'externalUrl',
      type: 'text',
      label: 'External URL',
    },
    {
      name: 'location',
      type: 'point',
      label: 'Location',
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
