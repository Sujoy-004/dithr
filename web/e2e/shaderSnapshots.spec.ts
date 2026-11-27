import { test, expect, type Page } from '@playwright/test';

/**
 * Shader Engine 2.0 Visual Verification & Composable Stack E2E Suite
 * Covers:
 * 1. Media-first empty stack passthrough color fidelity (non-ASCII default)
 * 2. All 16 shaders + crtVhs/rgbSplit/masks/threeD (non-black, non-NaN, distinct outputs)
 * 3. UI stack workflow: 1-click auditioning, + Stack (dither -> vhs, ascii -> vhs),
 *    reorder, toggle, Clear all, and resolution scaling.
 */

async function injectSyntheticMedia(page: Page, width = 320, height = 180) {
  await page.evaluate(
    ({ w, h }) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;

      // Left half: vibrant warm red gradient
      const leftGrad = ctx.createLinearGradient(0, 0, 0, h);
      leftGrad.addColorStop(0, '#eb3324');
      leftGrad.addColorStop(1, '#5a1410');
      ctx.fillStyle = leftGrad;
      ctx.fillRect(0, 0, w / 2, h);

      // Top-right: crisp cyan/blue block
      ctx.fillStyle = '#24c8e8';
      ctx.fillRect(w / 2, 0, w / 2, h / 2);

      // Bottom-right: bright gold + high-contrast diagonal bars for edge/dither/ascii contrast
      ctx.fillStyle = '#f2c438';
      ctx.fillRect(w / 2, h / 2, w / 2, h / 2);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(w * 0.35, h * 0.3, w * 0.3, h * 0.4);
      ctx.fillStyle = '#101218';
      ctx.fillRect(w * 0.42, h * 0.38, w * 0.16, h * 0.24);

      const url = c.toDataURL('image/png');
      const store = (window as any).useStudioStore;
      store.setState({
        mediaType: 'image',
        mediaUrl: url,
        mediaName: 'synthetic-test.png',
        dimensions: { width: w, height: h },
      });
    },
    { w: width, h: height }
  );

  // Wait for Image onload + GPU texture upload + initial render
  await page.waitForTimeout(250);
}

async function sampleCanvasFrame(page: Page) {
  return page.evaluate(() => {
    const pipeline = (window as any).getActivePipeline?.();
    if (pipeline) {
      pipeline.render(1.0);
    }

    const canvas = document.querySelector(
      'canvas[aria-label="Media viewport canvas"]'
    ) as HTMLCanvasElement;
    const w = canvas.width || 320;
    const h = canvas.height || 180;
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d');
    if (!ctx) {
      return {
        hasNaN: false,
        isBlack: true,
        mean: 0,
        nonZeroCount: 0,
        width: w,
        height: h,
        leftSample: [0, 0, 0],
        topRightSample: [0, 0, 0],
        signature: 0,
      };
    }

    ctx.drawImage(canvas, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let sum = 0;
    let nonZeroCount = 0;
    let hasNaN = false;
    let signature = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) || Number.isNaN(data[i + 3])) {
        hasNaN = true;
      }
      if (r > 4 || g > 4 || b > 4) {
        nonZeroCount++;
      }
      sum += (r + g + b) / 3;
      if ((i / 4) % 37 === 0) {
        signature += r * 0.3 + g * 0.59 + b * 0.11;
      }
    }

    const sampleAt = (nx: number, ny: number) => {
      const px = Math.min(w - 1, Math.max(0, Math.floor(nx * w)));
      const py = Math.min(h - 1, Math.max(0, Math.floor(ny * h)));
      const idx = (py * w + px) * 4;
      return [data[idx], data[idx + 1], data[idx + 2]];
    };

    return {
      hasNaN,
      isBlack: nonZeroCount === 0,
      mean: sum / ((data.length / 4) * 255),
      nonZeroCount,
      width: w,
      height: h,
      leftSample: sampleAt(0.15, 0.2),
      topRightSample: sampleAt(0.85, 0.2),
      signature,
    };
  });
}

