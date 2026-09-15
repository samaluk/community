'use client'

import { LocateFixedIcon, LocateOffIcon } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { defaultMaxDistanceKm, maxMaxDistanceKm, minMaxDistanceKm } from '@/lib/placesGeo'
import { createStoredUserGeo, type StoredUserGeo } from '@/lib/placesUserGeo'
import { cn } from '@/lib/utils'

import { usePlacesGeo } from './PlacesGeoContext'

function notifyLocationRequired() {
  toast('Comparte tu ubicación para ajustar la distancia máxima.', {
    id: 'places-location-required',
  })
}

/** First value of a slider callback payload, falling back to the default. */
const firstSliderValue = (value: readonly number[] | number): number =>
  typeof value === 'number' ? value : (value[0] ?? defaultMaxDistanceKm)

type LocateHandlers = {
  fallbackMaxKm: number
  onFailure: (message: string) => void
  onResolved: (geo: StoredUserGeo | null) => void
}

/** Browser geolocation wrapped so the component only handles outcomes. */
function locateCurrentUser({ fallbackMaxKm, onFailure, onResolved }: LocateHandlers) {
  if (!navigator.geolocation) return onFailure('Tu navegador no permite compartir ubicación.')

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const geo = createStoredUserGeo(
        position.coords.latitude,
        position.coords.longitude,
        fallbackMaxKm,
      )

      if (!geo) return onFailure('No pudimos guardar tu ubicación. Intenta de nuevo.')

      onResolved(geo)
    },
    () => onFailure('No pudimos obtener tu ubicación. Revisa los permisos del navegador.'),
    {
      enableHighAccuracy: true,
      maximumAge: 60_000,
      timeout: 15_000,
    },
  )
}

type SetUserGeo = (geo: StoredUserGeo | null) => void

/**
 * Slider state for the maximum distance: optimistic local value plus a
 * debounced persist into the session geo cookie.
 */
function useMaxDistanceControls(userGeo: StoredUserGeo | null, setUserGeo: SetUserGeo) {
  const committedMaxKm = userGeo?.maxKm ?? defaultMaxDistanceKm
  const [sliderMaxKm, setSliderMaxKm] = React.useState(committedMaxKm)
  const [syncedCommittedMaxKm, setSyncedCommittedMaxKm] = React.useState(committedMaxKm)
  const persistMaxKmTimeout = React.useRef<number>(null)

  if (committedMaxKm !== syncedCommittedMaxKm) {
    setSyncedCommittedMaxKm(committedMaxKm)
    setSliderMaxKm(committedMaxKm)
  }

  React.useEffect(
    () => () => {
      if (persistMaxKmTimeout.current) window.clearTimeout(persistMaxKmTimeout.current)
    },
    [],
  )

  // React Compiler caches these callbacks automatically.
  const cancelPendingPersist = () => {
    if (persistMaxKmTimeout.current === null) return

    window.clearTimeout(persistMaxKmTimeout.current)
    persistMaxKmTimeout.current = null
  }

  const persistMaxDistance = (value: number) => {
    if (!userGeo) return notifyLocationRequired()

    cancelPendingPersist()
    setUserGeo({ ...userGeo, maxKm: value })
  }

  const schedulePersistMaxDistance = (value: number) => {
    setSliderMaxKm(value)

    if (!userGeo) return notifyLocationRequired()

    cancelPendingPersist()
    persistMaxKmTimeout.current = window.setTimeout(() => {
      persistMaxDistance(value)
    }, 300)
  }

  const commitMaxDistance = (value: number) => {
    setSliderMaxKm(value)
    cancelPendingPersist()
    persistMaxDistance(value)
  }

  return { commitMaxDistance, persistMaxDistance, schedulePersistMaxDistance, sliderMaxKm }
}

