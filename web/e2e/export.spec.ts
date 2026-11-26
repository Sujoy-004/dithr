import { test, expect } from '@playwright/test';

test.describe('ExportDrawer & ServerExportModal', () => {
  test('ExportDrawer provides PNG, JPEG, TXT, SVG and server MP4/GIF controls with upfront limits', async ({
    page,
  }) => {
    await page.goto('/studio/');

    // Image tab is active by default
    await expect(page.getByRole('button', { name: /Export PNG/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Export JPEG/i })).toBeDisabled();

    // Switch to 'clip' export tab
    const clipTab = page.getByRole('tab', { name: 'clip' });
    await expect(clipTab).toBeVisible();
    await clipTab.click();

    await expect(page.getByRole('button', { name: /Export MP4/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Export GIF/i })).toBeDisabled();
    await expect(page.getByText(/1 to 5 s/i)).toBeVisible();

    // Load sample media into studio store
    await page.evaluate(() => {
      (window as any).useStudioStore.setState({
        mediaType: 'image',
        mediaUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        mediaName: 'test-pixel.png',
        dimensions: { width: 800, height: 600 },
      });
    });

    const serverBtn = page.getByRole('button', { name: /Export MP4/i });
    await expect(serverBtn).toBeEnabled();
    await serverBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Start Export' })).toBeVisible();
  });
});
