import { test, expect } from '@playwright/test';

test.describe('CenterStage Viewport & Canvas (D-03, RELY-06)', () => {
  test('studio mounts canvas viewport and HUD controls', async ({ page }) => {
    await page.goto('/studio/');

    // Canvas viewport mounted
    const canvas = page.locator('canvas[aria-label="Media viewport canvas"]');
    await expect(canvas).toBeVisible();

    // Viewport HUD toolbar visible
    const hud = page.locator('div[role="toolbar"][aria-label="Viewport controls"]');
    await expect(hud).toBeVisible();

    // Zoom controls and reset button present
    await expect(hud.getByRole('button', { name: 'zoom in' })).toBeVisible();
    await expect(hud.getByRole('button', { name: 'zoom out' })).toBeVisible();
    await expect(hud.getByRole('button', { name: 'reset pan and zoom' })).toBeVisible();

    // Quality tier badge present
    const tierBadge = hud.locator('button[aria-label*="Quality Tier"]');
    await expect(tierBadge).toBeVisible();
  });
});
