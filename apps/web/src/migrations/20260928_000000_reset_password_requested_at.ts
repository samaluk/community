import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Payload 3.90 adds resetPasswordRequestedAt to auth collections.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql`ALTER TABLE public.users ADD COLUMN reset_password_requested_at timestamp(3) with time zone`,
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE public.users DROP COLUMN reset_password_requested_at`)
}
