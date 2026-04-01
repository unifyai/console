/**
 * Tests for session invalidation and stale-session handling.
 *
 * Covers:
 * - Password change invalidation: getCurrentUser() returns null when the JWT
 *   was issued before the user's password was last changed.
 * - Stale session (DB reset): getCurrentUser() returns null when the user
 *   no longer exists in the database (e.g. local DB was reset), instead of
 *   throwing an unhandled error that crashes the page.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockAdminClientGet = vi.fn();

vi.mock('@/lib/orchestra/orchestra-client', () => ({
  OrchestraAdminClient: {
    get: (...args: any[]) => mockAdminClientGet(...args),
  },
}));

const mockGetServerSession = vi.fn();
vi.mock('next-auth/next', () => ({
  getServerSession: (...args: any[]) => mockGetServerSession(...args),
}));

vi.mock('@/app/api/auth/[...nextauth]/options', () => ({
  default: {},
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: () => undefined })),
  headers: vi.fn(() => ({ get: () => null })),
}));

vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, cache: (fn: any) => fn };
});

vi.mock('@/utils/casing', () => ({
  snakeToCamelObject: <T>(obj: any): T => obj as T,
  camelToSnakeObject: (obj: any) => obj,
}));

// ─── Import after mocks ────────────────────────────────────────────────────

import { getCurrentUser } from '@/lib/user/user';

// ─── Helpers ────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-123',
  name: 'Test User',
  lastName: 'User',
  email: 'test@example.com',
  apiKey: 'key-123',
  image: '',
  jobTitle: '',
  bio: '',
  timezone: null,
  phoneNumber: null,
  createdAt: '2025-01-01',
  stripeCustomerId: '',
  organization: { name: '', roleId: 1, roleName: 'owner' },
  organizations: [],
};

function setupSession(iat: number) {
  mockGetServerSession.mockResolvedValue({
    user: { email: 'test@example.com', name: 'Test', image: null },
    iat,
  });
}

function setupUserLookup() {
  // The first call to OrchestraAdminClient.get with '/user/by-email' returns the user
  mockAdminClientGet.mockImplementation((url: string) => {
    if (url === '/user/by-email') {
      return Promise.resolve({ data: mockUser });
    }
    // Default: no email account
    if (url === '/auth/email-credentials') {
      return Promise.resolve({ data: { hasEmailAccount: false } });
    }
    return Promise.resolve({ data: {} });
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('getCurrentUser – session invalidation on password change', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ON_PREM;
  });

  it('returns null when JWT was issued before password change', async () => {
    // JWT issued at 2025-06-01T00:00:00Z
    const jwtIat = Math.floor(new Date('2025-06-01T00:00:00Z').getTime() / 1000);
    // Password changed at 2025-06-02T00:00:00Z (one day later)
    const passwordChangedAt = '2025-06-02T00:00:00Z';

    setupSession(jwtIat);
    mockAdminClientGet.mockImplementation((url: string) => {
      if (url === '/user/by-email') {
        return Promise.resolve({ data: mockUser });
      }
      if (url === '/auth/email-credentials') {
        return Promise.resolve({
          data: { hasEmailAccount: true, passwordChangedAt },
        });
      }
      return Promise.resolve({ data: {} });
    });

    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it('returns user when JWT was issued after password change', async () => {
    // JWT issued at 2025-06-03T00:00:00Z
    const jwtIat = Math.floor(new Date('2025-06-03T00:00:00Z').getTime() / 1000);
    // Password changed at 2025-06-02T00:00:00Z (one day before)
    const passwordChangedAt = '2025-06-02T00:00:00Z';

    setupSession(jwtIat);
    mockAdminClientGet.mockImplementation((url: string) => {
      if (url === '/user/by-email') {
        return Promise.resolve({ data: mockUser });
      }
      if (url === '/auth/email-credentials') {
        return Promise.resolve({
          data: { hasEmailAccount: true, passwordChangedAt },
        });
      }
      return Promise.resolve({ data: {} });
    });

    const user = await getCurrentUser();
    expect(user).not.toBeNull();
    expect(user?.id).toBe('user-123');
  });

  it('returns user when user has no email account (OAuth only)', async () => {
    const jwtIat = Math.floor(Date.now() / 1000);
    setupSession(jwtIat);
    setupUserLookup(); // defaults to hasEmailAccount: false

    const user = await getCurrentUser();
    expect(user).not.toBeNull();
    expect(user?.id).toBe('user-123');
  });

  it('returns user when passwordChangedAt is null', async () => {
    const jwtIat = Math.floor(Date.now() / 1000);
    setupSession(jwtIat);
    mockAdminClientGet.mockImplementation((url: string) => {
      if (url === '/user/by-email') {
        return Promise.resolve({ data: mockUser });
      }
      if (url === '/auth/email-credentials') {
        return Promise.resolve({
          data: { hasEmailAccount: true, passwordChangedAt: null },
        });
      }
      return Promise.resolve({ data: {} });
    });

    const user = await getCurrentUser();
    expect(user).not.toBeNull();
    expect(user?.id).toBe('user-123');
  });

  it('returns user when credential check fails (graceful degradation)', async () => {
    const jwtIat = Math.floor(Date.now() / 1000);
    setupSession(jwtIat);
    mockAdminClientGet.mockImplementation((url: string) => {
      if (url === '/user/by-email') {
        return Promise.resolve({ data: mockUser });
      }
      if (url === '/auth/email-credentials') {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({ data: {} });
    });

    const user = await getCurrentUser();
    expect(user).not.toBeNull();
    expect(user?.id).toBe('user-123');
  });

  it('does not check password_changed_at when session has no iat', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: 'test@example.com', name: 'Test', image: null },
      // No iat field
    });
    setupUserLookup();

    const user = await getCurrentUser();
    expect(user).not.toBeNull();
    // Should NOT have called email-credentials endpoint
    const credentialsCalls = mockAdminClientGet.mock.calls.filter(
      (call: any[]) => call[0] === '/auth/email-credentials'
    );
    expect(credentialsCalls).toHaveLength(0);
  });

  it('handles exact boundary: JWT iat equals passwordChangedAt', async () => {
    // When iat exactly equals passwordChangedAt, the session should still be valid
    // (the token was issued at the same instant the password was changed, i.e. the
    // new session created immediately after changing the password)
    const timestamp = '2025-06-02T12:00:00.000Z';
    const jwtIat = Math.floor(new Date(timestamp).getTime() / 1000);

    setupSession(jwtIat);
    mockAdminClientGet.mockImplementation((url: string) => {
      if (url === '/user/by-email') {
        return Promise.resolve({ data: mockUser });
      }
      if (url === '/auth/email-credentials') {
        return Promise.resolve({
          data: { hasEmailAccount: true, passwordChangedAt: timestamp },
        });
      }
      return Promise.resolve({ data: {} });
    });

    const user = await getCurrentUser();
    // iat (in seconds) * 1000 == changedAtMs, so issuedAtMs is NOT < changedAtMs
    // The session should remain valid
    expect(user).not.toBeNull();
  });
});

// ─── Stale session (DB reset / user deleted) ─────────────────────────────────

describe('getCurrentUser – stale session handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ON_PREM;
  });

  it('returns null when getUserByEmail throws (user not in DB)', async () => {
    // Simulate a valid JWT session pointing to a user that no longer exists.
    // Orchestra returns 404 → axios throws.
    mockGetServerSession.mockResolvedValue({
      user: { email: 'deleted@example.com', name: 'Ghost', image: null },
    });

    mockAdminClientGet.mockImplementation((url: string) => {
      if (url === '/user/by-email') {
        return Promise.reject({
          response: { status: 404, data: { detail: 'User not found' } },
        });
      }
      return Promise.resolve({ data: {} });
    });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = await getCurrentUser();
    expect(user).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch user by email')
    );
    consoleSpy.mockRestore();
  });

  it('returns null when getUserByEmail throws a network error', async () => {
    // Simulate Orchestra being unreachable (e.g. wrong URL after restart).
    mockGetServerSession.mockResolvedValue({
      user: { email: 'test@example.com', name: 'Test', image: null },
    });

    mockAdminClientGet.mockImplementation((url: string) => {
      if (url === '/user/by-email') {
        return Promise.reject(new Error('ECONNREFUSED'));
      }
      return Promise.resolve({ data: {} });
    });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = await getCurrentUser();
    expect(user).toBeNull();
    consoleSpy.mockRestore();
  });

  it('returns null when getUserByEmail throws a 403 (admin key mismatch)', async () => {
    // Simulate a new Orchestra instance with a different admin key.
    mockGetServerSession.mockResolvedValue({
      user: { email: 'test@example.com', name: 'Test', image: null },
    });

    mockAdminClientGet.mockImplementation((url: string) => {
      if (url === '/user/by-email') {
        return Promise.reject({
          response: { status: 403, data: { detail: 'Forbidden' } },
        });
      }
      return Promise.resolve({ data: {} });
    });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = await getCurrentUser();
    expect(user).toBeNull();
    consoleSpy.mockRestore();
  });

  it('returns null when getUserByEmail returns null (user deleted from DB)', async () => {
    // Orchestra returns 200 with null body when user is not found.
    mockGetServerSession.mockResolvedValue({
      user: { email: 'deleted@example.com', name: 'Ghost', image: null },
    });

    mockAdminClientGet.mockImplementation((url: string) => {
      if (url === '/user/by-email') {
        return Promise.resolve({ data: null });
      }
      return Promise.resolve({ data: {} });
    });

    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it('does not crash downstream code when getUserByEmail throws', async () => {
    // Ensure that the error is caught before reaching the password-change
    // check or workspace resolution, which would crash on a null user.
    mockGetServerSession.mockResolvedValue({
      user: { email: 'test@example.com', name: 'Test', image: null },
      iat: Math.floor(Date.now() / 1000),
    });

    mockAdminClientGet.mockImplementation((url: string) => {
      if (url === '/user/by-email') {
        return Promise.reject(new Error('Service unavailable'));
      }
      // These should NOT be called when getUserByEmail fails
      if (url === '/auth/email-credentials') {
        throw new Error('Should not reach email-credentials check');
      }
      return Promise.resolve({ data: {} });
    });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = await getCurrentUser();
    expect(user).toBeNull();

    // Verify email-credentials was never called
    const credentialsCalls = mockAdminClientGet.mock.calls.filter(
      (call: any[]) => call[0] === '/auth/email-credentials'
    );
    expect(credentialsCalls).toHaveLength(0);
    consoleSpy.mockRestore();
  });
});
