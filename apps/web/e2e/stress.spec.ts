import { test, expect } from '@playwright/test'

test.describe('Stress Planner', () => {
  test('loads stress planner page', async ({ page }) => {
    const res = await page.goto('/stress-planner')
    expect(res?.status()).toBe(200)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/\/stress-planner/)
    await expect(page.getByText(/stress|scenario|planner/i).first()).toBeVisible({ timeout: 10000 })
  })
})
