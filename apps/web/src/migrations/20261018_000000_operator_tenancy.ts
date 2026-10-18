import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import { getInitialOperatorDomain } from '../collections/operatorDomain.js'

/** Move the existing single-site Payload data into its initial Operator. */
type MigrationDB = MigrateUpArgs['db']

async function createOperatorSchema(db: MigrationDB): Promise<void> {
  await db.execute(sql`CREATE TYPE public.enum_operators_status AS ENUM ('active', 'suspended')`)
  await db.execute(sql`CREATE TYPE public.enum_users_tenants_role AS ENUM (
    'admin',
    'editor',
    'validation-manager'
  )`)
  await db.execute(sql`CREATE TABLE public.operators (
    id integer NOT NULL,
    name character varying NOT NULL,
    domain character varying NOT NULL,
    status public.enum_operators_status DEFAULT 'active'::public.enum_operators_status NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
  )`)
  await db.execute(
    sql`CREATE SEQUENCE public.operators_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1`,
  )
  await db.execute(sql`ALTER SEQUENCE public.operators_id_seq OWNED BY public.operators.id`)
  await db.execute(
    sql`ALTER TABLE ONLY public.operators ALTER COLUMN id SET DEFAULT nextval('public.operators_id_seq'::regclass)`,
  )
  await db.execute(
    sql`ALTER TABLE ONLY public.operators ADD CONSTRAINT operators_pkey PRIMARY KEY (id)`,
  )
  await db.execute(
    sql`CREATE INDEX operators_created_at_idx ON public.operators USING btree (created_at)`,
  )
  await db.execute(
    sql`CREATE UNIQUE INDEX operators_domain_idx ON public.operators USING btree (domain)`,
  )
  await db.execute(
    sql`CREATE INDEX operators_updated_at_idx ON public.operators USING btree (updated_at)`,
  )
}

async function createInitialOperator(db: MigrationDB, domain: string): Promise<void> {
  await db.execute(sql`INSERT INTO public.operators (id, name, domain, status, updated_at, created_at)
    VALUES (
      1,
      COALESCE((SELECT brand_name FROM public.site_settings ORDER BY id LIMIT 1), 'Community'),
      ${domain},
      'active',
      COALESCE((SELECT updated_at FROM public.site_settings ORDER BY id LIMIT 1), now()),
      COALESCE((SELECT created_at FROM public.site_settings ORDER BY id LIMIT 1), now())
    )`)
  await db.execute(
    sql`SELECT setval('public.operators_id_seq', GREATEST((SELECT max(id) FROM public.operators), 1), true)`,
  )
}

async function migrateUsersToOperatorMemberships(db: MigrationDB): Promise<void> {
  await db.execute(sql`ALTER TABLE public.users ADD COLUMN platform_admin boolean DEFAULT false`)
  await db.execute(sql`CREATE TABLE public.users_tenants (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id character varying NOT NULL,
    operator_id integer NOT NULL,
    role public.enum_users_tenants_role DEFAULT 'editor'::public.enum_users_tenants_role NOT NULL
  )`)
  await db.execute(
    sql`ALTER TABLE ONLY public.users_tenants ADD CONSTRAINT users_tenants_pkey PRIMARY KEY (id)`,
  )
  await db.execute(sql`ALTER TABLE ONLY public.users_tenants
    ADD CONSTRAINT users_tenants_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.users(id) ON DELETE CASCADE`)
  await db.execute(sql`ALTER TABLE ONLY public.users_tenants
    ADD CONSTRAINT users_tenants_operator_id_operators_id_fk FOREIGN KEY (operator_id) REFERENCES public.operators(id) ON DELETE RESTRICT`)
  await db.execute(
    sql`CREATE INDEX users_tenants_operator_idx ON public.users_tenants USING btree (operator_id)`,
  )
  await db.execute(
    sql`CREATE INDEX users_tenants_order_idx ON public.users_tenants USING btree (_order)`,
  )
  await db.execute(
    sql`CREATE INDEX users_tenants_parent_id_idx ON public.users_tenants USING btree (_parent_id)`,
  )
  await db.execute(sql`INSERT INTO public.users_tenants (_order, _parent_id, id, operator_id, role)
    SELECT
      1,
      users.id,
      'legacy-operator-' || users.id::text,
      1,
      users.role::text::public.enum_users_tenants_role
    FROM public.users
    ORDER BY users.id`)
  await db.execute(sql`ALTER TABLE public.users DROP COLUMN role`)
  await db.execute(sql`DROP TYPE public.enum_users_role`)
}

