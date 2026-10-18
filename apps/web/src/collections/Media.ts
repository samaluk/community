import type { CollectionConfig } from 'payload'

import { operatorScopedRead } from '@/access/operatorScopedRead'
import { ensureRequestHostOperator, isAdmin, isEditorOrAdmin } from '@/access/roles'

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
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: true,
}
