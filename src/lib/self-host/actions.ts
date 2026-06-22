'use server';

/**
 * Self-host passwordless auto-login.
 *
 * Single-owner local installs should never see a password prompt after the
 * first account creation. This server action mints a NextAuth session for the
 * recorded local owner (see ./owner) using the trusted local admin key — the
 * same direct cookie-mint pattern dev quick-login uses — and is hard-gated to
 * self-host. It is a no-op in cloud/dev.
 */

import { cookies } from 'next/headers';
import { encode } from 'next-auth/jwt';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { snakeToCamelObject } from '@/utils/casing';
import { isSelfHost } from '@/lib/environment/environment';
import { readSelfHostOwner, writeSelfHostOwner, clearSelfHostOwner } from '@/lib/self-host/owner';

// Mirrors the cookie naming in app/api/auth/[...nextauth]/options.tsx.
const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
const cookiePrefix = useSecureCookies ? '__Secure-' : '';
const cookieName = `${cookiePrefix}next-auth.session-token`;

// Long-lived locally so re-auth is rare; auto-login silently re-mints anyway.
const SELF_HOST_SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export interface SelfHostAutoLoginResult {
  ok: boolean;
  reason?: 'not_self_host' | 'no_secret' | 'no_account' | 'stale' | 'lookup_failed';
}

export interface SelfHostSignInResult {
  ok: boolean;
  reason?: 'not_self_host' | 'no_secret' | 'invalid_email' | 'no_account' | 'lookup_failed';
}

interface SelfHostUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

async function lookupSelfHostUserByEmail(email: string): Promise<SelfHostUser | null> {
  const response = await OrchestraAdminClient.get('/user/by-email', {
    params: { email },
  });

  if (!response.data) return null;

  return snakeToCamelObject<SelfHostUser>(response.data as Record<string, unknown>);
}

async function mintSelfHostSession(user: SelfHostUser, secret: string): Promise<void> {
  const token = await encode({
    token: {
      sub: user.id,
      email: user.email,
      name: user.name,
      picture: user.image ?? null,
      provider: 'credentials',
      iat: Math.floor(Date.now() / 1000),
    },
    secret,
    maxAge: SELF_HOST_SESSION_MAX_AGE,
  });

  const cookieStore = await cookies();
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: useSecureCookies,
    maxAge: SELF_HOST_SESSION_MAX_AGE,
  });
}

export async function selfHostAutoLogin(): Promise<SelfHostAutoLoginResult> {
  if (!isSelfHost()) return { ok: false, reason: 'not_self_host' };

  const secret = process.env.JWT_SECRET;
  if (!secret) return { ok: false, reason: 'no_secret' };

  const owner = readSelfHostOwner();
  if (!owner) return { ok: false, reason: 'no_account' };

  try {
    const user = await lookupSelfHostUserByEmail(owner.email);
    if (!user) {
      // Owner pointer is stale (e.g. local DB was reset) — drop it so the user
      // lands on the create-account screen instead of an infinite retry.
      clearSelfHostOwner();
      return { ok: false, reason: 'stale' };
    }

    await mintSelfHostSession(user, secret);

    return { ok: true };
  } catch (err: unknown) {
    // Only a definitive "user not found" clears the pointer; transient Orchestra
    // errors keep it so a hiccup doesn't force re-registration.
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      clearSelfHostOwner();
    }
    return { ok: false, reason: 'lookup_failed' };
  }
}

export async function selfHostSignInByEmail(email: string): Promise<SelfHostSignInResult> {
  if (!isSelfHost()) return { ok: false, reason: 'not_self_host' };

  const secret = process.env.JWT_SECRET;
  if (!secret) return { ok: false, reason: 'no_secret' };

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return { ok: false, reason: 'invalid_email' };

  try {
    const user = await lookupSelfHostUserByEmail(normalizedEmail);
    if (!user) return { ok: false, reason: 'no_account' };

    writeSelfHostOwner({ userId: user.id, email: user.email, name: user.name ?? null });
    await mintSelfHostSession(user, secret);

    return { ok: true };
  } catch {
    return { ok: false, reason: 'lookup_failed' };
  }
}
