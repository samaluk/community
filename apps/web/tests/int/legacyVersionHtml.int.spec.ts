import { randomUUID } from 'node:crypto'

import { postgresAdapter, sql } from '@payloadcms/db-postgres'
import { buildConfig, getPayload } from 'payload'
import { expect, it } from 'vitest'

import {
  legacyVersionHtmlCollections,
  preserveLegacyVersionHtml,
} from '@/lib/preserveLegacyVersionHtml'

it.each([
  { collections: legacyVersionHtmlCollections },
  ...legacyVersionHtmlCollections.map((collection) => ({ collections: [collection] })),
  { collections: [] },
])(
  'syncs the schema and preserves historical HTML with collections $collections',
  async ({ collections }) => {
    const schemaName = `legacy_html_${randomUUID().replaceAll('-', '')}`
    const payload = await getPayload({
      config: buildConfig({
        secret: 'schema-regression-test-secret',
        db: postgresAdapter({
          pool: { connectionString: process.env.TEST_POSTGRES_URL },
          schemaName,
          push: false,
          afterSchemaInit: [preserveLegacyVersionHtml],
        }),
        localization: { locales: ['es', 'en'], defaultLocale: 'es' },
        collections: collections.map((slug) => ({
          slug,
          versions: { drafts: true },
          fields: [{ name: 'title', type: 'text', localized: true }],
        })),
      }),
      key: schemaName,
    })

    try {
      const { pushSchema } = payload.db.requireDrizzleKit()
      const push = () => pushSchema(payload.db.schema, payload.db.drizzle, [schemaName])
      await payload.db.drizzle.execute(
        sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(schemaName)}`,
      )
      await (await push()).apply()

      for (const collection of collections) {
        for (const locale of ['es', 'en'] as const) {
          await payload.create({
            collection,
            data: { title: 'Historical content' },
            locale,
            draft: true,
          })
        }
        const table = sql`${sql.identifier(schemaName)}.${sql.identifier(`_${collection}_v_locales`)}`
        // Reproduce an existing database whose retired HTML fields still have data.
        await payload.db.drizzle.execute(
          sql`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS version_body_html varchar`,
        )
        await payload.db.drizzle.execute(
          sql`UPDATE ${table} SET version_body_html = '<p>Historical HTML</p>'`,
        )
      }

      const pushed = await push()
      expect(pushed.hasDataLoss).toBe(false)
      await pushed.apply()

      for (const collection of collections) {
        const table = sql`${sql.identifier(schemaName)}.${sql.identifier(`_${collection}_v_locales`)}`
        const result = await payload.db.drizzle.execute(sql`SELECT version_body_html FROM ${table}`)
        expect(result.rows.length).toBeGreaterThan(0)
        for (const row of result.rows) {
          expect(row.version_body_html).toBe('<p>Historical HTML</p>')
        }
      }
    } finally {
      try {
        await payload.db.drizzle.execute(sql`DROP SCHEMA ${sql.identifier(schemaName)} CASCADE`)
      } finally {
        await payload.destroy()
      }
    }
  },
  30_000,
)
