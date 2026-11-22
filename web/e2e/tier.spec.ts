import { test, expect } from '@playwright/test';

test.describe('GPU Capability Tier & Override Popover (D-08, RELY-09)', () => {
  test('Header and HUD tier badges allow interactive tier switching', async ({ page }) => {
    await page.goto('/studio/');

    // Header tier badge
    const headerTierBtn = page.locator('header button[aria-label*="Quality Tier"]');
    await expect(headerTierBtn).toBeVisible();
    await expect(headerTierBtn).toContainText('[TIER:');

    // Click badge to open popover
    await headerTierBtn.click();

    // Popover opens
    const popover = page.locator('div[role="dialog"][aria-label="Quality tier selection"]');
    await expect(popover).toBeVisible();
    await expect(popover.getByText('Switch Quality Tier')).toBeVisible();

    // Select Low tier
    const lowOption = popover.getByRole('radio', { name: /Low \(480p canvas/i });
    await expect(lowOption).toBeVisible();
    await lowOption.click();

    // Popover closes and badge reflects LOW
    await expect(popover).not.toBeVisible();
    await expect(headerTierBtn).toContainText('[TIER: LOW]');
  });
});
