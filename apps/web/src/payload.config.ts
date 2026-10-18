import { postgresAdapter } from '@payloadcms/db-postgres'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { env } from '@/env'

import { isPlatformAdminField } from './access/roles'
import { Operators } from './collections/Operators'
import { Memberships } from './collections/Memberships'
import { Articles } from './collections/Articles'
import { Places } from './collections/Places'
import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { withOperatorField } from './collections/operatorField'
import { Products } from './collections/Products'
import { HomePage } from './globals/HomePage'
import { SiteSettings } from './globals/SiteSettings'
import { preserveLegacyVersionHtml } from './lib/preserveLegacyVersionHtml'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    livePreview: {
      breakpoints: [
        {
          height: 667,
          label: 'Mobile',
          name: 'mobile',
          width: 375,
        },
      ],
    },
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Users,
    Operators,
    withOperatorField(Media),
    withOperatorField(Memberships),
    withOperatorField(Places),
    withOperatorField(Articles),
    withOperatorField(Products),
    withOperatorField(SiteSettings, true),
    withOperatorField(HomePage, true),
  ],
  localization: {
    defaultLocale: 'es',
    fallback: true,
    locales: [
      {
        code: 'es',
        label: 'Español',
      },
      {
        code: 'en',
        label: 'English',
      },
    ],
  },
  editor: lexicalEditor(),
  secret: env.PAYLOAD_SECRET,
  serverURL: env.NEXT_PUBLIC_SERVER_URL,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    afterSchemaInit: [preserveLegacyVersionHtml],
    migrationDir: path.resolve(dirname, 'migrations'),
    pool: {
      connectionString: env.POSTGRES_URL,
    },
    // Greenfield schema sync is Drizzle push, including outside production.
    // Payload skips this flag when NODE_ENV is production; the build calls
    // scripts/push-payload-schema.ts instead of recording a dev migration.
    push: env.NODE_ENV !== 'production',
  }),
  sharp,
  plugins: [
    vercelBlobStorage({
      clientUploads: true,
      enabled: Boolean(env.BLOB_READ_WRITE_TOKEN),
      collections: {
        media: true,
      },
      token: env.BLOB_READ_WRITE_TOKEN,
    }),
    multiTenantPlugin({
      cleanupAfterTenantDelete: false,
      collections: {
        articles: { customTenantField: true, useTenantAccess: false },
        'home-page': { customTenantField: true, isGlobal: true, useTenantAccess: false },
        media: { customTenantField: true, useTenantAccess: false },
        memberships: { customTenantField: true, useTenantAccess: false },
        places: { customTenantField: true, useTenantAccess: false },
        products: { customTenantField: true, useTenantAccess: false },
        'site-settings': { customTenantField: true, isGlobal: true, useTenantAccess: false },
      },
      tenantField: {
        name: 'operator',
      },
      tenantsArrayField: {
        arrayFieldName: 'tenants',
        arrayTenantFieldName: 'operator',
        arrayFieldAccess: {
          create: isPlatformAdminField,
          update: isPlatformAdminField,
        },
        rowFields: [
          {
            name: 'role',
            type: 'select',
            required: true,
            defaultValue: 'editor',
            options: [
              { label: 'Admin', value: 'admin' },
              { label: 'Editor', value: 'editor' },
              { label: 'Validation Manager', value: 'validation-manager' },
            ],
            access: {
              create: isPlatformAdminField,
              update: isPlatformAdminField,
            },
          },
        ],
      },
      tenantsSlug: Operators.slug,
      userHasAccessToAllTenants: (user) =>
        Boolean(user && typeof user === 'object' && 'platformAdmin' in user && user.platformAdmin),
    }),
  ],
})
