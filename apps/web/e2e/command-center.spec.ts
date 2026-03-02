import { test, expect } from '@playwright/test'

test.describe('Command Center', () => {
  test('loads command center page', async ({ page }) => {
    const res = await page.goto('/command')
    expect(res?.status()).toBe(200)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/\/command/)
    const heading = page.getByRole('heading', { level: 1 }).first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })
})
