/**
 * Embed URL Parsing Tests
 *
 * Tests for parseEmbedUrl and containsEmbedUrl covering
 * tile and dashboard URL patterns alongside existing table/plot patterns.
 */

import { describe, it, expect } from 'vitest';
import { parseEmbedUrl, containsEmbedUrl } from '@/components/Chat/InlineEmbed';

// =============================================================================
// parseEmbedUrl
// =============================================================================

describe('parseEmbedUrl', () => {
  describe('tile URLs', () => {
    it('matches full tile URL', () => {
      const result = parseEmbedUrl('https://console.unify.ai/tile/view/abc123_XYZ-9');
      expect(result).toEqual({
        type: 'tile',
        token: 'abc123_XYZ-9',
        url: 'https://console.unify.ai/tile/view/abc123_XYZ-9',
      });
    });

    it('matches relative tile URL', () => {
      const result = parseEmbedUrl('/tile/view/someToken42');
      expect(result).toEqual({
        type: 'tile',
        token: 'someToken42',
        url: '/tile/view/someToken42',
      });
    });

    it('matches tile URL with localhost', () => {
      const result = parseEmbedUrl('http://localhost:3000/tile/view/tk_abc123');
      expect(result).toEqual({
        type: 'tile',
        token: 'tk_abc123',
        url: 'http://localhost:3000/tile/view/tk_abc123',
      });
    });
  });

  describe('dashboard URLs', () => {
    it('matches full dashboard URL', () => {
      const result = parseEmbedUrl('https://console.unify.ai/dashboard/view/dash-token-1');
      expect(result).toEqual({
        type: 'dashboard',
        token: 'dash-token-1',
        url: 'https://console.unify.ai/dashboard/view/dash-token-1',
      });
    });

    it('matches relative dashboard URL', () => {
      const result = parseEmbedUrl('/dashboard/view/myDash_99');
      expect(result).toEqual({
        type: 'dashboard',
        token: 'myDash_99',
        url: '/dashboard/view/myDash_99',
      });
    });
  });

  describe('table URLs', () => {
    it('matches table URL', () => {
      const result = parseEmbedUrl('https://console.unify.ai/table/view/tbl123');
      expect(result).toEqual({
        type: 'table',
        token: 'tbl123',
        url: 'https://console.unify.ai/table/view/tbl123',
      });
    });
  });

  describe('plot URLs', () => {
    it('matches plot URL', () => {
      const result = parseEmbedUrl('https://console.unify.ai/plot/view/plt456');
      expect(result).toEqual({
        type: 'plot',
        token: 'plt456',
        url: 'https://console.unify.ai/plot/view/plt456',
      });
    });
  });

  describe('non-matching URLs', () => {
    it('returns null for unrelated URL', () => {
      expect(parseEmbedUrl('https://example.com/something')).toBeNull();
    });

    it('returns null for partial path', () => {
      expect(parseEmbedUrl('/tile/notview/abc')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseEmbedUrl('')).toBeNull();
    });
  });

  describe('priority (dashboard before tile)', () => {
    it('parses dashboard URL, not tile', () => {
      const result = parseEmbedUrl('/dashboard/view/abc123');
      expect(result?.type).toBe('dashboard');
    });
  });
});

// =============================================================================
// containsEmbedUrl
// =============================================================================

describe('containsEmbedUrl', () => {
  it('detects tile URL in text', () => {
    expect(containsEmbedUrl('Check this: https://console.unify.ai/tile/view/abc123')).toBe(true);
  });

  it('detects dashboard URL in text', () => {
    expect(containsEmbedUrl('See /dashboard/view/dash1 for details')).toBe(true);
  });

  it('detects table URL in text', () => {
    expect(containsEmbedUrl('Open /table/view/tbl1')).toBe(true);
  });

  it('detects plot URL in text', () => {
    expect(containsEmbedUrl('View /plot/view/plt1')).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(containsEmbedUrl('No URLs here')).toBe(false);
  });

  it('returns false for unrelated URL', () => {
    expect(containsEmbedUrl('Visit https://example.com')).toBe(false);
  });
});
