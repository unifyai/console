import { decode, encode } from 'next-auth/jwt';

/**
 * Server-only crypto helpers for the preview-environment OAuth bounce.
 *
 * The bounce solves a cookie-scoping problem: the canonical console
 * (where Google's OAuth redirect lands) and a slug-tagged Cloud Run
 * revision are unrelated hostnames, so a session cookie set on one
 * cannot be read on the other. Instead, we mint a short-lived JWE
 * "transfer token" on canonical, redirect the browser to the slug
 * with the token in the URL, and the slug re-mints a normal session
 * cookie locally.
 *
 * Both ends share the same NextAuth secret (``JWT_SECRET``), so a JWE
 * encoded by ``next-auth/jwt`` on canonical can be decoded by the slug
 * without any external coordination.
 *
 * Only imported by the three preview-* App Router route handlers, which
 * are server-only by Next.js routing — there is no client-side caller.
 */

/** How long a transfer token is valid. Should be long enough to cover the
 *  redirect hop and short enough that capture is operationally useless. */
export const PREVIEW_TRANSFER_MAX_AGE_SECONDS = 30;

/** Session lifetime mirrors ``options.tsx`` so re-minted cookies match the
 *  cookie any other login path would produce on this host. */
export const PREVIEW_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Shape of the session JWT written to the slug-side cookie. Mirrors the
 * fields the canonical NextAuth ``jwt`` callback persists, so middleware
 * and ``getToken()`` accept the cookie transparently.
 */
export interface PreviewSessionPayload {
  sub: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  provider?: string;
  mfaPending?: boolean;
  onboardingStep?: string;
  [key: string]: unknown;
}

/**
 * Carrier shape of the cross-host transfer token. Adds a single ``aud``
 * claim pinning the token to the receiving slug origin so a token leaked
 * from one slug cannot be replayed on another.
 */
export type PreviewTransferPayload = PreviewSessionPayload & { aud: string };

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

/**
 * Mint a 30-second JWE that can be claimed only at ``audience``.
 *
 * Called by the canonical ``preview-redirect`` route after Google OAuth
 * completes; the receiving slug calls {@link decodePreviewTransferToken}.
 */
export async function encodePreviewTransferToken(
  payload: PreviewSessionPayload,
  audience: string
): Promise<string> {
  const token: PreviewTransferPayload = { ...payload, aud: audience };
  return encode({
    token,
    secret: getSecret(),
    maxAge: PREVIEW_TRANSFER_MAX_AGE_SECONDS,
  });
}

/**
 * Decode a transfer token and verify its audience matches ``expectedAudience``.
 *
 * NextAuth's ``decode`` enforces the JWE signature and ``exp`` claim; this
 * helper additionally pins the token to the host that minted it, preventing
 * cross-slug replay if a transfer token leaks.
 */
export async function decodePreviewTransferToken(
  rawToken: string,
  expectedAudience: string
): Promise<PreviewSessionPayload | null> {
  let decoded: Record<string, unknown> | null;
  try {
    decoded = (await decode({
      token: rawToken,
      secret: getSecret(),
    })) as Record<string, unknown> | null;
  } catch {
    return null;
  }
  if (!decoded || typeof decoded !== 'object') return null;
  if (decoded.aud !== expectedAudience) return null;
  if (typeof decoded.sub !== 'string' || typeof decoded.email !== 'string') return null;

  const { aud: _aud, ...rest } = decoded as PreviewTransferPayload & Record<string, unknown>;
  return rest as PreviewSessionPayload;
}

/**
 * Mint the session JWE the slug-side ``preview-claim`` route writes to its
 * cookie. Equivalent to what NextAuth itself would produce on a normal
 * sign-in for this host, so middleware, ``getToken()`` and ``getServerSession()``
 * accept it transparently.
 */
export async function encodePreviewSessionToken(payload: PreviewSessionPayload): Promise<string> {
  return encode({
    token: { ...payload, iat: Math.floor(Date.now() / 1000) },
    secret: getSecret(),
    maxAge: PREVIEW_SESSION_MAX_AGE_SECONDS,
  });
}

/** Cookie-name + secure-flag derivation that matches ``options.tsx``. */
export function previewSessionCookie(): { name: string; secure: boolean } {
  const secure = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
  return {
    name: `${secure ? '__Secure-' : ''}next-auth.session-token`,
    secure,
  };
}
