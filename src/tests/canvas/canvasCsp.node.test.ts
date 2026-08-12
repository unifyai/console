/**
 * The response headers on the standalone canvas page.
 *
 * A second `Content-Security-Policy` header on a more specific route *replaces* the
 * global one rather than adding to it, so a route that emits a bare
 * `frame-ancestors` directive silently drops `script-src`, `connect-src` and
 * `object-src` — the retired dashboard/tile view routes did exactly that.
 *
 * These tests pin the canvas route to the opposite shape: the whole base policy plus
 * a narrow `frame-ancestors`. They fail if someone shortens it back to a single
 * directive, or widens it to `*` to make third-party embedding work, which is a
 * per-canvas opt-in rather than a blanket allowance.
 */

import { describe, expect, it } from 'vitest';

import nextConfig from '../../../next.config.js';

const CANVAS_ROUTE = '/canvas/view/:token*';

type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> };

async function rules(): Promise<HeaderRule[]> {
  return (await (nextConfig as { headers: () => Promise<HeaderRule[]> }).headers()) ?? [];
}

function policyFor(all: HeaderRule[], source: string): string {
  const rule = all.find((entry) => entry.source === source);
  if (!rule) throw new Error(`no header rule for ${source}`);
  const csp = rule.headers.find((header) => header.key === 'Content-Security-Policy');
  if (!csp) throw new Error(`no CSP on ${source}`);
  return csp.value;
}

describe('canvas response headers', () => {
  it('frames the canvas origin from the global policy', async () => {
    // Without this the frame is blocked outright, on every surface.
    const global = policyFor(await rules(), '/:path*');
    const frameSrc = global.match(/frame-src [^;]*/)?.[0] ?? '';
    expect(frameSrc).toContain('localhost:3100');
  });

  it('carries the whole base policy on the standalone route, not a bare directive', async () => {
    const all = await rules();
    const base = policyFor(all, '/:path*');
    const canvas = policyFor(all, CANVAS_ROUTE);

    for (const directive of base.split('; ')) {
      expect(canvas).toContain(directive);
    }
  });

  it('restricts who may frame the standalone page to this origin', async () => {
    const canvas = policyFor(await rules(), CANVAS_ROUTE);

    expect(canvas).toContain("frame-ancestors 'self'");
    expect(canvas).not.toMatch(/frame-ancestors[^;]*\*/);
  });

  it('relaxes X-Frame-Options only as far as same-origin', async () => {
    // The global value is DENY, which would block console framing its own page in
    // browsers that honour the header instead of frame-ancestors.
    const all = await rules();
    const rule = all.find((entry) => entry.source === CANVAS_ROUTE);
    const xfo = rule?.headers.find((header) => header.key === 'X-Frame-Options');

    expect(xfo?.value).toBe('SAMEORIGIN');
    expect(xfo?.value).not.toBe('ALLOWALL');
  });
});