async function assignOperatorToCollections(db: MigrationDB): Promise<void> {
  const tenantTables = [
    ['articles', 'articles_operator_id_operators_id_fk'],
    ['places', 'places_operator_id_operators_id_fk'],
    ['products', 'products_operator_id_operators_id_fk'],
    ['memberships', 'memberships_operator_id_operators_id_fk'],
    ['media', 'media_operator_id_operators_id_fk'],
    ['site_settings', 'site_settings_operator_id_operators_id_fk'],
    ['home_page', 'home_page_operator_id_operators_id_fk'],
  ] as const

  for (const [table, constraint] of tenantTables) {
    await db.execute(sql`ALTER TABLE public.${sql.raw(table)} ADD COLUMN operator_id integer`)
    await db.execute(sql`UPDATE public.${sql.raw(table)} SET operator_id = 1`)
    await db.execute(
      sql`ALTER TABLE public.${sql.raw(table)} ALTER COLUMN operator_id SET NOT NULL`,
    )
    await db.execute(sql`ALTER TABLE ONLY public.${sql.raw(table)}
      ADD CONSTRAINT ${sql.raw(constraint)} FOREIGN KEY (operator_id) REFERENCES public.operators(id) ON DELETE RESTRICT`)
  }
}

async function assignOperatorToVersions(db: MigrationDB): Promise<void> {
  const versionTables = [
    ['_articles_v', '_articles_v_version_operator_id_operators_id_fk'],
    ['_places_v', '_places_v_version_operator_id_operators_id_fk'],
    ['_products_v', '_products_v_version_operator_id_operators_id_fk'],
    ['_memberships_v', '_memberships_v_version_operator_id_operators_id_fk'],
    ['_home_page_v', '_home_page_v_version_operator_id_operators_id_fk'],
  ] as const

  for (const [table, constraint] of versionTables) {
    await db.execute(
      sql`ALTER TABLE public.${sql.raw(table)} ADD COLUMN version_operator_id integer`,
    )
    await db.execute(sql`UPDATE public.${sql.raw(table)} SET version_operator_id = 1`)
    await db.execute(
      sql`ALTER TABLE public.${sql.raw(table)} ALTER COLUMN version_operator_id SET NOT NULL`,
    )
    await db.execute(sql`ALTER TABLE ONLY public.${sql.raw(table)}
      ADD CONSTRAINT ${sql.raw(constraint)} FOREIGN KEY (version_operator_id) REFERENCES public.operators(id) ON DELETE RESTRICT`)
    await db.execute(sql`CREATE INDEX ${sql.raw(`${table}_version_version_operator_idx`)}
      ON public.${sql.raw(table)} USING btree (version_operator_id)`)
  }
}

async function migrateHomePageVersions(db: MigrationDB): Promise<void> {
  // Global versions have no parent_id. Once home-page is a collection, bind
  // its retained history to the existing collection document.
  await db.execute(sql`ALTER TABLE public._home_page_v ADD COLUMN parent_id integer`)
  await db.execute(sql`UPDATE public._home_page_v
    SET parent_id = (SELECT id FROM public.home_page ORDER BY id LIMIT 1)
    WHERE parent_id IS NULL AND EXISTS (SELECT 1 FROM public.home_page)`)
  await db.execute(sql`ALTER TABLE ONLY public._home_page_v
    ADD CONSTRAINT _home_page_v_parent_id_home_page_id_fk
    FOREIGN KEY (parent_id) REFERENCES public.home_page(id) ON DELETE SET NULL`)
  await db.execute(
    sql`CREATE INDEX _home_page_v_parent_idx ON public._home_page_v USING btree (parent_id)`,
  )
}