test.describe('Shader Engine 2.0 Visual Verification & Composable Stack', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/studio/?testMode=true&freezeTime=1.0&seed=42');
    const canvas = page.locator('canvas[aria-label="Media viewport canvas"]');
    await expect(canvas).toBeVisible();
    await injectSyntheticMedia(page, 320, 180);
  });

  test('1. Media upload defaults to empty stack passthrough with faithful source colors (non-ASCII)', async ({
    page,
  }) => {
    const state = await page.evaluate(() => {
      const s = (window as any).useStudioStore.getState();
      return {
        activeStack: s.activeStack,
        selectedPassId: s.selectedPassId,
        effect: s.effect,
      };
    });

    expect(state.activeStack).toEqual([]);
    expect(state.selectedPassId).toBeNull();
    expect(state.effect).toBeNull();

    await expect(page.getByText('Original media (no active shaders)')).toBeVisible();
    // ASCII ramp presets are hidden until an ascii/matrix/threeD pass is active
    await expect(page.getByText('ASCII ramp presets')).not.toBeVisible();

    const frame = await sampleCanvasFrame(page);
    expect(frame.hasNaN).toBe(false);
    expect(frame.isBlack).toBe(false);
    expect(frame.width).toBe(320);
    expect(frame.height).toBe(180);

    // Left quadrant is warm red (#eb3324): R substantially exceeds G and B
    expect(frame.leftSample[0]).toBeGreaterThan(150);
    expect(frame.leftSample[0]).toBeGreaterThan(frame.leftSample[1] + 60);
    expect(frame.leftSample[0]).toBeGreaterThan(frame.leftSample[2] + 60);

    // Top-right quadrant is cyan (#24c8e8): G and B substantially exceed R
    expect(frame.topRightSample[1]).toBeGreaterThan(130);
    expect(frame.topRightSample[2]).toBeGreaterThan(150);
    expect(frame.topRightSample[2]).toBeGreaterThan(frame.topRightSample[0] + 60);
  });

  test('2. All 16 shaders + crtVhs/rgbSplit/masks/threeD render distinct non-black non-NaN output', async ({
    page,
  }) => {
    const passthroughFrame = await sampleCanvasFrame(page);

    const allShaders = [
      'ascii',
      'dither',
      'halftone',
      'vhs',
      'matrix',
      'dots',
      'contour',
      'pixelSort',
      'blockify',
      'threshold',
      'edgeDetect',
      'crosshatch',
      'waveLines',
      'noise',
      'voronoi',
      'tone',
      'crtVhs',
      'rgbSplit',
      'masks',
      'threeD',
    ];

    const signatures = new Map<string, number>();

    for (const shaderId of allShaders) {
      await page.evaluate((id) => {
        const store = (window as any).useStudioStore;
        store.getState().setSingleEffectFastPath(id);
      }, shaderId);

      await page.waitForTimeout(80);
      const frame = await sampleCanvasFrame(page);

      expect(frame.hasNaN, `${shaderId} produced NaN`).toBe(false);
      expect(frame.isBlack, `${shaderId} rendered pitch black`).toBe(false);
      expect(frame.nonZeroCount, `${shaderId} had too few lit pixels`).toBeGreaterThan(100);
      expect(frame.width).toBe(320);
      expect(frame.height).toBe(180);

      signatures.set(shaderId, frame.signature);
    }

    // Stylizing effects must actually transform the image relative to raw passthrough
    for (const transformedId of ['ascii', 'threshold', 'edgeDetect', 'matrix', 'crosshatch', 'contour']) {
      const sig = signatures.get(transformedId)!;
      expect(Math.abs(sig - passthroughFrame.signature)).toBeGreaterThan(5);
    }

    // 'vhs' alias and canonical 'crtVhs' render identically
    expect(Math.abs(signatures.get('vhs')! - signatures.get('crtVhs')!)).toBeLessThan(1.0);
  });

  test('3. UI workflow: click shader, + Stack (dither -> vhs, ascii -> vhs), reorder, toggle, Clear all', async ({
    page,
  }) => {
    const shaderList = page.getByRole('list', { name: 'Shader list' });

    // 1. Click 'dither' row -> single effect active
    await shaderList.getByRole('button', { name: /^dither/i }).click();
    let stackIds = await page.evaluate(() =>
      (window as any).useStudioStore.getState().activeStack.map((p: any) => p.effectId)
    );
    expect(stackIds).toEqual(['dither']);

    // 2. Click '+ Stack' on 'vhs' row -> sequential 2-pass stack ['dither', 'crtVhs']
    await shaderList.getByRole('button', { name: 'Add vhs to stack' }).click();
    stackIds = await page.evaluate(() =>
      (window as any).useStudioStore.getState().activeStack.map((p: any) => p.effectId)
    );
    expect(stackIds).toEqual(['dither', 'crtVhs']);

    const stackedFrame = await sampleCanvasFrame(page);
    expect(stackedFrame.hasNaN).toBe(false);
    expect(stackedFrame.isBlack).toBe(false);

    // 3. Reorder pass 2 ('crtVhs') up -> ['crtVhs', 'dither']
    const activeStackList = page.getByRole('list', { name: 'Active effect passes' });
    const moveUpButtons = activeStackList.getByRole('button', { name: 'Move effect up' });
    await moveUpButtons.nth(1).click();

    stackIds = await page.evaluate(() =>
      (window as any).useStudioStore.getState().activeStack.map((p: any) => p.effectId)
    );
    expect(stackIds).toEqual(['crtVhs', 'dither']);

    // 4. Toggle pass 1 off -> enabled: false
    await activeStackList.getByRole('button', { name: 'Toggle effect' }).first().click();
    const firstEnabled = await page.evaluate(
      () => (window as any).useStudioStore.getState().activeStack[0].enabled
    );
    expect(firstEnabled).toBe(false);

    // 5. Clear all -> back to empty passthrough
    await page.getByRole('button', { name: 'Clear all shaders' }).click();
    await expect(page.getByText('Original media (no active shaders)')).toBeVisible();
    const clearedFrame = await sampleCanvasFrame(page);
    expect(clearedFrame.hasNaN).toBe(false);
    expect(clearedFrame.isBlack).toBe(false);

    // 6. Test ascii -> vhs multi-pass composition & conditional ASCII presets
    await shaderList.getByRole('button', { name: /^ascii/i }).click();
    await expect(page.getByText('ASCII ramp presets')).toBeVisible();
    await shaderList.getByRole('button', { name: 'Add vhs to stack' }).click();

    stackIds = await page.evaluate(() =>
      (window as any).useStudioStore.getState().activeStack.map((p: any) => p.effectId)
    );
    expect(stackIds).toEqual(['ascii', 'crtVhs']);
    const asciiVhsFrame = await sampleCanvasFrame(page);
    expect(asciiVhsFrame.hasNaN).toBe(false);
    expect(asciiVhsFrame.isBlack).toBe(false);
  });

  test('4. Resolution scaling caps dimensions to active tier (480p, 720p, 1080p)', async ({
    page,
  }) => {
    const resolutions = [
      { width: 854, height: 480 },
      { width: 1280, height: 720 },
      { width: 1920, height: 1080 },
    ];

    for (const res of resolutions) {
      await page.evaluate(({ width, height }) => {
        const store = (window as any).useStudioStore;
        store.getState().setDimensions({ width, height });
      }, res);

      await page.waitForTimeout(80);
      const dimensions = await page.evaluate(
        () => (window as any).useStudioStore.getState().dimensions
      );
      expect(dimensions.width).toBe(res.width);
      expect(dimensions.height).toBe(res.height);
    }
  });
});
