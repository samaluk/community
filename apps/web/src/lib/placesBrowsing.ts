import type { Payload, Where } from 'payload'

import type { PlaceMapItem } from '@/lib/places'
import { annotatePlacesWithDistance, paginatePlaces } from '@/lib/placesGeo'
import { getPlacesNearWhere } from '@/lib/placesLocation'
import type { StoredUserGeo } from '@/lib/placesUserGeo'
import { applyParamUpdates } from '@/lib/urlSearchParams'

export type PlacesSort = {
  direction: 'asc' | 'desc'
  field: 'accessType' | 'city' | 'region' | 'title'
}

export type PlacesView = 'cards' | 'table'

type PlacesFilters = {
  accessType: string
  city: string
  page: number
  pageSize: number
  q: string
  region: string
  sort: PlacesSort
  view: string
}

export type PlacesPaginationModel = {
  firstRow: number
  label: string
  links: {
    first: PlacesPaginationLink
    last: PlacesPaginationLink
    next: PlacesPaginationLink
    previous: PlacesPaginationLink
  }
  page: number
  pageLabel: string
  pageSize: number
  pageSizeOptions: PlacesPageSizeOption[]
  places: PlaceMapItem[]
  totalDocs: number
  totalPages: number
}

export type PlacesPaginationLink = {
  disabled: boolean
  href: string
}

export type PlacesPageSizeOption = {
  href: string
  value: number
}

export type PlacesSortLink = {
  active: boolean
  direction: PlacesSort['direction']
  disabled: boolean
  href: string
}

export type PlacesNavigationModel = {
  sortLinks: Record<PlacesSort['field'], PlacesSortLink>
}

export type PlacesControlsModel = {
  filterOptions: {
    accessTypes: string[]
    cities: string[]
    regions: string[]
  }
  view: PlacesView
}

export type PlacesResultsModel = {
  mapPlaces?: PlaceMapItem[]
  navigation: PlacesNavigationModel
  pagination: PlacesPaginationModel
  showDistance: boolean
  sort: PlacesSort
  userGeo: StoredUserGeo | null
  view: PlacesView
}

export type PlacesBrowsingModel = {
  controls: PlacesControlsModel
  results: PlacesResultsModel
}

export type FindPlacesArgs = {
  depth: 0
  limit: number
  locale: 'es'
  page?: number
  pagination?: false
  sort?: string
  where?: Where
}

export type FindPlacesResult = {
  docs: PlaceMapItem[]
  page?: number
  totalDocs: number
  totalPages: number
}

export type PlacesFinder = (args: FindPlacesArgs) => Promise<FindPlacesResult>

export type PlacesAdapter = {
  find: PlacesFinder
}

export type PlacesCmsQueryOptions = {
  draft: boolean
  overrideAccess: boolean
}

export type LoadPlacesBrowsingArgs = {
  places: PlacesAdapter
  searchParams: Record<string, string | string[] | undefined>
  userGeo: StoredUserGeo | null
}

const defaultPageSize = 10
const maxPageSize = 50
const geoFetchLimit = 1000

function isSortField(field: string): field is PlacesSort['field'] {
  switch (field) {
    case 'accessType':
    case 'city':
    case 'region':
    case 'title':
      return true
    default:
      return false
  }
}

export function createPayloadPlacesAdapter({
  cmsQuery,
  payload,
}: {
  cmsQuery: PlacesCmsQueryOptions
  payload: Pick<Payload, 'find'>
}): PlacesAdapter {
  return {
    find: async (args) => {
      const result = await payload.find({
        collection: 'places',
        ...args,
        ...cmsQuery,
      })

      return {
        // oxlint-disable-next-line typescript/consistent-type-assertions, typescript/no-unnecessary-type-assertion
        docs: result.docs as PlaceMapItem[],
        page: result.page ?? undefined,
        totalDocs: result.totalDocs,
        totalPages: result.totalPages,
      }
    },
  }
}

export async function loadPlacesBrowsing({
  places,
  searchParams,
  userGeo,
}: LoadPlacesBrowsingArgs): Promise<PlacesBrowsingModel> {
  const filters = parsePlacesFilters(searchParams)
  const view = filters.view === 'table' ? 'table' : 'cards'
  const hrefSearchParams = normalizePlacesSearchParams(searchParams, filters)
  const where = getPlacesWhere(filters, userGeo)

  const [filterOptionsResult, tableResult, poolResult] = await Promise.all([
    places.find({
      depth: 0,
      limit: 1000,
      locale: 'es',
      sort: 'title',
    }),
    findTablePlacesPage(places, { filters, userGeo, view, where }),
    findCardPoolPlaces(places, { userGeo, view, where }),
  ])

  const tableDocs = tableResult ? annotatePool(tableResult.docs, userGeo) : []
  const annotatedCardPool = poolResult ? annotatePool(poolResult.docs, userGeo) : null
  const pagination = buildResultsPagination({
    cardsPagination: annotatedCardPool
      ? paginatePlaces(annotatedCardPool, filters.page, filters.pageSize)
      : null,
    filterOptionsSearch: hrefSearchParams,
    filters,
    tableDocs,
    tableResult,
    view,
  })
  const controls: PlacesControlsModel = {
    filterOptions: {
      accessTypes: getUniqueValues(filterOptionsResult.docs, 'accessType'),
      cities: getUniqueValues(filterOptionsResult.docs, 'city'),
      regions: getUniqueValues(filterOptionsResult.docs, 'region'),
    },
    view,
  }
  const results: PlacesResultsModel = {
    mapPlaces: userGeo && annotatedCardPool ? annotatedCardPool : undefined,
    navigation: {
      sortLinks: buildSortLinks(hrefSearchParams, filters.sort, userGeo !== null),
    },
    pagination,
    showDistance: userGeo !== null,
    sort: filters.sort,
    userGeo,
    view,
  }

  return {
    controls,
    results,
  }
}

