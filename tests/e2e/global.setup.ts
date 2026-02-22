/**
 * Playwright global setup — authenticates both test users and saves their
 * storage states so individual specs can load them without re-logging in.
 *
 * Required env vars:
 *   TEST_AUTH=true
 *   TEST_USER_A_EMAIL / TEST_USER_A_PASSWORD
 *   TEST_USER_B_EMAIL / TEST_USER_B_PASSWORD
 */
import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const AUTH_DIR = path.join(__dirname, '.auth')

async function loginAs(
  page: import('@playwright/test').Page,
  userSlot: 'a' | 'b',
  stateFile: string
) {
  // Hit the test-auth endpoint — it signs in via Supabase and sets session cookies
  const response = await page.request.post(`/api/test-auth?user=${userSlot}`)

  if (!response.ok()) {
    const body = await response.text()
    throw new Error(
      `test-auth failed for user ${userSlot} (${response.status()}): ${body}\n` +
      `Make sure TEST_AUTH=true and TEST_USER_${userSlot.toUpperCase()}_EMAIL / ` +
      `TEST_USER_${userSlot.toUpperCase()}_PASSWORD are set in your env.`
    )
  }

  // Persist the cookie jar so specs can reuse it
  await page.context().storageState({ path: stateFile })
}

setup('authenticate test users', async ({ page }) => {
  // Ensure .auth directory exists
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true })
  }

  // User A
  await loginAs(page, 'a', path.join(AUTH_DIR, 'userA.json'))

  // User B — use a fresh context so cookies don't bleed between sessions
  await page.context().clearCookies()
  await loginAs(page, 'b', path.join(AUTH_DIR, 'userB.json'))

  console.log('✅ Both test users authenticated and storage states saved.')
})
