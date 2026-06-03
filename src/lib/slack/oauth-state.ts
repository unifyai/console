/**
 * OAuth state nonce for the owner-scoped Slack install flow.
 *
 * Mirrors ``src/lib/oauth/state.ts``'s sign-JWT + mirror-nonce-in-
 * HTTP-only-cookie approach, but the payload is owner-scoped (one
 * Slack install per workspace, owned by an org or a personal user)
 * and uses a distinct cookie name so the two flows can't interfere if
 * a user happens to start both in parallel.
 *
 * The signed JWT carries the ``owner`` descriptor, the
 * ``initiatorUserId`` (the session user that began the flow — the
 * callback re-checks it), and the ``redirectAfter`` path the callback
 * uses to send the user back to the right spot once the install row is
 * persisted in Orchestra.
 */

import { encode, decode } from 'next-auth/jwt';
import { cookies } from 'next/headers';
import type { SlackInstallOwner } from '@/types/slack/install';

const COOKIE_NAME = 'slack_oauth_state';
const COOKIE_MAX_AGE_SECONDS = 10 * 60;

export interface SlackOAuthStatePayload {
  owner: SlackInstallOwner;
  /** Session user that initiated the flow; the callback asserts the
   *  returning user matches this before persisting. */
  initiatorUserId: string;
  redirectAfter: string;
  /** Random component mirrored in the cookie so a stolen JWT alone
   *  can't be replayed without the matching cookie. */
  nonce: string;
}

function isOwner(value: unknown): value is SlackInstallOwner {
  if (!value || typeof value !== 'object') return false;
  const owner = value as Record<string, unknown>;
  if (owner.kind === 'org') return typeof owner.orgId === 'number';
  if (owner.kind === 'user') return typeof owner.userId === 'string';
  return false;
}

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not set — required for Slack OAuth state signing.');
  }
  return secret;
}

function randomNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Signs a Slack OAuth state JWT and sets a matching HTTP-only
 * cookie. Call from ``/api/slack/oauth/start`` before returning the
 * authorize URL. Returns the signed token the caller should put in
 * the Slack ``state`` query parameter.
 */
export async function beginSlackOAuthState(
  payload: Omit<SlackOAuthStatePayload, 'nonce'>
): Promise<string> {
  const nonce = randomNonce();
  const fullPayload: SlackOAuthStatePayload = { ...payload, nonce };
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
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: '/',
  });
  return stateToken;
}

/**
 * Verifies a Slack OAuth state JWT and the matching cookie nonce.
 * Throws on any mismatch (invalid token, missing/wrong cookie,
 * expired). Returns the decoded payload on success and clears the
 * cookie so the same state can't be replayed.
 */
export async function verifySlackOAuthState(stateToken: string): Promise<SlackOAuthStatePayload> {
  if (!stateToken) {
    throw new Error('Slack OAuth state token missing from callback URL.');
  }
  const decoded = await decode({ token: stateToken, secret: getSecret() });
  if (!decoded || typeof decoded !== 'object') {
    throw new Error('Slack OAuth state token failed to decode.');
  }
  const payload = decoded as unknown as SlackOAuthStatePayload;
  if (
    !isOwner(payload.owner) ||
    typeof payload.initiatorUserId !== 'string' ||
    typeof payload.redirectAfter !== 'string' ||
    typeof payload.nonce !== 'string'
  ) {
    throw new Error('Slack OAuth state token missing required fields.');
  }
  const cookieStore = await cookies();
  const cookieNonce = cookieStore.get(COOKIE_NAME)?.value;
  if (!cookieNonce || cookieNonce !== payload.nonce) {
    throw new Error('Slack OAuth state nonce mismatch — possible CSRF or expired state.');
  }
  cookieStore.delete(COOKIE_NAME);
  return payload;
}
