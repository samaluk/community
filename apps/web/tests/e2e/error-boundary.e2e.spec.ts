import { expect, test } from '@playwright/test'

import {
  createPublicContentTestAdmin,
  corruptPublicContentPlaceBody,
  destroyPublicContentTestAdmin,
  loginPublicContentTestAdmin,
} from '../helpers/publicContentTestAdmin'

const validRichTextBody = {
  root: {
    type: 'root',
    format: 'richText',
    version: 2,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        version: 1,
        children: [{ text: 'Recovered after retry.', type: 'text', version: 1 }],
        direction: 'ltr',
      },
    ],
  },
}

function documentId(responseBody: unknown): number {
  if (!responseBody || typeof responseBody !== 'object' || !('doc' in responseBody)) {
    throw new Error('Payload did not return the created place')
  }

  const doc = responseBody.doc
  if (!doc || typeof doc !== 'object' || !('id' in doc) || typeof doc.id !== 'number') {
    throw new Error('Payload response did not include an place ID')
  }

  return doc.id
}

test('public detail content recovers from a server render error with retry', async ({
  page,
  request,
}) => {
  const admin = await createPublicContentTestAdmin()
  const slug = `public-content-retry-${Date.now()}`
  let placeId: number | undefined
  let authHeaders: { Authorization: string } | undefined
  let cleanupError: AggregateError | undefined

  try {
    const token = await loginPublicContentTestAdmin(request, admin)
    authHeaders = { Authorization: `JWT ${token}` }
    const createResponse = await request.post('/api/places?locale=es&draft=false', {
      data: {
        _status: 'published',
        body: validRichTextBody,
        accessType: 'open',
        slug,
        sourceUrl: `https://example.com/${slug}`,
        title: 'Retryable place',
      },
      headers: authHeaders,
    })
    expect(createResponse.ok(), await createResponse.text()).toBeTruthy()
    placeId = documentId(await createResponse.json())
    await corruptPublicContentPlaceBody(admin, placeId)

    await page.goto('/places')
    await page.locator(`a[href="/places/${slug}"]`).click()
    await expect(page.getByTestId('public-content-error')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()

    const repairResponse = await request.patch(`/api/places/${placeId}?locale=es&draft=false`, {
      data: { body: validRichTextBody, title: 'Retryable place recovered' },
      headers: authHeaders,
    })
    expect(repairResponse.ok(), await repairResponse.text()).toBeTruthy()

    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByTestId('place-detail-title')).toHaveText('Retryable place recovered')
    await expect(page.getByText('Recovered after retry.')).toBeVisible()
  } finally {
    const cleanupErrors: unknown[] = []
    if (placeId !== undefined) {
      try {
        const response = await request.delete(`/api/places/${placeId}?locale=es`, {
          headers: authHeaders,
          timeout: 5000,
        })
        if (!response.ok()) {
          throw new Error(`Could not delete retry fixture: ${await response.text()}`)
        }
      } catch (error) {
        cleanupErrors.push(error)
        try {
          await admin.payload.delete({ collection: 'places', id: placeId, overrideAccess: true })
        } catch (fallbackError) {
          cleanupErrors.push(fallbackError)
        }
      }
    }
    try {
      await destroyPublicContentTestAdmin(admin)
    } catch (error) {
      cleanupErrors.push(error)
    }
    if (cleanupErrors.length > 0) {
      cleanupError = new AggregateError(cleanupErrors, 'Error recovery test cleanup failed')
    }
  }

  if (cleanupError) throw cleanupError
})

test('missing public detail content remains inside the not-found boundary', async ({ page }) => {
  await page.goto('/places/does-not-exist')

  await expect(page.getByRole('heading', { name: 'This page could not be found.' })).toBeVisible()
  await expect(page.getByTestId('public-content-error')).toHaveCount(0)
})
