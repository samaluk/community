'use client'

import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button-variants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getGoogleMapsUrl, placeAccessLabels } from '@/lib/places'
import type { PlaceMapItem } from '@/lib/places'
import type { PlacesResultsModel } from '@/lib/placesBrowsing'
import { formatDistanceKm } from '@/lib/placesGeo'
import { cn } from '@/lib/utils'

import { PlacesDataTable } from './PlacesDataTable'
import { PlacesMapLoader } from './PlacesMapLoader'
import { PlacesPagination } from './PlacesPagination'

export type PlacesFilteredResultsProps = {
  results: PlacesResultsModel
}

export function PlacesFilteredResults({ results }: PlacesFilteredResultsProps) {
  const { mapPlaces, navigation, pagination, showDistance, sort, userGeo, view } = results
  const placeDocs = pagination.places
  const mapPlaceDocs = mapPlaces ?? placeDocs
  const userLocation = toUserLocation(userGeo)

  if (view === 'table') {
    return (
      <PlacesDataTable
        geoSortActive={showDistance}
        pagination={pagination}
        places={placeDocs}
        showDistance={showDistance}
        sort={sort}
        sortLinks={navigation.sortLinks}
      />
    )
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      <div className="grid grid-cols-places-cards items-start gap-4 max-[760px]:grid-cols-1 max-[760px]:gap-3">
        <PlacesMapLoader places={mapPlaceDocs} userLocation={userLocation} />
        <div
          aria-label="Listado de lugares"
          className="grid max-h-170 gap-2 overflow-auto pe-1 max-[760px]:max-h-none max-[760px]:overflow-visible max-[760px]:pe-0"
        >
          {placeDocs.length ? (
            placeDocs.map((place, index) => (
              <PlaceResultCard
                index={(pagination.page - 1) * pagination.pageSize + index + 1}
                key={place.id}
                place={place}
              />
            ))
          ) : (
            <EmptyResultsCard showDistance={showDistance} />
          )}
        </div>
      </div>
      <PlacesPagination pagination={pagination} />
    </div>
  )
}

function toUserLocation(userGeo: PlacesResultsModel['userGeo']) {
  return userGeo ? { latitude: userGeo.latitude, longitude: userGeo.longitude } : null
}

function EmptyResultsCard({ showDistance }: { showDistance: boolean }) {
  return (
    <Card className="min-w-0" size="sm">
      <CardContent>
        <p className="py-6 text-sm text-muted-foreground">
          {showDistance
            ? 'No hay lugares con coordenadas dentro del radio elegido. Prueba aumentar la distancia máxima.'
            : 'No hay lugares para los filtros seleccionados.'}
        </p>
      </CardContent>
    </Card>
  )
}

function PlaceResultCard({ index, place }: { index: number; place: PlaceMapItem }) {
  return (
    <Card className="min-w-0" size="sm">
      <CardHeader>
        <div className="flex items-start gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-green text-label font-black text-white-soft max-[760px]:size-6 max-[760px]:text-xs">
            {index}
          </span>
          <PlaceCardBadges place={place} />
        </div>
        <CardTitle>{place.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {place.summary ? (
            <p className="max-w-none text-base text-muted max-[760px]:text-sm max-[760px]:leading-snippet-sm">
              {place.summary}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <Link
              className={cn(buttonVariants({ variant: 'link' }), 'font-extrabold')}
              href={`/places/${place.slug}`}
            >
              Ver ficha
            </Link>
            <a
              className={cn(buttonVariants({ variant: 'link' }), 'font-extrabold')}
              href={getGoogleMapsUrl(place)}
              rel="noreferrer"
              target="_blank"
            >
              Google Maps
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PlaceCardBadges({ place }: { place: PlaceMapItem }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline">{placeAccessLabels[place.accessType]}</Badge>
      {place.region ? <Badge variant="outline">{place.region}</Badge> : null}
      {place.city ? <Badge variant="outline">{place.city}</Badge> : null}
      <DistanceBadge place={place} />
    </div>
  )
}

function DistanceBadge({ place }: { place: PlaceMapItem }) {
  if (!('distanceKm' in place) || typeof place.distanceKm !== 'number') return null

  return <Badge variant="secondary">{formatDistanceKm(place.distanceKm)}</Badge>
}