async function addLockedDocumentRelationships(db: MigrationDB): Promise<void> {
  // These relationship columns are part of Payload's generated collection
  // lock schema after the former globals become collections.
  await db.execute(sql`ALTER TABLE public.payload_locked_documents_rels
    ADD COLUMN operators_id integer,
    ADD COLUMN site_settings_id integer,
    ADD COLUMN home_page_id integer`)
  await db.execute(sql`ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_operators_fk
    FOREIGN KEY (operators_id) REFERENCES public.operators(id) ON DELETE CASCADE`)
  await db.execute(sql`ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_site_settings_fk
    FOREIGN KEY (site_settings_id) REFERENCES public.site_settings(id) ON DELETE CASCADE`)
  await db.execute(sql`ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_home_page_fk
    FOREIGN KEY (home_page_id) REFERENCES public.home_page(id) ON DELETE CASCADE`)
  await db.execute(sql`CREATE INDEX payload_locked_documents_rels_operators_id_idx
    ON public.payload_locked_documents_rels USING btree (operators_id)`)
  await db.execute(sql`CREATE INDEX payload_locked_documents_rels_site_settings_id_idx
    ON public.payload_locked_documents_rels USING btree (site_settings_id)`)
  await db.execute(sql`CREATE INDEX payload_locked_documents_rels_home_page_id_idx
    ON public.payload_locked_documents_rels USING btree (home_page_id)`)
}

async function createScopedIndexes(db: MigrationDB): Promise<void> {
  await db.execute(sql`DROP INDEX public.articles_slug_idx`)
  await db.execute(
    sql`CREATE UNIQUE INDEX articles_operator_slug_idx ON public.articles USING btree (operator_id, slug)`,
  )
  await db.execute(sql`DROP INDEX public.places_slug_idx`)
  await db.execute(
    sql`CREATE UNIQUE INDEX places_operator_slug_idx ON public.places USING btree (operator_id, slug)`,
  )
  await db.execute(sql`DROP INDEX public.products_slug_idx`)
  await db.execute(
    sql`CREATE UNIQUE INDEX products_operator_slug_idx ON public.products USING btree (operator_id, slug)`,
  )
  await db.execute(sql`DROP INDEX public.memberships_normalized_identifier_idx`)
  await db.execute(sql`CREATE UNIQUE INDEX memberships_operator_normalized_identifier_idx
    ON public.memberships USING btree (operator_id, normalized_identifier)`)
  await db.execute(sql`DROP INDEX public.memberships_lookup_hash_idx`)
  await db.execute(sql`CREATE UNIQUE INDEX memberships_operator_lookup_hash_idx
    ON public.memberships USING btree (operator_id, lookup_hash)`)

  await db.execute(
    sql`CREATE INDEX articles_operator_idx ON public.articles USING btree (operator_id)`,
  )
  await db.execute(sql`CREATE INDEX places_operator_idx ON public.places USING btree (operator_id)`)
  await db.execute(
    sql`CREATE INDEX products_operator_idx ON public.products USING btree (operator_id)`,
  )
  await db.execute(
    sql`CREATE INDEX memberships_operator_idx ON public.memberships USING btree (operator_id)`,
  )
  await db.execute(sql`CREATE INDEX media_operator_idx ON public.media USING btree (operator_id)`)
  await db.execute(
    sql`CREATE UNIQUE INDEX site_settings_operator_idx ON public.site_settings USING btree (operator_id)`,
  )
  await db.execute(
    sql`CREATE UNIQUE INDEX home_page_operator_idx ON public.home_page USING btree (operator_id)`,
  )
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const domain = getInitialOperatorDomain(process.env.NEXT_PUBLIC_SERVER_URL)

  await createOperatorSchema(db)
  await createInitialOperator(db, domain)
  await migrateUsersToOperatorMemberships(db)
  await assignOperatorToCollections(db)
  await assignOperatorToVersions(db)
  await migrateHomePageVersions(db)
  await addLockedDocumentRelationships(db)
  await createScopedIndexes(db)
}

/** A rollback must be performed as a forward repair to preserve tenant data. */
export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    'Operator tenancy migration is forward-only because rollback would discard tenant assignments.',
  )
}
