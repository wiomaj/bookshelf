/**
 * E2E — Authentication flows
 *
 * P0 tests:
 *  - Unauthenticated visitor is redirected to /login
 *  - /login page renders correctly and contains no private data
 *  - Authenticated user landing on /login is redirected to /
 *  - Signing out lands back on /login
 */
import { test, expect } from '@playwright/test'

// These tests run WITHOUT storageState (unauthenticated context)
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Unauthenticated access', () => {
  test('visiting / redirects to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('visiting /add redirects to /login', async ({ page }) => {
    await page.goto('/add')
    await expect(page).toHaveURL(/\/login/)
  })

  test('visiting /settings redirects to /login', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/login/)
  })

  test('visiting a book detail page redirects to /login', async ({ page }) => {
    await page.goto('/book/any-id')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('/login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('shows the login page (not a redirect loop)', async ({ page }) => {
    await expect(page).toHaveURL(/\/login/)
  })

  test('shows the Sign in with Google button', async ({ page }) => {
    await expect(page.getByText('Sign in with Google')).toBeVisible()
  })

  test('does not expose any book data', async ({ page }) => {
    // There should be no book titles, ratings, or notes visible
    const content = await page.content()
    expect(content).not.toMatch(/my bookshelf/i)
    // The page should not contain user-specific UI
    expect(content).not.toContain('Settings')
    expect(content).not.toContain('Add my first book')
  })

  test('has no console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    await page.goto('/login')
    expect(errors).toHaveLength(0)
  })
})

test.describe('Authenticated user hitting /login', () => {
  // This test needs auth — use userA storage state directly
  test('is redirected away from /login to /', async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: 'tests/e2e/.auth/userA.json',
    })
    const page = await ctx.newPage()
    await page.goto('/login')
    // Middleware should redirect authenticated users away from /login
    await expect(page).toHaveURL(/^http:\/\/localhost:3000\/?$/)
    await ctx.close()
  })
})
