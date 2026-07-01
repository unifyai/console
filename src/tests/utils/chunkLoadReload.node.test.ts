import { describe, expect, it } from 'vitest';
import { isChunkLoadError } from '@/utils/chunkLoadReload';

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
