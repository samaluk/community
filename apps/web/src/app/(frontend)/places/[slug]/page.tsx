import {
  MetaPills,
  PageLede,
  PayloadDocDetail,
  RichContent,
  type SlugPageProps,
} from '@/components/page'
import { getGoogleMapsUrl, placeAccessLabels, type PlaceMapItem } from '@/lib/places'
import { payloadDocRoute } from '@/lib/payloadBySlug'
import type { Place } from '@/payload-types'

const { generateMetadata, generateStaticParams } = payloadDocRoute('places', 'Places')
export { generateMetadata, generateStaticParams }

export default function PlaceDetailPage({ params }: SlugPageProps) {
  return (
    <PayloadDocDetail
      backHref="/places"
      backLabel="Volver a lugares"
      backTestId="place-detail-back-link"
      collection="places"
      kicker="Lugar"
      params={params}
      titleTestId="place-detail-title"
    >
      {(place) => <PlaceDetailBody place={place} />}
    </PayloadDocDetail>
  )
}

function PlaceDetailBody({ place }: { place: Place }) {
  // getGoogleMapsUrl consumes the narrower map-item shape.
  // oxlint-disable-next-line typescript/consistent-type-assertions
  const placeItem = place as PlaceMapItem
  const metaItems = [placeAccessLabels[place.accessType], place.region, place.city].filter(
    (item): item is string => typeof item === 'string' && item.length > 0,
  )

  return (
    <>
      <MetaPills items={metaItems} />
      {place.summary ? <PageLede className="max-w-195">{place.summary}</PageLede> : null}
      <div className="flex flex-wrap gap-3">
        <a
          className="inline-flex min-h-10 w-fit items-center justify-center rounded-md border border-green bg-transparent px-4 font-bold text-green no-underline"
          href={getGoogleMapsUrl(placeItem)}
          rel="noreferrer"
          target="_blank"
        >
          Abrir en Google Maps
        </a>
        <PlaceExternalLink url={place.externalUrl} />
      </div>
      <RichContent body={place.body} />
    </>
  )
}

function PlaceExternalLink({ url }: { url?: null | string }) {
  if (!url) return null

  return (
    <a
      className="inline-flex min-h-10 w-fit items-center justify-center rounded-md border border-green bg-transparent px-4 font-bold text-green no-underline"
      href={url}
      rel="noreferrer"
      target="_blank"
    >
      Sitio web
    </a>
  )
}
