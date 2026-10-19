import { expect, test, type APIRequestContext } from '@playwright/test'
import type { Place } from '@/payload-types'
import type { Payload } from 'payload'

import {
  createPublicContentTestAdmin,
  destroyPublicContentTestAdmin,
} from '../helpers/publicContentTestAdmin'

const richTextBody: Place['body'] = {
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 2,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        version: 1,
        children: [{ text: 'Operator isolation browser fixture.', type: 'text', version: 1 }],
        direction: 'ltr',
      },
    ],
  },
}

type TenantVisit = {
  domain: string
  title: string
  brand: string
  lang: string
  foreignTitle: string
  foreignBrand: string
}

type OperatorFixture = {
  id: number
  domain: string
}

type IsolationFixture = {
  key: string
  sharedSlug: string
  draftSlug: string
  identifier: string
  operators: OperatorFixture[]
  activeOperator?: OperatorFixture
  inactiveOperator?: OperatorFixture
  suspendedOperator?: OperatorFixture
  visits: TenantVisit[]
  siteSettingsIds: number[]
  articleIds: number[]
  membershipIds: number[]
}

test('keeps public content, chrome, language, and membership checks isolated by Operator Host', async ({
  baseURL,
  page,
  request,
}) => {
  if (!baseURL) throw new Error('Playwright baseURL is required for Operator isolation tests')

  const admin = await createPublicContentTestAdmin()
  const fixture = createIsolationFixture()
  const base = new URL(baseURL)
  let cleanupError: AggregateError | undefined

  try {
    await seedOperatorIsolation(admin.payload, fixture)
    await verifyTenantVisits(page, request, baseURL, base, fixture)
    await verifyDraftPrivacy(page, request, baseURL, base, fixture)
    await verifyMembershipIsolation(request, base.port, fixture)
    await verifyRejectedHosts(request, baseURL, base.port, fixture)
  } finally {
    cleanupError = await cleanupOperatorIsolation(admin.payload, fixture)
    try {
      await destroyPublicContentTestAdmin(admin)
    } catch (error) {
      cleanupError = combineCleanupError(cleanupError, error)
      try {
        await admin.payload.destroy()
      } catch (fallbackError) {
        cleanupError = combineCleanupError(cleanupError, fallbackError)
      }
    }
  }

  if (cleanupError) throw cleanupError
})

function createIsolationFixture(): IsolationFixture {
  const key = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  return {
    key,
    sharedSlug: `${key}-shared`,
    draftSlug: `${key}-draft`,
    identifier: `member-${key}`,
    operators: [],
    visits: [],
    siteSettingsIds: [],
    articleIds: [],
    membershipIds: [],
  }
}

async function seedOperatorIsolation(payload: Payload, fixture: IsolationFixture) {
  const operatorA = await createOperator(payload, fixture, 'a', `Tenant A ${fixture.key}`, 'active')
  const operatorB = await createOperator(payload, fixture, 'b', `Tenant B ${fixture.key}`, 'active')
  const suspendedOperator = await createOperator(
    payload,
    fixture,
    'suspended',
    `Suspended ${fixture.key}`,
    'suspended',
  )
  fixture.activeOperator = operatorA
  fixture.inactiveOperator = operatorB
  fixture.suspendedOperator = suspendedOperator

  await seedOperatorSettings(payload, fixture, operatorA, operatorB)
  await seedOperatorArticles(payload, fixture, operatorA, operatorB)
  await seedOperatorMemberships(payload, fixture, operatorA, operatorB)
  fixture.visits = createTenantVisits(fixture, operatorA, operatorB)
}

async function createOperator(
  payload: Payload,
  fixture: IsolationFixture,
  suffix: string,
  name: string,
  status: 'active' | 'suspended',
) {
  const domain = `${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.localhost`
  const operator = await payload.create({
    collection: 'operators',
    data: { domain, name, status },
    overrideAccess: true,
  })
  const created = { domain: operator.domain, id: operator.id }
  fixture.operators.push(created)
  return created
}

async function seedOperatorSettings(
  payload: Payload,
  fixture: IsolationFixture,
  operatorA: OperatorFixture,
  operatorB: OperatorFixture,
) {
  const settingsA = await payload.create({
    collection: 'site-settings',
    data: {
      brandName: `Brand A ${fixture.key}`,
      defaultLocale: 'es',
      lang: 'es',
      operator: operatorA.id,
    },
    overrideAccess: true,
  })
  fixture.siteSettingsIds.push(settingsA.id)

  const settingsB = await payload.create({
    collection: 'site-settings',
    data: {
      brandName: `Brand B ${fixture.key}`,
      defaultLocale: 'en',
      lang: 'en',
      operator: operatorB.id,
    },
    overrideAccess: true,
  })
  fixture.siteSettingsIds.push(settingsB.id)
}

