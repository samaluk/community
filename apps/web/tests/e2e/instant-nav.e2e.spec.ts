import { instant } from '@next/playwright'
import { expect, test } from '@playwright/test'

/**
 * Instant-navigation guards for the public content flows (issue #191).
 *
 * Each test locks dynamic data (instant()) while navigating and asserts the
 * destination's static shell commits under the lock. Prerendered content may
 * also be available immediately. Offline tests separately prove that a cached
 * shell can render while network-dependent content waits for reconnection.
 *
 * Runs against the production build served by `next start` (see
 * instant-nav.rig.md). Test user: anonymous public visitor.
 */

const SHELL = {
  placeDetail: '[data-testid="place-detail-back-link"]',
  articleDetail: '[data-testid="article-detail-back-link"]',
  productDetail: '[data-testid="product-detail-back-link"]',
  placesList: '[data-testid="places-list-title"]',
} as const

const listToDetailFlows = [
  {
    name: 'places',
    listPath: '/places',
    fixtureCard: 'Lugar Fixture Uno',
    triggerLink: 'Ver ficha',
    shell: SHELL.placeDetail,
    deferredTitle: 'place-detail-title',
    urlPattern: /\/places\/place-fixture-1/,
  },
  {
    name: 'articles',
    listPath: '/articles',
    fixtureCard: 'Articulo Fixture Uno',
    triggerLink: 'Read article',
    shell: SHELL.articleDetail,
    deferredTitle: 'article-detail-title',
    urlPattern: /\/articles\/articulo-fixture-1/,
  },
  {
    name: 'products',
    listPath: '/products',
    fixtureCard: 'Producto Fixture Uno',
    triggerLink: 'View product',
    shell: SHELL.productDetail,
    deferredTitle: 'product-detail-title',
    urlPattern: /\/products\/producto-fixture-1/,
  },
] as const

for (const flow of listToDetailFlows) {
  test(`${flow.name} list → detail commits its shell instantly`, async ({ page }) => {
    await page.goto(flow.listPath)

    const fixtureCard = page.locator('[data-slot="card"]').filter({ hasText: flow.fixtureCard })
    const trigger = fixtureCard.getByRole('link', { name: flow.triggerLink })
    await expect(trigger).toBeVisible({ timeout: 20_000 })

    await instant(page, async () => {
      await trigger.click()
      await expect(page.locator(flow.shell)).toBeVisible()
    })

    await expect(page.getByTestId(flow.deferredTitle)).toBeVisible()
    await expect(page).toHaveURL(flow.urlPattern)
  })
}

test('home → Ver lugares CTA commits the places shell instantly', async ({ page }) => {
  await page.goto('/')

  const trigger = page.getByRole('link', { name: 'Ver lugares', exact: true })
  await expect(trigger).toBeVisible({ timeout: 20_000 })

  await instant(page, async () => {
    await trigger.click()
    await expect(page.locator(SHELL.placesList)).toBeVisible()
  })

  await expect(page.getByRole('link', { name: 'Ver ficha' }).first()).toBeVisible()
  await expect(page).toHaveURL(/\/places$/)
})

test('home → Verify CTA commits instantly', async ({ page }) => {
  // Smoke guard: /verify is fully static (no dynamic reads, no
  // Suspense), so this lock asserts the prerendered page commits rather than
  // exercising the shell mechanism. It regression-guards the AC but can
  // never fail on this code path on its own.
  await page.goto('/')

  const trigger = page.getByTestId('home-verify-cta')
  await expect(trigger).toBeVisible({ timeout: 20_000 })

  await instant(page, async () => {
    await trigger.click()
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Verify active membership.',
      }),
    ).toBeVisible()
  })
})

for (const mobile of [false, true]) {
  test(`${mobile ? 'mobile' : 'desktop'} header navigation commits the places shell instantly`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: mobile ? 390 : 1280, height: 844 })
    await page.goto('/')
    if (mobile) await page.getByLabel('Abrir navegacion').click()

    const navigation = page.getByRole('navigation', {
      name: mobile ? 'Principal movil' : 'Principal',
      exact: true,
    })
    const link = navigation.getByRole('link', { name: 'Lugares' })
    await expect(link).toBeVisible()

    await instant(page, async () => {
      await link.click()
      await expect(page.getByTestId('places-list-title')).toBeVisible()
    })
  })
}
