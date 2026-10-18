import type { CollectionConfig } from 'payload'

import { getPublicContentPublishing } from '@/lib/publicContentPublishing'

import { localizedRichBodyField, localizedTitleField, uniqueSlugField } from './fields'

const publishing = getPublicContentPublishing('articles')

export const Articles: CollectionConfig = {
  slug: 'articles',
  labels: {
    singular: 'Article',
    plural: 'Articles',
  },
  ...publishing,
  admin: {
    ...publishing.admin,
    defaultColumns: ['title', 'category', 'difficulty', 'reviewedAt'],
    useAsTitle: 'title',
  },
  fields: [
    localizedTitleField(),
    uniqueSlugField(),
    localizedRichBodyField(),
    {
      name: 'category',
      type: 'text',
      label: 'Category',
    },
    {
      name: 'difficulty',
      type: 'select',
      defaultValue: 'beginner',
      options: [
        {
          label: 'Beginner',
          value: 'beginner',
        },
        {
          label: 'Intermediate',
          value: 'intermediate',
        },
        {
          label: 'Advanced',
          value: 'advanced',
        },
      ],
      required: true,
    },
    {
      name: 'reviewedAt',
      type: 'date',
      label: 'Reviewed at',
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
