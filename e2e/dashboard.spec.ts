import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should load dashboard with stats cards', async ({ page }) => {
    // Wait for stats to load
    await page.waitForSelector('[id="tour-stats"]', { timeout: 5000 })

    // Check if stats cards are visible
    const statsCards = await page.locator('.panel').count()
    expect(statsCards).toBeGreaterThan(0)
  })

  test('should have navigation sidebar', async ({ page }) => {
    const sidebar = await page.locator('[class*="sidebar"]')
    await expect(sidebar).toBeVisible()

    // Check for common navigation items
    const subscribers = page.locator('text=المشتركون')
    const analytics = page.locator('text=التحليلات')

    expect(await subscribers.count()).toBeGreaterThan(0)
  })

  test('should display tabs for overview, subscribers, and alerts', async ({ page }) => {
    await page.waitForSelector('[id="tour-tabs"]', { timeout: 5000 })

    const overviewTab = page.locator('text=النظرة العامة')
    const subscribersTab = page.locator('text=المشتركون')
    const alertsTab = page.locator('text=التنبيهات')

    await expect(overviewTab).toBeVisible()
    await expect(subscribersTab).toBeVisible()
    await expect(alertsTab).toBeVisible()
  })

  test('should open add subscriber modal', async ({ page }) => {
    const addButton = page.locator('button:has-text("مشترك جديد")')
    await addButton.click()

    // Check if modal opened
    const modal = page.locator('[class*="modal"]')
    await expect(modal).toBeVisible()
  })

  test('should toggle dark mode', async ({ page }) => {
    const themeToggle = page.locator('button[title*="Dark"]')

    if (await themeToggle.count() > 0) {
      await themeToggle.click()

      // Check if dark mode is applied
      const html = await page.locator('html')
      const dataTheme = await html.getAttribute('data-theme')
      expect(dataTheme).toBeTruthy()
    }
  })

  test('should show guided tour on first visit (new users)', async ({ page, context }) => {
    // Clear localStorage to simulate first visit
    await context.clearCookies()
    await page.evaluate(() => localStorage.clear())

    await page.goto('/')
    await page.waitForSelector('[class*="joyride"]', { timeout: 5000 })

    const tourTooltip = page.locator('[class*="tooltip"]')
    expect(await tourTooltip.count()).toBeGreaterThan(0)
  })
})
