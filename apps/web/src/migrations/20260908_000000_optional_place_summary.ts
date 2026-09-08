import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Places.summary is optional in Payload. The baseline retained a NOT NULL
// constraint that development schema synchronization removed automatically.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE public.places_locales ALTER COLUMN summary DROP NOT NULL`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE public.places_locales ALTER COLUMN summary SET NOT NULL`)
}
