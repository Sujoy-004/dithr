import { test, expect } from '@playwright/test';

test.describe('ExportDrawer & ServerExportModal (D-03, D-04, RELY-01, RELY-03, RELY-04)', () => {
  test('ExportDrawer provides WebM and GIF recording controls and server export modal', async ({ page }) => {
    await page.goto('/studio/');

    // Switch to 'clip' export tab
    const clipTab = page.getByRole('tab', { name: 'clip' });
    await expect(clipTab).toBeVisible();
    await clipTab.click();

    // Format toggles
    await expect(page.getByRole('button', { name: 'WebM Video' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Animated GIF' })).toBeVisible();

    // WebM primary CTA and Audio checkbox
    await expect(page.getByRole('button', { name: 'Record WebM Clip' })).toBeVisible();
    await expect(page.getByText('Preserve Audio Track')).toBeVisible();

    // Switch to GIF mode
    await page.getByRole('button', { name: 'Animated GIF' }).click();
    await expect(page.getByRole('button', { name: 'Record Animated GIF' })).toBeVisible();
    await expect(page.getByText('resolution: max 480px')).toBeVisible();

    // Verify buttons are disabled when no media is loaded
    await expect(page.getByRole('button', { name: 'Record Animated GIF' })).toBeDisabled();

    // Load mock media into studio store
    await page.evaluate(() => {
      (window as any).useStudioStore.setState({
        mediaType: 'image',
        mediaUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        mediaName: 'test-pixel.png',
        dimensions: { width: 800, height: 600 },
      });
    });

    // Now buttons are enabled
    const gifBtn = page.getByRole('button', { name: 'Record Animated GIF' });
    await expect(gifBtn).toBeEnabled();

    // Server Export modal trigger
    const serverBtn = page.getByRole('button', { name: /export MP4/i });
    await expect(serverBtn).toBeEnabled();
    await serverBtn.click();

    // Server modal opens
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Start Export' })).toBeVisible();
  });
});
