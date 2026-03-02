import { test, expect } from '@playwright/test'

test.describe('Map', () => {
  test('command center has map/globe area', async ({ page }) => {
    const res = await page.goto('/command')
    expect(res?.status()).toBe(200)
    await page.waitForLoadState('domcontentloaded')
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible({ timeout: 15000 })
  })
})
