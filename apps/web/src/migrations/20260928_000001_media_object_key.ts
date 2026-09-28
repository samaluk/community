import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Payload 3.90 stores a Blob object key when the storage plugin is enabled.
// Production builds do not push schema, so prerender fails until this column exists.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE public.media ADD COLUMN IF NOT EXISTS _objectkey character varying`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE public.media DROP COLUMN IF EXISTS _objectkey`)
}