export function PlacesLocationFilter() {
  const { isGeoPending, setUserGeo, userGeo } = usePlacesGeo()
  const [isLocating, setIsLocating] = React.useState(false)
  const [locationError, setLocationError] = React.useState<string | null>(null)
  const hasLocation = userGeo !== null
  const maxDistance = useMaxDistanceControls(userGeo, setUserGeo)

  const requestLocation = () => {
    setIsLocating(true)
    setLocationError(null)

    locateCurrentUser({
      fallbackMaxKm: userGeo?.maxKm ?? defaultMaxDistanceKm,
      onFailure: (message) => {
        setIsLocating(false)
        setLocationError(message)
      },
      onResolved: (geo) => {
        setIsLocating(false)
        setUserGeo(geo)
      },
    })
  }

  const clearLocation = () => {
    setLocationError(null)
    setUserGeo(null)
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="places-max-distance">Cerca de ti</Label>
          <p className="max-w-prose text-sm text-muted-foreground">
            Tu ubicación se guarda en una cookie de sesión segura en este navegador. No se incluye
            al compartir el enlace de la página.
          </p>
        </div>
        <LocationButtons
          hasLocation={hasLocation}
          isGeoPending={isGeoPending}
          isLocating={isLocating}
          onClear={clearLocation}
          onRequest={requestLocation}
          requestDisabled={isLocating || isGeoPending}
        />
      </div>
      {locationError ? <p className="text-sm text-destructive">{locationError}</p> : null}
      <DistanceControls
        disabled={!hasLocation || isGeoPending}
        maxKm={maxDistance.sliderMaxKm}
        onCommit={maxDistance.commitMaxDistance}
        onSchedule={maxDistance.schedulePersistMaxDistance}
        showSummary={hasLocation}
      />
    </div>
  )
}

const locationButtonLabel = (isLocating: boolean, hasLocation: boolean) =>
  isLocating
    ? 'Obteniendo ubicación...'
    : hasLocation
      ? 'Actualizar ubicación'
      : 'Usar mi ubicación'

function LocationButtons({
  hasLocation,
  isGeoPending,
  isLocating,
  onClear,
  onRequest,
  requestDisabled,
}: {
  hasLocation: boolean
  isGeoPending: boolean
  isLocating: boolean
  onClear: () => void
  onRequest: () => void
  requestDisabled: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={requestDisabled} onClick={onRequest} type="button" variant="outline">
        <LocateFixedIcon data-icon="inline-start" />
        {locationButtonLabel(isLocating, hasLocation)}
      </Button>
      {hasLocation ? (
        <Button disabled={isGeoPending} onClick={onClear} type="button" variant="ghost">
          <LocateOffIcon data-icon="inline-start" />
          Quitar ubicación
        </Button>
      ) : null}
    </div>
  )
}

function DistanceControls({
  disabled,
  maxKm,
  onCommit,
  onSchedule,
  showSummary,
}: {
  disabled: boolean
  maxKm: number
  onCommit: (value: number) => void
  onSchedule: (value: number) => void
  showSummary: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      {showSummary ? (
        <p className="text-sm text-muted-foreground">
          Mostrando lugares a hasta <strong className="text-foreground">{maxKm} km</strong> de tu
          ubicación actual.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Usa el botón de arriba para compartir tu ubicación y filtrar lugares por distancia.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <label
          className={cn(
            'text-xs font-normal text-muted-foreground',
            disabled && 'pointer-events-none opacity-50',
          )}
          htmlFor="places-max-distance"
        >
          Distancia máxima: {maxKm} km
        </label>
        <SliderBlock
          disabled={disabled}
          maxKm={maxKm}
          onCommit={onCommit}
          onSchedule={onSchedule}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{minMaxDistanceKm} km</span>
          <span>{maxMaxDistanceKm} km</span>
        </div>
      </div>
    </div>
  )
}

function SliderBlock({
  disabled,
  maxKm,
  onCommit,
  onSchedule,
}: {
  disabled: boolean
  maxKm: number
  onCommit: (value: number) => void
  onSchedule: (value: number) => void
}) {
  return (
    <div className="relative">
      <Slider
        aria-disabled={disabled}
        aria-label="Distancia máxima en kilómetros"
        disabled={disabled}
        id="places-max-distance"
        max={maxMaxDistanceKm}
        min={minMaxDistanceKm}
        onValueChange={(value) => onSchedule(firstSliderValue(value))}
        onValueCommitted={(value) => onCommit(firstSliderValue(value))}
        step={5}
        value={[maxKm]}
      />
      {!disabled ? null : (
        <div
          aria-hidden="true"
          className="absolute inset-0 cursor-not-allowed"
          onPointerDown={(event) => {
            event.preventDefault()
            notifyLocationRequired()
          }}
        />
      )}
    </div>
  )
}
