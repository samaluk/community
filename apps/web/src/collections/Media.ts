import type { CollectionConfig } from 'payload'

import { operatorScopedRead } from '@/access/operatorScopedRead'
import { ensureRequestHostOperator, getRecordField, isAdmin, isEditorOrAdmin } from '@/access/roles'
import { getMediaFileURL } from '@/lib/mediaFileURL'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: operatorScopedRead,
    create: isEditorOrAdmin,
    update: isEditorOrAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [ensureRequestHostOperator],
  },
  fields: [
    {
      name: 'url',
      type: 'text',
      hooks: {
        afterRead: [
          ({ data, originalDoc, req, value }) =>
            getMediaFileURL({
              apiRoute: req.payload.config.routes.api ?? '',
              filename: getRecordField(data, 'filename') ?? getRecordField(originalDoc, 'filename'),
              serverURL: req.payload.config.serverURL,
              value: typeof value === 'string' ? value : null,
            }),
        ],
      },
    },
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: {
    adminThumbnail: ({ doc }) => (typeof doc.url === 'string' ? doc.url : null),
  },
}
