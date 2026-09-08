'use client'

import { useOffline } from 'next/offline'

export function OfflineBanner() {
  const isOffline = useOffline()

  return (
    <output aria-live="polite">
      {isOffline ? (
        <span className="block border-b border-line bg-white-soft px-6 py-3 text-center text-sm">
          You're offline. Waiting for a connection to finish loading or saving changes.
        </span>
      ) : null}
    </output>
  )
}
