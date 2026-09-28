import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { env } from '@/env'

import { Memberships } from './collections/Memberships'
import { Articles } from './collections/Articles'
import { Places } from './collections/Places'
import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Products } from './collections/Products'
import { HomePage } from './globals/HomePage'
import { SiteSettings } from './globals/SiteSettings'

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
  collections: [Users, Media, Memberships, Places, Articles, Products],
  globals: [SiteSettings, HomePage],
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
  ],
})