async function seedOperatorArticles(
  payload: Payload,
  fixture: IsolationFixture,
  operatorA: OperatorFixture,
  operatorB: OperatorFixture,
) {
  await createArticle(
    payload,
    fixture,
    operatorA.id,
    fixture.sharedSlug,
    `Article A ${fixture.key}`,
  )
  await createArticle(
    payload,
    fixture,
    operatorB.id,
    fixture.sharedSlug,
    `Article B ${fixture.key}`,
  )
  await createArticle(
    payload,
    fixture,
    operatorA.id,
    fixture.draftSlug,
    `Draft A ${fixture.key}`,
    true,
  )
  await createArticle(
    payload,
    fixture,
    operatorB.id,
    fixture.draftSlug,
    `Draft B ${fixture.key}`,
    true,
  )
}

async function createArticle(
  payload: Payload,
  fixture: IsolationFixture,
  operatorId: number,
  slug: string,
  title: string,
  draft = false,
) {
  const article = await payload.create({
    collection: 'articles',
    data: {
      _status: draft ? 'draft' : 'published',
      body: richTextBody,
      category: 'Browser fixture',
      difficulty: 'beginner',
      operator: operatorId,
      slug,
      sourceUrl: `https://example.test/${slug}`,
      title,
    },
    draft,
    locale: 'es',
    overrideAccess: true,
  })
  fixture.articleIds.push(article.id)
}

async function seedOperatorMemberships(
  payload: Payload,
  fixture: IsolationFixture,
  operatorA: OperatorFixture,
  operatorB: OperatorFixture,
) {
  const active = await payload.create({
    collection: 'memberships',
    data: {
      identifier: fixture.identifier,
      isActive: true,
      lookupHash: '',
      normalizedIdentifier: '',
      operator: operatorA.id,
    },
    overrideAccess: true,
  })
  fixture.membershipIds.push(active.id)

  const inactive = await payload.create({
    collection: 'memberships',
    data: {
      identifier: fixture.identifier,
      isActive: false,
      lookupHash: '',
      normalizedIdentifier: '',
      operator: operatorB.id,
    },
    overrideAccess: true,
  })
  fixture.membershipIds.push(inactive.id)
  expect(active.lookupHash).toBe(inactive.lookupHash)
}

function createTenantVisits(
  fixture: IsolationFixture,
  operatorA: OperatorFixture,
  operatorB: OperatorFixture,
): TenantVisit[] {
  const visitA = {
    domain: operatorA.domain,
    title: `Article A ${fixture.key}`,
    brand: `Brand A ${fixture.key}`,
    lang: 'es',
    foreignTitle: `Article B ${fixture.key}`,
    foreignBrand: `Brand B ${fixture.key}`,
  }
  const visitB = {
    domain: operatorB.domain,
    title: `Article B ${fixture.key}`,
    brand: `Brand B ${fixture.key}`,
    lang: 'en',
    foreignTitle: `Article A ${fixture.key}`,
    foreignBrand: `Brand A ${fixture.key}`,
  }
  return [visitA, visitB, visitA]
}

async function verifyTenantVisits(
  page: import('@playwright/test').Page,
  request: APIRequestContext,
  baseURL: string,
  base: URL,
  fixture: IsolationFixture,
) {
  for (const visit of fixture.visits) {
    const rawPage = await readHostPage(
      request,
      baseURL,
      visit.domain,
      `/articles/${fixture.sharedSlug}`,
    )
    expect(rawPage).toContain(visit.title)
    expect(rawPage).toContain(visit.brand)
    expect(rawPage).not.toContain(visit.foreignTitle)

    await page.goto(operatorURL(base, visit.domain, `/articles/${fixture.sharedSlug}`))
    const title = page.getByTestId('article-detail-title')
    await expect(title).toHaveText(visit.title)
    await expect(title).toBeVisible()
    await expectVisibleBrand(page, visit.brand, visit.foreignBrand)
    await expect(page).toHaveTitle(`${visit.title} · ${visit.brand}`)
    await expect(page.locator('html')).toHaveAttribute('lang', visit.lang)
  }
}

async function expectVisibleBrand(
  page: import('@playwright/test').Page,
  brand: string,
  foreignBrand: string,
) {
  const visibleBanner = page.getByRole('banner').filter({ visible: true })
  await expect(visibleBanner).toHaveCount(1)
  await expect(visibleBanner).toContainText(brand)
  await expect(visibleBanner).not.toContainText(foreignBrand)
}

async function verifyDraftPrivacy(
  page: import('@playwright/test').Page,
  request: APIRequestContext,
  baseURL: string,
  base: URL,
  fixture: IsolationFixture,
) {
  for (const operator of fixture.operators.slice(0, 2)) {
    const draftPage = await readHostPage(
      request,
      baseURL,
      operator.domain,
      `/articles/${fixture.draftSlug}`,
    )
    expect(draftPage).not.toContain(`Draft A ${fixture.key}`)
    expect(draftPage).not.toContain(`Draft B ${fixture.key}`)

    await page.goto(operatorURL(base, operator.domain, `/articles/${fixture.draftSlug}`))
    await expect(page.getByText(`Draft A ${fixture.key}`, { exact: false })).toHaveCount(0)
    await expect(page.getByText(`Draft B ${fixture.key}`, { exact: false })).toHaveCount(0)
  }
}

