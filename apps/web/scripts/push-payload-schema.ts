import type { PostgresAdapter } from '@payloadcms/db-postgres'
import type { DatabaseAdapter } from 'payload'
import { getPayload } from 'payload'

import { loadBuildEnv, loadProductionEnv } from './loadScriptEnv.js'

const useProductionEnv = process.argv.includes('--production')

if (useProductionEnv) loadProductionEnv()
else loadBuildEnv()

if (process.env.NODE_ENV !== 'production') {
  throw new Error('push:schema must run with NODE_ENV=production')
}

// Payload's connect() skips push when NODE_ENV is production, and the dev
// push records batch -1, which makes the next migrate prompt and exit.
// Apply the Drizzle diff directly so production builds stay non-interactive.
const { default: config } = await import('../src/payload.config.js')

type SchemaPushResult = {
  apply: () => Promise<void>
  hasDataLoss: boolean
  warnings: readonly string[]
}

type PushableAdapter = DatabaseAdapter &
  Pick<
    PostgresAdapter,
    'drizzle' | 'extensions' | 'requireDrizzleKit' | 'schema' | 'schemaName' | 'tablesFilter'
  >

function isPushableAdapter(db: DatabaseAdapter): db is PushableAdapter {
  return 'requireDrizzleKit' in db && 'schema' in db && 'drizzle' in db && 'extensions' in db
}

function isSchemaPushResult(value: unknown): value is SchemaPushResult {
  if (typeof value !== 'object' || value === null) return false
  if (!('apply' in value) || typeof value.apply !== 'function') return false
  if (!('hasDataLoss' in value) || typeof value.hasDataLoss !== 'boolean') return false
  if (!('warnings' in value) || !Array.isArray(value.warnings)) return false

  return value.warnings.every((warning) => typeof warning === 'string')
}

let exitCode = 0

try {
  const payload = await getPayload({ config })

  try {
    if (!isPushableAdapter(payload.db)) {
      throw new Error('Payload database adapter cannot push a Postgres schema')
    }

    const { pushSchema } = payload.db.requireDrizzleKit()
    const pushed: unknown = await pushSchema(
      payload.db.schema,
      payload.db.drizzle,
      payload.db.schemaName ? [payload.db.schemaName] : undefined,
      payload.db.tablesFilter,
      payload.db.extensions.postgis ? ['postgis'] : undefined,
    )

    if (!isSchemaPushResult(pushed)) {
      throw new Error('Drizzle schema push returned an unexpected result')
    }

    if (pushed.hasDataLoss) {
      throw new Error(
        `Schema push would lose data:\n${pushed.warnings.join('\n') || '(no details)'}`,
      )
    }

    if (pushed.warnings.length > 0) {
      payload.logger.warn(`Schema push warnings:\n${pushed.warnings.join('\n')}`)
    }

    await pushed.apply()
    payload.logger.info('Pushed Payload schema.')
  } finally {
    await payload.destroy()
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  exitCode = 1
}

process.exit(exitCode)
