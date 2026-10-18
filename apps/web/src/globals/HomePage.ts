import type { CollectionConfig } from 'payload'

import { ensureHomeVideoOperator } from '@/access/homeVideoOperator'
import { publishedOrStaff } from '@/access/publishedOrStaff'
import {
  ensureRequestHostOperator,
  getRecordField,
  isEditorOrAdmin,
  isVersionEditorOrAdmin,
} from '@/access/roles'
import { buildPreviewUrl, draftVersions, getOperatorId } from '@/lib/preview'
import { revalidateGlobalPublicContent } from '@/lib/publicContentPublishing'

export const HomePage: CollectionConfig = {
  slug: 'home-page',
  labels: { singular: 'Home Page', plural: 'Home Pages' },
  admin: {
    livePreview: {
      url: ({ data, locale }) => {
        const operatorId = getOperatorId(data?.operator)
        if (operatorId === null) return null
        return buildPreviewUrl({
          collection: 'home-page',
          operatorId,
          locale,
          path: '/',
          slug: 'home-page',
        })
      },
    },
    preview: (data, { locale }) => {
      const operatorId = getOperatorId(data?.operator)
      if (operatorId === null) return null
      return buildPreviewUrl({
        collection: 'home-page',
        operatorId,
        locale,
        path: '/',
        slug: 'home-page',
      })
    },
  },
  access: {
    read: publishedOrStaff,
    create: isEditorOrAdmin,
    update: isEditorOrAdmin,
    readVersions: isVersionEditorOrAdmin,
  },
  versions: draftVersions,
  hooks: {
    beforeValidate: [ensureRequestHostOperator, ensureHomeVideoOperator],
    afterChange: [
      ({ doc }) => revalidateGlobalPublicContent(getOperatorId(getRecordField(doc, 'operator'))),
    ],
  },
  fields: [
    {
      name: 'heroVideo',
      type: 'upload',
      label: 'Hero video',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'heroVideoAlt',
      type: 'text',
      label: 'Hero video alt text',
      defaultValue: 'Featured community video',
      required: true,
    },
  ],
}
