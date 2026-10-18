import { expect, test } from '@playwright/test'

import { observePrefetchedShell } from './helpers/prefetchedShell'

test('a prefetched article remains usable offline and after reconnecting', async ({
  context,
  page,
}) => {
  const articlePath = '/articles/articulo-fixture-1'
  const shell = await observePrefetchedShell(page, articlePath)

  try {
    await page.goto('/articles')
    const card = page.locator('[data-slot="card"]').filter({ hasText: 'Articulo Fixture Uno' })
    const link = card.getByRole('link', { name: 'Read article' })
    await expect(link).toBeVisible()
    await link.scrollIntoViewIfNeeded()
    await link.hover()
    // A route-tree prefetch has no shell data. Wait for the actual article segment,
    // then let Next process the streamed response and settle its module requests.
    await shell.waitUntilReady('article-detail-back-link')
    await page.waitForLoadState('networkidle')

    await context.setOffline(true)
    await expect(page.getByRole('status').filter({ hasText: "You're offline" })).toBeVisible()

    await link.click()
    await expect(page.getByTestId('article-detail-back-link')).toBeVisible()
    await context.setOffline(false)
    await expect(page.getByTestId('article-detail-title')).toHaveText('Articulo Fixture Uno')
    await expect(page.getByText("You're offline", { exact: false })).toHaveCount(0)
  } finally {
    await context.setOffline(false)
    await shell.close()
  }
})

test('a pending location Server Action saves once the connection returns', async ({
  context,
  page,
}) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: -33.45, longitude: -70.66 })
  await page.goto('/places')
  const locate = page.getByRole('button', { name: 'Usar mi ubicación' })
  await expect(locate).toBeVisible()

  try {
    await context.setOffline(true)
    await expect(page.getByText("You're offline", { exact: false })).toBeVisible()
    await locate.click()
    const update = page.getByRole('button', { name: 'Actualizar ubicación' })
    await expect(update).toBeDisabled()
    expect(
      (await context.cookies()).find((cookie) => cookie.name === 'community.places.userGeo'),
    ).toBeUndefined()

    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        Boolean(response.request().headers()['next-action']) &&
        response.ok(),
    )
    await context.setOffline(false)
    await saved
    await expect(update).toBeEnabled()
    const cookie = (await context.cookies()).find(
      (entry) => entry.name === 'community.places.userGeo',
    )
    expect(cookie).toBeDefined()
    if (!cookie) throw new Error('Expected the location action to set the Operator geo cookie')
    const storedGeo: unknown = JSON.parse(decodeURIComponent(cookie.value))
    expect(storedGeo).toMatchObject({
      operatorId: expect.any(Number),
      geo: {
        latitude: -33.45,
        longitude: -70.66,
        maxKm: 50,
      },
    })
    await expect(page.getByText("You're offline", { exact: false })).toHaveCount(0)

    await page.reload()
    await expect(page.getByRole('button', { name: 'Actualizar ubicación' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Usar mi ubicación' })).toHaveCount(0)
  } finally {
    await context.setOffline(false)
  }
})
