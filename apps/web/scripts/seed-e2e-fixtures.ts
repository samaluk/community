/**
 * Seeds the fixture content the instant-navigation e2e suite runs against:
 * published places, articles, and products with fixed slugs.
 *
 * Idempotent: upserts by slug. Runs against POSTGRES_URL (the same database
 * the served build reads). Invoked from the Playwright globalSetup and can
 * also be run standalone: `pnpm exec tsx scripts/seed-e2e-fixtures.ts`.
 */
import { getPayload, type Payload, type RequiredDataFromCollectionSlug } from 'payload'

import { loadTestEnv } from './loadScriptEnv.js'
import { getTestOperator } from './getTestOperator.js'

loadTestEnv()
await import('../src/env.js')

const richTextBody = {
  root: {
    type: 'root',
    format: 'richText',
    version: 2,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        version: 1,
        children: [
          {
            text: 'Contenido de fixture para el test de navegacion instantanea.',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
      },
    ],
  },
}

const fixtureCollections = ['places', 'articles', 'products'] as const

type FixtureCollection = (typeof fixtureCollections)[number]

/**
 * Per-collection fixture shape: each collection's docs are checked against
 * its own Payload data type via the `satisfies` map below, so a place shape
 * cannot silently drift into a product shape. `body` is exempted because
 * Payload's generated rich-text type is lossier than the lexical editor
 * state fixtures carry (its root demands an indent/alignment `format` the
 * real serialized state does not emit).
 */
type FixtureDoc<C extends FixtureCollection> = Omit<
  RequiredDataFromCollectionSlug<C>,
  'body' | 'operator'
> & {
  body: typeof richTextBody
  slug: string
}

const fixtures = {
  articles: [
    {
      body: richTextBody,
      category: 'Getting Started',
      difficulty: 'beginner',
      slug: 'articulo-fixture-1',
      sourceUrl: 'https://mbqb.cl/fixture/articulo-1',
      title: 'Articulo Fixture Uno',
    },
    {
      body: richTextBody,
      category: 'Rules & Etiquette',
      difficulty: 'intermediate',
      slug: 'articulo-fixture-2',
      sourceUrl: 'https://mbqb.cl/fixture/articulo-2',
      title: 'Articulo Fixture Dos',
    },
  ],
  places: [
    {
      accessType: 'open',
      body: richTextBody,
      slug: 'place-fixture-1',
      sourceUrl: 'https://community.example/fixture/place-1',
      summary: 'Lugar de fixture para pruebas.',
      title: 'Lugar Fixture Uno',
    },
    {
      accessType: 'private',
      body: richTextBody,
      slug: 'place-fixture-2',
      sourceUrl: 'https://community.example/fixture/place-2',
      summary: 'Lugar de fixture privado.',
      title: 'Lugar Fixture Dos',
    },
  ],
  products: [
    {
      body: richTextBody,
      priceCLP: 15_000,
      slug: 'producto-fixture-1',
      sourceUrl: 'https://mbqb.cl/fixture/producto-1',
      stockStatus: 'available',
      title: 'Producto Fixture Uno',
    },
    {
      body: richTextBody,
      priceCLP: 25_000,
      slug: 'producto-fixture-2',
      sourceUrl: 'https://mbqb.cl/fixture/producto-2',
      stockStatus: 'unavailable',
      title: 'Producto Fixture Dos',
    },
  ],
} satisfies { [K in FixtureCollection]: readonly FixtureDoc<K>[] }

async function upsertFixtures() {
  const { default: config } = await import('@payload-config')
  const payload = await getPayload({ config })

  try {
    const operator = await getTestOperator(payload)
    // These six fixture slugs are independent. Await every write before
    // destroying the adapter, including when one fixture fails.
    const results = await Promise.allSettled(
      fixtureCollections.flatMap((collection) =>
        fixtures[collection].map((data) =>
          upsertFixtureDoc(payload, collection, data, operator.id),
        ),
      ),
    )
    const failures = results.filter((result) => result.status === 'rejected')
    if (failures.length) {
      throw new AggregateError(
        failures.map(({ reason }): unknown => reason),
        'Could not seed all E2E fixtures',
      )
    }
  } finally {
    await payload.destroy()
  }
}

async function upsertFixtureDoc(
  payload: Payload,
  collection: FixtureCollection,
  data: FixtureDoc<FixtureCollection>,
  operatorId: number,
) {
  const slug = data.slug
  const existing = await payload.find({
    collection,
    depth: 0,
    draft: true,
    limit: 1,
    locale: 'es',
    overrideAccess: true,
    where: {
      and: [{ operator: { equals: operatorId } }, { slug: { equals: slug } }],
    },
  })

  // Per-collection shapes are enforced upstream by the `satisfies` map
  // and `FixtureDoc`; only the rich-text body widens through Payload's
  // generated type, whose root shape (indent/format) is lossier than
  // the lexical editor state fixtures carry.
  // oxlint-disable no-unsafe-type-assertion, typescript/consistent-type-assertions
  const payloadData = {
    ...data,
    body: data.body as unknown as RequiredDataFromCollectionSlug<FixtureCollection>['body'],
    _status: 'published',
    operator: operatorId,
  } as RequiredDataFromCollectionSlug<FixtureCollection>
  // oxlint-enable no-unsafe-type-assertion, typescript/consistent-type-assertions

  if (existing.docs[0]?.id) {
    await payload.update({
      id: existing.docs[0].id,
      collection,
      data: payloadData,
      draft: false,
      locale: 'es',
      overrideAccess: true,
    })
    console.log(`[seed] updated ${collection}/${slug}`)
    return
  }

  await payload.create({
    collection,
    data: payloadData,
    draft: false,
    locale: 'es',
    overrideAccess: true,
  })
  console.log(`[seed] created ${collection}/${slug}`)
}

export async function seedE2eFixtures() {
  await upsertFixtures()
  console.log('[seed] fixture content ready')
}

if (process.argv[1]?.endsWith('seed-e2e-fixtures.ts')) {
  await seedE2eFixtures()
  // Payload's postgres adapter keeps its initial connection checked out. The
  // standalone seed command is a short-lived CI process, so exit after the
  // writes complete instead of waiting forever on that adapter-owned handle.
  process.exit(0)
}
