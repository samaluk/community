import type { APIRequestContext } from '@playwright/test'
import { BasePayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'

export type PublicContentTestAdmin = {
  email: string
  password: string
  payload: Payload
  userId: number
}

export async function createPublicContentTestAdmin(): Promise<PublicContentTestAdmin> {
  // Each test owns this instance and closes it. getPayload() would return a
  // cached instance whose database pool the previous test already destroyed.
  const payload = await new BasePayload().init({ config })
  const email = `public-content-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
  const password = 'public-content-test-password'
  const user = await payload.create({
    collection: 'users',
    data: { email, password, role: 'admin' },
    overrideAccess: true,
  })

  return { email, password, payload, userId: user.id }
}

export async function loginPublicContentTestAdmin(
  request: APIRequestContext,
  admin: Pick<PublicContentTestAdmin, 'email' | 'password'>,
): Promise<string> {
  const response = await request.post('/api/users/login', {
    data: { email: admin.email, password: admin.password },
  })

  if (!response.ok()) {
    throw new Error(`Could not authenticate test admin: ${await response.text()}`)
  }

  const body: unknown = await response.json()
  if (!body || typeof body !== 'object' || !('token' in body)) {
    throw new Error('Could not authenticate test admin: login response did not include a token')
  }

  if (typeof body.token !== 'string' || body.token.length === 0) {
    throw new Error('Could not authenticate test admin: login response returned an invalid token')
  }

  return body.token
}

export async function corruptPublicContentPlaceBody(
  admin: PublicContentTestAdmin,
  placeId: number,
) {
  await admin.payload.db.pool.query(
    // Preserve the node tree so Payload can read and repair the document.
    // The invalid indent fails only when the Server Component renders HTML.
    "UPDATE places_locales SET body = jsonb_set(body, '{root,children,0,indent}', $1::jsonb) WHERE _parent_id = $2 AND _locale = $3",
    [JSON.stringify({ valueOf: 1, toString: 1 }), placeId, 'es'],
  )
}

export async function destroyPublicContentTestAdmin(admin: PublicContentTestAdmin) {
  try {
    await admin.payload.delete({ collection: 'users', id: admin.userId, overrideAccess: true })
  } finally {
    await admin.payload.destroy()
  }
}
