import { describe, expect, it, vi } from 'vitest'

import type { PlaceMapItem } from '@/lib/places'
import {
  createPayloadPlacesAdapter,
  loadPlacesBrowsing,
  type PlacesAdapter,
} from '@/lib/placesBrowsing'

const place = (overrides: Partial<PlaceMapItem> = {}): PlaceMapItem => ({
  accessType: 'open',
  city: 'Santiago',
  id: 1,
  location: [-70.6, -33.4],
  region: 'Metropolitana',
  slug: 'sample',
  summary: 'Sample summary',
  title: 'Sample',
  ...overrides,
})

it('keeps public Places queries scoped to one Operator and published documents', async () => {
  const find = vi.fn().mockResolvedValue({ docs: [], page: 1, totalDocs: 0, totalPages: 0 })
  const places = createPayloadPlacesAdapter({
    cmsQuery: { draft: false, overrideAccess: true },
    operatorId: 101,
    payload: { find } as never,
  })

  await places.find({
    depth: 0,
    limit: 10,
    locale: 'es',
    where: { city: { equals: 'Santiago' } },
  })

  expect(find).toHaveBeenCalledWith(
    expect.objectContaining({
      collection: 'places',
      draft: false,
      overrideAccess: true,
      where: {
        and: [
          { operator: { equals: 101 } },
          { _status: { equals: 'published' } },
          { city: { equals: 'Santiago' } },
        ],
      },
    }),
  )
})

describe('loadPlacesBrowsing', () => {
  it('builds a page-ready cards model from filtered Places', async () => {
    const docs = [
      place({ id: 1, city: 'Santiago', title: 'B Place' }),
      place({ id: 2, city: 'Valdivia', region: 'Los Rios', title: 'A Place' }),
    ]
    const calls: Parameters<PlacesAdapter['find']>[0][] = []
    const places: PlacesAdapter = {
      find: async (args) => {
        calls.push(args)

        return {
          docs,
          page: args.page,
          totalDocs: docs.length,
          totalPages: 1,
        }
      },
    }

    const model = await loadPlacesBrowsing({
      places,
      searchParams: {
        pageSize: '1',
        q: 'Place',
      },
      userGeo: null,
    })

    expect(model.controls.view).toBe('cards')
    expect(model.controls.filterOptions).toEqual({
      accessTypes: ['open'],
      cities: ['Santiago', 'Valdivia'],
      regions: ['Los Rios', 'Metropolitana'],
    })
    expect(model.results.pagination).toMatchObject({
      label: '1-1 de 2 lugares',
      page: 1,
      pageLabel: 'Pagina 1 de 2',
      pageSize: 1,
      totalDocs: 2,
      totalPages: 2,
    })
    expect(model.results.pagination.places).toHaveLength(1)
    expect(model.results.pagination.links.next).toEqual({
      disabled: false,
      href: '/places?q=Place&pageSize=1&page=2',
    })
    expect(model.results.pagination.pageSizeOptions).toContainEqual({
      href: '/places?q=Place&pageSize=20',
      value: 20,
    })
    expect(model.results.navigation.sortLinks.city).toMatchObject({
      active: false,
      direction: 'asc',
      disabled: false,
      href: '/places?q=Place&pageSize=1&view=table&sort=city',
    })
    expect(calls).toHaveLength(2)
    expect(calls[1]).toMatchObject({
      limit: 1000,
      page: 1,
      sort: 'title',
      where: {
        or: [{ title: { contains: 'Place' } }, { summary: { contains: 'Place' } }],
      },
    })
  })

  it('uses distance-ready table results when user geo is present', async () => {
    const docs = [
      place({ id: 1, location: [-70.6, -33.4] }),
      place({ id: 2, location: null, title: 'Sin coordenadas' }),
    ]
    const calls: Parameters<PlacesAdapter['find']>[0][] = []
    const places: PlacesAdapter = {
      find: async (args) => {
        calls.push(args)

        return {
          docs,
          page: args.page,
          totalDocs: docs.length,
          totalPages: 1,
        }
      },
    }

    const model = await loadPlacesBrowsing({
      places,
      searchParams: {
        page: '2',
        sort: '-region',
        view: 'table',
      },
      userGeo: {
        latitude: -33.4489,
        longitude: -70.6693,
        maxKm: 50,
      },
    })

    expect(model.results.view).toBe('table')
    expect(model.results.showDistance).toBe(true)
    expect(model.results.navigation.sortLinks.region).toMatchObject({
      active: true,
      disabled: true,
      href: '/places?view=table&sort=region',
    })
    expect(model.results.pagination.places).toHaveLength(1)
    expect(model.results.pagination.places[0]).toHaveProperty('distanceKm')
    expect(calls[1]).toMatchObject({
      limit: 10,
      page: 2,
      sort: undefined,
      where: {
        location: {
          near: [-70.6693, -33.4489, 50_000],
        },
      },
    })
  })

  it('normalizes malformed page, page size, sort, and repeated query values internally', async () => {
    const docs = [place()]
    const calls: Parameters<PlacesAdapter['find']>[0][] = []
    const places: PlacesAdapter = {
      find: async (args) => {
        calls.push(args)

        return {
          docs,
          page: args.page,
          totalDocs: docs.length,
          totalPages: 1,
        }
      },
    }

    const model = await loadPlacesBrowsing({
      places,
      searchParams: {
        accessType: ['private', 'open'],
        page: 'nope',
        pageSize: '99',
        q: ['club', 'ignored'],
        sort: '-distance',
        view: 'table',
      },
      userGeo: null,
    })

    expect(model.results.pagination.page).toBe(1)
    expect(model.results.pagination.pageSize).toBe(50)
    expect(model.results.sort).toEqual({
      direction: 'asc',
      field: 'title',
    })
    expect(model.results.navigation.sortLinks.city.href).toBe(
      '/places?accessType=private&q=club&view=table&pageSize=50&sort=city',
    )
    expect(calls[1]).toMatchObject({
      limit: 50,
      page: 1,
      sort: 'title',
      where: {
        and: [
          {
            or: [{ title: { contains: 'club' } }, { summary: { contains: 'club' } }],
          },
          {
            accessType: {
              equals: 'private',
            },
          },
        ],
      },
    })
  })
})
