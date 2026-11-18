import { act, cleanup, render } from '@testing-library/react'
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PlacesLocationFilter } from '@/app/(frontend)/places/PlacesLocationFilter'
import type { StoredUserGeo } from '@/lib/placesUserGeo'

/**
 * Handles captured from the vendored Slider primitive: the stable contract the
 * filter relies on (`onValueChange` per drag tick, `onValueCommitted` on
 * release).
 */
const stubs = vi.hoisted(() => {
  type CapturedGeo = {
    hasGeoFilter: boolean
    isGeoPending: boolean
    setUserGeo: (geo: unknown) => void
    userGeo: unknown
  }

  type CapturedSliderProps = {
    onValueChange: (value: number[]) => void
    onValueCommitted: (value: number[]) => void
  }

  const geo: { current: CapturedGeo | null } = { current: null }
  const sliderProps: { current: CapturedSliderProps | null } = { current: null }

  return { geo, sliderProps }
})

// oxlint-disable-next-line landmines-testing/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
vi.mock('@/app/(frontend)/places/PlacesGeoContext', () => ({
  usePlacesGeo: () => stubs.geo.current,
}))

// oxlint-disable-next-line landmines-testing/no-test-doubles -- TODO(landmines): replace legacy test double with real implementation or MSW.
vi.mock('@/components/ui/slider', async () => {
  const { createElement } = await import('react')

  return {
    Slider(props: {
      onValueChange?: (value: number[]) => void
      onValueCommitted?: (value: number[]) => void
    }) {
      stubs.sliderProps.current = {
        onValueChange: props.onValueChange ?? (() => {}),
        onValueCommitted: props.onValueCommitted ?? (() => {}),
      }

      return createElement('div', { 'data-testid': 'slider-stub' })
    },
  }
})

const geoAt = (maxKm: number): StoredUserGeo => ({
  latitude: -33.45,
  longitude: -70.66,
  maxKm,
})

/** Renders the filter with a settled geo cookie and returns drag/commit drivers. */
function renderLocationFilter(userGeo: StoredUserGeo | null) {
  const setUserGeo = vi.fn()

  stubs.geo.current = {
    hasGeoFilter: userGeo !== null,
    isGeoPending: false,
    setUserGeo: (geo) => {
      setUserGeo(geo)
    },
    userGeo,
  }

  render(React.createElement(PlacesLocationFilter))

  const slider = stubs.sliderProps.current
  if (!slider) throw new Error('Slider stub did not render')

  return {
    commit: (km: number) => act(() => slider.onValueCommitted([km])),
    dragTo: (km: number) => act(() => slider.onValueChange([km])),
    setUserGeo,
  }
}

describe('PlacesLocationFilter max-distance persistence', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    stubs.geo.current = null
    stubs.sliderProps.current = null
  })

  it('coalesces a drag into one debounced persist and lets the commit win over trailing timers', () => {
    vi.useFakeTimers()
    const { commit, dragTo, setUserGeo } = renderLocationFilter(geoAt(20))

    // Dragging fires many intermediate values; nothing should persist mid-drag.
    dragTo(25)
    dragTo(30)
    dragTo(35)
    expect(setUserGeo).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(setUserGeo).not.toHaveBeenCalled()

    // Exactly one timer survives the drag and persists the latest value once.
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(setUserGeo).toHaveBeenCalledTimes(1)
    expect(setUserGeo).toHaveBeenCalledWith(geoAt(35))

    // Pointer-up commits the final value, superseding any pending schedule.
    dragTo(40)
    commit(45)
    expect(setUserGeo).toHaveBeenCalledTimes(2)
    expect(setUserGeo).toHaveBeenLastCalledWith(geoAt(45))

    // Orphaned intermediate timers must never fire after the commit.
    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(setUserGeo).toHaveBeenCalledTimes(2)
    expect(setUserGeo).toHaveBeenLastCalledWith(geoAt(45))
  })
})
