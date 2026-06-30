'use server';

/**
 * "View as user" impersonation actions for Unify staff.
 *
 * Console's session JWT carries identity only (email + sub); the Orchestra API
 * key is resolved server-side per request from the session email. So switching
 * who the app acts as reduces to minting a new `next-auth.session-token` cookie
 * with the target user's identity — `getCurrentUser()` then transparently loads
 * that user's keys, assistants and data.
 *
 * To return cleanly, the impersonator's original session token is stashed
 * verbatim in a separate httpOnly cookie and restored on exit, preserving the
 * admin's provider / issued-at / MFA state exactly.
 *
 * Every action is gated by `requireUnifyMember()` (defense-in-depth — server
 * actions are public RPC endpoints, so a page-level guard is not enough).
 */

import { cookies } from 'next/headers';
import { encode } from 'next-auth/jwt';
import { getCurrentUser, getUserByEmail } from '@/lib/user/user';
import { requireUnifyMember } from '@/lib/admin/_guard';
import { invalidateApiKeyCache } from '@/app/api/_utils/api-key-cache';
import type { ResponseProps } from '@/types/common';

// ── Cookie constants (mirror options.tsx / dev actions) ──────────────────────

const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
const cookiePrefix = useSecureCookies ? '__Secure-' : '';
const sessionCookieName = `${cookiePrefix}next-auth.session-token`;
const impersonatorCookieName = `${cookiePrefix}impersonator-session-token`;
const workspaceCookieName = 'unify_workspace_id';

const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days, matches options.tsx

// ── Types ────────────────────────────────────────────────────────────────────

export interface ImpersonationTarget {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

// ── Actions ──────────────────────────────────────────────────────────────────

/**
 * Resolve a target user by email for the impersonation picker. Returns only
 * safe display fields — never the user's API key.
 */
export async function lookupImpersonationTarget(
  email: string
): Promise<ImpersonationTarget | ResponseProps> {
  const denied = await requireUnifyMember();
  if (denied) return denied;

  const trimmed = email.trim();
  if (!trimmed) {
    return { detail: 'Email is required', status: 400 };
  }

  try {
    const user = await getUserByEmail(trimmed);
    if (!user?.id) {
      return { detail: 'User not found', status: 404 };
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
    };
  } catch (error) {
    console.error('[impersonation] lookup failed', error);
    return { detail: 'User not found', status: 404 };
  }
}

/**
 * Begin impersonating the user with the given email. Stashes the current
 * session token, mints a fresh session for the target, and resets workspace
 * context so the target's own default applies.
 */
export async function impersonateUser(email: string): Promise<ResponseProps | null> {
  const denied = await requireUnifyMember();
  if (denied) return denied;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[impersonation] JWT_SECRET is not configured');
    return { detail: 'Server misconfiguration', status: 500 };
  }

  const impersonator = await getCurrentUser();
  if (!impersonator?.email) {
    return { detail: 'Unauthorized', status: 401 };
  }

  const trimmed = email.trim();
  if (!trimmed) {
    return { detail: 'Email is required', status: 400 };
  }
  if (trimmed.toLowerCase() === impersonator.email.toLowerCase()) {
    return { detail: 'Cannot impersonate yourself', status: 400 };
  }

  let target;
  try {
    target = await getUserByEmail(trimmed);
  } catch (error) {
    console.error('[impersonation] target lookup failed', error);
    return { detail: 'User not found', status: 404 };
  }
  if (!target?.id) {
    return { detail: 'User not found', status: 404 };
  }

  const cookieStore = await cookies();

  // Preserve the impersonator's current session verbatim so we can restore it
  // on exit. Only stash if we're not already impersonating (so nested switches
  // still return to the original admin).
  const existingImpersonator = cookieStore.get(impersonatorCookieName)?.value;
  if (!existingImpersonator) {
    const currentSession = cookieStore.get(sessionCookieName)?.value;
    if (currentSession) {
      cookieStore.set(impersonatorCookieName, currentSession, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        maxAge: SESSION_MAX_AGE,
      });
    }
  }

  const token = await encode({
    token: {
      sub: target.id,
      email: target.email,
      name: target.name,
      picture: target.image ?? null,
      provider: 'credentials',
      iat: Math.floor(Date.now() / 1000),
      impersonating: true,
      impersonatorEmail: impersonator.email,
      impersonatorName: impersonator.name ?? impersonator.email,
    },
    secret,
    maxAge: SESSION_MAX_AGE,
  });

  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: useSecureCookies,
    maxAge: SESSION_MAX_AGE,
  });

  // Reset workspace context so the target's own default (incl. the non-Unify
  // org lock in getCurrentUser) applies instead of the admin's selection.
  cookieStore.delete(workspaceCookieName);

  invalidateApiKeyCache(impersonator.email);
  invalidateApiKeyCache(target.email);

  console.warn(
    `[impersonation] ${impersonator.email} now viewing as ${target.email} (${target.id})`
  );

  return null;
}

/**
 * Stop impersonating and restore the original admin session.
 */
export async function stopImpersonating(): Promise<ResponseProps | null> {
  const cookieStore = await cookies();
  const original = cookieStore.get(impersonatorCookieName)?.value;

  if (!original) {
    return { detail: 'Not impersonating', status: 400 };
  }

  // Capture the impersonated email (best-effort) for cache invalidation before
  // we swap identities back.
  const impersonatedEmail = (await getCurrentUser())?.email;

  cookieStore.set(sessionCookieName, original, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: useSecureCookies,
    maxAge: SESSION_MAX_AGE,
  });
  cookieStore.delete(impersonatorCookieName);
  cookieStore.delete(workspaceCookieName);

  if (impersonatedEmail) {
    invalidateApiKeyCache(impersonatedEmail);
  }

  console.warn('[impersonation] session restored to original admin');

  return null;
}
