import type { PostgresAdapterArgs } from '@payloadcms/db-postgres'
import { varchar } from '@payloadcms/db-postgres/drizzle/pg-core'

// The HTML-to-Lexical migration retired these fields, but existing databases
// still hold historical HTML in version rows. Keep it outside the Payload API
// so schema synchronization cannot delete it. Removal needs an explicit migration.
export const preserveLegacyVersionHtml: NonNullable<
  PostgresAdapterArgs['afterSchemaInit']
>[number] = ({ extendTable, schema }) => {
  for (const tableName of ['_places_v_locales', '_products_v_locales']) {
    extendTable({
      table: schema.tables[tableName],
      columns: { versionBodyHtml: varchar('version_body_html') },
    })
  }

  return schema
}
