import { ChevronDownIcon, ExternalLinkIcon } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button-variants'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getGoogleMapsUrl, placeAccessLabels, type PlaceMapItem } from '@/lib/places'
import type { PlacesPaginationModel, PlacesSort, PlacesSortLink } from '@/lib/placesBrowsing'
import { formatDistanceKm } from '@/lib/placesGeo'
import { cn } from '@/lib/utils'

import { PlacesColumnControls } from './PlacesColumnControls'
import { PlacesPagination } from './PlacesPagination'

export type PlacesDataTableProps = {
  geoSortActive?: boolean
  pagination: PlacesPaginationModel
  places: PlaceMapItem[]
  showDistance?: boolean
  sort: PlacesSort
  sortLinks: Record<PlacesSort['field'], PlacesSortLink>
}

const columnLabels = {
  accessType: 'Acceso',
  actions: 'Acciones',
  city: 'Ciudad',
  distance: 'Distancia',
  region: 'Región',
  summary: 'Resumen',
  title: 'Lugar',
} as const

const hideableColumns = ['accessType', 'region', 'city', 'summary'] as const

export function PlacesDataTable({
  geoSortActive = false,
  pagination,
  places,
  showDistance = false,
  sort,
  sortLinks,
}: PlacesDataTableProps) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex items-center justify-end gap-3">
        <PlacesColumnControls
          columns={hideableColumns.map((id) => ({ id, label: columnLabels[id] }))}
        />
      </div>
      <div className="overflow-hidden rounded-lg border bg-card [&_thead]:bg-muted">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead data-column="title">
                <ColumnLabel
                  geoSortActive={geoSortActive}
                  label={columnLabels.title}
                  sort={sort}
                  sortField="title"
                  sortLink={sortLinks.title}
                />
              </TableHead>
              {showDistance ? (
                <TableHead data-column="distance">{columnLabels.distance}</TableHead>
              ) : null}
              <TableHead data-column="accessType">
                <ColumnLabel
                  geoSortActive={geoSortActive}
                  label={columnLabels.accessType}
                  sort={sort}
                  sortField="accessType"
                  sortLink={sortLinks.accessType}
                />
              </TableHead>
              <TableHead data-column="region">
                <ColumnLabel
                  geoSortActive={geoSortActive}
                  label={columnLabels.region}
                  sort={sort}
                  sortField="region"
                  sortLink={sortLinks.region}
                />
              </TableHead>
              <TableHead data-column="city">
                <ColumnLabel
                  geoSortActive={geoSortActive}
                  label={columnLabels.city}
                  sort={sort}
                  sortField="city"
                  sortLink={sortLinks.city}
                />
              </TableHead>
              <TableHead data-column="summary">{columnLabels.summary}</TableHead>
              <TableHead data-column="actions">
                <span className="sr-only">{columnLabels.actions}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {places.length ? (
              places.map((place) => (
                <PlaceTableRow key={place.id} place={place} showDistance={showDistance} />
              ))
            ) : (
              <TableRow>
                <TableCell className="h-24 text-center" colSpan={showDistance ? 7 : 6}>
                  <span className="text-muted-foreground">
                    No se encontraron lugares para los filtros seleccionados
                  </span>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <PlacesPagination pagination={pagination} />
    </div>
  )
}

const fallbackText = (value: string | null | undefined, fallback: string) => value || fallback

function PlaceTableRow({
  place,
  showDistance = false,
}: {
  place: PlaceMapItem
  showDistance?: boolean
}) {
  return (
    <TableRow>
      <TableCell data-column="title">
        <Link
          className={cn(buttonVariants({ variant: 'link' }), 'h-auto justify-start p-0 text-start')}
          href={`/places/${place.slug}`}
        >
          {place.title}
        </Link>
      </TableCell>
      {showDistance ? <DistanceTableCell place={place} /> : null}
      <TableCell data-column="accessType">
        <Badge variant="outline">{placeAccessLabels[place.accessType]}</Badge>
      </TableCell>
      <TableCell data-column="region">{fallbackText(place.region, 'Sin región')}</TableCell>
      <TableCell data-column="city">{fallbackText(place.city, 'Sin ciudad')}</TableCell>
      <TableCell data-column="summary">
        <span className="block max-w-105 truncate text-muted-foreground">
          {fallbackText(place.summary, 'Sin resumen')}
        </span>
      </TableCell>
      <TableCell data-column="actions">
        <div className="flex justify-end gap-1">
          <Link
            className={buttonVariants({ size: 'sm', variant: 'outline' })}
            href={`/places/${place.slug}`}
          >
            Ver ficha
          </Link>
          <a
            className={buttonVariants({ size: 'icon-sm', variant: 'outline' })}
            href={getGoogleMapsUrl(place)}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLinkIcon />
            <span className="sr-only">Google Maps</span>
          </a>
        </div>
      </TableCell>
    </TableRow>
  )
}

function DistanceTableCell({ place }: { place: PlaceMapItem }) {
  const distance =
    'distanceKm' in place && typeof place.distanceKm === 'number'
      ? formatDistanceKm(place.distanceKm)
      : '—'

  return <TableCell data-column="distance">{distance}</TableCell>
}

function ColumnLabel({
  geoSortActive,
  label,
  sort,
  sortField,
  sortLink,
}: {
  geoSortActive: boolean
  label: string
  sort: PlacesSort
  sortField: PlacesSort['field']
  sortLink: PlacesSortLink
}) {
  if (geoSortActive) {
    return <span>{label}</span>
  }

  return <SortLink label={label} sort={sort} sortField={sortField} sortLink={sortLink} />
}

function SortLink({
  label,
  sort,
  sortField,
  sortLink,
}: {
  label: string
  sort: PlacesSort
  sortField: PlacesSort['field']
  sortLink: PlacesSortLink
}) {
  const active = sort.field === sortField

  return (
    <Link
      className={cn(buttonVariants({ size: 'sm', variant: 'ghost' }), 'px-0')}
      href={sortLink.href}
    >
      {label}
      <ChevronDownIcon
        className={active && sort.direction === 'asc' ? 'rotate-180' : undefined}
        data-icon="inline-end"
      />
    </Link>
  )
}
