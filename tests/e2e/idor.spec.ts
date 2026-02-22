/**
 * E2E — Insecure Direct Object Reference (IDOR) abuse tests
 *
 * Verifies that RLS and the bookApi effectively prevent cross-user data access.
 *
 * Scenario:
 *  1. User A creates a book — gets its UUID from the URL
 *  2. User B loads their own session
 *  3. User B navigates to User A's book URL  → should see "Book not found"
 *  4. User B calls Supabase REST directly with their token → empty result (RLS)
 *
 * Both users need to be real Supabase accounts (provisioned via TEST_USER_B_*).
 */
import { test, expect } from '@playwright/test'
import path from 'path'

const BOOK_TITLE = 'IDOR Test Book — User A Only'

test.describe('IDOR — cross-user book access prevention', () => {
  let bookUrl: string   // set by User A creation step

  test('User A can create a book and see it', async ({ browser }) => {
    const ctxA = await browser.newContext({
      storageState: path.join(__dirname, '.auth/userA.json'),
    })
    const pageA = await ctxA.newPage()

    // Add a book as User A
    await pageA.goto('/add')

    // Fill title
    await pageA.getByPlaceholder(/start typing/i).fill(BOOK_TITLE)

    // Fill year (number field)
    await pageA.locator('input[inputmode="numeric"]').first().fill('2023')

    // Select a rating (click the 3rd star)
    const ratingSection = pageA.getByText('Rating').locator('..')
    await ratingSection.locator('button').nth(2).click()

    // Submit
    await pageA.getByRole('button', { name: /add book/i }).click()
    await expect(pageA).toHaveURL(/\/$/)

    // Click on the book to get its URL
    await pageA.getByText(BOOK_TITLE).first().click()
    await pageA.waitForURL(/\/book\//)
    bookUrl = pageA.url()

    expect(bookUrl).toMatch(/\/book\/[a-f0-9-]{36}/)

    await ctxA.close()
  })

  test('User B cannot view User A\'s book via the UI', async ({ browser }) => {
    // Depends on the previous test having set bookUrl
    test.skip(!bookUrl, 'Skipping: User A book creation step did not run or failed')

    const ctxB = await browser.newContext({
      storageState: path.join(__dirname, '.auth/userB.json'),
    })
    const pageB = await ctxB.newPage()

    // User B navigates directly to User A's book URL
    await pageB.goto(bookUrl)

    // Should see "Book not found" — not User A's data
    await expect(pageB.getByText(/book not found/i)).toBeVisible({ timeout: 10_000 })

    // Make absolutely sure none of User A's content is visible
    const content = await pageB.content()
    expect(content).not.toContain(BOOK_TITLE)

    await ctxB.close()
  })

  test('User B cannot fetch User A\'s book via direct Supabase REST API', async ({ browser }) => {
    test.skip(!bookUrl, 'Skipping: no bookUrl from prior test')

    // Extract the book UUID from the URL
    const bookId = bookUrl.split('/book/')[1]

    const ctxB = await browser.newContext({
      storageState: path.join(__dirname, '.auth/userB.json'),
    })
    const pageB = await ctxB.newPage()

    // Navigate to home to ensure the session is active (cookies are loaded)
    await pageB.goto('/')

    // Get the Supabase anon key and URL from env — available in the browser via NEXT_PUBLIC_*
    const { supabaseUrl, supabaseKey } = await pageB.evaluate(() => ({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    }))

    // Read User B's session token from the page context
    const cookies = await ctxB.cookies()
    const authCookie = cookies.find(c => c.name.includes('auth-token'))
    const accessToken = authCookie
      ? JSON.parse(decodeURIComponent(authCookie.value))?.access_token ?? ''
      : ''

    // Attempt a direct REST query for User A's book using User B's token
    const restResponse = await pageB.request.get(
      `${supabaseUrl}/rest/v1/books?id=eq.${bookId}&select=id,title,user_id`,
      {
        headers: {
          'apikey':        supabaseKey,
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    const body: unknown[] = await restResponse.json()

    // RLS must return an empty array — not User A's book
    expect(body).toHaveLength(0)

    await ctxB.close()
  })

  test.afterAll(async ({ browser }) => {
    // Cleanup: User A deletes the test book
    if (!bookUrl) return

    const ctxA = await browser.newContext({
      storageState: path.join(__dirname, '.auth/userA.json'),
    })
    const pageA = await ctxA.newPage()
    await pageA.goto(bookUrl)
    const deleteBtn = pageA.getByRole('button', { name: /delete/i }).first()
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click()
      await pageA.getByRole('button', { name: /delete/i }).last().click()
    }
    await ctxA.close()
  })
})
