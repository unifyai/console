import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isChunkLoadError, tryReloadForChunkLoadError } from '@/utils/chunkLoadReload';

describe('isChunkLoadError', () => {
  it('matches explicit webpack chunk load failures', () => {
    expect(isChunkLoadError(new Error('Loading chunk 31255 failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Loading CSS chunk 42 failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('ChunkLoadError: something'))).toBe(true);
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
  });

  it('matches stale webpack module tables when the stack references Next chunks', () => {
    const error = new Error("Cannot read properties of undefined (reading 'call')");
    error.stack = [
      "TypeError: Cannot read properties of undefined (reading 'call')",
      '    at c (https://console.example/_next/static/chunks/webpack-cd5f49ef.js:1:143)',
      '    at s (https://console.example/_next/static/chunks/31255-abc.js:1:150874)',
    ].join('\n');

    expect(isChunkLoadError(error)).toBe(true);
  });

  it('does not treat unrelated undefined.call errors as chunk failures', () => {
    expect(
      isChunkLoadError(new Error("Cannot read properties of undefined (reading 'call')"))
    ).toBe(false);
  });

  it('ignores unrelated runtime errors', () => {
    expect(isChunkLoadError(new Error('Network request failed'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('tryReloadForChunkLoadError', () => {
  const chunkError = () => new Error('Loading chunk 31255 failed.');
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
    reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reloads on a chunk failure and ignores unrelated errors', () => {
    expect(tryReloadForChunkLoadError(new Error('Network request failed'))).toBe(false);
    expect(tryReloadForChunkLoadError(chunkError())).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload again while the chunk is still missing', () => {
    tryReloadForChunkLoadError(chunkError());
    vi.advanceTimersByTime(2_000);

    expect(tryReloadForChunkLoadError(chunkError())).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads again for a failure episode a later deploy brings', () => {
    tryReloadForChunkLoadError(chunkError());
    vi.advanceTimersByTime(4 * 60 * 60 * 1000);

    expect(tryReloadForChunkLoadError(chunkError())).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('reloads once for a tab carrying the superseded latch value', () => {
    window.sessionStorage.setItem('console:chunk-load-reload', '1');

    expect(tryReloadForChunkLoadError(chunkError())).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
