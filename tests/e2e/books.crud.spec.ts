/**
 * E2E — Book CRUD flows (runs as User A, authenticated via storageState)
 *
 * P0:
 *  - Add a book → appears in the list
 *  - View book detail
 *  - Edit book → changes persist
 *  - Delete book → removed from list
 *
 * Cleanup: each test is self-contained; books created in tests are deleted
 * at the end so they don't pollute subsequent runs.
 */
import { test, expect } from '@playwright/test'

// storageState is set by the "chromium" project in playwright.config.ts

const BOOK = {
  title:  'Playwright Test Book',
  author: 'Test Author',
  year:   '2024',
  rating: 4, // 1-indexed star (4 = "Really liked it")
} as const

test.describe('Book CRUD', () => {
  test('add a book and verify it appears in the list', async ({ page }) => {
    // Navigate to the add page
    await page.goto('/add')
    await expect(page).toHaveURL(/\/add/)

    // Fill in title (triggers book search autocomplete — just type and wait)
    await page.getByPlaceholder(/start typing/i).fill(BOOK.title)

    // Fill author
    await page.getByPlaceholder(/author/i).fill(BOOK.author)

    // Fill the year field (numeric input)
    await page.locator('input[inputmode="numeric"]').first().fill(BOOK.year)

    // Click the 4th star (rating = 4) — the Rating section contains 5 buttons
    const ratingSection = page.getByText('Rating').locator('..')
    const starButtons = ratingSection.locator('button')
    await starButtons.nth(3).click() // 4th star (0-indexed)

    // Submit
    await page.getByRole('button', { name: /add book/i }).click()

    // Should redirect to home
    await expect(page).toHaveURL(/\/$/)

    // Book should appear in the list
    await expect(page.getByText(BOOK.title)).toBeVisible()
  })

  test('view book detail page', async ({ page }) => {
    // Navigate to home and click on the test book
    await page.goto('/')

    // Wait for books to load
    await page.waitForSelector('text=' + BOOK.title, { timeout: 10_000 })
    await page.getByText(BOOK.title).first().click()

    // Should navigate to the book detail page
    await expect(page).toHaveURL(/\/book\//)

    // Title should be visible
    await expect(page.getByText(BOOK.title)).toBeVisible()
    // Author should be visible
    await expect(page.getByText(BOOK.author)).toBeVisible()
  })

  test('edit a book and verify changes persist', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=' + BOOK.title, { timeout: 10_000 })
    await page.getByText(BOOK.title).first().click()
    await expect(page).toHaveURL(/\/book\//)

    // Click Edit button
    await page.getByRole('button', { name: /edit/i }).click()

    // Change the author
    const authorInput = page.getByPlaceholder(/author/i)
    await authorInput.clear()
    await authorInput.fill('Updated Author')

    // Save
    await page.getByRole('button', { name: /save/i }).click()

    // Should return to detail view with updated author
    await expect(page.getByText('Updated Author')).toBeVisible()
  })

  test('delete a book and verify it is removed from the list', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=' + BOOK.title, { timeout: 10_000 })
    await page.getByText(BOOK.title).first().click()
    await expect(page).toHaveURL(/\/book\//)

    // Click Delete button
    await page.getByRole('button', { name: /delete/i }).first().click()

    // Confirm deletion in the dialog
    await page.getByRole('button', { name: /delete/i }).last().click()

    // Should redirect back to home
    await expect(page).toHaveURL(/\/$/)

    // Book should no longer appear
    await expect(page.getByText(BOOK.title)).not.toBeVisible()
  })
})
