import type { PostgresAdapterArgs } from '@payloadcms/db-postgres'
import { getTableColumns } from '@payloadcms/db-postgres/drizzle'
import { getTableConfig, varchar } from '@payloadcms/db-postgres/drizzle/pg-core'

export const legacyVersionHtmlCollections = ['places', 'products'] as const

const operatorTables = [
  'articles',
  'places',
  'products',
  'memberships',
  'media',
  'site_settings',
  'home_page',
  'users_tenants',
] as const

const versionTables = [
  '_articles_v',
  '_places_v',
  '_products_v',
  '_memberships_v',
  '_home_page_v',
] as const

function enforceRequiredOperator(table: Parameters<typeof getTableColumns>[0], columnName: string) {
  const columns = getTableColumns(table)
  const operatorColumn = columns[columnName]
  if (!operatorColumn) return

  Object.defineProperty(operatorColumn, 'notNull', { value: true })

  for (const foreignKey of getTableConfig(table).foreignKeys) {
    if (foreignKey.reference().columns.includes(operatorColumn)) {
      Object.defineProperty(foreignKey, 'onDelete', { value: 'restrict' })
    }
  }
}

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

  // Drizzle push otherwise follows the plugin's nullable SET NULL schema and
  // undoes the forward migration. Encode application ownership in the schema
  // itself so dev push and the production build push agree on these invariants.
  for (const tableName of operatorTables) {
    const table = schema.tables[tableName]
    if (table) enforceRequiredOperator(table, 'operator')
  }

  for (const tableName of versionTables) {
    const table = schema.tables[tableName]
    if (table) enforceRequiredOperator(table, 'version_operator')
  }

  return schema
}
