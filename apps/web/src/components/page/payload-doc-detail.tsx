import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import type { CollectionSlug, DataFromCollectionSlug } from 'payload'

import { getPayloadDocBySlug } from '@/lib/payloadBySlug'
import type { Config } from '@/payload-types'

import { PageDetail } from './page-shell'
import { PageKicker } from './page-kicker'
import { PageTitle } from './page-title'
import { PublicContentErrorBoundary } from './public-content-error-boundary'

/** Params contract of every Next.js detail route (`[slug]/page.tsx`). */
export type SlugPageProps = {
  params: Promise<{
    slug: string
  }>
}

/**
 * Slugs of collections whose documents carry a `title` — the only
 * collections a detail page can render.
 */
export type TitledCollectionSlug = {
  [TSlug in CollectionSlug<Config>]: DataFromCollectionSlug<TSlug> extends { title: string }
    ? TSlug
    : never
}[CollectionSlug<Config>]

export type PayloadDocDetailProps<TSlug extends TitledCollectionSlug> = SlugPageProps & {
  /** Payload collection the doc is fetched from. */
  collection: TSlug
  backHref: string
  backLabel: string
  backTestId: string
  kicker: string
  /** Instant-nav e2e targets this attribute; every detail route supplies one. */
  titleTestId: string
  /** Renders the doc-specific body once the doc is fetched and verified. */
  children: (doc: DataFromCollectionSlug<TSlug>) => React.ReactNode
}

/**
 * Standard detail page for a Payload doc: back link, kicker, and a streaming
 * Suspense boundary around draft-aware fetch-by-slug with not-found handling.
 * The shell renders synchronously; only the content suspends. Route files
 * supply the collection plus a render function for the doc body.
 */
export function PayloadDocDetail<TSlug extends TitledCollectionSlug>({
  backHref,
  backLabel,
  backTestId,
  children,
  collection,
  kicker,
  params,
  titleTestId,
}: PayloadDocDetailProps<TSlug>) {
  return (
    <PageDetail>
      <Link className="back-link" data-testid={backTestId} href={backHref}>
        {backLabel}
      </Link>
      <PageKicker>{kicker}</PageKicker>
      <Suspense fallback={null}>
        <PublicContentErrorBoundary>
          <DocDetailContent collection={collection} params={params} titleTestId={titleTestId}>
            {children}
          </DocDetailContent>
        </PublicContentErrorBoundary>
      </Suspense>
    </PageDetail>
  )
}

async function DocDetailContent<TSlug extends TitledCollectionSlug>({
  children,
  collection,
  params,
  titleTestId,
}: Pick<PayloadDocDetailProps<TSlug>, 'children' | 'collection' | 'params' | 'titleTestId'>) {
  const { slug } = await params
  const doc = await getPayloadDocBySlug(collection, slug)

  if (!doc) notFound()

  return (
    <>
      <PageTitle data-testid={titleTestId}>{doc.title}</PageTitle>
      {children(doc)}
    </>
  )
}
