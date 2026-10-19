import { describe, expect, it } from 'vitest'
import { getTableConfig, integer, pgTable, serial } from '@payloadcms/db-postgres/drizzle/pg-core'

import { preserveLegacyVersionHtml } from '@/lib/preserveLegacyVersionHtml'

describe('preserveLegacyVersionHtml schema extension', () => {
  it('keeps ownership columns required and Operator deletes restricted in generated tables', () => {
    const operators = pgTable('operators', { id: serial('id').primaryKey() })
    const articles = pgTable('articles', {
      id: serial('id').primaryKey(),
      operator: integer('operator').references(() => operators.id, { onDelete: 'set null' }),
    })
    const articleVersions = pgTable('_articles_v', {
      id: serial('id').primaryKey(),
      version_operator: integer('version_operator').references(() => operators.id, {
        onDelete: 'set null',
      }),
    })
    const schema = { enums: {}, relations: {}, tables: { articles, _articles_v: articleVersions } }
    // The hook only inspects the generated schema and does not use adapter services.
    const adapter = {} as Parameters<typeof preserveLegacyVersionHtml>[0]['adapter']
    const args = {
      adapter,
      extendTable: () => undefined,
      schema,
    } satisfies Parameters<typeof preserveLegacyVersionHtml>[0]

    const result = preserveLegacyVersionHtml(args)

    expect(result).toBe(schema)
    expect(articles.operator.notNull).toBe(true)
    expect(articleVersions.version_operator.notNull).toBe(true)
    expect(getTableConfig(articles).foreignKeys[0]?.onDelete).toBe('restrict')
    expect(getTableConfig(articleVersions).foreignKeys[0]?.onDelete).toBe('restrict')
  })
})
