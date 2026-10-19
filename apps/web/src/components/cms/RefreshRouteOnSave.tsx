'use client'

import { RefreshRouteOnSave as PayloadRefreshRouteOnSave } from '@payloadcms/live-preview-react'
import { useRouter } from 'next/navigation'

export function RefreshRouteOnSave({ serverURL }: { serverURL: string }) {
  const router = useRouter()

  return <PayloadRefreshRouteOnSave refresh={() => router.refresh()} serverURL={serverURL} />
}
