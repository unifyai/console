import 'server-only';

/**
 * The active workspace, carried on the session token.
 *
 * The switcher's ``unify_workspace_id`` cookie is ``SameSite=Strict``, so the
 * browser withholds it on cross-site entry points — an inbound Microsoft Teams
 * or Slack deep link is a top-level cross-site navigation. Without a second
 * signal those requests resolve to the personal workspace no matter which
 * workspace the user is actually in, and anything they bind lands on the wrong
 * owner. The session token is ``SameSite=Lax`` and does arrive, so the selection
 * rides along on it.
 *
 * The stored claim is tri-state, and the third state is the point:
 *
 * * a workspace id — that organization is active
 * * ``null`` — personal is active, chosen explicitly
 * * absent — the session predates the claim, or was minted by impersonation;
 *   the caller applies its own default
 *
 * Readers get the cookie-equivalent value (``'personal'`` for an explicit null,
 * ``undefined`` when the claim is absent) so a missing cookie and an unresolved
 * session stay distinguishable from a deliberate choice of personal.
 */

import { cookies } from 'next/headers';
import { decode, encode } from 'next-auth/jwt';
import type { JWT } from 'next-auth/jwt';

/** The value the personal workspace is addressed by, matching the cookie. */
export const PERSONAL_WORKSPACE_ID = 'personal';

const WORKSPACE_CLAIM = 'workspaceId';

const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
const sessionCookieName = `${useSecureCookies ? '__Secure-' : ''}next-auth.session-token`;

/** Matches ``session.maxAge`` in the NextAuth options. */
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured; the session token cannot be read or written.');
  }
  return secret;
}

/**
 * The active workspace on an already-decoded token. API routes decode the
 * session token anyway, so they read the claim from it rather than paying for a
 * second decode.
 */
export function activeWorkspaceIdFromToken(token: JWT | null): string | undefined {
  const claim = token?.[WORKSPACE_CLAIM];
  if (claim === null) return PERSONAL_WORKSPACE_ID;
  return typeof claim === 'string' ? claim : undefined;
}

/** The active workspace on the current request's session token. */
export async function readActiveWorkspaceId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(sessionCookieName)?.value;
  if (!sessionToken) return undefined;
  return activeWorkspaceIdFromToken(await decode({ token: sessionToken, secret: jwtSecret() }));
}

/**
 * Record the active workspace on the session token.
 *
 * Pass ``null`` for the personal workspace so the claim says so explicitly — an
 * absent claim reads as "unresolved", which for a user who belongs to an
 * organization resolves to the wrong workspace.
 *
 * Re-encodes the session cookie the way NextAuth's own session refresh does, on
 * the same rolling window, so ``iat`` advances exactly as it would on any
 * session read. Under externally-injected identity (``authMode === 'external'``)
 * there is no session token to carry the claim, and the cookie remains the only
 * signal.
 */
export async function writeActiveWorkspaceId(workspaceId: string | null): Promise<void> {
  const secret = jwtSecret();
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(sessionCookieName)?.value;
  if (!sessionToken) return;

  const token = await decode({ token: sessionToken, secret });
  if (!token) return;

  const next = await encode({
    token: { ...token, [WORKSPACE_CLAIM]: workspaceId },
    secret,
    maxAge: SESSION_MAX_AGE,
  });

  cookieStore.set(sessionCookieName, next, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: useSecureCookies,
    maxAge: SESSION_MAX_AGE,
  });
}
