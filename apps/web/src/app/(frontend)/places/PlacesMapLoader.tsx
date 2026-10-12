'use client'

import dynamic from 'next/dynamic'

import type { PlaceMapItem } from '@/lib/places'
import type { GeoPoint } from '@/lib/placesGeo'

const PlacesMap = dynamic(() => import('./PlacesMap'), {
  loading: () => (
    <div className="sticky inset-bs-6 z-0 grid min-h-170 place-items-center overflow-hidden rounded-lg border border-line bg-white-soft text-base font-bold text-muted max-[760px]:relative max-[760px]:inset-bs-auto max-[760px]:min-h-55">
      Cargando mapa
    </div>
  ),
  ssr: false,
})

export function PlacesMapLoader({
  places,
  userLocation,
}: {
  places: PlaceMapItem[]
  userLocation?: GeoPoint | null
}) {
  return <PlacesMap places={places} userLocation={userLocation ?? null} />
}
