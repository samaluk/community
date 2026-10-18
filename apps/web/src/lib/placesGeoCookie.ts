import 'server-only'

import { cookies } from 'next/headers'

import { env } from '@/env'
import { assertActiveOperator, getRequestOperator } from '@/lib/operator'

import { parseStoredUserGeo, type StoredUserGeo } from '@/lib/placesUserGeo'

const placesUserGeoCookieName = 'community.places.userGeo'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const cookiePath = '/places'
const maxAgeSeconds = 8 * 60 * 60

const cookieOptions = {
  httpOnly: true,
  path: cookiePath,
  sameSite: 'lax' as const,
  secure: env.NODE_ENV === 'production',
}

export async function readPlacesUserGeoCookie(): Promise<StoredUserGeo | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(placesUserGeoCookieName)?.value

  if (!raw) return null

  try {
    const storedValue: unknown = JSON.parse(raw)
    if (!isRecord(storedValue)) return null

    const operator = await getRequestOperator()
    assertActiveOperator(operator)

    if (Number(storedValue.operatorId) !== operator.id) return null
    return parseStoredUserGeo(storedValue.geo)
  } catch {
    return null
  }
}

export async function setPlacesUserGeoCookie(geo: StoredUserGeo) {
  const parsed = parseStoredUserGeo(geo)

  if (!parsed) {
    throw new Error('Invalid user geo')
  }

  const operator = await getRequestOperator()
  assertActiveOperator(operator)
  const cookieStore = await cookies()
  cookieStore.set(
    placesUserGeoCookieName,
    JSON.stringify({ geo: parsed, operatorId: operator.id }),
    {
      ...cookieOptions,
      maxAge: maxAgeSeconds,
    },
  )
}

export async function clearPlacesUserGeoCookie() {
  const cookieStore = await cookies()
  cookieStore.delete({
    name: placesUserGeoCookieName,
    path: cookiePath,
  })
}