async function verifyMembershipIsolation(
  request: APIRequestContext,
  port: string,
  fixture: IsolationFixture,
) {
  const activeOperator = requireFixtureOperator(fixture.activeOperator)
  const inactiveOperator = requireFixtureOperator(fixture.inactiveOperator)
  const activeCheck = await verifyMembership(
    request,
    activeOperator.domain,
    port,
    fixture.identifier,
  )
  expect(activeCheck.status()).toBe(200)
  expect(await activeCheck.json()).toMatchObject({ status: 'active' })

  const inactiveCheck = await verifyMembership(
    request,
    inactiveOperator.domain,
    port,
    fixture.identifier,
  )
  expect(inactiveCheck.status()).toBe(404)
  expect(await inactiveCheck.json()).toMatchObject({ status: 'not_found' })

  const activeCheckAfterInactive = await verifyMembership(
    request,
    activeOperator.domain,
    port,
    fixture.identifier,
  )
  expect(activeCheckAfterInactive.status()).toBe(200)
  expect(await activeCheckAfterInactive.json()).toMatchObject({ status: 'active' })
}

async function verifyRejectedHosts(
  request: APIRequestContext,
  baseURL: string,
  port: string,
  fixture: IsolationFixture,
) {
  const suspendedOperator = requireFixtureOperator(fixture.suspendedOperator)
  const unknownHost = `${fixture.key}-unknown.localhost`
  const unknownVerification = await verifyMembership(request, unknownHost, port, fixture.identifier)
  expect(unknownVerification.status()).toBe(404)

  const suspendedVerification = await verifyMembership(
    request,
    suspendedOperator.domain,
    port,
    fixture.identifier,
  )
  expect(suspendedVerification.status()).toBe(404)

  await expectRejectedArticle(request, baseURL, unknownHost, fixture)
  await expectRejectedArticle(request, baseURL, suspendedOperator.domain, fixture)
}

async function expectRejectedArticle(
  request: APIRequestContext,
  baseURL: string,
  domain: string,
  fixture: IsolationFixture,
) {
  const rejectedPage = await readHostPage(
    request,
    baseURL,
    domain,
    `/articles/${fixture.sharedSlug}`,
  )
  expect(rejectedPage).not.toContain(`Article A ${fixture.key}`)
  expect(rejectedPage).not.toContain(`Article B ${fixture.key}`)
}

function requireFixtureOperator(operator?: OperatorFixture): OperatorFixture {
  if (!operator) throw new Error('Operator fixture was not initialized')
  return operator
}

async function cleanupOperatorIsolation(payload: Payload, fixture: IsolationFixture) {
  const errors: unknown[] = []
  await deleteFixtureRecords(
    fixture.membershipIds,
    (id) => payload.delete({ collection: 'memberships', id, overrideAccess: true }),
    errors,
  )
  await deleteFixtureRecords(
    fixture.articleIds,
    (id) => payload.delete({ collection: 'articles', id, overrideAccess: true }),
    errors,
  )
  await deleteFixtureRecords(
    fixture.siteSettingsIds,
    (id) => payload.delete({ collection: 'site-settings', id, overrideAccess: true }),
    errors,
  )
  await deleteFixtureRecords(
    fixture.operators,
    (operator) =>
      payload.delete({ collection: 'operators', id: operator.id, overrideAccess: true }),
    errors,
  )

  return errors.length
    ? new AggregateError(errors, 'Operator isolation test cleanup failed')
    : undefined
}

async function deleteFixtureRecords<T>(
  records: readonly T[],
  deleteRecord: (record: T) => Promise<unknown>,
  errors: unknown[],
) {
  for (const record of records) {
    try {
      await deleteRecord(record)
    } catch (error) {
      errors.push(error)
    }
  }
}

function combineCleanupError(previous: AggregateError | undefined, error: unknown) {
  return previous
    ? new AggregateError([previous, error], 'Operator isolation test cleanup failed')
    : new AggregateError([error], 'Operator isolation test cleanup failed')
}

async function readHostPage(
  request: APIRequestContext,
  baseURL: string,
  domain: string,
  path: string,
) {
  const url = new URL(path, baseURL)
  const host = hostWithPort(domain, url.port)
  const response = await request.get(path, { headers: { host } })
  return response.text()
}

async function verifyMembership(
  request: APIRequestContext,
  domain: string,
  port: string,
  identifier: string,
) {
  return request.post('/api/verify', {
    data: { identifier },
    headers: { host: hostWithPort(domain, port) },
  })
}

function operatorURL(base: URL, domain: string, path: string) {
  return `${base.protocol}//${hostWithPort(domain, base.port)}${path}`
}

function hostWithPort(domain: string, port: string) {
  return port ? `${domain}:${port}` : domain
}
