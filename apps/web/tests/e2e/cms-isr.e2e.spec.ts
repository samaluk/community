import { expect, test, type APIResponse } from '@playwright/test'

import {
  createPublicContentTestAdmin,
  destroyPublicContentTestAdmin,
  loginPublicContentTestAdmin,
  publicContentTestAuthHeaders,
} from '../helpers/publicContentTestAdmin'

test('streams a generic shell, hides drafts, and invalidates warmed Operator content on publish and edit', async ({
  baseURL,
  request,
}) => {
  const admin = await createPublicContentTestAdmin()
  let publishedId: number | undefined
  let draftId: number | undefined
  let authorization: { Authorization: string; Cookie: string } | undefined
  let cleanupError: AggregateError | undefined

  try {
    const token = await loginPublicContentTestAdmin(request, admin)
    authorization = publicContentTestAuthHeaders(admin, token)

    const slug = `cms-operator-${Date.now()}`
    const initialTitle = `Published ISR ${slug}`
    const createResponse = await request.post('/api/places?locale=es&draft=false', {
      data: {
        _status: 'published',
        accessType: 'open',
        body: validRichTextBody,
        operator: admin.operatorId,
        slug,
        sourceUrl: `https://example.com/${slug}`,
        title: initialTitle,
      },
      headers: authorization,
    })
    expect(createResponse.ok(), await createResponse.text()).toBeTruthy()
    publishedId = documentId(await createResponse.json())

    // Static generation has no Operator Host. A cold request streams the
    // destination detail shell before its host-scoped published query.
    const coldPage = await readStreamingPublicPage(baseURL, `/places/${slug}`)
    expect(coldPage.body).toContain(initialTitle)
    expect(coldPage.body.indexOf('place-detail-back-link')).toBeGreaterThanOrEqual(0)
    expect(coldPage.body.indexOf(initialTitle)).toBeGreaterThan(
      coldPage.body.indexOf('place-detail-back-link'),
    )

    // Warm the same Operator and slug query, then edit through the HTTP API so
    // the collection hook invalidates the tagged published-data cache.
    const warmedPage = await fetchPublicPage(baseURL, `/places/${slug}`)
    expect(warmedPage.body).toContain(initialTitle)

    const updatedTitle = `Edited ISR ${slug}`
    const updateResponse = await request.patch(`/api/places/${publishedId}?locale=es&draft=false`, {
      data: { title: updatedTitle },
      headers: authorization,
    })
    expect(updateResponse.ok(), await updateResponse.text()).toBeTruthy()

    await expect(async () => {
      const updatedPage = await fetchPublicPage(baseURL, `/places/${slug}`)
      expect(updatedPage.body).toContain(updatedTitle)
      expect(updatedPage.body).not.toContain(initialTitle)
    }).toPass({ timeout: 5000 })

    const draftSlug = `${slug}-draft`
    const draftTitle = `Private draft ${draftSlug}`
    const draftResponse = await request.post('/api/places?locale=es&draft=true', {
      data: {
        _status: 'draft',
        accessType: 'open',
        body: validRichTextBody,
        operator: admin.operatorId,
        slug: draftSlug,
        sourceUrl: `https://example.com/${draftSlug}`,
        title: draftTitle,
      },
      headers: authorization,
    })
    expect(draftResponse.ok(), await draftResponse.text()).toBeTruthy()
    draftId = documentId(await draftResponse.json())

    const hiddenDraft = await fetchPublicPage(baseURL, `/places/${draftSlug}`)
    expect(hiddenDraft.body).not.toContain(draftTitle)

    const publishedDraftTitle = `Now published ${draftSlug}`
    const publishResponse = await request.patch(`/api/places/${draftId}?locale=es&draft=false`, {
      data: { _status: 'published', title: publishedDraftTitle },
      headers: authorization,
    })
    expect(publishResponse.ok(), await publishResponse.text()).toBeTruthy()

    const newlyPublished = await readStreamingPublicPage(baseURL, `/places/${draftSlug}`)
    expect(newlyPublished.body).toContain(publishedDraftTitle)
    expect(newlyPublished.body.indexOf('place-detail-back-link')).toBeGreaterThanOrEqual(0)
    expect(newlyPublished.body.indexOf(publishedDraftTitle)).toBeGreaterThan(
      newlyPublished.body.indexOf('place-detail-back-link'),
    )

    const warmPublished = await fetchPublicPage(baseURL, `/places/${draftSlug}`)
    expect(warmPublished.body).toContain(publishedDraftTitle)
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

    if (authorization && draftId !== undefined) {
      const id = draftId
      const headers = authorization
      await cleanupViaApiOrLocal(
        'Could not delete temporary draft place',
        () => request.delete(`/api/places/${id}?locale=es&draft=false`, { headers }),
        () => admin.payload.delete({ collection: 'places', id, overrideAccess: true }),
      )
    }

    if (authorization && publishedId !== undefined) {
      const id = publishedId
      const headers = authorization
      await cleanupViaApiOrLocal(
        'Could not delete temporary published place',
        () => request.delete(`/api/places/${id}?locale=es&draft=false`, { headers }),
        () => admin.payload.delete({ collection: 'places', id, overrideAccess: true }),
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
      cleanupError = new AggregateError(cleanupErrors, 'CMS publication test cleanup failed')
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
  if (!baseURL) throw new Error('Playwright baseURL is required for CMS cache tests')

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
  if (!baseURL) throw new Error('Playwright baseURL is required for CMS cache tests')

  const response = await fetch(new URL(path, baseURL))
  if (!response.body) throw new Error('Expected a streaming response body')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let body = ''

  while (true) {
    const chunk = await reader.read()
    if (chunk.value) {
      const decoded = decoder.decode(chunk.value, { stream: !chunk.done })
      body += decoded
    }
    if (chunk.done) break
  }

  body += decoder.decode()
  return { body, response }
}
