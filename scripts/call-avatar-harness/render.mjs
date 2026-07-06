/**
 * Renders the real UnityCallAvatar (React, in-browser) in the exact call-window
 * slot markup and screenshots each cell plus a full comparison board.
 *
 *   node scripts/call-avatar-harness/render.mjs
 *
 * Outputs to renders/call-avatar-live/.
 */
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const outDir = resolve(repoRoot, 'renders/call-avatar-live');

execFileSync(
  'npx',
  [
    'esbuild',
    resolve(here, 'entry.tsx'),
    '--bundle',
    `--outfile=${resolve(here, 'bundle.js')}`,
    '--loader:.css=css',
    `--alias:@=${resolve(repoRoot, 'src')}`,
    '--jsx=automatic',
    '--define:process.env.NODE_ENV="production"',
  ],
  { cwd: repoRoot, stdio: 'inherit' }
);

await mkdir(outDir, { recursive: true });
const { chromium } = await import('playwright');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 700, height: 950 },
    deviceScaleFactor: 3,
  });
  await page.goto(`file://${resolve(here, 'index.html')}`);
  // Let the lid-hinge animation and the ResizeObserver-driven lift settle.
  await page.waitForTimeout(1500);
  const board = await page.screenshot({
    path: resolve(outDir, 'live-harness.png'),
    fullPage: true,
  });

  // Every close-up is cropped from the SAME full-page frame (not re-shot), so
  // the animated parts (key beep, blinks) can never differ between artifacts.
  // Padded crops rather than element screenshots: the laptop overflows the
  // slot (overflow: visible), and element screenshots would clip it.
  const cells = await page.evaluate(() =>
    [...document.querySelectorAll('.cell')].map((cell) => {
      const slot = cell.querySelector('.slot').getBoundingClientRect();
      return {
        slug: cell.dataset.slug,
        x: slot.x + window.scrollX,
        y: slot.y + window.scrollY,
        w: slot.width,
        h: slot.height,
      };
    })
  );
  const PAD = 40;
  const SCALE = 3; // deviceScaleFactor above
  const crops = await page.evaluate(
    async ({ png, cells, PAD, SCALE }) => {
      const img = new Image();
      await new Promise((res) => {
        img.onload = res;
        img.src = 'data:image/png;base64,' + png;
      });
      const out = {};
      for (const cell of cells) {
        const w = (cell.w + 2 * PAD) * SCALE;
        const h = (cell.h + 2 * PAD) * SCALE;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, (cell.x - PAD) * SCALE, (cell.y - PAD) * SCALE, w, h, 0, 0, w, h);
        out[cell.slug] = canvas.toDataURL('image/png').split(',')[1];
      }
      return out;
    },
    { png: board.toString('base64'), cells, PAD, SCALE }
  );
  const { writeFile } = await import('node:fs/promises');
  for (const [slug, b64] of Object.entries(crops)) {
    await writeFile(resolve(outDir, `${slug}.png`), Buffer.from(b64, 'base64'));
  }
  console.log(`wrote ${outDir}`);
} finally {
  await browser.close();
}
