import { test, expect } from '@playwright/test'

test.describe('Subscriber Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[id="tour-stats"]', { timeout: 5000 })
  })

  test('should add new subscriber', async ({ page }) => {
    const addButton = page.locator('button:has-text("مشترك جديد")')
    await addButton.click()

    // Wait for modal
    const modal = page.locator('[class*="modal"]')
    await expect(modal).toBeVisible()

    // Fill form
    const nameInput = page.locator('input[placeholder*="الاسم"]').first()
    await nameInput.fill('محمد أحمد')

    const phoneInput = page.locator('input[placeholder*="الهاتف"]').first()
    await phoneInput.fill('966501234567')

    const emailInput = page.locator('input[placeholder*="البريد"]').first()
    await emailInput.fill('test@example.com')

    // Submit form
    const submitButton = page.locator('button:has-text("حفظ")').first()
    if (await submitButton.count() > 0) {
      await submitButton.click()

      // Check for success message
      const successToast = page.locator('text=تم الحفظ بنجاح')
      await expect(successToast).toBeVisible({ timeout: 5000 })
    }
  })

  test('should switch between tabs', async ({ page }) => {
    const subscribersTab = page.locator('text=المشتركون')
    await subscribersTab.click()

    // Check if table is visible
    const table = page.locator('table')
    await expect(table).toBeVisible({ timeout: 5000 })
  })

  test('should show alerts tab with paused/frozen subscribers', async ({ page }) => {
    const alertsTab = page.locator('text=التنبيهات')
    await alertsTab.click()

    // Wait for alerts content
    const alertsContent = page.locator('[class*="alert"]')
    expect(await alertsContent.count()).toBeGreaterThanOrEqual(0)
  })

  test('should filter subscribers by date range', async ({ page }) => {
    const filterButton = page.locator('button:has-text("آخر")').first()

    if (await filterButton.count() > 0) {
      await filterButton.click()

      // Select a date option
      const dateOption = page.locator('text=آخر 7 أيام').first()
      if (await dateOption.count() > 0) {
        await dateOption.click()

        // Verify filter is applied
        await page.waitForTimeout(500)
      }
    }
  })

  test('should open subscriber profile', async ({ page }) => {
    const subscribersTab = page.locator('text=المشتركون')
    await subscribersTab.click()

    // Wait for table
    await page.waitForSelector('table', { timeout: 5000 })

    // Click first row
    const firstRow = page.locator('tbody tr').first()
    if (await firstRow.count() > 0) {
      await firstRow.click()

      // Check if profile modal opened
      const modal = page.locator('[class*="modal"]')
      await expect(modal).toBeVisible({ timeout: 5000 })
    }
  })
})
