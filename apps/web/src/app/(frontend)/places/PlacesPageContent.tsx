import config from '@payload-config'
import { Suspense } from 'react'
import { getPayload } from 'payload'

import { readPlacesUserGeoCookie } from '@/lib/placesGeoCookie'
import { createPayloadPlacesAdapter, loadPlacesBrowsing } from '@/lib/placesBrowsing'
import { getCmsQueryOptions } from '@/lib/cmsQuery'
import { assertActiveOperator, getRequestOperator } from '@/lib/operator'

import { PlacesFilteredResults } from './PlacesFilteredResults'
import { PlacesGeoProvider } from './PlacesGeoContext'
import { PlacesViewControls } from './PlacesViewControls'

export type PlacesPageContentProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function PlacesPageContent({ searchParams }: PlacesPageContentProps) {
  const params = await searchParams
  // Cookie read, Payload boot, and CMS query options don't depend on each
  // other, so race them. The browsing load depends on all three results, so
  // it chains once they settle.
  const { browsing, userGeo } = await Promise.all([
    readPlacesUserGeoCookie(),
    getPayload({ config }),
    getCmsQueryOptions(),
    getRequestOperator(),
  ]).then(async ([geo, payload, cmsQuery, resolvedOperator]) => {
    const operator = assertActiveOperator(resolvedOperator)

    return {
      userGeo: geo,
      browsing: await loadPlacesBrowsing({
        places: createPayloadPlacesAdapter({ cmsQuery, operatorId: operator.id, payload }),
        searchParams: params,
        userGeo: geo,
      }),
    }
  })

  return (
    <Suspense fallback={null}>
      <PlacesGeoProvider initialUserGeo={userGeo}>
        <PlacesViewControls controls={browsing.controls} />
        <PlacesFilteredResults results={browsing.results} />
      </PlacesGeoProvider>
    </Suspense>
  )
}
