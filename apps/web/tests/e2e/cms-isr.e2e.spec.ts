import { expect, test, type APIResponse } from '@playwright/test'

import {
  createPublicContentTestAdmin,
  destroyPublicContentTestAdmin,
  loginPublicContentTestAdmin,
} from '../helpers/publicContentTestAdmin'

test('publishes and caches a slug created after build, while invalidating a prerendered slug', async ({
  baseURL,
  page,
  request,
}) => {
  const admin = await createPublicContentTestAdmin()
  let createdId: number | undefined
  let prerenderedId: number | undefined
  let originalTitle: string | undefined
  let authorization: { Authorization: string } | undefined
  let cleanupError: AggregateError | undefined

  try {
    const token = await loginPublicContentTestAdmin(request, admin)
    authorization = { Authorization: `JWT ${token}` }

    const existing = await admin.payload.find({
      collection: 'places',
      draft: false,
      limit: 1,
      locale: 'es',
      overrideAccess: true,
      where: { slug: { equals: 'place-fixture-1' } },
    })
    const prerendered = existing.docs[0]
    if (!prerendered) throw new Error('Expected the seeded prerendered place')
    prerenderedId = prerendered.id
    originalTitle = prerendered.title

    const updatedTitle = `Lugar prerenderizado actualizado ${Date.now()}`
    const updateResponse = await request.patch(
      `/api/places/${prerendered.id}?locale=es&draft=false`,
      { data: { title: updatedTitle }, headers: authorization },
    )
    expect(updateResponse.ok(), await updateResponse.text()).toBeTruthy()

    const updatedPage = await fetchPublicPage(baseURL, '/places/place-fixture-1')
    expect(updatedPage.body).toContain(updatedTitle)

    const slug = `cms-isr-${Date.now()}`
    const draftTitle = `Borrador ISR ${slug}`
    const createResponse = await request.post('/api/places?locale=es&draft=true', {
      data: {
        _status: 'draft',
        accessType: 'open',
        body: validRichTextBody,
        slug,
        sourceUrl: `https://example.com/${slug}`,
        title: draftTitle,
      },
      headers: authorization,
    })
    expect(createResponse.ok(), await createResponse.text()).toBeTruthy()
    createdId = documentId(await createResponse.json())

    const draftPage = await fetchPublicPage(baseURL, `/places/${slug}`)
    expect(draftPage.body).toContain('This page could not be found.')
    expect(draftPage.body).not.toContain(draftTitle)

    const publishedTitle = `Publicado ISR ${slug}`
    const publishResponse = await request.patch(`/api/places/${createdId}?locale=es&draft=false`, {
      data: { _status: 'published', title: publishedTitle },
      headers: authorization,
    })
    expect(publishResponse.ok(), await publishResponse.text()).toBeTruthy()

    // The first visit to an omitted build-time slug streams the generic shell
    // before its published content, then completes with the upgraded page.
    const coldPage = await readStreamingPublicPage(baseURL, `/places/${slug}`)
    expect(coldPage.firstChunk).toContain('place-detail-back-link')
    expect(coldPage.firstChunk).not.toContain('place-detail-title')
    expect(coldPage.body).toContain(publishedTitle)

    // The background upgrade can finish after the first response streams out.
    // Wait for that upgrade, then verify a visitor gets the server-cached page.
    await expect(async () => {
      const warmPage = await fetchPublicPage(baseURL, `/places/${slug}`)
      expect(warmPage.response.headers.get('x-nextjs-cache')).toBe('HIT')
      expect(warmPage.response.headers.get('x-nextjs-postponed')).toBeNull()
      expect(warmPage.body).toContain(publishedTitle)
    }).toPass({ timeout: 5000 })

    await page.goto('/places')
    await page.locator(`a[href="/places/${slug}"]`).click()
    await expect(page.getByTestId('place-detail-title')).toHaveText(publishedTitle)
  } finally {
    const cleanupErrors: unknown[] = []

    const cleanupViaApiOrLocal = async (
      label: string,
      apiAction: () => Promise<APIResponse>,
      localAction: () => Promise<unknown>,
    ) => {
      try {
        const response = await apiAction()
        if (response.ok()) return

        cleanupErrors.push(new Error(`${label} (${response.status()}): ${await response.text()}`))
      } catch (error) {
        cleanupErrors.push(error)
      }

      try {
        await localAction()
      } catch (error) {
        cleanupErrors.push(error)
      }
    }

    if (authorization && createdId !== undefined) {
      const placeId = createdId
      const auth = authorization
      await cleanupViaApiOrLocal(
        'Could not delete temporary ISR place',
        () =>
          request.delete(`/api/places/${placeId}?locale=es&draft=false`, {
            headers: auth,
          }),
        () =>
          admin.payload.delete({
            collection: 'places',
            id: placeId,
            overrideAccess: true,
          }),
      )
    }

    if (authorization && prerenderedId !== undefined && originalTitle !== undefined) {
      const placeId = prerenderedId
      const auth = authorization
      const title = originalTitle
      await cleanupViaApiOrLocal(
        'Could not restore prerendered ISR place',
        () =>
          request.patch(`/api/places/${placeId}?locale=es&draft=false`, {
            data: { title },
            headers: auth,
          }),
        () =>
          admin.payload.update({
            collection: 'places',
            id: placeId,
            data: { title },
            draft: false,
            locale: 'es',
            overrideAccess: true,
          }),
      )
    }

    try {
      await destroyPublicContentTestAdmin(admin)
    } catch (error) {
      cleanupErrors.push(error)
      try {
        await admin.payload.destroy()
      } catch (fallbackError) {
        cleanupErrors.push(fallbackError)
      }
    }

    if (cleanupErrors.length > 0) {
      cleanupError = new AggregateError(cleanupErrors, 'CMS ISR test cleanup failed')
    }
  }

  if (cleanupError) throw cleanupError
})

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
        children: [{ text: 'Contenido del test ISR.', type: 'text', version: 1 }],
        direction: 'ltr',
      },
    ],
  },
}

async function fetchPublicPage(baseURL: string | undefined, path: string) {
  if (!baseURL) throw new Error('Playwright baseURL is required for ISR tests')

  const response = await fetch(new URL(path, baseURL))
  return { body: await response.text(), response }
}

function documentId(responseBody: unknown): number {
  if (!responseBody || typeof responseBody !== 'object' || !('doc' in responseBody)) {
    throw new Error('Payload did not return the created place')
  }

  const doc = responseBody.doc
  if (!doc || typeof doc !== 'object' || !('id' in doc) || typeof doc.id !== 'number') {
    throw new Error('Payload response did not include a place ID')
  }

  return doc.id
}

async function readStreamingPublicPage(baseURL: string | undefined, path: string) {
  if (!baseURL) throw new Error('Playwright baseURL is required for ISR tests')

  const response = await fetch(new URL(path, baseURL))
  if (!response.body) throw new Error('Expected a streaming response body')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let firstChunk = ''
  let body = ''
  let firstRead = true

  while (true) {
    const chunk = await reader.read()
    if (chunk.value) {
      const decoded = decoder.decode(chunk.value, { stream: !chunk.done })
      body += decoded
      if (firstRead) {
        firstChunk = decoded
        firstRead = false
      }
    }
    if (chunk.done) break
  }

  body += decoder.decode()
  return { body, firstChunk, response }
}
