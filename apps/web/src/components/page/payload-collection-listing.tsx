import Link from 'next/link'
import { Fragment, Suspense } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import type { CollectionSlug, DataFromCollectionSlug } from 'payload'

import { buttonVariants } from '@/components/ui/button-variants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getPayloadDocs } from '@/lib/payloadBySlug'
import type { Config } from '@/payload-types'
import { cn } from '@/lib/utils'

import { PageGrid } from './page-grid'
import { PageKicker } from './page-kicker'
import { PageLede } from './page-lede'
import { RichSnippet } from './rich-snippet'
import { PageShell } from './page-shell'
import { PageTitle } from './page-title'

export type PayloadCollectionListingProps<TSlug extends CollectionSlug<Config>> = {
  collection: TSlug
  kicker: string
  title: string
  lede: string
  /** Renders one grid card per doc. */
  renderItem: (doc: DataFromCollectionSlug<TSlug>) => ReactNode
}

/**
 * Standard listing page for a Payload collection: shell header and a streaming
 * Suspense boundary around draft-aware fetching. The shell renders
 * synchronously; only the grid suspends.
 */
export function PayloadCollectionListing<TSlug extends CollectionSlug<Config>>({
  collection,
  kicker,
  lede,
  renderItem,
  title,
}: PayloadCollectionListingProps<TSlug>) {
  return (
    <PageShell>
      <PageKicker>{kicker}</PageKicker>
      <PageTitle>{title}</PageTitle>
      <PageLede>{lede}</PageLede>
      <Suspense fallback={null}>
        <ListingGrid collection={collection} renderItem={renderItem} />
      </Suspense>
    </PageShell>
  )
}

async function ListingGrid<TSlug extends CollectionSlug<Config>>({
  collection,
  renderItem,
}: Pick<PayloadCollectionListingProps<TSlug>, 'collection' | 'renderItem'>) {
  const docs = await getPayloadDocs(collection)

  return (
    <PageGrid>
      {docs.map((doc) => (
        <Fragment key={doc.id}>{renderItem(doc)}</Fragment>
      ))}
    </PageGrid>
  )
}

export type DocCardProps = {
  badges: ReactNode
  /** Lexical rich-text state rendered by the card's snippet. */
  body: ComponentProps<typeof RichSnippet>['body']
  href: string
  linkLabel: string
  title: ReactNode
  image?: ReactNode
}

/** Card scaffold shared by every collection listing grid. */
export function DocCard({ badges, body, href, image, linkLabel, title }: DocCardProps) {
  return (
    <Card className="min-w-0" size="sm">
      {image}
      <CardHeader>
        <div className="flex flex-wrap gap-2">{badges}</div>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <RichSnippet body={body} />
          <Link
            className={cn(buttonVariants({ variant: 'link' }), 'w-fit font-extrabold')}
            href={href}
          >
            {linkLabel}
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