type PlaceFindInput = {
  filters: PlacesFilters
  userGeo: StoredUserGeo | null
  view: PlacesView
  where?: Where
}

type PlaceFindResult = Awaited<ReturnType<PlacesAdapter['find']>>

/** Table view pages through the filtered result set server-side. */
function findTablePlacesPage(
  places: PlacesAdapter,
  { filters, userGeo, view, where }: PlaceFindInput,
): Promise<PlaceFindResult | null> {
  if (view !== 'table') return Promise.resolve(null)

  return places.find({
    depth: 0,
    limit: filters.pageSize,
    locale: 'es',
    page: filters.page,
    sort: userGeo ? undefined : getPayloadSort(filters.sort),
    ...(where ? { where } : {}),
  })
}

/** Card view fetches one bounded pool and paginates it in memory. */
function findCardPoolPlaces(
  places: PlacesAdapter,
  { userGeo, view, where }: Omit<PlaceFindInput, 'filters'>,
): Promise<PlaceFindResult | null> {
  if (view !== 'cards') return Promise.resolve(null)

  return places.find({
    depth: 0,
    limit: geoFetchLimit,
    locale: 'es',
    page: 1,
    sort: userGeo ? undefined : 'title',
    ...(where ? { where } : {}),
  })
}

function buildResultsPagination(args: {
  cardsPagination: ReturnType<typeof paginatePlaces<PlaceMapItem>> | null
  filterOptionsSearch: Record<string, string>
  filters: PlacesFilters
  tableDocs: PlaceMapItem[]
  tableResult: PlaceFindResult | null
  view: PlacesView
}) {
  const { cardsPagination, filterOptionsSearch, filters, tableDocs, tableResult, view } = args

  if (view === 'table' && tableResult) {
    return buildPaginationModel({
      docs: tableDocs,
      page: tableResult.page ?? filters.page,
      pageSize: filters.pageSize,
      searchParams: filterOptionsSearch,
      totalDocs: tableResult.totalDocs,
      totalPages: tableResult.totalPages,
      view,
    })
  }

  if (cardsPagination) {
    return buildPaginationModel({
      docs: cardsPagination.docs,
      page: cardsPagination.page,
      pageSize: filters.pageSize,
      searchParams: filterOptionsSearch,
      totalDocs: cardsPagination.totalDocs,
      totalPages: cardsPagination.totalPages,
      view,
    })
  }

  return buildPaginationModel({
    docs: [],
    page: 1,
    pageSize: filters.pageSize,
    searchParams: filterOptionsSearch,
    totalDocs: 0,
    totalPages: 1,
    view,
  })
}

function parsePlacesFilters(params: Record<string, string | string[] | undefined>): PlacesFilters {
  const sort = parseSort(getParam(params.sort))

  return {
    accessType: getParam(params.accessType),
    city: getParam(params.city),
    page: clampNumber(getParam(params.page), 1, 9999, 1),
    pageSize: clampNumber(getParam(params.pageSize), 1, maxPageSize, defaultPageSize),
    q: getParam(params.q),
    region: getParam(params.region),
    sort,
    view: getParam(params.view),
  }
}

function clampNumber(value: string, min: number, max: number, fallback: number) {
  if (!value.trim()) return fallback

  const number = Number(value)

  if (!Number.isInteger(number)) return fallback

  return Math.min(Math.max(number, min), max)
}

function copySearchParams(
  target: URLSearchParams,
  searchParams: Record<string, string | string[] | undefined>,
) {
  for (const [key, value] of Object.entries(searchParams)) {
    const paramValue = Array.isArray(value) ? value[0] : value
    if (paramValue) target.set(key, paramValue)
  }
}

function getPlacesHref(
  searchParams: Record<string, string | string[] | undefined>,
  updates: Record<string, null | string>,
  options?: { view?: PlacesView },
) {
  const params = new URLSearchParams()
  copySearchParams(params, searchParams)

  if (options?.view === 'table') params.set('view', 'table')
  if (options?.view === 'cards') params.delete('view')

  applyParamUpdates(params, updates)

  const query = params.toString()

  return query ? `/places?${query}` : '/places'
}

function normalizePlacesSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  filters: PlacesFilters,
) {
  const normalized: Record<string, string> = {}

  for (const key of ['accessType', 'city', 'q', 'region', 'view'] as const) {
    const value = filters[key]
    if (value) normalized[key] = value
  }

  if (hasParam(searchParams.page)) normalized.page = `${filters.page}`
  if (hasParam(searchParams.pageSize)) normalized.pageSize = `${filters.pageSize}`
  if (hasParam(searchParams.sort)) {
    normalized.sort = `${filters.sort.direction === 'desc' ? '-' : ''}${filters.sort.field}`
  }

  return normalized
}

function hasParam(value: string | string[] | undefined) {
  return getParam(value).trim().length > 0
}

function getPlacesWhere(filters: PlacesFilters, userGeo?: StoredUserGeo | null) {
  const and: Where[] = []

  if (filters.q) {
    and.push({
      or: [
        {
          title: {
            contains: filters.q,
          },
        },
        {
          summary: {
            contains: filters.q,
          },
        },
      ],
    })
  }

  if (filters.accessType) {
    and.push({
      accessType: {
        equals: filters.accessType,
      },
    })
  }

  if (filters.region) {
    and.push({
      region: {
        equals: filters.region,
      },
    })
  }

  if (filters.city) {
    and.push({
      city: {
        equals: filters.city,
      },
    })
  }

  if (userGeo) {
    and.push(getPlacesNearWhere(userGeo, userGeo.maxKm))
  }

  if (and.length === 0) return undefined
  if (and.length === 1) return and[0]

  return { and }
}

function getParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ''

  return value ?? ''
}

function parseSort(value: string): PlacesSort {
  const direction = value.startsWith('-') ? 'desc' : 'asc'
  const field = value.replace(/^-/, '')

  if (isSortField(field)) {
    return {
      direction,
      field,
    }
  }

  return {
    direction: 'asc',
    field: 'title',
  }
}

function getPayloadSort(sort: PlacesSort) {
  return `${sort.direction === 'desc' ? '-' : ''}${sort.field}`
}

function buildPaginationModel({
  docs,
  page,
  pageSize,
  searchParams,
  totalDocs,
  totalPages,
  view,
}: {
  docs: PlaceMapItem[]
  page: number
  pageSize: number
  searchParams: Record<string, string | string[] | undefined>
  totalDocs: number
  totalPages: number
  view: PlacesView
}): PlacesPaginationModel {
  const firstRow = totalDocs === 0 ? 0 : (page - 1) * pageSize + 1
  const lastRow = Math.min(page * pageSize, totalDocs)
  const hrefOptions = { view }

  return {
    firstRow,
    label: `${firstRow}-${lastRow} de ${totalDocs} lugares`,
    links: {
      first: {
        disabled: page <= 1,
        href: getPlacesHref(searchParams, { page: '1' }, hrefOptions),
      },
      last: {
        disabled: page >= totalPages,
        href: getPlacesHref(searchParams, { page: `${totalPages}` }, hrefOptions),
      },
      next: {
        disabled: page >= totalPages,
        href: getPlacesHref(searchParams, { page: `${page + 1}` }, hrefOptions),
      },
      previous: {
        disabled: page <= 1,
        href: getPlacesHref(searchParams, { page: `${page - 1}` }, hrefOptions),
      },
    },
    page,
    pageLabel: `Pagina ${page} de ${Math.max(totalPages, 1)}`,
    pageSize,
    pageSizeOptions: [10, 20, 50].map((value) => ({
      href: getPlacesHref(searchParams, { page: null, pageSize: `${value}` }, hrefOptions),
      value,
    })),
    places: docs,
    totalDocs,
    totalPages,
  }
}

function buildSortLinks(
  searchParams: Record<string, string | string[] | undefined>,
  sort: PlacesSort,
  disabled: boolean,
): Record<PlacesSort['field'], PlacesSortLink> {
  return {
    accessType: buildSortLink(searchParams, sort, 'accessType', disabled),
    city: buildSortLink(searchParams, sort, 'city', disabled),
    region: buildSortLink(searchParams, sort, 'region', disabled),
    title: buildSortLink(searchParams, sort, 'title', disabled),
  }
}

function buildSortLink(
  searchParams: Record<string, string | string[] | undefined>,
  sort: PlacesSort,
  field: PlacesSort['field'],
  disabled: boolean,
): PlacesSortLink {
  const active = sort.field === field
  const direction = active && sort.direction === 'asc' ? 'desc' : 'asc'

  return {
    active,
    direction,
    disabled,
    href: getPlacesHref(
      searchParams,
      {
        page: null,
        sort: `${direction === 'desc' ? '-' : ''}${field}`,
      },
      { view: 'table' },
    ),
  }
}

function annotatePool(docs: PlaceMapItem[], userGeo: StoredUserGeo | null) {
  if (!userGeo) return docs

  return annotatePlacesWithDistance(docs, userGeo)
}

function getUniqueValues(docs: PlaceMapItem[], key: keyof PlaceMapItem): string[] {
  return Array.from(
    new Set(
      docs
        .map((doc) => doc[key])
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    ),
  ).toSorted((a, b) => a.localeCompare(b, 'es'))
}
