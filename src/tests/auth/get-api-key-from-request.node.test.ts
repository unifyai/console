/**
 * Tests for getApiKeyFromRequest() with API key cache integration.
 *
 * Covers:
 * - Fast path: JWT email + cached key → no getCurrentUser() call
 * - Slow path: cache miss → getCurrentUser() fallback
 * - MFA blocking
 * - Header-based auth fallbacks
 * - Workspace resolution via cache
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetToken = vi.fn();
vi.mock('next-auth/jwt', () => ({
  getToken: (...args: any[]) => mockGetToken(...args),
}));

const mockGetCurrentUser = vi.fn();
vi.mock('@/lib/user/user', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

const mockResolveApiKeyFromCache = vi.fn();
vi.mock('@/app/api/_utils/api-key-cache', () => ({
  resolveApiKeyFromCache: (...args: any[]) => mockResolveApiKeyFromCache(...args),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { getApiKeyFromRequest } from '@/app/api/_utils/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  url = 'http://localhost/api/test',
  options?: {
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  }
): NextRequest {
  const req = new NextRequest(url, {
    headers: options?.headers,
  });
  if (options?.cookies) {
    for (const [name, value] of Object.entries(options.cookies)) {
      req.cookies.set(name, value);
    }
  }
  return req;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getApiKeyFromRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue(null);
    mockGetCurrentUser.mockResolvedValue(null);
    mockResolveApiKeyFromCache.mockReturnValue(null);
  });

  // =========================================================================
  // MFA blocking
  // =========================================================================

  describe('MFA blocking', () => {
    it('returns null when mfaPending is true on non-MFA route', async () => {
      mockGetToken.mockResolvedValue({ email: 'user@test.com', mfaPending: true });

      const result = await getApiKeyFromRequest(makeRequest('http://localhost/api/test'));
      expect(result).toBeNull();
      expect(mockGetCurrentUser).not.toHaveBeenCalled();
    });

    it('allows MFA routes even when mfaPending', async () => {
      mockGetToken.mockResolvedValue({ email: 'user@test.com', mfaPending: true });
      mockResolveApiKeyFromCache.mockReturnValue('cached-key');

      const result = await getApiKeyFromRequest(
        makeRequest('http://localhost/api/auth/mfa/verify')
      );
      expect(result).toBe('cached-key');
    });
  });

  // =========================================================================
  // Fast path: cache hit
  // =========================================================================

  describe('fast path — cache hit', () => {
    it('returns cached key without calling getCurrentUser', async () => {
      mockGetToken.mockResolvedValue({ email: 'user@test.com' });
      mockResolveApiKeyFromCache.mockReturnValue('cached-personal-key');

      const result = await getApiKeyFromRequest(makeRequest());

      expect(result).toBe('cached-personal-key');
      expect(mockResolveApiKeyFromCache).toHaveBeenCalledWith(
        'user@test.com',
        undefined, // no workspace cookie
        null // no header apiKey
      );
      expect(mockGetCurrentUser).not.toHaveBeenCalled();
    });

    it('passes workspace cookie to cache resolver', async () => {
      mockGetToken.mockResolvedValue({ email: 'user@test.com' });
      mockResolveApiKeyFromCache.mockReturnValue('cached-org-key');

      const result = await getApiKeyFromRequest(
        makeRequest('http://localhost/api/test', {
          cookies: { unify_workspace_id: '42' },
        })
      );

      expect(result).toBe('cached-org-key');
      expect(mockResolveApiKeyFromCache).toHaveBeenCalledWith(
        'user@test.com',
        '42',
        null
      );
      expect(mockGetCurrentUser).not.toHaveBeenCalled();
    });

    it('passes header apiKey to cache resolver', async () => {
      mockGetToken.mockResolvedValue({ email: 'user@test.com' });
      mockResolveApiKeyFromCache.mockReturnValue('header-matched-key');

      const result = await getApiKeyFromRequest(
        makeRequest('http://localhost/api/test', {
          headers: { apiKey: 'some-api-key' },
        })
      );

      expect(result).toBe('header-matched-key');
      expect(mockResolveApiKeyFromCache).toHaveBeenCalledWith(
        'user@test.com',
        undefined,
        'some-api-key'
      );
    });
  });

  // =========================================================================
  // Slow path: cache miss → getCurrentUser
  // =========================================================================

  describe('slow path — cache miss', () => {
    it('falls back to getCurrentUser when cache returns null', async () => {
      mockGetToken.mockResolvedValue({ email: 'user@test.com' });
      mockResolveApiKeyFromCache.mockReturnValue(null);
      mockGetCurrentUser.mockResolvedValue({ apiKey: 'fresh-key' });

      const result = await getApiKeyFromRequest(makeRequest());

      expect(result).toBe('fresh-key');
      expect(mockResolveApiKeyFromCache).toHaveBeenCalled();
      expect(mockGetCurrentUser).toHaveBeenCalled();
    });

    it('falls back to getCurrentUser when JWT has no email', async () => {
      mockGetToken.mockResolvedValue({ sub: 'some-id' }); // no email
      mockGetCurrentUser.mockResolvedValue({ apiKey: 'user-key' });

      const result = await getApiKeyFromRequest(makeRequest());

      expect(result).toBe('user-key');
      expect(mockResolveApiKeyFromCache).not.toHaveBeenCalled();
    });

    it('falls back to getCurrentUser when JWT is null', async () => {
      mockGetToken.mockResolvedValue(null);
      mockGetCurrentUser.mockResolvedValue({ apiKey: 'session-key' });

      const result = await getApiKeyFromRequest(makeRequest());

      expect(result).toBe('session-key');
      expect(mockResolveApiKeyFromCache).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Header-based auth fallbacks
  // =========================================================================

  describe('header-based auth fallbacks', () => {
    it('uses Authorization: Bearer header when no session or cache', async () => {
      mockGetToken.mockResolvedValue(null);
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getApiKeyFromRequest(
        makeRequest('http://localhost/api/test', {
          headers: { Authorization: 'Bearer bearer-token-123' },
        })
      );

      expect(result).toBe('bearer-token-123');
    });

    it('uses custom apiKey header as last resort', async () => {
      mockGetToken.mockResolvedValue(null);
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getApiKeyFromRequest(
        makeRequest('http://localhost/api/test', {
          headers: { apiKey: 'custom-key-456' },
        })
      );

      expect(result).toBe('custom-key-456');
    });

    it('returns null when no auth method succeeds', async () => {
      mockGetToken.mockResolvedValue(null);
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getApiKeyFromRequest(makeRequest());
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // Priority: cache > getCurrentUser > headers
  // =========================================================================

  describe('resolution priority', () => {
    it('prefers cache over getCurrentUser', async () => {
      mockGetToken.mockResolvedValue({ email: 'user@test.com' });
      mockResolveApiKeyFromCache.mockReturnValue('cached');
      mockGetCurrentUser.mockResolvedValue({ apiKey: 'from-session' });

      const result = await getApiKeyFromRequest(makeRequest());
      expect(result).toBe('cached');
      expect(mockGetCurrentUser).not.toHaveBeenCalled();
    });

    it('prefers getCurrentUser over header when cache misses', async () => {
      mockGetToken.mockResolvedValue({ email: 'user@test.com' });
      mockResolveApiKeyFromCache.mockReturnValue(null);
      mockGetCurrentUser.mockResolvedValue({ apiKey: 'from-session' });

      const result = await getApiKeyFromRequest(
        makeRequest('http://localhost/api/test', {
          headers: { Authorization: 'Bearer header-key' },
        })
      );
      expect(result).toBe('from-session');
    });
  });
});
