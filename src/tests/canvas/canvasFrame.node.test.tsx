import { render } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';

import { CanvasFrame } from '@/components/Canvas/CanvasFrame';
import { getCanvasHostUrl, getCanvasOrigin } from '@/lib/canvas/origin';

vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));

/**
 * Static guarantees of the canvas frame.
 *
 * The protocol itself is exercised in `canvasFrame.browser.test.tsx`: jsdom
 * neither transfers MessagePorts through `postMessage` nor reports a real
 * `event.source`, so a handshake test here would assert against a fiction.
 * What is worth pinning down in jsdom is the markup, because the sandbox
 * attributes are the isolation boundary and a well-meaning edit that adds
 * `allow-same-origin` would silently dissolve it.
 */

describe('canvas origin configuration', () => {
  const original = process.env.NEXT_PUBLIC_CANVAS_ORIGIN;
  afterEach(() => {
    process.env.NEXT_PUBLIC_CANVAS_ORIGIN = original;
  });

  it('falls back to a distinct local port so local dev keeps real origin isolation', () => {
    delete process.env.NEXT_PUBLIC_CANVAS_ORIGIN;
    // A port is part of an origin, so this is genuinely separate from :3000
    // and needs no hosts-file or TLS setup to behave like production.
    expect(getCanvasOrigin()).toBe('http://localhost:3100');
  });

  it('honours the configured origin and versions the host path', () => {
    process.env.NEXT_PUBLIC_CANVAS_ORIGIN = 'https://canvas.unify.ai/';
    expect(getCanvasOrigin()).toBe('https://canvas.unify.ai');
    // Versioned so a kit upgrade can publish host/v2 alongside and leave
    // existing canvases on the runtime they were reviewed against.
    expect(getCanvasHostUrl()).toBe('https://canvas.unify.ai/host/v1/index.html');
  });
});

describe('CanvasFrame sandboxing', () => {
  it('never grants allow-same-origin, which would undo the opaque origin', () => {
    const { container } = render(<CanvasFrame source="export default () => null" />);
    const iframe = container.querySelector('iframe')!;
    const sandbox = iframe.getAttribute('sandbox') ?? '';

    expect(sandbox).toBe('allow-scripts');
    for (const forbidden of [
      'allow-same-origin',
      'allow-popups',
      'allow-forms',
      'allow-top-navigation',
      'allow-modals',
      'allow-downloads',
    ]) {
      expect(sandbox).not.toContain(forbidden);
    }
    expect(iframe.getAttribute('allow')).toBe('');
    expect(iframe.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('points at the canvas origin rather than console', () => {
    const { container } = render(<CanvasFrame source="export default () => null" />);
    const src = container.querySelector('iframe')!.getAttribute('src') ?? '';
    expect(src.startsWith(getCanvasOrigin())).toBe(true);
    expect(src).not.toContain('localhost:3000');
  });
});
