import type { PostgresAdapterArgs } from '@payloadcms/db-postgres'
import { varchar } from '@payloadcms/db-postgres/drizzle/pg-core'

export const legacyVersionHtmlCollections = ['places', 'products'] as const

// The HTML-to-Lexical migration retired these fields, but existing databases
// still hold historical HTML in version rows. Keep it outside the Payload API
// so schema synchronization cannot delete it. Removal needs an explicit migration.
export const preserveLegacyVersionHtml: NonNullable<
  PostgresAdapterArgs['afterSchemaInit']
>[number] = ({ extendTable, schema }) => {
  for (const collection of legacyVersionHtmlCollections) {
    const tableName = `_${collection}_v_locales`
    const table = schema.tables[tableName]
    if (!table) continue

    extendTable({
      table,
      columns: { versionBodyHtml: varchar('version_body_html') },
    })
  }

  return schema
}
