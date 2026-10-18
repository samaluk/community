import { APIError, type CollectionBeforeValidateHook, type CollectionConfig } from 'payload'

import { isPlatformAdmin, isPlatformAdminField, ownerOrAdmin } from '@/access/roles'

export const enforceUserCreateAuthority: CollectionBeforeValidateHook = ({
  data,
  operation,
  req,
}) => {
  if (operation !== 'create' || req.payloadAPI === 'local' || req.user?.platformAdmin === true) {
    return data
  }

  throw new APIError('Only a Platform Administrator can create users through the API.', 403)
}

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  access: {
    read: ownerOrAdmin,
    create: isPlatformAdmin,
    update: ownerOrAdmin,
    delete: isPlatformAdmin,
  },
  hooks: {
    beforeValidate: [enforceUserCreateAuthority],
  },
  fields: [
    {
      name: 'platformAdmin',
      type: 'checkbox',
      defaultValue: false,
      access: {
        create: isPlatformAdminField,
        update: isPlatformAdminField,
      },
      admin: {
        description: 'Grants access to every operator and its administration.',
      },
    },
  ],
}
