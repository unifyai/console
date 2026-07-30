// @vitest-environment node
/**
 * Active-workspace claim on the session token.
 *
 * Covers the tri-state the fallback depends on: an org id, an explicit null for
 * personal, and an absent claim. Conflating the last two is the bug this claim
 * exists to fix — a withheld ``SameSite=Strict`` workspace cookie used to read as
 * "personal", so an inbound Teams deep link bound the tenant's bot install to the
 * user's personal account while the org workspace kept reporting none.
 *
 * Runs on the node environment rather than the project's jsdom default: jsdom
 * replaces the ``Uint8Array`` global, so jose rejects its own encoder's output and
 * no real JWE can be produced.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { decode, encode } from 'next-auth/jwt';

const SECRET = 'workspace-session-test-secret';
const SESSION_COOKIE = 'next-auth.session-token';

// Set before the module under test is imported: it derives the session cookie
// name from NEXTAUTH_URL at module scope.
process.env.JWT_SECRET = SECRET;
process.env.NEXTAUTH_URL = 'http://localhost:3000';

const jar = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) as string } : undefined),
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
}));

let mod: typeof import('@/lib/user/workspace-session');

beforeAll(async () => {
  mod = await import('@/lib/user/workspace-session');
});

/** Seed a session cookie carrying ``claims`` on top of a plausible identity. */
async function seedSession(claims: Record<string, unknown> = {}): Promise<void> {
  jar.set(
    SESSION_COOKIE,
    await encode({
      token: { sub: 'user-1', email: 'someone@example.com', provider: 'google', ...claims },
      secret: SECRET,
      maxAge: 60,
    })
  );
}

beforeEach(() => {
  jar.clear();
});

describe('activeWorkspaceIdFromToken', () => {
  it('reads an organization id', () => {
    expect(mod.activeWorkspaceIdFromToken({ workspaceId: '11' })).toBe('11');
  });

  it('reads an explicit null as personal', () => {
    expect(mod.activeWorkspaceIdFromToken({ workspaceId: null })).toBe('personal');
  });

  it('leaves an absent claim unresolved', () => {
    expect(mod.activeWorkspaceIdFromToken({})).toBeUndefined();
    expect(mod.activeWorkspaceIdFromToken(null)).toBeUndefined();
  });
});

describe('readActiveWorkspaceId', () => {
  it('returns undefined with no session token', async () => {
    await expect(mod.readActiveWorkspaceId()).resolves.toBeUndefined();
  });

  it('returns undefined for a session minted before the claim existed', async () => {
    await seedSession();
    await expect(mod.readActiveWorkspaceId()).resolves.toBeUndefined();
  });

  it('returns the organization id the session carries', async () => {
    await seedSession({ workspaceId: '11' });
    await expect(mod.readActiveWorkspaceId()).resolves.toBe('11');
  });
});

describe('writeActiveWorkspaceId', () => {
  it('round-trips an organization id', async () => {
    await seedSession();
    await mod.writeActiveWorkspaceId('11');
    await expect(mod.readActiveWorkspaceId()).resolves.toBe('11');
  });

  it('writes personal back as null rather than dropping the claim', async () => {
    await seedSession({ workspaceId: '11' });
    await mod.writeActiveWorkspaceId(null);
    await expect(mod.readActiveWorkspaceId()).resolves.toBe('personal');
  });

  it('preserves the rest of the session', async () => {
    await seedSession({ workspaceId: '11', onboardingStep: 'workspace' });
    await mod.writeActiveWorkspaceId(null);

    const token = await decode({ token: jar.get(SESSION_COOKIE) as string, secret: SECRET });
    expect(token).toMatchObject({
      sub: 'user-1',
      email: 'someone@example.com',
      provider: 'google',
      onboardingStep: 'workspace',
      workspaceId: null,
    });
  });

  it('is a no-op without a session token to carry the claim', async () => {
    await mod.writeActiveWorkspaceId('11');
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });
});
