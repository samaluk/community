import { expect, test } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

test('Operator admin can edit their own account but cannot grant staff access', async ({
  baseURL,
  page,
}) => {
  if (!baseURL) throw new Error('Playwright baseURL is required for admin tests')

  const fixture = await seedTestUser()

  try {
    await login({ page, user: testUser })

    // The admin UI needs the host Operator selected before it can expose
    // Operator-scoped collections and the current user's editable record.
    await page
      .context()
      .addCookies([{ name: 'payload-tenant', value: String(fixture.operatorId), url: baseURL }])

    await page.goto(`/admin/collections/users/${fixture.id}`)
    const emailField = page.locator('input[name="email"]')
    await expect(emailField).toBeVisible()
    await expect(emailField).toHaveValue(testUser.email)

    const updatedEmail = `dev+edited-${fixture.id}@payloadcms.com`
    await emailField.fill(updatedEmail)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.locator('input[name="email"]')).toHaveValue(updatedEmail)

    // Operator admins cannot create Users, so they cannot grant memberships
    // or platform access through the admin UI. Check both the list affordance
    // and the direct create route to cover navigation around that restriction.
    await page.goto('/admin/collections/users')
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
    await expect(page.getByRole('link', { name: /create/i })).toHaveCount(0)

    await page.goto('/admin/collections/users/create')
    await expect(page.locator('input[name="email"]')).toHaveCount(0)
    await expect(page.locator('body')).toContainText(
      /you are not allowed|not authorized|access denied/i,
    )
  } finally {
    await cleanupTestUser(fixture.id)
  }
})
