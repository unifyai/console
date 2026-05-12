/**
 * OAuth state nonce — sign/verify short-lived JWTs that round-trip
 * through the third-party OAuth provider's authorize-redirect dance.
 *
 * Uses the same NEXTAUTH_SECRET that next-auth uses for session JWTs so
 * we don't introduce another platform secret.  The nonce is also
 * mirrored in a signed HTTP-only cookie set on ``/api/integrations/oauth/start``
 * and verified by the per-provider callback route at
 * ``/oauth/<provider>/callback``.
 *
 * The signed JWT carries the assistantId, ownerId, providerId, and a
 * ``redirectAfter`` path the callback uses to send the user back to the
 * right place once tokens are stored.
 */

import { encode, decode } from 'next-auth/jwt';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'integrations_oauth_state';
const COOKIE_MAX_AGE_SECONDS = 10 * 60; // 10 minutes — generous over EH's typical ~5min code TTL.

export interface OAuthStatePayload {
  assistantId: string;
  ownerId: string;
  providerId: string;
  redirectAfter: string;
  /** Random component included in the JWT and mirrored in the cookie so a
   *  stolen JWT alone can't be replayed without the matching cookie. */
  nonce: string;
}

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not set — required for OAuth state signing.');
  }
  return secret;
}

function randomNonce(): string {
  // 16 bytes of entropy, hex-encoded.  ``crypto.randomUUID`` is also fine
  // but base16 avoids URL-encoding surprises.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Signs an OAuth state JWT and sets a matching HTTP-only cookie.  Call
 * this from the ``/api/integrations/oauth/start`` route handler **before**
 * returning the authorize URL to the browser.  Returns the signed token
 * the caller should put in the OAuth ``state`` query parameter.
 */
export async function beginOAuthState(payload: Omit<OAuthStatePayload, 'nonce'>): Promise<string> {
  const nonce = randomNonce();
  const fullPayload: OAuthStatePayload = { ...payload, nonce };

  const stateToken = await encode({
    token: fullPayload as unknown as Record<string, unknown>,
    secret: getSecret(),
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });

  const cookieStore = await cookies();
  cookieStore.set({
    name: COOKIE_NAME,
    value: nonce,
    httpOnly: true,
    sameSite: 'lax', // 'lax' lets the cookie travel through the OAuth round-trip
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: '/',
  });

  return stateToken;
}

/**
 * Verifies an OAuth state JWT and the matching cookie nonce.  Throws on
 * any mismatch (invalid token, missing/wrong cookie, expired).  Returns
 * the decoded payload on success and clears the cookie so the same state
 * can't be replayed.
 */
export async function verifyOAuthState(stateToken: string): Promise<OAuthStatePayload> {
  if (!stateToken) {
    throw new Error('OAuth state token missing from callback URL.');
  }
  const decoded = await decode({
    token: stateToken,
    secret: getSecret(),
  });
  if (!decoded || typeof decoded !== 'object') {
    throw new Error('OAuth state token failed to decode.');
  }
  const payload = decoded as unknown as OAuthStatePayload;
  if (
    typeof payload.assistantId !== 'string' ||
    typeof payload.ownerId !== 'string' ||
    typeof payload.providerId !== 'string' ||
    typeof payload.redirectAfter !== 'string' ||
    typeof payload.nonce !== 'string'
  ) {
    throw new Error('OAuth state token missing required fields.');
  }

  const cookieStore = await cookies();
  const cookieNonce = cookieStore.get(COOKIE_NAME)?.value;
  if (!cookieNonce || cookieNonce !== payload.nonce) {
    throw new Error('OAuth state nonce mismatch — possible CSRF or expired state.');
  }

  // Single-use: clear the cookie so the same state can't be replayed.
  cookieStore.delete(COOKIE_NAME);

  return payload;
}
