/**
 * Renders the parity page (classic overlay vs in-scene laptop) and pixel-diffs
 * each body's pair, cropping both from one full-page frame.
 *
 *   node scripts/call-avatar-harness/parity.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const outDir = resolve(repoRoot, 'renders/call-avatar-live/parity');

execFileSync(
  'npx',
  [
    'esbuild',
    resolve(here, 'parity-entry.tsx'),
    '--bundle',
    `--outfile=${resolve(here, 'parity-bundle.js')}`,
    '--loader:.css=css',
    `--alias:@=${resolve(repoRoot, 'src')}`,
    '--jsx=automatic',
    '--define:process.env.NODE_ENV="production"',
  ],
  { cwd: repoRoot, stdio: 'inherit' },
);

await mkdir(outDir, { recursive: true });
const { chromium } = await import('playwright');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 950 },
    deviceScaleFactor: 3,
  });
  await page.goto(`file://${resolve(here, 'parity.html')}`);
  await page.waitForTimeout(800);
  const board = await page.screenshot({ fullPage: true });

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
    }),
  );
  const PAD = 40;
  // Per-cell clipped captures (the page is fully static): each clip rasterizes
  // at its own origin, avoiding the one-device-pixel banding that full-page
  // stitched captures introduce between rows.
  const crops = {};
  for (const cell of cells) {
    crops[cell.slug] = (
      await page.screenshot({
        clip: { x: cell.x - PAD, y: cell.y - PAD, width: cell.w + 2 * PAD, height: cell.h + 2 * PAD },
      })
    ).toString('base64');
  }
  const result = await page.evaluate(
    async ({ crops }) => {
      const load = (b64) =>
        new Promise((res) => {
          const img = new Image();
          img.onload = () => res(img);
          img.src = 'data:image/png;base64,' + b64;
        });
      const toCanvas = (img) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        return { canvas, ctx, w: img.width, h: img.height };
      };
      const images = {};
      for (const [slug, b64] of Object.entries(crops)) {
        images[slug] = toCanvas(await load(b64));
      }
      const crop = (cell) => images[cell];
      const out = { crops, diffs: {} };
      // Downscale a 3x crop to display resolution (1x): sub-0.1px vector
      // quantization differences (the billboard rounds path points to 0.1 unit)
      // disappear, leaving only real geometry errors.
      const at1x = (c) => {
        const canvas = document.createElement('canvas');
        canvas.width = c.w / 3;
        canvas.height = c.h / 3;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(c.canvas, 0, 0, canvas.width, canvas.height);
        return { canvas, ctx, w: canvas.width, h: canvas.height };
      };
      const diffPair = (a, b, threshold) => {
        const da = a.ctx.getImageData(0, 0, a.w, a.h).data;
        const db = b.ctx.getImageData(0, 0, b.w, b.h).data;
        let diff = 0;
        const heat = document.createElement('canvas');
        heat.width = a.w;
        heat.height = a.h;
        const hctx = heat.getContext('2d');
        hctx.drawImage(a.canvas, 0, 0);
        const hd = hctx.getImageData(0, 0, a.w, a.h);
        for (let i = 0; i < da.length; i += 4) {
          const d =
            Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
          if (d > threshold) {
            diff++;
            hd.data[i] = 255;
            hd.data[i + 1] = 0;
            hd.data[i + 2] = 0;
          }
        }
        hctx.putImageData(hd, 0, 0);
        return { diff, total: da.length / 4, heat };
      };
      // The classic overlay's svg sits at a fractional CSS position and gets
      // paint-snapped by Chromium up to one device pixel, independently of the
      // droid svg (an artifact that varied with page position in production).
      // The laptop metric therefore diffs the laptop window with the minimum
      // over a +-1 device-pixel shift: parity up to the classic composition's
      // own paint-snap indeterminacy. Exact geometry equality is asserted
      // separately from the DOM (see vertexParity).
      const diffLaptopAligned = (a, b, threshold) => {
        const da = a.ctx.getImageData(0, 0, a.w, a.h).data;
        const db = b.ctx.getImageData(0, 0, b.w, b.h).data;
        // Laptop region in crop device px (slot -30..158 CSS mapped at 3x).
        const win = { x0: 240, y0: 270, x1: Math.min(a.w - 2, 560), y1: Math.min(a.h - 2, 550) };
        let best = Infinity;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            let diff = 0;
            for (let y = win.y0; y < win.y1; y++) {
              for (let x = win.x0; x < win.x1; x++) {
                const ia = (y * a.w + x) * 4;
                const ib = ((y + dy) * b.w + (x + dx)) * 4;
                const d =
                  Math.abs(da[ia] - db[ib]) +
                  Math.abs(da[ia + 1] - db[ib + 1]) +
                  Math.abs(da[ia + 2] - db[ib + 2]);
                if (d > threshold) diff++;
              }
            }
            if (diff < best) best = diff;
          }
        }
        return { diff: best, total: (win.x1 - win.x0) * (win.y1 - win.y0) };
      };
      // Exact geometry check straight from the DOM: every laptop polygon
      // vertex, classic vs in-scene, in slot-relative CSS px.
      const vertexParity = (slug) => {
        const verts = (cellSlug, classic) => {
          const cell = document.querySelector(`[data-slug="${cellSlug}"]`);
          const slot = cell.querySelector('.slot').getBoundingClientRect();
          let polys;
          if (classic) polys = [...cell.querySelectorAll('svg.hub-laptop-svg polygon')];
          else {
            const svg = cell.querySelector('svg.creature-svg');
            const gs = svg.querySelectorAll(':scope > g');
            polys = [...gs[gs.length - 1].querySelectorAll('polygon')];
          }
          return polys.map((p) => {
            const ctm = p.getScreenCTM();
            return [...p.points].map((pt) => [
              ctm.a * pt.x + ctm.c * pt.y + ctm.e - slot.x,
              ctm.b * pt.x + ctm.d * pt.y + ctm.f - slot.y,
            ]);
          });
        };
        const A = verts(`classic-${slug}`, true);
        const B = verts(`inscene-${slug}`, false);
        if (A.length !== B.length) return { error: `polygon count ${A.length} vs ${B.length}` };
        let max = 0;
        for (let i = 0; i < A.length; i++) {
          for (let j = 0; j < A[i].length; j++) {
            max = Math.max(
              max,
              Math.abs(A[i][j][0] - B[i][j][0]),
              Math.abs(A[i][j][1] - B[i][j][1]),
            );
          }
        }
        return { polygons: A.length, maxVertexDeltaCssPx: +max.toFixed(4) };
      };
      // Display-resolution error bound: max per-pixel delta after downscaling
      // to 1x, i.e. the worst any pixel a user can actually see differs.
      const maxDelta1x = (a, b) => {
        const da = a.ctx.getImageData(0, 0, a.w, a.h).data;
        const db = b.ctx.getImageData(0, 0, b.w, b.h).data;
        let max = 0;
        for (let i = 0; i < da.length; i += 4) {
          const d = Math.max(
            Math.abs(da[i] - db[i]),
            Math.abs(da[i + 1] - db[i + 1]),
            Math.abs(da[i + 2] - db[i + 2]),
          );
          if (d > max) max = d;
        }
        return max;
      };
      for (const key of Object.keys(images).filter((k) => k.startsWith('classic-'))) {
        const slug = key.replace('classic-', '');
        const a = crop(key);
        const b = crop(`inscene-${slug}`);
        const raw = diffPair(a, b, 45);
        const laptopWin = diffLaptopAligned(a, b, 45);
        out.diffs[slug] = {
          rawPct: +((100 * raw.diff) / raw.total).toFixed(3),
          laptopWinPct: +((100 * laptopWin.diff) / laptopWin.total).toFixed(3),
          maxDelta1x: maxDelta1x(at1x(a), at1x(b)),
          vertices: vertexParity(slug),
          heat: raw.heat.toDataURL('image/png').split(',')[1],
        };
      }
      return out;
    },
    { crops },
  );

  await writeFile(resolve(outDir, 'board.png'), board);
  for (const [slug, b64] of Object.entries(result.crops)) {
    await writeFile(resolve(outDir, `${slug}.png`), Buffer.from(b64, 'base64'));
  }
  for (const [slug, d] of Object.entries(result.diffs)) {
    await writeFile(resolve(outDir, `diff-${slug}.png`), Buffer.from(d.heat, 'base64'));
    console.log(
      `${slug}: vector ${JSON.stringify(d.vertices)} | max display-pixel delta ${d.maxDelta1x}/255 | edge-pixel flags raw@3x ${d.rawPct}%`,
    );
  }
} finally {
  await browser.close();
}
