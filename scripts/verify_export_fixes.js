const { chromium } = require('../web/node_modules/playwright');
const path = require('path');

(async () => {
  console.log('Testing export fixes on dev server...');
  const browser = await chromium.launch({
    headless: false,
    args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--no-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/studio/');
  await page.waitForTimeout(1500);

  // 1. Verify palette attributes
  const pixelSortBtn = page.locator('button[data-effect-id="pixelSort"][data-testid="add-effect-pixelSort"]');
  const count = await pixelSortBtn.count();
  console.log('1. pixelSort button count with data-effect-id:', count);
  if (count === 0) throw new Error('Missing data-effect-id on pixelSort button');

  // 2. Upload video
  const vidPath = path.resolve('.proof/.vid/source_video.mp4');
  await page.locator('input[type="file"][accept*="png"]').setInputFiles(vidPath);
  await page.waitForTimeout(2000);

  // 3. Verify clip tab
  const clipTab = page.locator('button[role="tab"]:has-text("clip")');
  console.log('2. Clip tab selected:', await clipTab.getAttribute('aria-selected'));

  const webmBtn = page.locator('button:has-text("record WebM clip")');
  console.log('3. record WebM clip visible:', await webmBtn.isVisible());

  const gifBtn = page.locator('button:has-text("record client GIF")');
  console.log('4. record client GIF visible:', await gifBtn.isVisible());

  // 4. Test WebM download
  console.log('5. Testing WebM download trigger (3s)...');
  const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch(e => null);
  await webmBtn.click();
  const dl = await downloadPromise;
  const filename = dl ? dl.suggestedFilename() : 'NO DOWNLOAD';
  console.log('   Downloaded filename:', filename);
  if (!dl) throw new Error('WebM download event did not fire');

  // 5. Open Server Modal and check fallback banner
  const mp4Btn = page.locator('button:has-text("export MP4")');
  await mp4Btn.click();
  await page.waitForTimeout(1000);
  const fallbackBanner = page.locator('button:has-text("Use Instant In-Browser Export")');
  const hasFallback = await fallbackBanner.isVisible();
  console.log('6. Fallback banner visible in modal:', hasFallback);
  if (!hasFallback) throw new Error('Missing fallback banner in ServerExportModal');

  await browser.close();
  console.log('\n🎉 ALL EXPORT FIXES VERIFIED SUCCESSFULLY!');
  process.exit(0);
})().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
